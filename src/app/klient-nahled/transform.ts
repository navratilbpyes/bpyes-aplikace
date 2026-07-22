import type {
  Termin, Nedostatek, Zaznam, Dotaz,
  PolozkaCasovehoPlanu, Metriky, MetrikyBasic, Naliehavost,
} from '@/types/dashboard';

const DEN = 86400000;

export const dniDo = (iso: string, dnes: Date): number =>
  Math.round((new Date(iso).getTime() - dnes.getTime()) / DEN);

export const naliehavostZDni = (d: number): Naliehavost =>
  d < 0 ? 'po_terminu' : d <= 14 ? 'blizi_se' : 'ok';

export const sklonDny = (n: number): string =>
  n === 1 ? 'den' : n >= 2 && n <= 4 ? 'dny' : 'dní';
export const sklonMesice = (n: number): string =>
  n === 1 ? 'měsíc' : n >= 2 && n <= 4 ? 'měsíce' : 'měsíců';
export const sklonNed = (n: number): string =>
  n === 1 ? 'nedostatek' : n >= 2 && n <= 4 ? 'nedostatky' : 'nedostatků';

export function stitekTerminu(d: number): string {
  if (d < 0) return `po termínu · ${Math.abs(d)} ${sklonDny(Math.abs(d))}`;
  if (d === 0) return 'dnes';
  if (d <= 21) return `do ${d} ${sklonDny(d)}`;
  const m = Math.round(d / 30);
  return `za ${m} ${sklonMesice(m)}`;
}

const RANK: Record<Naliehavost, number> = { po_terminu: 0, blizi_se: 1, ok: 2 };

export function sestavCasovyPlan(
  terminy: Termin[],
  nedostatky: Record<string, Nedostatek[]>,
  zaznamy: Zaznam[],
  dnes: Date,
): PolozkaCasovehoPlanu[] {
  const out: PolozkaCasovehoPlanu[] = [];

  for (const t of terminy) {
    if (t.stav !== 'aktivni') continue;
    const d = dniDo(t.terminIso, dnes);
    const pocet = (nedostatky[t.id] ?? []).filter((n) => n.stav === 'aktivni').length;
    const meta: string[] = [];
    if (t.typ === 'revize' && pocet > 0) meta.push(`${pocet} ${sklonNed(pocet)}`);
    if (t.typ === 'skoleni') meta.push(t.dodavatel === 'ozo' ? 'provádí OZO' : 'jiný dodavatel');
    meta.push(t.autor === 'ozo' ? 'zadal OZO' : 'zadal klient');
    out.push({
      id: t.id,
      typ: t.typ === 'skoleni' ? 'skoleni' : 'revize',
      nazev: t.nazev,
      meta: meta.join(' · '),
      zdroj: t.zdroj ?? (t.periodicitaMesice ? `periodicita ${t.periodicitaMesice} měsíců` : undefined),
      autor: t.autor,
      odpovednaOsoba: t.odpovednaOsoba,
      terminIso: t.terminIso,
      naliehavost: naliehavostZDni(d),
      stitek: stitekTerminu(d),
    });
  }

  for (const z of zaznamy) {
    if (z.stav !== 'aktivni' || !z.terminIso) continue;
    const d = dniDo(z.terminIso, dnes);
    out.push({
      id: z.id,
      typ: 'nalez',
      nazev: z.nazev,
      meta: z.autor === 'ozo' ? 'zadal OZO' : 'zadal klient',
      zdroj: z.zdroj,
      autor: z.autor,
      odpovednaOsoba: z.odpovednaOsoba,
      terminIso: z.terminIso,
      naliehavost: naliehavostZDni(d),
      stitek: stitekTerminu(d),
    });
  }

  return out.sort((a, b) => {
    const r = RANK[a.naliehavost] - RANK[b.naliehavost];
    if (r !== 0) return r;
    const ta = a.terminIso ? new Date(a.terminIso).getTime() : Infinity;
    const tb = b.terminIso ? new Date(b.terminIso).getTime() : Infinity;
    return ta - tb;
  });
}

export function spoctiMetriky(
  terminy: Termin[],
  zaznamy: Zaznam[],
  dotazy: Dotaz[],
  dnes: Date,
): Metriky {
  const at = terminy.filter((t) => t.stav === 'aktivni');
  const an = zaznamy.filter((z) => z.stav === 'aktivni');
  const isoAll = [
    ...at.map((t) => t.terminIso),
    ...(an.map((z) => z.terminIso).filter(Boolean) as string[]),
  ];
  return {
    do14dni: isoAll.filter((i) => { const d = dniDo(i, dnes); return d >= 0 && d <= 14; }).length,
    otevreneNalezy: an.length,
    poTerminu: isoAll.filter((i) => dniDo(i, dnes) < 0).length,
    nevyrizeneDotazy: dotazy.filter((d) => d.stav === 'nevyrizeno').length,
  };
}

export function spoctiMetrikyBasic(zaznamy: Zaznam[], dotazy: Dotaz[]): MetrikyBasic {
  const an = zaznamy.filter((z) => z.stav === 'aktivni');
  return {
    otevreneNalezy: an.length,
    nevyrizeneDotazy: dotazy.filter((d) => d.stav === 'nevyrizeno').length,
  };
}

export function tonZMetrik(m: Metriky): 'ok' | 'soon' | 'critical' {
  if (m.poTerminu > 0) return 'critical';
  if (m.do14dni > 0 || m.otevreneNalezy > 0) return 'soon';
  return 'ok';
}

export function tonBasic(m: MetrikyBasic): 'ok' | 'soon' {
  return m.otevreneNalezy > 0 ? 'soon' : 'ok';
}

export function seznamOdpovednychOsob(polozky: PolozkaCasovehoPlanu[]): string[] {
  return Array.from(
    new Set(polozky.map((p) => p.odpovednaOsoba).filter(Boolean) as string[]),
  ).sort();
}
