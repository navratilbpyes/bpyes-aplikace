/**
 * AuditFlow — časový plán klienta ze čtyř reálných zdrojů.
 * Umístění: src/lib/casovy-plan.ts
 *
 * Sjednocuje:
 *   - revize   (klienti/{id}/revize)
 *   - školení  (klienti/{id}/skoleni)
 *   - prohlídky (kolekce `prohlidky`, filtrováno klientId)
 *   - nálezy   (otevřené závady ze `zaznamy` daného klienta)
 *
 * Výstup je jednotný PolozkaPlanu, seřazený podle naléhavosti a data.
 */

import { platnyTermin as terminRevize } from '@/lib/revize';
import { platnyTermin as terminSkoleni } from '@/lib/skoleni';
import { terminNaDatum } from '@/lib/prohlidky';
import type { RevizeKlienta } from '@/lib/revize';
import type { SkoleniKlienta } from '@/lib/skoleni';
import type { Prohlidka } from '@/lib/prohlidky';
import type { Zaznam, Zavada } from '@/app/lib/types';

export type TypPolozky = 'revize' | 'skoleni' | 'prohlidka' | 'nalez';
export type Naliehavost = 'po_terminu' | 'blizi_se' | 'ok';

export interface PolozkaPlanu {
  id: string;
  typ: TypPolozky;
  nazev: string;
  /** doplňující řádek: firma, kdo provádí, pracoviště… */
  meta?: string;
  /** odpovědná osoba/firma pro filtr (firmaNazev / provadi / odpovědná osoba nálezu) */
  odpovednaOsoba?: string;
  /** číslo protokolu / reference kontroly */
  zdroj?: string;
  /** datum termínu pro řazení */
  terminDatum?: Date;
  /** text štítku: „po termínu · 8 dní", „březen 2027" */
  stitek: string;
  naliehavost: Naliehavost;
  /** true = má navázaný dokument (proklik), false = jen vypočtený termín */
  maDokument: boolean;
  /** cílová routa prokliku, nebo undefined když položka nikam nevede */
  odkaz?: string;
}

const DEN = 86400000;
const RANK: Record<Naliehavost, number> = { po_terminu: 0, blizi_se: 1, ok: 2 };

function dniDo(datum: Date, dnes: Date): number {
  return Math.round((datum.getTime() - dnes.getTime()) / DEN);
}

function naliehavostZDatumu(datum: Date | undefined, dnes: Date): Naliehavost {
  if (!datum) return 'ok';
  const d = dniDo(datum, dnes);
  if (d < 0) return 'po_terminu';
  if (d <= 30) return 'blizi_se';
  return 'ok';
}

function sklonDny(n: number): string {
  if (n === 1) return 'den';
  if (n >= 2 && n <= 4) return 'dny';
  return 'dní';
}

/** Štítek pro termín zadaný přesným datem (revize, školení, nálezy). */
function stitekDatum(datum: Date | undefined, dnes: Date): string {
  if (!datum) return 'bez termínu';
  const d = dniDo(datum, dnes);
  if (d < 0) return `po termínu · ${Math.abs(d)} ${sklonDny(Math.abs(d))}`;
  if (d === 0) return 'dnes';
  if (d <= 60) return `do ${d} ${sklonDny(d)}`;
  return datum.toLocaleDateString('cs-CZ', { month: 'long', year: 'numeric' });
}

const MESICE = [
  'leden', 'únor', 'březen', 'duben', 'květen', 'červen',
  'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec',
];

/** Štítek pro termín zadaný jen měsícem a rokem (prohlídky). */
function stitekMesic(mesic: number | undefined, rok: number | undefined, dnes: Date): string {
  if (!mesic || !rok) return 'bez termínu';
  const mesicu = (rok - dnes.getFullYear()) * 12 + (mesic - 1 - dnes.getMonth());
  if (mesicu < 0) return `po termínu · ${MESICE[mesic - 1]} ${rok}`;
  return `${MESICE[mesic - 1]} ${rok}`;
}

// ── Jednotlivé zdroje → PolozkaPlanu ──

export function revizeNaPolozky(
  revize: RevizeKlienta[],
  dnes: Date,
  klientId: string,
): PolozkaPlanu[] {
  return revize
    .filter((r) => r.stav === 'aktivni')
    .map((r) => {
      const iso = terminRevize(r);
      const datum = iso ? new Date(iso) : undefined;
      const meta = [r.poznamka, r.firmaNazev].filter(Boolean).join(' · ') || undefined;
      return {
        id: `revize_${r.id}`,
        typ: 'revize' as const,
        nazev: r.nazev,
        meta,
        odpovednaOsoba: r.firmaNazev || undefined,
        zdroj: r.cisloProtokolu ? `protokol ${r.cisloProtokolu}` : undefined,
        terminDatum: datum,
        stitek: stitekDatum(datum, dnes),
        naliehavost: naliehavostZDatumu(datum, dnes),
        maDokument: !!r.cisloProtokolu,
        odkaz: `/klienti/${klientId}?tab=revize`,
      };
    });
}

export function skoleniNaPolozky(
  skoleni: SkoleniKlienta[],
  dnes: Date,
  klientId: string,
): PolozkaPlanu[] {
  return skoleni
    .filter((s) => s.stav === 'aktivni')
    .map((s) => {
      const iso = terminSkoleni(s);
      const datum = iso ? new Date(iso) : undefined;
      const meta = [s.poznamka, s.provadi].filter(Boolean).join(' · ') || undefined;
      return {
        id: `skoleni_${s.id}`,
        typ: 'skoleni' as const,
        nazev: s.nazev,
        meta,
        odpovednaOsoba: s.provadi || undefined,
        terminDatum: datum,
        stitek: stitekDatum(datum, dnes),
        naliehavost: naliehavostZDatumu(datum, dnes),
        maDokument: false,
        odkaz: `/klienti/${klientId}?tab=skoleni`,
      };
    });
}

export function prohlidkyNaPolozky(prohlidky: Prohlidka[], dnes: Date): PolozkaPlanu[] {
  const NAZEV: Record<string, string> = {
    PBOZP: 'Prověrka BOZP',
    PPP: 'Preventivní požární prohlídka',
  };
  return prohlidky
    .filter((p) => p.stav === 'aktivni')
    .map((p) => {
      const datum = terminNaDatum(p.dalsiMesic, p.dalsiRok);
      return {
        id: `prohlidka_${p.id}`,
        typ: 'prohlidka' as const,
        nazev: NAZEV[p.typ] ?? p.typ,
        meta: p.pracovisteNazev || undefined,
        zdroj: p.zdrojCislo ? `kontrola ${p.zdrojCislo}` : undefined,
        terminDatum: datum,
        stitek: stitekMesic(p.dalsiMesic, p.dalsiRok, dnes),
        naliehavost: naliehavostZDatumu(datum, dnes),
        maDokument: !!p.zdrojZaznamId,
        odkaz: p.zdrojZaznamId ? `/zaznamy/${p.zdrojZaznamId}` : undefined,
      };
    });
}

/** Otevřené závady ze záznamů daného klienta. */
export function nalezyNaPolozky(zaznamy: Zaznam[], dnes: Date): PolozkaPlanu[] {
  const out: PolozkaPlanu[] = [];
  for (const z of zaznamy) {
    if (z.stav === 'archivovany') continue;
    for (const zavada of z.zavady ?? []) {
      if (zavada.odstraneno) continue;
      const datum = zavada.terminOdstraneni ? new Date(zavada.terminOdstraneni) : undefined;
      out.push({
        id: `nalez_${z.id}_${zavada.id}`,
        typ: 'nalez',
        nazev: zavada.popis,
        meta: zavada.lokalizace || undefined,
        odpovednaOsoba: (zavada as any).odpovednaOsoba || undefined,
        zdroj: z.cisloKlientske || z.cislo
          ? `kontrola ${z.cisloKlientske ?? z.cislo}`
          : undefined,
        terminDatum: datum,
        stitek: stitekDatum(datum, dnes),
        naliehavost: naliehavostZDatumu(datum, dnes),
        maDokument: true,
        odkaz: `/zaznamy/${z.id}`,
      });
    }
  }
  return out;
}

/** Sjednotí a seřadí všechny zdroje. */
export function sestavCasovyPlan(vstup: {
  klientId: string;
  revize: RevizeKlienta[];
  skoleni: SkoleniKlienta[];
  prohlidky: Prohlidka[];
  zaznamy: Zaznam[];
  dnes?: Date;
}): PolozkaPlanu[] {
  const dnes = vstup.dnes ?? new Date();
  const vse = [
    ...revizeNaPolozky(vstup.revize, dnes, vstup.klientId),
    ...skoleniNaPolozky(vstup.skoleni, dnes, vstup.klientId),
    ...prohlidkyNaPolozky(vstup.prohlidky, dnes),
    ...nalezyNaPolozky(vstup.zaznamy, dnes),
  ];
  return vse.sort((a, b) => {
    const r = RANK[a.naliehavost] - RANK[b.naliehavost];
    if (r !== 0) return r;
    const ta = a.terminDatum?.getTime() ?? Infinity;
    const tb = b.terminDatum?.getTime() ?? Infinity;
    return ta - tb;
  });
}

export interface Metriky {
  do30dni: number;
  otevreneNalezy: number;
  poTerminu: number;
}

export function spoctiMetriky(polozky: PolozkaPlanu[]): Metriky {
  return {
    do30dni: polozky.filter((p) => p.naliehavost === 'blizi_se').length,
    otevreneNalezy: polozky.filter((p) => p.typ === 'nalez').length,
    poTerminu: polozky.filter((p) => p.naliehavost === 'po_terminu').length,
  };
}
