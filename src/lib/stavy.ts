export type Hodnoceni = 'V' | 'N' | 'D' | 'NA' | 'NK';

export interface StavDefinice {
  kod: Hodnoceni;
  popis: string;
  /** Třída stavové pásky (levý svislý pruh) pro karty a řádky. */
  paska: string;
  /** Barva textu / čísla nedostatku. */
  text: string;
  /** Barva odznaku (badge) – podklad + text. */
  odznak: string;
  /** Třídy tlačítka v checklistu (neaktivní + aktivní stav). */
  tlacitko: string;
}

export const STAVY: Record<Hodnoceni, StavDefinice> = {
  V: {
    kod: 'V',
    popis: 'Vyhovuje',
    paska: 'paska paska-V',
    text: 'txt-stav-V',
    odznak: 'odznak-stav-V',
    tlacitko: 'btn-stav btn-stav-V',
  },
  N: {
    kod: 'N',
    popis: 'Nevyhovuje',
    paska: 'paska paska-N',
    text: 'txt-stav-N',
    odznak: 'odznak-stav-N',
    tlacitko: 'btn-stav btn-stav-N',
  },
  D: {
    kod: 'D',
    popis: 'Doporučeno',
    paska: 'paska paska-D',
    text: 'txt-stav-D',
    odznak: 'odznak-stav-D',
    tlacitko: 'btn-stav btn-stav-D',
  },
  NA: {
    kod: 'NA',
    popis: 'Neaplikováno',
    paska: 'paska paska-NA',
    text: 'txt-stav-NA',
    odznak: 'odznak-stav-NA',
    tlacitko: 'btn-stav btn-stav-NA',
  },
  NK: {
    kod: 'NK',
    popis: 'Nekontrolováno',
    paska: 'paska paska-NK',
    text: 'txt-stav-NK',
    odznak: 'odznak-stav-NK',
    tlacitko: 'btn-stav btn-stav-NK',
  },
};

/** Pořadí tlačítek v checklistu. */
export const POradi_TLACITEK: Hodnoceni[] = ['V', 'N', 'NA', 'NK'];

export function stav(kod?: string): StavDefinice | undefined {
  if (!kod) return undefined;
  return STAVY[kod as Hodnoceni];
}

/** Třída pásky pro daný stav; prázdný řetězec, když stav není znám. */
export function paskaPro(kod?: string): string {
  return stav(kod)?.paska ?? '';
}
