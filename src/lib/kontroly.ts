/** Typová závada načtená z Google Sheets (šablona pro rychlé vyplnění). */
export interface TypickaZavada {
  nazev: string;
  popis: string;
  opatreni: string;
}

/** Rozpracovaný nedostatek ve formuláři kontroly. */
export interface DefectFormState {
  uid: string;
  popis: string;
  navrhOpatreni: string;
  terminOdstraneni: string;
  odpovednaOsoba: string;
  odpovednaOsobaManualni: string;
  lokalizace: string;
  zavaznost: string;
  odstraneno: boolean;
  datumOdstraneni: string;
  zaznamProvedl: string;
  zaznamProvedlManualni: string;
  foto?: string[];
}

/** Nový prázdný nedostatek. Termín odstranění je předvyplněn na 30 dní. */
export const createEmptyDefect = (): DefectFormState => ({
  uid: Math.random().toString(36).substring(7),
  popis: "",
  navrhOpatreni: "",
  terminOdstraneni: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  odpovednaOsoba: "",
  odpovednaOsobaManualni: "",
  lokalizace: "",
  zavaznost: "none",
  odstraneno: false,
  datumOdstraneni: "",
  zaznamProvedl: "",
  zaznamProvedlManualni: "",
  foto: []
});

/** Adresa sídla rozložená na části, jak ji používá formulář klienta. */
export interface AdresaSidla {
  sidlo: string;
  psc: string;
  mesto: string;
}

/**
 * Poskládá ulici s číslem popisným a orientačním z odpovědi ARES.
 * Obec bez pojmenovaných ulic použije jako ulici svůj název.
 */
function sestavUlici(sidlo: any): string {
  const ulice = sidlo?.nazevUlice || sidlo?.nazevObce || '';
  const cd = sidlo?.cisloDomovni;
  const co = sidlo?.cisloOrientacni;

  let cislo = '';
  if (cd && co) cislo = `${cd}/${co}`;
  else if (cd) cislo = String(cd);

  return `${ulice} ${cislo}`.trim();
}

/** Naformátuje PSČ na tvar „790 01". Přijímá číslo i řetězec. */
function formatujPsc(psc: unknown): string {
  if (!psc) return '';
  const text = String(psc).replace(/\s/g, '');
  return text.length === 5 ? `${text.slice(0, 3)} ${text.slice(3)}` : text;
}

/**
 * Vytáhne adresu sídla z odpovědi ARES.
 * Vrací prázdné řetězce, pokud ARES adresu neposkytl.
 */
export function adresaZAres(data: any): AdresaSidla {
  const sidlo = data?.sidlo;
  return {
    sidlo: sestavUlici(sidlo),
    psc: formatujPsc(sidlo?.psc),
    mesto: sidlo?.nazevObce || '',
  };
}

/** Poskládá celou adresu na jeden řádek pro hlavičku protokolu. */
export function celaAdresa(k: { sidlo?: string; psc?: string; mesto?: string }): string {
  const mestoPsc = [k.psc, k.mesto].filter(Boolean).join(' ');
  return [k.sidlo, mestoPsc].filter(Boolean).join(', ') || 'Neuvedeno';
}

/**
 * Rozparsuje CSV na pole řádků. Zvládá uvozovky, escapované uvozovky
 * a všechny tři varianty konce řádku (CRLF, LF, CR).
 */
export function parseCSV(str: string): string[][] {
  const arr: string[][] = [];
  let quote = false;
  let row = 0,
    col = 0;

  for (let c = 0; c < str.length; c++) {
    const cc = str[c];
    const nc = str[c + 1];
    arr[row] = arr[row] || [];
    arr[row][col] = arr[row][col] || '';

    if (cc == '"' && quote && nc == '"') {
      arr[row][col] += cc;
      ++c;
      continue;
    }
    if (cc == '"') {
      quote = !quote;
      continue;
    }
    if (cc == ',' && !quote) {
      ++col;
      continue;
    }
    if (cc == '\r' && nc == '\n' && !quote) {
      ++row;
      col = 0;
      ++c;
      continue;
    }
    if (cc == '\n' && !quote) {
      ++row;
      col = 0;
      continue;
    }
    if (cc == '\r' && !quote) {
      ++row;
      col = 0;
      continue;
    }
    arr[row][col] += cc;
  }
  return arr;
}

/**
 * Posbírá všechny e-mailové adresy klienta – z hlavního pole,
 * z kontaktní osoby i ze seznamů odpovědných osob a kontaktů.
 * Vrací je oddělené čárkou, bez duplicit.
 */
export function extractEmail(klientObj: any): string {
  if (!klientObj) return '';
  const emaily = new Set<string>();

  const pridejEmail = (val: any) => {
    if (typeof val === 'string' && val.includes('@') && val.includes('.')) {
      emaily.add(val.trim());
    }
  };

  pridejEmail(klientObj.email);
  pridejEmail(klientObj.kontaktniOsoba?.email);

  ['odpovedneOsoby', 'kontakty', 'pozice'].forEach((nazevPole) => {
    if (Array.isArray(klientObj[nazevPole])) {
      klientObj[nazevPole].forEach((polozka: any) => pridejEmail(polozka?.email));
    }
  });

  return Array.from(emaily).join(', ');
}
