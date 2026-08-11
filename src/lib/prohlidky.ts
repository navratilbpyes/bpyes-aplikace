/**
 * AuditFlow — prověrky BOZP a preventivní požární prohlídky.
 * Umístění: src/lib/prohlidky.ts
 *
 * Zákonná povinnost se váže k PRACOVIŠTI, ne k návštěvě.
 * Proto: jedna kontrola nad třemi pracovišti = tři dokumenty prohlídek
 * se shodným `zdrojZaznamId`. Když příště objedeš jen dvě, třetí
 * správně zůstane po termínu.
 *
 * Termín dalšího provedení nese jen MĚSÍC a ROK — u ročních lhůt
 * nemá denní přesnost smysl a vytvářela by falešnou preciznost.
 */

import type { Zaznam } from '@/app/lib/types';

export type TypProhlidky = 'PBOZP' | 'PPP';
export type StavProhlidky = 'aktivni' | 'smazano';

/** Typy kontrol, které zakládají prověrku BOZP. */
export const TYPY_PROVERKA: Zaznam['typKontroly'][] = ['BOZPaPO', 'PBOZP'];
/** Typy kontrol, které zakládají preventivní požární prohlídku. */
export const TYPY_PPP: Zaznam['typKontroly'][] = ['BOZPaPO', 'PPP'];

/** Výchozí perioda v měsících. Prověrka BOZP je ze zákona 1× ročně. */
export const VYCHOZI_PERIODA: Record<TypProhlidky, number> = {
  PBOZP: 12,
  PPP: 12,
};

export interface Prohlidka {
  id: string;
  klientId: string;
  /** id pracoviště z pole Klient.pracoviste */
  pracovisteId: string;
  /** název pracoviště v době provedení (snapshot pro případ přejmenování) */
  pracovisteNazev: string;
  typ: TypProhlidky;
  /** datum posledního provedení (ISO) */
  posledniIso?: string;
  /** měsíc dalšího provedení 1–12 */
  dalsiMesic?: number;
  /** rok dalšího provedení */
  dalsiRok?: number;
  /** perioda v měsících (lze u klienta přepsat) */
  periodaMesice: number;
  /** id záznamu (reportu), ze kterého prohlídka vznikla */
  zdrojZaznamId?: string;
  /** číslo protokolu pro orientaci */
  zdrojCislo?: string;
  /** mapování na řádek požární knihy (nepovinné) */
  pozarniRadek?: string | null;
  stav: StavProhlidky;
  updatedAt: string;
}

export const NAZEV_TYPU: Record<TypProhlidky, string> = {
  PBOZP: 'Prověrka BOZP',
  PPP: 'Preventivní požární prohlídka',
};

export const KRATKY_NAZEV: Record<TypProhlidky, string> = {
  PBOZP: 'Prověrka BOZP',
  PPP: 'PPP',
};

const MESICE = [
  'leden', 'únor', 'březen', 'duben', 'květen', 'červen',
  'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec',
];

/** „březen 2027" */
export function popisTerminu(mesic?: number, rok?: number): string {
  if (!mesic || !rok) return '—';
  return `${MESICE[mesic - 1]} ${rok}`;
}

/** Krátký tvar pro tabulky: „3/2027" */
export function kratkyTermin(mesic?: number, rok?: number): string {
  if (!mesic || !rok) return '—';
  return `${mesic}/${rok}`;
}

/**
 * Z data provedení a periody spočítá měsíc a rok dalšího provedení.
 */
export function dopocitejDalsi(
  posledniIso: string,
  periodaMesice: number,
): { mesic: number; rok: number } {
  const d = new Date(posledniIso);
  const celkem = d.getMonth() + periodaMesice; // 0-based měsíc
  return {
    mesic: (celkem % 12) + 1,
    rok: d.getFullYear() + Math.floor(celkem / 12),
  };
}

/**
 * Datum pro řazení v časovém plánu — první den daného měsíce.
 * Zobrazuje se ale vždy jen měsíc a rok.
 */
export function terminNaDatum(mesic?: number, rok?: number): Date | undefined {
  if (!mesic || !rok) return undefined;
  return new Date(rok, mesic - 1, 1);
}

/** Kolik měsíců zbývá do termínu (záporné = po termínu). */
export function mesicuDoTerminu(mesic: number, rok: number, dnes = new Date()): number {
  return (rok - dnes.getFullYear()) * 12 + (mesic - 1 - dnes.getMonth());
}

export type NaliehavostProhlidky = 'po_terminu' | 'blizi_se' | 'ok';

/** Blíží se = zbývají 2 měsíce a méně. */
export function naliehavost(mesic?: number, rok?: number, dnes = new Date()): NaliehavostProhlidky {
  if (!mesic || !rok) return 'ok';
  const m = mesicuDoTerminu(mesic, rok, dnes);
  if (m < 0) return 'po_terminu';
  if (m <= 2) return 'blizi_se';
  return 'ok';
}

/**
 * Které typy prohlídek zakládá daný typ kontroly.
 * BOZPaPO pokrývá obojí — prověrku i požární prohlídku.
 */
export function typyProhlidekZKontroly(typKontroly: Zaznam['typKontroly']): TypProhlidky[] {
  const typy: TypProhlidky[] = [];
  if (TYPY_PROVERKA.includes(typKontroly)) typy.push('PBOZP');
  if (TYPY_PPP.includes(typKontroly)) typy.push('PPP');
  return typy;
}

/**
 * Deterministické ID prohlídky.
 * Díky němu opakovaná kontrola téhož pracoviště přepíše stávající
 * záznam místo zakládání duplicity.
 */
export function idProhlidky(klientId: string, pracovisteId: string, typ: TypProhlidky): string {
  return `${klientId}__${pracovisteId}__${typ}`;
}
