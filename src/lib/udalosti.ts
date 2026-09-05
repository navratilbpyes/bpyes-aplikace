/**
 * AuditFlow — záznamy školení, zácviků a lékařských prohlídek.
 * Umístění: src/lib/udalosti.ts
 *
 * Jeden dokument = jedna osoba, jedno téma, jedno datum. Historie vzniká tím,
 * že se záznamy nepřepisují mlčky — každá změna se zapíše do pole `log`.
 *
 * Perioda se počítá od data osoby, ne od firemního termínu:
 * dva lidé proškolení s odstupem dvou týdnů mají termíny posunuté o dva týdny.
 * Centrální kolo je pak sesbírá k jednomu datu (viz ochranná lhůta).
 */

import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/components/data-provider';
import type { StavZaznamu } from './skoleni';
import { pridejMesice } from './skoleni';

export type TypUdalosti = 'skoleni' | 'zacvik' | 'prohlidka';

/** Závěr lékařského posudku dle § 43 zák. č. 373/2011 Sb. */
export type ZaverProhlidky =
  | 'zpusobily'
  | 'zpusobilySPodminkou'
  | 'nezpusobily'
  | 'pozbylZpusobilost';

export type DruhProhlidky =
  | 'vstupni' | 'periodicka' | 'mimoradna' | 'vystupni' | 'nasledna';

export interface ZmenaLogu {
  kdy: string;
  kdo: string;
  pole: string;
  puvodni: string | null;
  nova: string | null;
}

export interface Udalost {
  id: string;
  osobaId: string;
  typ: TypUdalosti;
  /** u školení a zácviku odkaz do ciselnikSkoleni, u prohlídky prázdné */
  temaId?: string | null;
  /** název tématu v době zápisu (snapshot pro historii) */
  temaNazev?: string | null;
  /** datum školení / zahájení zácviku / provedení prohlídky */
  datum: string;
  /** ukončení zácviku — délka se liší podle schopností člověka */
  datumDo?: string | null;
  /** u prohlídky datum vydání posudku — od něj běží perioda */
  datumPosudku?: string | null;
  druhProhlidky?: DruhProhlidky | null;
  zaver?: ZaverProhlidky | null;
  /** platnost posudku, je-li uvedena přímo na posudku */
  platnostDo?: string | null;
  /** lektor, mentor nebo poskytovatel PLS */
  provedl?: string | null;
  poznamka?: string | null;
  log?: ZmenaLogu[];
  stav: StavZaznamu;
}

export const POPIS_ZAVERU: Record<ZaverProhlidky, string> = {
  zpusobily: 'Zdravotně způsobilý',
  zpusobilySPodminkou: 'Způsobilý s podmínkou',
  nezpusobily: 'Není způsobilý',
  pozbylZpusobilost: 'Pozbyl dlouhodobě způsobilost',
};

export const POPIS_DRUHU: Record<DruhProhlidky, string> = {
  vstupni: 'Vstupní',
  periodicka: 'Periodická',
  mimoradna: 'Mimořádná',
  vystupni: 'Výstupní',
  nasledna: 'Následná',
};

export async function nactiUdalosti(klientId: string): Promise<Udalost[]> {
  const snap = await getDocs(
    query(collection(db, 'klienti', klientId, 'udalosti'), where('stav', '==', 'aktivni')),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Udalost);
}

/** Poslední záznam osoby k danému tématu (u prohlídky temaId = null). */
export function posledni(
  udalosti: Udalost[],
  osobaId: string,
  typ: TypUdalosti,
  temaId: string | null,
): Udalost | undefined {
  return udalosti
    .filter((u) => u.osobaId === osobaId && u.typ === typ && (u.temaId ?? null) === temaId)
    .sort((a, b) => (b.datum ?? '').localeCompare(a.datum ?? ''))[0];
}

/**
 * Termín dalšího školení osoby. Počítá se od jejího posledního proškolení,
 * ne od firemního termínu — proto mají dva lidé různá data.
 */
export function dalsiTermin(u: Udalost | undefined, periodaMesice: number): string | undefined {
  if (!u || !periodaMesice) return undefined;
  const zaklad = u.typ === 'prohlidka' ? (u.datumPosudku ?? u.datum) : u.datum;
  if (!zaklad) return undefined;
  if (u.platnostDo) return u.platnostDo;
  return pridejMesice(zaklad, periodaMesice);
}

/**
 * Zařadit osobu do kola konaného v `datumKola`?
 * Ochranná lhůta brání tomu, aby čerstvě proškolený šel znovu — jde až
 * do dalšího kola. Bez ní by se periodická školení konala každý týden.
 */
export function patriDoKola(
  posledniUdalost: Udalost | undefined,
  datumKola: string,
  ochrannaLhutaMesicu: number,
): boolean {
  if (!posledniUdalost) return true;
  const hranice = pridejMesice(posledniUdalost.datum, ochrannaLhutaMesicu);
  return datumKola > hranice;
}

/** Vytvoří položku logu — do historie se ukládá, co bylo a co je. */
export function polozkaLogu(
  kdo: string,
  pole: string,
  puvodni: string | null | undefined,
  nova: string | null | undefined,
): ZmenaLogu {
  return {
    kdy: new Date().toISOString(),
    kdo,
    pole,
    puvodni: puvodni ?? null,
    nova: nova ?? null,
  };
}

export function formatDatum(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('cs-CZ');
}

/** Barevné pásmo termínu pro plán: po lhůtě / blíží se / v pořádku. */
export function stavTerminu(iso?: string): 'po' | 'blizi' | 'ok' | 'chybi' {
  if (!iso) return 'chybi';
  const dnes = new Date();
  const t = new Date(iso);
  const dnu = Math.round((t.getTime() - dnes.getTime()) / 86400000);
  if (dnu < 0) return 'po';
  if (dnu <= 90) return 'blizi';
  return 'ok';
}
