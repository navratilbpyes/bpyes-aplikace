/**
 * AuditFlow — Požární kniha (PO-05).
 * Umístění: src/lib/pozarni-kniha.ts
 *
 * Kniha se skládá ze dvou částí:
 *  1) Roční tabulka činností — 16 fixních řádků dle vzoru PO-05. Datum provedení
 *     se načítá z revizí / školení / prohlídek, které mají daný `pozarniRadek`.
 *  2) Volné záznamy — ruční zápisy (zjištění/nedostatky), zadává klient i OZO.
 *
 * Párování (varianta B): revize/školení/prohlídka nese pole `pozarniRadek`
 * = id jednoho z řádků níže. Vyplňuje se u položek s kategorií PO.
 */

export type StavZaznamu = 'aktivni' | 'smazano';

/** Jeden řádek roční tabulky požární knihy. */
export interface PozarniRadek {
  id: string;
  nazev: string;
}

/**
 * 16 fixních řádků dle PO-05. Pořadí odpovídá vzoru.
 * `id` je stabilní klíč (nemění se) — na něj se mapuje `pozarniRadek`
 * u revizí/školení/prohlídek. `nazev` je zobrazovaný text.
 */
export const POZARNI_RADKY: PozarniRadek[] = [
  { id: 'skoleni-zamestnanci', nazev: 'Školení zaměstnanců o požární ochraně' },
  { id: 'skoleni-vedouci', nazev: 'Školení vedoucích zaměstnanců o požární ochraně' },
  { id: 'preventivni-prohlidka', nazev: 'Preventivní požární prohlídka' },
  { id: 'kontrola-dokumentace', nazev: 'Kontrola dokumentace požární ochrany' },
  { id: 'kontrola-php', nazev: 'Kontrola provozuschopnosti přenosných hasicích přístrojů' },
  { id: 'kontrola-hydranty', nazev: 'Kontrola provozuschopnosti požárních hydrantů' },
  { id: 'priprava-hlidky', nazev: 'Odborná příprava preventivních požárních hlídek' },
  { id: 'priprava-preventiste', nazev: 'Odborná příprava preventistů požární ochrany' },
  { id: 'skoleni-zvysene-nebezpeci', nazev: 'Školení osob vykonávajících činnosti se zvýšeným / vysokým požárním nebezpečím' },
  { id: 'cvicny-poplach', nazev: 'Cvičný požární poplach' },
  { id: 'kontrola-suchovody', nazev: 'Kontrola provozuschopnosti suchovodů' },
  { id: 'kontrola-nouzove-osvetleni', nazev: 'Kontrola provozuschopnosti nouzového osvětlení' },
  { id: 'kontrola-prostupy', nazev: 'Kontrola provozuschopnosti požárních prostupů' },
  { id: 'kontrola-dvere', nazev: 'Kontrola provozuschopnosti požárních dveří / uzávěrů' },
  { id: 'kontrola-nadrz', nazev: 'Kontrola provozuschopnosti požární nádrže' },
  { id: 'kontrola-jina-pbz', nazev: 'Kontrola provozuschopnosti jiných požárně bezpečnostních zařízení' },
];

/** Rychlé dohledání názvu řádku podle id. */
export function nazevRadku(id: string): string {
  return POZARNI_RADKY.find((r) => r.id === id)?.nazev ?? id;
}

/** Volný záznam / provedení v požární knize. */
export interface PozarniZaznam {
  id: string;
  /** ISO datum záznamu */
  datum: string;
  /** rok (pro členění knihy po letech) — odvozeno z data */
  rok: number;
  /** obsah zjištění / nedostatky / odstranění (u provedení nepovinné) */
  obsah?: string;
  /**
   * Vazba na řádek roční tabulky:
   *  - id řádku (POZARNI_RADKY) → ruční PROVEDENÍ navázané na činnost,
   *  - null → obecný volný záznam (samostatná sekce).
   */
  radekId?: string | null;
  /** kdo záznam provedl */
  zadal: 'ozo' | 'klient';
  /** jméno toho, kdo provedl (pro tisk) */
  zadalJmeno?: string | null;
  stav: StavZaznamu;
}

/** Jedno provedení činnosti (řádek v tisku): datum + původ + kdo. */
export interface Provedeni {
  /** ISO datum */
  datum: string;
  /** zdroj: auto (z revize/školení/prohlídky) nebo ruční záznam */
  puvod: 'auto' | 'rucni';
  /** u auto: typ zdroje; u ručního: kdo zadal */
  zadal?: 'ozo' | 'klient' | null;
  zadalJmeno?: string | null;
  /** id ručního záznamu (pro mazání); u auto chybí */
  zaznamId?: string;
  /** nepovinná poznámka u ručního provedení */
  obsah?: string;
}

/** Řádek roční tabulky po agregaci: název + všechna provedení v daném roce. */
export interface RadekTabulky {
  id: string;
  nazev: string;
  provedeni: Provedeni[];
}

/** Vstup pro agregaci — položka nesoucí pozarniRadek + datum provedení. */
export interface ZdrojovaPolozka {
  pozarniRadek?: string | null;
  posledniIso?: string | null;
  typ: 'revize' | 'skoleni' | 'prohlidka';
}

/**
 * Sestaví roční tabulku. Každý fixní řádek dostane SEZNAM provedení v daném roce:
 *  - automatická (z revizí/školení/prohlídek s daným pozarniRadek, datum = posledniIso),
 *  - ruční (záznamy s radekId == id řádku).
 * Seřazeno vzestupně podle data.
 */
export function sestavTabulku(
  polozky: ZdrojovaPolozka[],
  zaznamy: PozarniZaznam[],
  rok: number,
): RadekTabulky[] {
  return POZARNI_RADKY.map((radek) => {
    const provedeni: Provedeni[] = [];

    // automatická provedení
    for (const p of polozky) {
      if (p.pozarniRadek !== radek.id || !p.posledniIso) continue;
      const d = new Date(p.posledniIso);
      if (isNaN(d.getTime()) || d.getFullYear() !== rok) continue;
      provedeni.push({ datum: p.posledniIso, puvod: 'auto', zadal: 'ozo' });
    }

    // ruční provedení navázaná na řádek
    for (const z of zaznamy) {
      if (z.radekId !== radek.id || z.stav === 'smazano') continue;
      const d = new Date(z.datum);
      if (isNaN(d.getTime()) || d.getFullYear() !== rok) continue;
      provedeni.push({
        datum: z.datum, puvod: 'rucni', zadal: z.zadal,
        zadalJmeno: z.zadalJmeno, zaznamId: z.id, obsah: z.obsah,
      });
    }

    provedeni.sort((a, b) => new Date(a.datum).getTime() - new Date(b.datum).getTime());
    return { id: radek.id, nazev: radek.nazev, provedeni };
  });
}

/** Formát data pro tabulku: „15. 3. 2025". */
export function formatDatum(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' });
}
