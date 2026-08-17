const MAX_DIMENSION = 1920; // Max rozlišení Full HD
const JPEG_QUALITY = 0.75;  // Vysoká kvalita přiměřená pro revize
const HOSTING_DIRECT_URL = 'https://appbpyes.cz/fotky/upload.php';

/**
 * Zkomprimuje obrázek v prohlížeči před odesláním.
 * Zmenší soubor z 10–15 MB na cca 250–400 KB během okamžiku.
 */
export async function zkomprimovatFotku(
  file: File,
  maxWidthOrHeight = MAX_DIMENSION,
  quality = JPEG_QUALITY
): Promise<File> {
  // Pokud soubor není obrázek nebo je už menší než 300 KB, neupravujeme ho
  if (!file.type.startsWith('image/') || file.size < 300 * 1024) {
    return file;
  }

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;

      // Zmenšení rozměrů při zachování poměru stran
      if (width > maxWidthOrHeight || height > maxWidthOrHeight) {
        if (width > height) {
          height = Math.round((height * maxWidthOrHeight) / width);
          width = maxWidthOrHeight;
        } else {
          width = Math.round((width * maxWidthOrHeight) / height);
          height = maxWidthOrHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return resolve(file); // Fallback na původní soubor, pokud Canvas API selže
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            return resolve(file);
          }

          const newFileName = file.name.replace(/\.[^/.]+$/, '') + '.jpg';
          const compressedFile = new File([blob], newFileName, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });

          console.log(
            `Fotka zkomprimována: ${(file.size / 1024 / 1024).toFixed(2)} MB -> ${(
              compressedFile.size /
              1024 /
              1024
            ).toFixed(2)} MB`
          );

          resolve(compressedFile);
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file); // Při chybě načtení obrázku vrátíme původní soubor
    };

    img.src = objectUrl;
  });
}

/**
 * Hlavní funkce pro nahrání fotky z frontendu.
 * 1. Zkomprimuje fotku na ~300 KB v prohlížeči.
 * 2. Zkusí odeslat přes Vercel API (/api/upload-foto).
 * 3. Pokud Vercel API selže (např. 504 Timeout z WEDOSu), automaticky provede přímý upload na appbpyes.cz.
 */
export async function nahratFotku(file: File): Promise<string> {
  // Krok 1: Komprese fotky v mobilu/prohlížeči
  const zkomprimovanaFotka = await zkomprimovatFotku(file);

  const formData = new FormData();
  formData.append('file', zkomprimovanaFotka, zkomprimovanaFotka.name);

  // Krok 2: Pokus o upload přes Vercel API
  try {
    const res = await fetch('/api/upload-foto', {
      method: 'POST',
      body: formData,
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.url) {
        return data.url;
      }
    }
    
    console.warn(`Vercel API vrátil status ${res.status}, zkouším přímý upload na hosting...`);
  } catch (err) {
    console.warn('Vercel API nedostupné nebo selhalo, přecházím na přímý upload:', err);
  }

  // Krok 3: Fallback – přímý upload na WEDOS (využívá váš nakonfigurovaný CORS v PHP)
  const directFormData = new FormData();
  directFormData.append('file', zkomprimovanaFotka, zkomprimovanaFotka.name);

  const directRes = await fetch(HOSTING_DIRECT_URL, {
    method: 'POST',
    body: directFormData,
  });

  if (!directRes.ok) {
    throw new Error(`Přímý upload na hosting selhal se statusem ${directRes.status}`);
  }

  const directRaw = await directRes.text();
  let directData: any;

  try {
    directData = JSON.parse(directRaw);
  } catch {
    throw new Error('Hosting vrátil neplatnou odpověď (ne-JSON).');
  }

  if (!directData.success || !directData.url) {
    throw new Error(directData.error || 'Nahrání na hosting selhalo.');
  }

  return directData.url;
}
