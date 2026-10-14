/**
 * AuditFlow — nedostatky zjištěné revizí: typ, stavy a souhrny.
 * Umístění: src/lib/nedostatky.ts
 *
 * Stejný tok jako u nedostatků z kontrol:
 *   otevřený → klient nahlásí odstranění → OZO potvrdí (nebo vrátí k dopracování).
 *
 * Stav se nikde neukládá jako samostatné pole, odvozuje se z polí nedostatku
 * (viz stavNedostatku). Díky tomu se nedá dostat do nesouladu.
 */

/** Jeden nedostatek zjištěný revizí. */
export interface Nedostatek {
  id: string;
  popis: string;
  /** kdo má odstranit — jméno nebo pozice, volný text */
  odpovedny?: string | null;
  /** termín odstranění (ISO) */
  terminIso?: string | null;
  /**
   * Kdy bylo odstranění uzavřeno (ISO); prázdné = trvá.
   * Nastaví OZO (potvrzením hlášení klienta, nebo přímo). Klient ho nenastavuje.
   */
  odstranenoIso?: string | null;
  /** jak bylo odstraněno / poznámka */
  poznamka?: string | null;
  zadanoIso: string;

  // --- hlášení klienta a ověření OZO (stejná pole jako u nedostatků z kontrol) ---
  /** klient nahlásil odstranění */
  vyresenoKlientem?: boolean;
  /** datum odstranění, které klient uvedl (ISO) */
  datumVyreseniKlientem?: string | null;
  jmenoVyresitele?: string | null;
  poznamkaKlienta?: string | null;
  /** rozhodnutí OZO; null/chybí = zatím neposouzeno */
  overenoOzo?: 'potvrzeno' | 'vraceno' | null;
  datumOvereniOzo?: string | null;
  /** důvod vrácení k dopracování */
  poznamkaOzo?: string | null;
}

export type StavNedostatku = 'otevreny' | 'ceka_na_overeni' | 'vraceno' | 'odstranen';

/** Odvodí stav nedostatku z jeho polí. */
export function stavNedostatku(n: Nedostatek): StavNedostatku {
  if (n.odstranenoIso) return 'odstranen';
  if (n.vyresenoKlientem) return 'ceka_na_overeni';
  if (n.overenoOzo === 'vraceno') return 'vraceno';
  return 'otevreny';
}

/** Nedostatek, který je potřeba řešit na straně klienta (otevřený nebo vrácený). */
export function jeKResenizKlientem(n: Nedostatek): boolean {
  const s = stavNedostatku(n);
  return s === 'otevreny' || s === 'vraceno';
}

/** Po termínu = klient ho má řešit a termín už uplynul. */
export function nedostatekPoTerminu(n: Nedostatek, dnes: Date = new Date()): boolean {
  if (!jeKResenizKlientem(n) || !n.terminIso) return false;
  return new Date(n.terminIso).getTime() < dnes.getTime();
}

export interface SouhrnNedostatku {
  /** otevřené + vrácené (řeší klient) */
  otevrene: number;
  /** nahlášené klientem, čekají na OZO */
  ceka: number;
  /** z otevřených ty po termínu */
  poTerminu: number;
}

/** Souhrn pro odznaky v přehledech. */
export function souhrnNedostatku(seznam?: Nedostatek[] | null, dnes: Date = new Date()): SouhrnNedostatku {
  const s: SouhrnNedostatku = { otevrene: 0, ceka: 0, poTerminu: 0 };
  for (const n of seznam ?? []) {
    const stav = stavNedostatku(n);
    if (stav === 'ceka_na_overeni') s.ceka += 1;
    else if (stav !== 'odstranen') {
      s.otevrene += 1;
      if (nedostatekPoTerminu(n, dnes)) s.poTerminu += 1;
    }
  }
  return s;
}

/** Pole, která se vynulují, když se hlášení klienta ruší nebo vrací. */
export const ZRUSENI_HLASENI: Partial<Nedostatek> = {
  vyresenoKlientem: false,
  datumVyreseniKlientem: null,
  jmenoVyresitele: null,
  poznamkaKlienta: null,
};
