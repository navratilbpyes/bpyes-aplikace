
export interface Klient {
  id: string;
  nazev: string;
  ico: string;
  dic?: string;
  sidlo: string;
  mesto: string;
  psc: string;
  kontaktOsoba: string;
  email: string;
  telefon: string;
  poznamka?: string;
  pracoviste: Pracoviste[];
  odpovedneOsoby: OdpovednaOsoba[];
  createdAt: string;
}

export interface Pracoviste {
  id: string;
  nazev: string;
  adresa: string;
  mesto: string;
  kontaktOsoba?: string;
  prostory: string[];
}

export interface OdpovednaOsoba {
  id: string;
  jmeno: string;
  prijmeni: string;
  pozice: string;
  email?: string;
  telefon?: string;
}

export interface Zaznam {
  id: string;
  cislo: string;
  klientId: string;
  pracovisteId: string;
  typKontroly: 'BOZPaPO' | 'PPP' | 'PBOZP';
  datum: string;
  ucastnici: { jmeno: string; pozice: string }[];
  kontrolniBody: KontrolniBod[];
  zavady: Zavada[];
  stav: 'otevreny' | 'uzavreny' | 'archivovany';
  createdAt: string;
  updatedAt: string;
}

export interface KontrolniBod {
  bod: number;
  hodnoceni: 'V' | 'N' | 'NA' | 'NK' | null;
  textHodnoceni: string;
  poznamka?: string;
}

export interface Zavada {
  id: string;
  cislo: number;
  bodKontroly?: number;
  popis: string;
  navrhOpatreni: string;
  terminOdstraneni: string;
  odpovednaOsoba: string;
  stavOdstraneni: 'otevrena' | 'v_reseni' | 'odstranena';
  zaznamOdstraneni?: string;
}

export interface Nastaveni {
  nazev: string;
  ico: string;
  adresa: string;
  auditor: string;
  certifikace: string[];
}
