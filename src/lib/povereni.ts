/**
 * AuditFlow — pověření: typy a výpočty.
 * Umístění: src/lib/povereni.ts
 *
 * Číselník `ciselnikPovereni` říká, jaké druhy pověření existují a jak dlouho platí
 * (platnostMesice = 0 → na neurčito). Pověření osoby je záznam v `klienti/{id}/udalosti`
 * s typem 'povereni' (temaId = ID druhu pověření, datum = od kdy, platnostDo = do kdy).
 * Položka číselníku „Školení a činnosti" s přepínačem „Vyžaduje pověření" odkazuje
 * na druh pověření přes `povereniId`.
 */

import type { StavZaznamu } from './skoleni';
import type { Udalost } from './udalosti';
import { pridejMesice } from './skoleni';

export interface CiselnikPovereni {
  id: string;
  nazev: string;
  /** platnost v měsících; 0 = na neurčito */
  platnostMesice: number;
  /** kdo pověřuje (statutární orgán, vedoucí, OZO…) — volný text */
  kdoVydava?: string | null;
  predpis?: string | null;
  poznamka?: string | null;
  stav: StavZaznamu;
}

/** Předvolby platnosti pro select. */
export const PLATNOSTI_POVERENI: { hodnota: number; popis: string }[] = [
  { hodnota: 0, popis: 'Na neurčito' },
  { hodnota: 12, popis: '1 rok' },
  { hodnota: 24, popis: '2 roky' },
  { hodnota: 36, popis: '3 roky' },
  { hodnota: 48, popis: '4 roky' },
  { hodnota: 60, popis: '5 let' },
];

export function popisPlatnosti(mesicu?: number | null): string {
  if (!mesicu) return 'na neurčito';
  if (mesicu % 12 === 0) {
    const r = mesicu / 12;
    return r === 1 ? '1 rok' : r < 5 ? `${r} roky` : `${r} let`;
  }
  return `${mesicu} měsíců`;
}

/** Nejnovější záznam pověření osoby k danému druhu. */
export function posledniPovereni(
  udalosti: Udalost[],
  osobaId: string,
  povereniId: string,
): Udalost | undefined {
  return udalosti
    .filter((u) => u.typ === 'povereni' && u.osobaId === osobaId && u.temaId === povereniId)
    .sort((a, b) => (b.datum ?? '').localeCompare(a.datum ?? ''))[0];
}

/**
 * Konec platnosti pověření: ruční datum má přednost, „na neurčito" platnost nehlídá,
 * jinak se počítá z platnosti druhu pověření. Vrací null = bez konce platnosti.
 */
export function konecPlatnostiPovereni(
  u: Udalost | undefined,
  def: CiselnikPovereni | undefined,
): string | null {
  if (!u) return null;
  if (u.naNeurcito) return null;
  if (u.platnostDo) return u.platnostDo;
  if (def && def.platnostMesice > 0 && u.datum) return pridejMesice(u.datum, def.platnostMesice);
  return null;
}

export type StavPovereni = 'ok' | 'blizi' | 'po' | 'chybi' | 'neurcito';

/** Stav pověření osoby k dnešku; `prahMesicu` = za jak dlouho dopředu upozorňovat. */
export function stavPovereni(
  u: Udalost | undefined,
  def: CiselnikPovereni | undefined,
  prahMesicu: number,
): { stav: StavPovereni; konec: string | null } {
  if (!u) return { stav: 'chybi', konec: null };
  const konec = konecPlatnostiPovereni(u, def);
  if (!konec) return { stav: 'neurcito', konec: null };
  const dnes = new Date().toISOString();
  const hranice = new Date();
  hranice.setMonth(hranice.getMonth() + prahMesicu);
  if (konec < dnes) return { stav: 'po', konec };
  if (konec < hranice.toISOString()) return { stav: 'blizi', konec };
  return { stav: 'ok', konec };
}
