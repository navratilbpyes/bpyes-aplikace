/**
 * AuditFlow — složení naskenovaných stránek do jednoho PDF.
 * Umístění: src/lib/pdf-ze-skenu.ts
 *
 * JPEG jde do PDF vložit beze změny dat jako XObject s filtrem DCTDecode.
 * Není tedy co překódovávat a celá práce je sestavení objektů, xref tabulky
 * a trailru. Proto tu není jspdf — dělal by přesně tohle za 350 kB bundlu.
 *
 * Každá stránka je A4 na výšku nebo na šířku podle poměru stran obrázku,
 * obrázek vyplní celou stránku (fotka listiny už je oříznutá na papír).
 */

/** Jedna stránka: syrová data JPEG a jeho rozměry v pixelech. */
export interface SkenStranka {
  jpeg: Uint8Array;
  sirka: number;
  vyska: number;
}

const A4_KRATKA = 595.28; // 210 mm v bodech
const A4_DLOUHA = 841.89; // 297 mm

/** Text → bajty (PDF struktura je ASCII, takže latin-1 stačí). */
function bajty(s: string): Uint8Array {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i += 1) out[i] = s.charCodeAt(i) & 0xff;
  return out;
}

/**
 * Sestaví PDF ze stránek. Vrací Blob připravený k nahrání.
 *
 * Číslování objektů: 1 = katalog, 2 = strom stránek, pak pro každou stránku
 * trojice (stránka, obsah, obrázek).
 */
export function pdfZeSkenu(stranky: SkenStranka[]): Blob {
  if (stranky.length === 0) throw new Error('PDF bez stránek nedává smysl.');

  const casti: Uint8Array[] = [];
  const offsety: number[] = []; // offsety[i] = pozice objektu i+1
  let delka = 0;

  const pridej = (u: Uint8Array) => { casti.push(u); delka += u.length; };
  const pridejText = (s: string) => pridej(bajty(s));

  /** Zapíše objekt daného čísla a zapamatuje si jeho pozici pro xref. */
  const objekt = (cislo: number, telo: string, data?: Uint8Array) => {
    offsety[cislo - 1] = delka;
    pridejText(`${cislo} 0 obj\n${telo}\n`);
    if (data) {
      pridejText('stream\n');
      pridej(data);
      pridejText('\nendstream\n');
    }
    pridejText('endobj\n');
  };

  pridejText('%PDF-1.4\n');
  // binární komentář — čtečky podle něj poznají, že soubor není textový
  pridej(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

  const idStranek = stranky.map((_, i) => 3 + i * 3);

  objekt(1, '<< /Type /Catalog /Pages 2 0 R >>');
  objekt(2, `<< /Type /Pages /Count ${stranky.length} /Kids [${
    idStranek.map((id) => `${id} 0 R`).join(' ')} ] >>`);

  stranky.forEach((s, i) => {
    const idStranka = idStranek[i];
    const idObsah = idStranka + 1;
    const idObrazek = idStranka + 2;

    const naSirku = s.sirka > s.vyska;
    const sirkaStranky = naSirku ? A4_DLOUHA : A4_KRATKA;
    const vyskaStranky = naSirku ? A4_KRATKA : A4_DLOUHA;

    // obrázek vepsat do stránky se zachováním poměru stran a vycentrovat
    const mer = Math.min(sirkaStranky / s.sirka, vyskaStranky / s.vyska);
    const w = s.sirka * mer;
    const h = s.vyska * mer;
    const x = (sirkaStranky - w) / 2;
    const y = (vyskaStranky - h) / 2;

    const obsah = `q ${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /Im0 Do Q`;

    objekt(
      idStranka,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${sirkaStranky.toFixed(2)} ${vyskaStranky.toFixed(2)}]`
      + ` /Resources << /XObject << /Im0 ${idObrazek} 0 R >> >> /Contents ${idObsah} 0 R >>`,
    );
    objekt(idObsah, `<< /Length ${obsah.length} >>`, bajty(obsah));
    objekt(
      idObrazek,
      `<< /Type /XObject /Subtype /Image /Width ${s.sirka} /Height ${s.vyska}`
      + ` /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${s.jpeg.length} >>`,
      s.jpeg,
    );
  });

  const pocet = offsety.length + 1; // +1 za volný objekt 0
  const xref = delka;
  let tabulka = `xref\n0 ${pocet}\n0000000000 65535 f \n`;
  for (let i = 0; i < offsety.length; i += 1) {
    tabulka += `${String(offsety[i]).padStart(10, '0')} 00000 n \n`;
  }
  pridejText(tabulka);
  pridejText(`trailer\n<< /Size ${pocet} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  return new Blob(casti as BlobPart[], { type: 'application/pdf' });
}
