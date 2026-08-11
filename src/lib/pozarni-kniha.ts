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

/** Volný záznam v požární knize (ruční zápis). */
export interface PozarniZaznam {
  id: string;
  /** ISO datum záznamu */
  datum: string;
  /** rok (pro členění knihy po letech) — odvozeno z data */
  rok: number;
  /** obsah zjištění / nedostatky / odstranění */
  obsah: string;
  /** kdo záznam provedl */
  zadal: 'ozo' | 'klient';
  /** jméno toho, kdo provedl (pro tisk) */
  zadalJmeno?: string | null;
  stav: StavZaznamu;
}

/**
 * Jeden řádek roční tabulky po agregaci — název + poslední datum provedení
 * (z revize/školení/prohlídky s daným pozarniRadek) v daném roce.
 */
export interface RadekTabulky {
  id: string;
  nazev: string;
  /** ISO datum posledního provedení v daném roce, nebo null */
  datumProvedeni: string | null;
  /** zdroj (pro případný proklik/rozlišení) */
  zdroj?: 'revize' | 'skoleni' | 'prohlidka' | null;
}

/** Vstup pro agregaci — položka nesoucí pozarniRadek + datum provedení. */
export interface ZdrojovaPolozka {
  pozarniRadek?: string | null;
  posledniIso?: string | null;
  typ: 'revize' | 'skoleni' | 'prohlidka';
}

/**
 * Sestaví roční tabulku: pro každý fixní řádek najde nejnovější datum provedení
 * z položek daného roku, které mají odpovídající pozarniRadek.
 */
export function sestavTabulku(polozky: ZdrojovaPolozka[], rok: number): RadekTabulky[] {
  return POZARNI_RADKY.map((radek) => {
    let nejnovejsi: string | null = null;
    let zdroj: RadekTabulky['zdroj'] = null;
    for (const p of polozky) {
      if (p.pozarniRadek !== radek.id || !p.posledniIso) continue;
      const d = new Date(p.posledniIso);
      if (isNaN(d.getTime()) || d.getFullYear() !== rok) continue;
      if (!nejnovejsi || d.getTime() > new Date(nejnovejsi).getTime()) {
        nejnovejsi = p.posledniIso;
        zdroj = p.typ;
      }
    }
    return { id: radek.id, nazev: radek.nazev, datumProvedeni: nejnovejsi, zdroj };
  });
}

/** Formát data pro tabulku: „15. 3. 2025". */
export function formatDatum(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' });
}
