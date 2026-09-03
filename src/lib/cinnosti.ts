/**
 * AuditFlow — činnosti a kategorie práce: typy a výpočty.
 * Umístění: src/lib/cinnosti.ts
 *
 * Činnost je rizikový profil osoby (svařování, práce ve výškách, jeřábník).
 * Přiřazuje se N:M — dva údržbáři mají stejnou pozici, ale různé činnosti.
 *
 * Z činnosti vyplývají tři věci:
 *   1. povinná školení (odkaz do ciselnikSkoleni),
 *   2. povinnost praktického zácviku,
 *   3. profesní riziko podle části II přílohy č. 1 vyhlášky č. 79/2013 Sb.
 *      — vynucuje vstupní i výstupní prohlídku i v kategorii 1
 *        a nese vlastní periodu prohlídky.
 *
 * OOPP zde vědomě NEJSOU. Ochranné prostředky se liší klient od klienta
 * (obsluha TNS v čisté hale nepotřebuje nic navíc), a proto žijí v matici
 * u konkrétního klienta, ne v globálním číselníku.
 */

import type { StavZaznamu } from './skoleni';

/** Kategorie práce podle zákona č. 258/2000 Sb. */
export type KodKategorie = '1' | '2' | '2R' | '3' | '4';

/** Položka číselníku činností (globální katalog). */
export interface CiselnikCinnost {
  id: string;
  nazev: string;
  /** volitelné zařazení pro filtrování, např. „Zdvihací" */
  oblast?: string;
  /** ID položek z `ciselnikSkoleni`, které z činnosti vyplývají */
  skoleniIds?: string[];
  /** vyžaduje praktický zácvik s mentorem (F002–F005) */
  zacvik?: boolean;
  /** profesní riziko dle části II přílohy č. 1 vyhlášky č. 79/2013 Sb. */
  profesniRiziko?: boolean;
  /** perioda prohlídky v měsících — jen má-li činnost profesní riziko */
  prohlidkaDo50?: number | null;
  prohlidkaNad50?: number | null;
  /** rozsah odborných vyšetření — text se přenáší do F006 */
  odbornaVysetreni?: string | null;
  poznamka?: string | null;
  stav: StavZaznamu;
}

/** Položka číselníku kategorií práce — jen periody prohlídek. */
export interface CiselnikKategorie {
  id: string;
  kod: KodKategorie;
  prohlidkaDo50: number;
  prohlidkaNad50: number;
  poznamka?: string | null;
}

/** Výchozí periody dle vyhlášky č. 79/2013 Sb. — zakládají se při prvním otevření. */
export const VYCHOZI_KATEGORIE: Omit<CiselnikKategorie, 'id'>[] = [
  { kod: '1', prohlidkaDo50: 72, prohlidkaNad50: 48 },
  { kod: '2', prohlidkaDo50: 48, prohlidkaNad50: 24 },
  { kod: '2R', prohlidkaDo50: 24, prohlidkaNad50: 24 },
  { kod: '3', prohlidkaDo50: 24, prohlidkaNad50: 24 },
  { kod: '4', prohlidkaDo50: 12, prohlidkaNad50: 12 },
];

/** Předvolby period prohlídek pro select. */
export const PERIODY_PROHLIDKY: { hodnota: number; popis: string }[] = [
  { hodnota: 12, popis: '1× ročně' },
  { hodnota: 24, popis: '1× za 2 roky' },
  { hodnota: 48, popis: '1× za 4 roky' },
  { hodnota: 72, popis: '1× za 6 let' },
];

/** Dosáhne osoba 50 let v den prohlídky? */
export function jeNad50(datumNarozeniIso: string, kDatuIso: string): boolean {
  const n = new Date(datumNarozeniIso);
  const k = new Date(kDatuIso);
  let vek = k.getFullYear() - n.getFullYear();
  const m = k.getMonth() - n.getMonth();
  if (m < 0 || (m === 0 && k.getDate() < n.getDate())) vek -= 1;
  return vek >= 50;
}

/**
 * Perioda prohlídky osoby = NEJKRATŠÍ ze všech jejích činností a z kategorie práce.
 * Údržbář lezoucí do výšek (4 roky) a svařující (2 roky) chodí po 2 letech.
 * Vrací měsíce, nebo undefined, není-li z čeho počítat.
 */
export function periodaProhlidky(
  kategorie: CiselnikKategorie | undefined,
  cinnosti: CiselnikCinnost[],
  nad50: boolean,
): number | undefined {
  const kandidati: number[] = [];
  if (kategorie) {
    kandidati.push(nad50 ? kategorie.prohlidkaNad50 : kategorie.prohlidkaDo50);
  }
  for (const c of cinnosti) {
    if (!c.profesniRiziko) continue;
    const p = nad50 ? c.prohlidkaNad50 : c.prohlidkaDo50;
    if (p) kandidati.push(p);
  }
  const platne = kandidati.filter((x) => x > 0);
  return platne.length > 0 ? Math.min(...platne) : undefined;
}

/** Má osoba alespoň jednu činnost s profesním rizikem? (vynucuje vstupní i výstupní prohlídku) */
export function maProfesniRiziko(cinnosti: CiselnikCinnost[]): boolean {
  return cinnosti.some((c) => c.profesniRiziko);
}

/** Souhrn profesních rizik pro předvyplnění formuláře F006. */
export function souhrnProfesnichRizik(cinnosti: CiselnikCinnost[]): string {
  return cinnosti.filter((c) => c.profesniRiziko).map((c) => c.nazev).join('; ');
}

/** Sloučený rozsah odborných vyšetření pro F006. */
export function souhrnVysetreni(cinnosti: CiselnikCinnost[]): string {
  return cinnosti
    .map((c) => c.odbornaVysetreni?.trim())
    .filter((t): t is string => !!t)
    .join('; ');
}

/** Formát periody prohlídky pro zobrazení. */
export function popisPeriodyProhlidky(mesicu?: number | null): string {
  if (!mesicu) return '—';
  if (mesicu === 12) return '1× ročně';
  if (mesicu % 12 === 0) return `1× za ${mesicu / 12} let`;
  return `1× za ${mesicu} měsíců`;
}
