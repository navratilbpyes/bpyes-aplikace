/**
 * AuditFlow — most mezi sloučeným číselníkem „Školení a činnosti" a modulem Lidské zdroje.
 * Umístění: src/lib/cinnosti-adapter.ts
 *
 * Lidské zdroje počítají s tvarem `CiselnikCinnost`. Po sloučení číselníků je zdrojem
 * pravdy `ciselnikSkoleni`, takže se každá položka převede na tento tvar. Osoby, pozice
 * a procesní mapa ale mohou mít uložená ID původních činností — `alias` je přemapuje
 * na nová ID při načtení (v databázi se nic hromadně nepřepisuje).
 */

import type { CiselnikSkoleni } from './skoleni';
import type { CiselnikCinnost } from './cinnosti';
import type { Osoba, Pozice } from './osoby';
import type { CiselnikUzel } from './uzly';

/** Pořadí oblastí pro řazení a seskupení sloupců i seznamů. */
export const PORADI_OBLASTI = [
  'BOZP', 'PO', 'První pomoc', 'Doprava', 'OOPP', 'Elektro', 'Tlak', 'Plyn',
  'Zdvihací', 'Výšky a stavby', 'Svařování', 'Rizikové faktory', 'Ostatní',
];

export function poradiOblasti(o?: string | null): number {
  const i = PORADI_OBLASTI.indexOf(o ?? '');
  return i === -1 ? PORADI_OBLASTI.length : i;
}

/** Položka číselníku → tvar, se kterým pracují Lidské zdroje. */
export function polozkaNaCinnost(s: CiselnikSkoleni): CiselnikCinnost {
  const sledovana = !s.bezSkoleniPovereni && (s.periodaMesice ?? 0) > 0;
  return {
    id: s.id,
    nazev: s.nazev,
    oblast: s.oblast,
    // vlastní termín položky + to, co z ní vyplývá
    skoleniIds: Array.from(new Set([...(sledovana ? [s.id] : []), ...(s.souvisejiciIds ?? [])])),
    zacvik: !!s.zacvik,
    profesniRiziko: !!s.profesniRiziko,
    prohlidkaDo50: s.prohlidkaDo50 ?? null,
    prohlidkaNad50: s.prohlidkaNad50 ?? null,
    odbornaVysetreni: s.odbornaVysetreni ?? null,
    faktory: s.faktory ?? [],
    poznamka: s.poznamka ?? null,
    stav: s.stav,
  };
}

export interface SestavenyCiselnik {
  /** všechny položky ve tvaru činnosti, seřazené podle oblasti a názvu */
  cinnosti: CiselnikCinnost[];
  /** staré ID činnosti → nové ID položky */
  alias: Record<string, string>;
}

export function sestavCinnosti(skoleni: CiselnikSkoleni[]): SestavenyCiselnik {
  const alias: Record<string, string> = {};
  for (const s of skoleni) {
    for (const stare of s.puvodniCinnostIds ?? []) alias[stare] = s.id;
  }
  const cinnosti = [...skoleni]
    .sort((a, b) => {
      const o = poradiOblasti(a.oblast) - poradiOblasti(b.oblast);
      return o !== 0 ? o : a.nazev.localeCompare(b.nazev, 'cs');
    })
    .map(polozkaNaCinnost);
  return { cinnosti, alias };
}

const mapuj = (id: string, alias: Record<string, string>) => alias[id] ?? id;
const unikatni = <T,>(a: T[]) => Array.from(new Set(a));

export function prepojOsobu<T extends Osoba>(o: T, alias: Record<string, string>): T {
  if (!o.cinnosti || o.cinnosti.length === 0) return o;
  return { ...o, cinnosti: o.cinnosti.map((p) => ({ ...p, cinnostId: mapuj(p.cinnostId, alias) })) };
}

export function prepojPozici<T extends Pozice>(p: T, alias: Record<string, string>): T {
  if (!p.vychoziCinnosti) return p;
  return { ...p, vychoziCinnosti: unikatni(p.vychoziCinnosti.map((id) => mapuj(id, alias))) };
}

export function prepojUzel<T extends CiselnikUzel>(u: T, alias: Record<string, string>): T {
  if (!u.cinnostiIds) return u;
  return { ...u, cinnostiIds: unikatni(u.cinnostiIds.map((id) => mapuj(id, alias))) };
}
