/**
 * AuditFlow — revize: typy a výpočty.
 * Umístění: src/lib/revize.ts
 *
 * Číselník nese jen téma a periodu. Konkrétní revizní firma
 * se zadává až u revize v kartě klienta — u každého klienta
 * bývá jiná, do globálního katalogu nepatří.
 */

export type StavZaznamu = 'aktivni' | 'smazano';

/** Položka číselníku revizí. */
export interface CiselnikRevize {
  id: string;
  /** téma revize, např. „Revize hromosvodu" */
  nazev: string;
  periodaMesice: number;
  stav: StavZaznamu;
}

/** Revizní firma / technik u konkrétní revize. */
export interface RevizniFirma {
  nazev?: string;
  telefon?: string;
  email?: string;
}

/**
 * Revize přiřazená konkrétnímu klientovi.
 * Vzniká jako kopie číselníkové položky (snapshot) — pozdější změna
 * v číselníku tuto instanci neovlivní.
 */
export interface RevizeKlienta {
  id: string;
  /** informativní odkaz do číselníku; prázdné u vlastní revize */
  ciselnikId?: string;
  nazev: string;
  periodaMesice: number;
  /** revizní firma / technik pro tuto konkrétní revizi */
  firmaNazev?: string;
  firmaTelefon?: string;
  firmaEmail?: string;
  /** popis zařízení / objektu, např. „hala B — rozvaděč RH2" */
  poznamka?: string;
  /** číslo protokolu poslední revize, např. „HR-2025/14" */
  cisloProtokolu?: string;
  /** datum poslední revize */
  posledniIso?: string;
  /** termín další — dopočtený, nebo ručně přepsaný */
  dalsiIso?: string;
  /** true = uživatel zadal dalsiIso ručně, nepřepočítávat */
  dalsiRucne: boolean;
  stav: StavZaznamu;
  /** kdo záznam založil: 'ozo' (admin/technik) nebo 'klient'. Chybí u starých = 'ozo'. */
  zadal?: 'ozo' | 'klient';
  /** potvrzeno OZO. Chybí u starých adminových = bereme jako potvrzené. */
  potvrzenoOzo?: boolean;
}

/** Přičte měsíce k datu (ISO in, ISO out). */
export function pridejMesice(iso: string, mesicu: number): string {
  const d = new Date(iso);
  const puvodniDen = d.getDate();
  d.setMonth(d.getMonth() + mesicu);
  if (d.getDate() !== puvodniDen) d.setDate(0);
  return d.toISOString();
}

/** Dopočítá termín další revize. Vrací undefined, chybí-li datum poslední. */
export function dopocitejDalsi(
  posledniIso: string | undefined,
  periodaMesice: number,
): string | undefined {
  if (!posledniIso || !periodaMesice) return undefined;
  return pridejMesice(posledniIso, periodaMesice);
}

/** Ruční přepis má přednost před dopočtem z periody. */
export function platnyTermin(r: RevizeKlienta): string | undefined {
  if (r.dalsiRucne && r.dalsiIso) return r.dalsiIso;
  return dopocitejDalsi(r.posledniIso, r.periodaMesice);
}

/** Formát periody pro zobrazení. */
export function popisPeriody(mesicu: number): string {
  if (mesicu === 12) return '1× ročně';
  if (mesicu === 24) return '1× za 2 roky';
  if (mesicu === 36) return '1× za 3 roky';
  if (mesicu % 12 === 0) return `1× za ${mesicu / 12} let`;
  return `1× za ${mesicu} měsíců`;
}

/** Předvolby period pro revize. */
export const PERIODY: { hodnota: number; popis: string }[] = [
  { hodnota: 3, popis: '1× za 3 měsíce' },
  { hodnota: 6, popis: '1× za 6 měsíců' },
  { hodnota: 12, popis: '1× ročně' },
  { hodnota: 24, popis: '1× za 2 roky' },
  { hodnota: 36, popis: '1× za 3 roky' },
  { hodnota: 48, popis: '1× za 4 roky' },
  { hodnota: 60, popis: '1× za 5 let' },
];
