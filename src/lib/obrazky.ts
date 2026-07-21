export interface KompreseNastaveni {
  /** Maximální šířka i výška v pixelech. Výchozí 1024 (fotografie nedostatků). */
  maxRozmer?: number;
  /** Kvalita JPEG 0–1. Výchozí 0.7. */
  kvalita?: number;
  /**
   * Barva podkladu vykreslená pod obrázek. Nutná u PNG s průhledností –
   * bez ní JPEG převede průhledné pixely na černou (razítko, podpis).
   * Výchozí: bez podkladu.
   */
  podklad?: string;
}

/**
 * Zmenší a zkomprimuje obrázek na data URL (JPEG).
 * Poměr stran zůstává zachován.
 */
export function compressImage(
  file: File,
  nastaveni: KompreseNastaveni = {}
): Promise<string> {
  const { maxRozmer = 1024, kvalita = 0.7, podklad } = nastaveni;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error('Soubor se nepodařilo načíst.'));

    reader.onload = (e) => {
      const img = new Image();

      img.onerror = () => reject(new Error('Obrázek se nepodařilo zpracovat.'));

      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        if (width > height) {
          if (width > maxRozmer) {
            height *= maxRozmer / width;
            width = maxRozmer;
          }
        } else {
          if (height > maxRozmer) {
            width *= maxRozmer / height;
            height = maxRozmer;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (ctx) {
          if (podklad) {
            ctx.fillStyle = podklad;
            ctx.fillRect(0, 0, width, height);
          }
          ctx.drawImage(img, 0, 0, width, height);
        }

        resolve(canvas.toDataURL('image/jpeg', kvalita));
      };

      img.src = e.target?.result as string;
    };

    reader.readAsDataURL(file);
  });
}

/** Fotografie nedostatku: zmenšená kvůli limitu velikosti dokumentu (Firestore 1 MB). */
export const FOTO_NEDOSTATKU: KompreseNastaveni = {
  maxRozmer: 800,
  kvalita: 0.55,
};

/** Razítko a podpis: menší, na bílém podkladu (kvůli průhlednému PNG). */
export const RAZITKO_PODPIS: KompreseNastaveni = {
  maxRozmer: 500,
  kvalita: 0.7,
  podklad: '#FFFFFF',
};

// ------- Nahrani fotky na hosting (pres bezpecny Vercel endpoint) -------

/** Pozna, jestli je hodnota uz URL (nahrana fotka), nebo base64 (jeste ne). */
export function jeUrl(hodnota: string): boolean {
  return typeof hodnota === 'string' && /^https?:\/\//.test(hodnota);
}

/** Prevede base64 data URL na Blob. */
function dataUrlNaBlob(dataUrl: string): Blob {
  const [hlavicka, data] = dataUrl.split(',');
  const mime = hlavicka.match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bin = atob(data);
  const pole = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) pole[i] = bin.charCodeAt(i);
  return new Blob([pole], { type: mime });
}

/**
 * Nahraje jednu fotku na hosting a vrati jeji URL.
 * Kdyz uz je vstup URL (drive nahrana), vrati ji beze zmeny.
 * Kdyz je to base64, posle ji na /api/upload-foto a vrati vysledne URL.
 */
export async function nahrajFotku(fotka: string): Promise<string> {
  if (jeUrl(fotka)) return fotka; // uz nahrana, nic nedelej

  const blob = dataUrlNaBlob(fotka);
  const fd = new FormData();
  fd.append('file', blob, 'foto.jpg');

  const res = await fetch('/api/upload-foto', { method: 'POST', body: fd });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Nahrani fotky selhalo.');
  return data.url as string;
}

/** Nahraje pole fotek (mix URL a base64) a vrati pole URL. */
export async function nahrajFotky(fotky: string[]): Promise<string[]> {
  if (!fotky || fotky.length === 0) return [];
  const vysledky: string[] = [];
  for (const f of fotky) {
    vysledky.push(await nahrajFotku(f));
  }
  return vysledky;
}
