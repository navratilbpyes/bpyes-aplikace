/**
 * AuditFlow — školení: typy a výpočty.
 * Umístění: src/lib/skoleni.ts
 */

export type StavZaznamu = 'aktivni' | 'smazano';

/** Položka globálního číselníku školení. */
export interface CiselnikSkoleni {
  id: string;
  nazev: string;
  periodaMesice: number;
  /** id osoby z ciselnikOsoby, nebo prázdné */
  provadiOsobaId?: string;
  poznamka?: string;
  stav: StavZaznamu;
}

/** Osoba, která školení provádí. */
export interface Osoba {
  id: string;
  jmeno: string;
  /** volitelný popis role, např. „OZO", „revizní technik elektro" */
  role?: string;
  stav: StavZaznamu;
}

/**
 * Školení přiřazené konkrétnímu klientovi.
 * Vzniká jako kopie číselníkové položky (snapshot) — pozdější změna
 * v číselníku tuto instanci neovlivní.
 */
export interface SkoleniKlienta {
  id: string;
  /** informativní odkaz do číselníku; prázdné u vlastního školení */
  ciselnikId?: string;
  nazev: string;
  periodaMesice: number;
  provadiOsobaId?: string;
  /** popis skupiny, např. „skupina B — sklad" */
  poznamka?: string;
  /** datum posledního proškolení */
  posledniIso?: string;
  /** termín dalšího — dopočtený, nebo ručně přepsaný */
  dalsiIso?: string;
  /** true = uživatel zadal dalsiIso ručně, nepřepočítávat */
  dalsiRucne: boolean;
  stav: StavZaznamu;
}

/** Přičte měsíce k datu (ISO in, ISO out). */
export function pridejMesice(iso: string, mesicu: number): string {
  const d = new Date(iso);
  const puvodniDen = d.getDate();
  d.setMonth(d.getMonth() + mesicu);
  // ošetření přetečení (31. 1. + 1 měsíc by dalo 3. 3.)
  if (d.getDate() !== puvodniDen) {
    d.setDate(0);
  }
  return d.toISOString();
}

/**
 * Dopočítá termín dalšího školení.
 * Vrací undefined, pokud chybí datum posledního.
 */
export function dopocitejDalsi(
  posledniIso: string | undefined,
  periodaMesice: number,
): string | undefined {
  if (!posledniIso || !periodaMesice) return undefined;
  return pridejMesice(posledniIso, periodaMesice);
}

/**
 * Vrátí termín, který se má zobrazit: ruční přepis má přednost
 * před dopočtem z periody.
 */
export function platnyTermin(s: SkoleniKlienta): string | undefined {
  if (s.dalsiRucne && s.dalsiIso) return s.dalsiIso;
  return dopocitejDalsi(s.posledniIso, s.periodaMesice);
}

/** Formát periody pro zobrazení: „1× za 12 měsíců". */
export function popisPeriody(mesicu: number): string {
  if (mesicu === 12) return '1× ročně';
  if (mesicu === 24) return '1× za 2 roky';
  if (mesicu === 36) return '1× za 3 roky';
  if (mesicu % 12 === 0) return `1× za ${mesicu / 12} let`;
  return `1× za ${mesicu} měsíců`;
}

/** Předvolby period pro select. */
export const PERIODY: { hodnota: number; popis: string }[] = [
  { hodnota: 6, popis: '1× za 6 měsíců' },
  { hodnota: 12, popis: '1× ročně' },
  { hodnota: 24, popis: '1× za 2 roky' },
  { hodnota: 36, popis: '1× za 3 roky' },
  { hodnota: 48, popis: '1× za 4 roky' },
  { hodnota: 60, popis: '1× za 5 let' },
];
