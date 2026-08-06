/**
 * AuditFlow — revize: typy a výpočty.
 * Umístění: src/lib/revize.ts
 *
 * Číselník nese jen téma a periodu. Konkrétní revizní firma
 * se zadává až u revize v kartě klienta — u každého klienta
 * bývá jiná, do globálního katalogu nepatří.
 */

export type StavZaznamu = 'aktivni' | 'smazano';

/** Oblast revize/kontroly (kategorizace matice). */
export type Oblast = 'Elektro' | 'Tlak' | 'Zdvihací' | 'PO' | 'Ostatní';

/**
 * Typ lhůty — řídí výpočet dalšího termínu:
 *  - 'klouzava'   → poslední + periodaMesice (pro lhůty < 12 měsíců)
 *  - 'kalendarni' → stejný kalendářní měsíc po N letech (roční a víceleté)
 *  - 'text'       → bez auto-výpočtu; lhůta je jen textová (dle návodu / místního řádu)
 */
export type TypLhuty = 'klouzava' | 'kalendarni' | 'text';

/**
 * Položka číselníku revizí (matice revizí/kontrol BOZP/PO).
 * Pole oblast/zarizeni/druhUkonu/lhutaText/kdoProvadi/typLhuty jsou volitelná
 * kvůli zpětné kompatibilitě se staršími položkami, které měly jen nazev+perioda.
 */
export interface CiselnikRevize {
  id: string;
  /** téma revize — u nových položek složeno „zarizeni – druhUkonu" */
  nazev: string;
  periodaMesice: number;
  stav: StavZaznamu;
  /** kategorie (Elektro/Tlak/Zdvihací/PO/Ostatní) */
  oblast?: Oblast;
  /** zařízení / prostředí, např. „Administrativa" */
  zarizeni?: string;
  /** druh úkonu, např. „Revize", „Vizuální kontrola", „Tlaková zkouška" */
  druhUkonu?: string;
  /** doslovná lhůta z matice, např. „1× ročně", „14 dní", „Dle místního řádu" */
  lhutaText?: string;
  /** kdo úkon provádí */
  kdoProvadi?: string;
  /** typ lhůty pro výpočet termínu; chybí = 'klouzava' (zpětná kompatibilita) */
  typLhuty?: TypLhuty;
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
  /** pracoviště z klient.pracoviste (výběr) — id */
  pracovisteId?: string | null;
  /** pracoviště — název (snapshot pro zobrazení) */
  pracovisteNazev?: string | null;
  /** bližší určení umístění (volný text — např. místnost) */
  umisteni?: string | null;
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
  /** ID nahraného protokolu v kolekci `dokumenty` (viz lib/protokol.ts) */
  protokolDokumentId?: string | null;
  /** název souboru protokolu (pro zobrazení) */
  protokolNazev?: string | null;
  /** stav protokolu: 'ceka' (klient nahrál) | 'videl' | 'odmitnuto' (OZO) */
  protokolStav?: 'ceka' | 'videl' | 'odmitnuto' | null;
  /** důvod odmítnutí protokolu (vyplní OZO) */
  protokolDuvod?: string | null;
  // --- snapshot z číselníku (matice) — kopíruje se při přidání z katalogu ---
  /** kategorie z matice (Elektro/Tlak/…) */
  oblast?: Oblast;
  /** druh úkonu z matice (Revize / Vizuální kontrola / …) */
  druhUkonu?: string;
  /** doslovná lhůta z matice (informativní) */
  lhutaText?: string;
  /** kdo úkon provádí (informativní, nezaměňovat s firmaNazev u klienta) */
  kdoProvadi?: string;
  /** typ lhůty pro výpočet termínu; chybí = 'klouzava' */
  typLhuty?: TypLhuty;
}

/** Přičte měsíce k datu (ISO in, ISO out). Klouzavý výpočet. */
export function pridejMesice(iso: string, mesicu: number): string {
  const d = new Date(iso);
  const puvodniDen = d.getDate();
  d.setMonth(d.getMonth() + mesicu);
  if (d.getDate() !== puvodniDen) d.setDate(0);
  return d.toISOString();
}

/**
 * Kalendářní výpočet pro roční a víceleté lhůty (bod 5):
 * další termín padne na STEJNÝ kalendářní měsíc po N letech (N = periodaMesice/12),
 * konkrétně na poslední den toho měsíce (aby termín „platil celý měsíc").
 * Např. poslední 15. 3. 2025, „1× ročně" → 31. 3. 2026.
 */
export function pridejKalendarniRoky(iso: string, periodaMesice: number): string {
  const d = new Date(iso);
  const roky = Math.max(1, Math.round(periodaMesice / 12));
  // cílový měsíc = měsíc poslední revize; rok + N; den = poslední den měsíce
  const cil = new Date(d.getFullYear() + roky, d.getMonth() + 1, 0);
  return cil.toISOString();
}

/**
 * Dopočítá termín další revize podle typu lhůty.
 * Vrací undefined, chybí-li datum poslední nebo jde o textovou lhůtu.
 *
 * Zpětná kompatibilita: pokud `typLhuty` chybí, chová se jako 'klouzava'
 * (původní chování) — stará data i stará volání fungují beze změny.
 */
export function dopocitejDalsi(
  posledniIso: string | undefined,
  periodaMesice: number,
  typLhuty?: TypLhuty,
): string | undefined {
  if (!posledniIso) return undefined;
  if (typLhuty === 'text') return undefined;
  if (!periodaMesice) return undefined;
  if (typLhuty === 'kalendarni') {
    return pridejKalendarniRoky(posledniIso, periodaMesice);
  }
  // 'klouzava' nebo nevyplněno
  return pridejMesice(posledniIso, periodaMesice);
}

/** Ruční přepis má přednost před dopočtem z periody. */
export function platnyTermin(r: RevizeKlienta): string | undefined {
  if (r.dalsiRucne && r.dalsiIso) return r.dalsiIso;
  return dopocitejDalsi(r.posledniIso, r.periodaMesice, r.typLhuty);
}

/** Formát periody pro zobrazení. */
export function popisPeriody(mesicu: number): string {
  if (mesicu === 1) return '1× za měsíc';
  if (mesicu === 12) return '1× ročně';
  if (mesicu === 24) return '1× za 2 roky';
  if (mesicu === 36) return '1× za 3 roky';
  if (mesicu % 12 === 0) return `1× za ${mesicu / 12} let`;
  return `1× za ${mesicu} měsíců`;
}

/**
 * Vygeneruje textovou lhůtu podle periody a typu (dávka 2a — verze i).
 * Rozlišuje kalendářní (roky) od klouzavé (měsíce), aby text seděl s významem:
 *  - kalendarni 12 → „1× ročně", 24 → „1× za 2 roky"
 *  - klouzava   12 → „1× za 12 měsíců", 6 → „1× za 6 měsíců"
 *  - text       → volný text zadá uživatel, tato funkce vrací '' (nepoužije se)
 */
export function generujLhutaText(periodaMesice: number, typLhuty: TypLhuty): string {
  if (typLhuty === 'text') return '';
  if (typLhuty === 'kalendarni') {
    if (periodaMesice === 12) return '1× ročně';
    if (periodaMesice % 12 === 0) return `1× za ${periodaMesice / 12} ${periodaMesice / 12 <= 4 ? 'roky' : 'let'}`;
    return `1× za ${periodaMesice} měsíců`;
  }
  // klouzava
  if (periodaMesice === 1) return '1× za měsíc';
  return `1× za ${periodaMesice} měsíců`;
}

/** Předvolby period pro revize. */
export const PERIODY: { hodnota: number; popis: string }[] = [
  { hodnota: 1, popis: '1× za měsíc' },
  { hodnota: 2, popis: '1× za 2 měsíce' },
  { hodnota: 3, popis: '1× za 3 měsíce' },
  { hodnota: 6, popis: '1× za 6 měsíců' },
  { hodnota: 12, popis: '1× ročně' },
  { hodnota: 24, popis: '1× za 2 roky' },
  { hodnota: 36, popis: '1× za 3 roky' },
  { hodnota: 48, popis: '1× za 4 roky' },
  { hodnota: 60, popis: '1× za 5 let' },
  { hodnota: 72, popis: '1× za 6 let' },
  { hodnota: 120, popis: '1× za 10 let' },
];
