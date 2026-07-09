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
    text: 'text-[hsl(var(--stav-vyhovuje))]',
    odznak: 'bg-[hsl(var(--stav-vyhovuje))]/10 text-[hsl(var(--stav-vyhovuje))]',
    tlacitko:
      'bg-[hsl(var(--stav-vyhovuje))]/10 text-[hsl(var(--stav-vyhovuje))] hover:bg-[hsl(var(--stav-vyhovuje))]/20 data-[state=active]:bg-[hsl(var(--stav-vyhovuje))] data-[state=active]:text-white',
  },
  N: {
    kod: 'N',
    popis: 'Nevyhovuje',
    paska: 'paska paska-N',
    text: 'text-[hsl(var(--stav-zavada))]',
    odznak: 'bg-[hsl(var(--stav-zavada))]/10 text-[hsl(var(--stav-zavada))]',
    tlacitko:
      'bg-[hsl(var(--stav-zavada))]/10 text-[hsl(var(--stav-zavada))] hover:bg-[hsl(var(--stav-zavada))]/20 data-[state=active]:bg-[hsl(var(--stav-zavada))] data-[state=active]:text-white',
  },
  D: {
    kod: 'D',
    popis: 'Doporučeno',
    paska: 'paska paska-D',
    text: 'text-[hsl(var(--stav-doporuceni))]',
    odznak: 'bg-[hsl(var(--stav-doporuceni))]/10 text-[hsl(var(--stav-doporuceni))]',
    tlacitko:
      'bg-[hsl(var(--stav-doporuceni))]/10 text-[hsl(var(--stav-doporuceni))] hover:bg-[hsl(var(--stav-doporuceni))]/20 data-[state=active]:bg-[hsl(var(--stav-doporuceni))] data-[state=active]:text-white',
  },
  NA: {
    kod: 'NA',
    popis: 'Neaplikováno',
    paska: 'paska paska-NA',
    text: 'text-[hsl(var(--stav-neutral))]',
    odznak: 'bg-[hsl(var(--stav-neutral))]/10 text-[hsl(var(--stav-neutral))]',
    tlacitko:
      'bg-[hsl(var(--stav-neutral))]/10 text-[hsl(var(--stav-neutral))] hover:bg-[hsl(var(--stav-neutral))]/20 data-[state=active]:bg-[hsl(var(--stav-neutral))] data-[state=active]:text-white',
  },
  NK: {
    kod: 'NK',
    popis: 'Nekontrolováno',
    paska: 'paska paska-NK',
    text: 'text-[hsl(var(--stav-neutral))]',
    odznak: 'bg-[hsl(var(--stav-neutral))]/10 text-[hsl(var(--stav-neutral))]',
    tlacitko:
      'bg-[hsl(var(--stav-neutral))]/10 text-[hsl(var(--stav-neutral))] hover:bg-[hsl(var(--stav-neutral))]/20 data-[state=active]:bg-[hsl(var(--stav-neutral))] data-[state=active]:text-white',
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
