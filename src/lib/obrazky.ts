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
