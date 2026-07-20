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
  bezOdkladu?: boolean;
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
  foto: [],
  bezOdkladu: false
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
 * Rozparsuje CSV s typovými závadami na strukturu
 * { typKontroly: { idBodu: TypickaZavada[] } }.
 * Hlavičky hledá podle názvu, takže snese změnu pořadí sloupců.
 */
export function parsujTypoveZavady(csvText: string): Record<string, Record<string, TypickaZavada[]>> {
  const rows = parseCSV(csvText);
  const vysledek: Record<string, Record<string, TypickaZavada[]>> = {};
  if (rows.length <= 1) return vysledek;

  const headers = rows[0].map((h) => h.toLowerCase().trim());
  const iTyp = headers.findIndex((h) => h.includes('typ'));
  const iId = headers.findIndex((h) => h.includes('id'));
  let iKratky = headers.findIndex(
    (h) => h === 'tag' || h.includes('zkrác') || h.includes('krát') || h.includes('název')
  );
  if (iKratky === -1) iKratky = headers.findIndex((h) => h.includes('nedostatek'));
  const iPopis = headers.findIndex((h) => h === 'popis' || (h.includes('popis') && !h.includes('zkr')));
  const iOpatreni = headers.findIndex((h) => h.includes('opatřen') || h.includes('opatren'));

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length < 3) continue;

    const typ = iTyp >= 0 ? r[iTyp]?.trim() : r[0]?.trim();
    const id = parseInt(iId >= 0 ? r[iId] : r[2]);
    const nazev = (iKratky >= 0 ? r[iKratky] : r[3])?.trim();
    const popis = (iPopis >= 0 ? r[iPopis] : r[4])?.trim();
    const opatreni = (iOpatreni >= 0 ? r[iOpatreni] : r[5])?.trim();

    if (typ && !isNaN(id) && nazev) {
      const idKey = String(id);
      if (!vysledek[typ]) vysledek[typ] = {};
      if (!vysledek[typ][idKey]) vysledek[typ][idKey] = [];
      vysledek[typ][idKey].push({ nazev, popis: popis || '', opatreni: opatreni || '' });
    }
  }
  return vysledek;
}

/** Kontakt klienta, kterému lze poslat report. */
export interface Prijemce {
  id: string;
  jmeno: string;
  funkce: string;
  email: string;
  hlavni: boolean;
}

/**
 * Vrátí kontakty klienta, které mají vyplněný e-mail.
 * Hlavní kontakty jsou první v seznamu.
 */
export function prijemciKlienta(klientObj: any): Prijemce[] {
  if (!klientObj?.kontakty) return [];

  const prijemci: Prijemce[] = klientObj.kontakty
    .filter((k: any) => typeof k?.email === 'string' && k.email.includes('@'))
    .map((k: any, i: number) => ({
      id: k.id || `k${i}`,
      jmeno: k.jmeno?.trim() || k.email,
      funkce: k.funkce?.trim() || '',
      email: k.email.trim(),
      hlavni: !!k.hlavni,
    }));

  return prijemci.sort((a, b) => Number(b.hlavni) - Number(a.hlavni));
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
