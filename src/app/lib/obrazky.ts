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
 * Zmenší fotku před uploadem: omezí delší stranu na MAX_STRANA px a překóduje
 * do JPEG q0.8. Fotka z telefonu (5–8 MB) tím spadne na cca 300–600 KB, takže
 * upload je rychlý a nespadne na timeout (504). Průhlednost/PNG se překlopí do
 * JPEG (u fotek závad nevadí). Když se cokoli nepovede, vrátí původní blob.
 */
const MAX_STRANA = 1600;
async function zmensiFotku(dataUrl: string): Promise<Blob> {
  const original = dataUrlNaBlob(dataUrl);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = dataUrl;
    });
    const scale = Math.min(1, MAX_STRANA / Math.max(img.width, img.height));
    // když je fotka menší než limit a už je JPEG, nemá smysl překódovat
    if (scale === 1 && original.type === 'image/jpeg' && original.size < 1_500_000) {
      return original;
    }
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return original;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.8),
    );
    return blob && blob.size > 0 ? blob : original;
  } catch {
    return original; // fallback — radši nahrát velké než nenahrát nic
  }
}

/**
 * Nahraje jednu fotku na hosting a vrati jeji URL.
 * Kdyz uz je vstup URL (drive nahrana), vrati ji beze zmeny.
 * Kdyz je to base64, zmensi ji a posle na /api/upload-foto.
 *
 * Hosting (Wedos) obcas jeden request odmitne nebo zablokuje (limit soubeznych
 * PHP procesu) — projevi se to jako 504 po dlouhem cekani. Proto ma kazdy pokus
 * vlastni timeout (nevisi minuty) a pri selhani se upload nekolikrat zopakuje.
 */
const FOTO_TIMEOUT_MS = 30_000;
const FOTO_POKUSY = 3;

async function jedenPokusUpload(blob: Blob): Promise<string> {
  const fd = new FormData();
  fd.append('file', blob, 'foto.jpg');

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FOTO_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch('/api/upload-foto', { method: 'POST', body: fd, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }

  // Hosting/proxy muze pri chybe vratit HTML nebo prazdnou odpoved (ne JSON) —
  // napr. 504 timeout. Cteme text a parsujeme opatrne.
  const raw = await res.text();
  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(res.status === 504 ? 'timeout' : `status ${res.status}`);
  }
  if (!res.ok || !data?.success) throw new Error(data?.error || 'Nahrání fotky selhalo.');
  return data.url as string;
}

export async function nahrajFotku(fotka: string): Promise<string> {
  if (jeUrl(fotka)) return fotka; // uz nahrana, nic nedelej

  const blob = await zmensiFotku(fotka);
  let posledniChyba: any;
  for (let pokus = 1; pokus <= FOTO_POKUSY; pokus++) {
    try {
      return await jedenPokusUpload(blob);
    } catch (e: any) {
      posledniChyba = e;
      if (pokus < FOTO_POKUSY) {
        // krátká rostoucí pauza mezi pokusy (odlehčí zahlcenému hostingu)
        await new Promise((r) => setTimeout(r, 800 * pokus));
      }
    }
  }
  const t = posledniChyba?.message === 'timeout' || posledniChyba?.name === 'AbortError';
  throw new Error(
    t
      ? 'Nahrávání fotky opakovaně vypršelo. Zkuste to prosím znovu.'
      : (posledniChyba?.message || 'Nahrání fotky selhalo.'),
  );
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
