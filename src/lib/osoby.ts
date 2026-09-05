/**
 * AuditFlow — osoby a pozice: typy a načítání.
 * Umístění: src/lib/osoby.ts
 *
 * Osoba je centrální entita modulu lidských zdrojů. Visí na ní školení,
 * prohlídky, zácviky, OOPP i úrazy.
 *
 * Pozice je organizační zařazení (1:1), činnost je rizikový profil (N:M).
 * Dva údržbáři mají stejnou pozici, ale jeden leze do výšek a druhý sváří —
 * proto se povinnosti odvozují z činností, ne z pozice.
 */

import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/components/data-provider';
import type { StavZaznamu } from './skoleni';
import type { KodKategorie, ZarazeniFaktoru } from './cinnosti';

/** Přiřazení činnosti osobě. Datované — historie povinností musí zůstat. */
export interface PrirazeniCinnosti {
  cinnostId: string;
  /** od kdy osoba činnost vykonává (ISO) */
  od?: string;
  /** do kdy — prázdné = trvá */
  do?: string | null;
  /**
   * Přepis profesního rizika z číselníku. null = převzít globální hodnotu.
   * Používá se zřídka: dva elektrotechnici, jeden pracuje pod napětím.
   */
  profesniRizikoOverride?: boolean | null;
  poznamka?: string | null;
}

export interface Osoba {
  id: string;
  jmeno: string;
  prijmeni: string;
  /** datum narození (ISO) — nutné pro periodu prohlídky a formulář F006 */
  datumNarozeni?: string | null;
  osobniCislo?: string | null;
  poziceId?: string | null;
  cinnosti?: PrirazeniCinnosti[];
  datumNastupu?: string | null;
  datumUkonceni?: string | null;
  stav: StavZaznamu;
  poznamka?: string | null;
}

export interface Pozice {
  id: string;
  nazev: string;
  /** vedoucí zaměstnanec — atribut pozice, ne osoby (§ 103 ZP) */
  jeVedouci?: boolean;
  /**
   * Souhrnná kategorie — zůstává kvůli starším datům.
   * Nová kategorizace se zadává po faktorech níže; výsledná je nejvyšší z obojího.
   */
  kategorie?: KodKategorie | null;
  /** kategorizace rizikových faktorů prostředí na této pozici */
  faktory?: ZarazeniFaktoru[];
  /** činnosti předvyplněné novým osobám na této pozici */
  vychoziCinnosti?: string[];
  stav: StavZaznamu;
}

export function celeJmeno(o: Osoba): string {
  return `${o.prijmeni} ${o.jmeno}`.trim();
}

/** Aktivní přiřazení k danému dni (výchozí dnes). */
export function aktivniCinnosti(o: Osoba, kDatu = new Date().toISOString()): PrirazeniCinnosti[] {
  return (o.cinnosti ?? []).filter((p) => {
    if (p.od && p.od > kDatu) return false;
    if (p.do && p.do < kDatu) return false;
    return true;
  });
}

/** Osoba je v evidenci aktivní, dokud nemá datum ukončení v minulosti. */
export function jeAktivni(o: Osoba): boolean {
  if (o.stav !== 'aktivni') return false;
  if (!o.datumUkonceni) return true;
  return o.datumUkonceni > new Date().toISOString();
}

/** Načte osoby a pozice jednoho klienta. */
export async function nactiOsoby(klientId: string): Promise<Osoba[]> {
  const snap = await getDocs(
    query(collection(db, 'klienti', klientId, 'osoby'), where('stav', '==', 'aktivni')),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Osoba);
}

export async function nactiPozice(klientId: string): Promise<Pozice[]> {
  const snap = await getDocs(
    query(collection(db, 'klienti', klientId, 'pozice'), where('stav', '==', 'aktivni')),
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Pozice)
    .sort((a, b) => a.nazev.localeCompare(b.nazev, 'cs'));
}

/**
 * Rozparsuje CSV. Oddělovač se detekuje ze záhlaví (`;` nebo `,`),
 * protože Excel v českém prostředí exportuje středníkem.
 * Vrací záhlaví a řádky jako pole hodnot.
 */
export function parsujCsv(text: string): { hlavicka: string[]; radky: string[][] } {
  const cisty = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
  const radkyText = cisty.split('\n').filter((r) => r.trim() !== '');
  if (radkyText.length === 0) return { hlavicka: [], radky: [] };

  const oddelovac = (radkyText[0].match(/;/g)?.length ?? 0) >= (radkyText[0].match(/,/g)?.length ?? 0) ? ';' : ',';

  const rozdel = (radek: string): string[] => {
    const out: string[] = [];
    let bunka = '';
    let vUvozovkach = false;
    for (let i = 0; i < radek.length; i += 1) {
      const z = radek[i];
      if (z === '"') {
        if (vUvozovkach && radek[i + 1] === '"') { bunka += '"'; i += 1; }
        else vUvozovkach = !vUvozovkach;
      } else if (z === oddelovac && !vUvozovkach) {
        out.push(bunka.trim());
        bunka = '';
      } else {
        bunka += z;
      }
    }
    out.push(bunka.trim());
    return out;
  };

  return { hlavicka: rozdel(radkyText[0]), radky: radkyText.slice(1).map(rozdel) };
}

/** Cílová pole importu — na ně se mapují sloupce CSV. */
export const IMPORT_POLE: { klic: keyof Osoba | 'poziceNazev'; popis: string; povinne?: boolean }[] = [
  { klic: 'prijmeni', popis: 'Příjmení', povinne: true },
  { klic: 'jmeno', popis: 'Jméno', povinne: true },
  { klic: 'datumNarozeni', popis: 'Datum narození' },
  { klic: 'osobniCislo', popis: 'Osobní číslo' },
  { klic: 'poziceNazev', popis: 'Pracovní pozice' },
  { klic: 'datumNastupu', popis: 'Datum nástupu' },
];

/**
 * Převede běžné české zápisy data na ISO. Zvládá 1.2.2024, 01. 02. 2024,
 * 2024-02-01. Vrací null, nedá-li se rozpoznat — import pak pole vynechá.
 */
export function normalizujDatum(vstup: string): string | null {
  const t = vstup.trim();
  if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return new Date(t).toISOString();
  const m = t.match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})$/);
  if (m) {
    const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), 12);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}
