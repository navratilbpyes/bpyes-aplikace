// AuditFlow — typy klientského dashboardu (prototyp, izolovaná routa)

export type Stav = 'aktivni' | 'splneno' | 'smazano';
export type Autor = 'ozo' | 'klient';
export type Naliehavost = 'po_terminu' | 'blizi_se' | 'ok';
export type IsoDatum = string;

export interface Zapis {
  kdo: string;
  kdyIso: IsoDatum;
}

export type TypTerminu = 'revize' | 'skoleni' | 'lekarska' | 'prohlidka' | 'ostatni';
export type DodavatelSkoleni = 'ozo' | 'jiny_dodavatel';

export interface Termin {
  id: string;
  klientId: string;
  typ: TypTerminu;
  nazev: string;
  terminIso: IsoDatum;
  periodicitaMesice?: number;
  zdroj?: string;
  autor: Autor;
  odpovednaOsoba?: string;
  dodavatel?: DodavatelSkoleni;
  stav: Stav;
}

export interface Nedostatek {
  id: string;
  popis: string;
  stav: Stav;
  odstranenoIso?: IsoDatum;
}

export interface Zaznam {
  id: string;
  klientId: string;
  nazev: string;
  zdroj?: string;
  terminIso?: IsoDatum;
  autor: Autor;
  odpovednaOsoba?: string;
  stav: Stav;
  puvodZjisteni?: 'ozo' | 'klient';
}

export interface Navsteva {
  id: string;
  klientId: string;
  datumIso: IsoDatum;
  poznamka?: string;
  stav: Stav;
}

export type StavDotazu = 'nevyrizeno' | 'vyrizeno';

export interface Dotaz {
  id: string;
  klientId: string;
  text: string;
  stav: StavDotazu;
  autor: Zapis;
  vytvoreno: IsoDatum;
}

// úroveň klientského přístupu
export type UrovenKlienta = 'full' | 'basic';

// view-modely
export type TypPolozky = 'revize' | 'skoleni' | 'nalez';

export interface PolozkaCasovehoPlanu {
  id: string;
  typ: TypPolozky;
  nazev: string;
  meta?: string;
  zdroj?: string;
  autor: Autor;
  odpovednaOsoba?: string;
  terminIso?: IsoDatum;
  naliehavost: Naliehavost;
  stitek: string;
}

export interface Metriky {
  do14dni: number;
  otevreneNalezy: number;
  poTerminu: number;
  nevyrizeneDotazy: number;
}

export interface MetrikyBasic {
  otevreneNalezy: number;
  nevyrizeneDotazy: number;
}
