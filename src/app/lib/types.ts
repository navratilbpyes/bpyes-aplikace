export interface Klient {
  id: string;
  nazev: string;
  ico: string;
  /** Ulice a číslo popisné. Doplňováno z ARES. */
  sidlo?: string;
  /** Poštovní směrovací číslo. Doplňováno z ARES. */
  psc?: string;
  mesto: string;
  pracoviste: Pracoviste[];
  /** Pozice odpovědných osob (v UI „pozice“). */
  pozice?: Pozice[];
  kontakty?: Kontakt[];
  createdAt?: string;
}

export interface Pracoviste {
  id: string;
  nazev: string;
  adresa: string;
  mesto?: string;
  prostory?: string[];
}

export interface Pozice {
  id: string;
  nazev: string;
  /** Pevná pozice, kterou nelze přejmenovat ani odebrat. */
  isFixed?: boolean;
}

export interface Kontakt {
  id: string;
  jmeno: string;
  funkce: string;
  email?: string;
  telefon?: string;
  /** Hlavní kontakt klienta. Označených může být více (např. dva jednatelé). */
  hlavni?: boolean;
}

/**
 * Snímek klienta pořízený při vytvoření protokolu.
 * Protokol je dokument k datu – pozdější změna údajů klienta
 * nesmí zpětně měnit už vydaný protokol.
 */
export interface KlientSnapshot {
  nazev: string;
  ico: string;
  sidlo?: string;
  psc?: string;
  mesto: string;
  pracoviste: { id: string; nazev: string; adresa: string }[];
}

export interface Zaznam {
  id: string;
  cislo: string;
  cisloKlientske?: string;
  revize?: number;
  klientId: string;
  /** Název klienta v době kontroly (pro orientaci a řazení). */
  klientNazev?: string;
  klientSnapshot?: KlientSnapshot;
  pracovisteIds: string[];
  typKontroly: 'BOZPaPO' | 'PPP' | 'PBOZP';
  datum: string;
  ucastnici?: { jmeno: string; pozice: string }[];
  kontrolniBody: KontrolniBod[];
  zavady: Zavada[];
  stav: 'otevreny' | 'uzavreny' | 'archivovany';
  createdAt: string;
  updatedAt: string;
}

export interface KontrolniBod {
  /** ID kontrolního bodu. Řetězec, protože zdrojová data jsou textová. */
  bod: string;
  hodnoceni: 'V' | 'N' | 'D' | 'NA' | 'NK' | null;
  textHodnoceni: string;
  sekce?: string;
  otazka?: string;
  poznamka?: string;
  navrhOpatreni?: string;
  lokalizace?: string;
  terminOdstraneni?: string;
  odpovednaOsoba?: string;
  foto?: string[];
  /** Zobrazit formulář doporučení u tohoto bodu. */
  showDoporuceni?: boolean;
}

export interface Zavada {
  id: string;
  cislo: number;
  bodKontroly?: string;
  sekce?: string;
  popis: string;
  navrhOpatreni: string;
  terminOdstraneni: string;
  odpovednaOsoba: string;
  lokalizace?: string;
  zavaznost?: string;
  odstraneno?: boolean;
  datumOdstraneni?: string;
  foto?: string[];
}

export interface AuditorConfig {
  nazev: string;
  ico: string;
  adresa: string;
  auditor: string;
  email?: string;
  telefon?: string;
  certifikace?: { nazev: string; cislo?: string }[];
  razitkoBase64?: string;
  podpisBase64?: string;
}
