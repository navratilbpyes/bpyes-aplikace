
'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Klient, Zaznam, Nastaveni } from '@/app/lib/types';
import { useToast } from '@/hooks/use-toast';

interface DataContextType {
  klienti: Klient[];
  zaznamy: Zaznam[];
  nastaveni: Nastaveni;
  setKlienti: React.Dispatch<React.SetStateAction<Klient[]>>;
  setZaznamy: React.Dispatch<React.SetStateAction<Zaznam[]>>;
  setNastaveni: React.Dispatch<React.SetStateAction<Nastaveni>>;
  isLoading: boolean;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

const INITIAL_NASTAVENI: Nastaveni = {
  nazev: 'BPyes s.r.o.',
  ico: '12345678',
  adresa: 'Dlouhá 123, 110 00 Praha 1',
  auditor: 'Ing. Petr Bezpečný',
  certifikace: ['ROVS/3465/PREV/2026', 'Z-TP-20/2018']
};

const SAMPLE_KLIENTI: Klient[] = [
  {
    id: 'k1',
    nazev: 'Kovárna Novák s.r.o.',
    ico: '12345678',
    sidlo: 'Brněnská 45',
    mesto: 'Brno',
    psc: '602 00',
    kontaktOsoba: 'Jan Novák',
    email: 'novak@kovarnanovak.cz',
    telefon: '+420 777 123 456',
    pracoviste: [
      {
        id: 'p1',
        nazev: 'Provozovna Brno-střed',
        adresa: 'Brněnská 45',
        mesto: 'Brno',
        kontaktOsoba: 'Jan Novák',
        prostory: ['Dílna', 'Sklad', 'Kancelář']
      }
    ],
    odpovedneOsoby: [
      {
        id: 'o1',
        jmeno: 'Jan',
        prijmeni: 'Novák',
        pozice: 'vedoucí výroby',
        email: 'novak@kovarnanovak.cz'
      }
    ],
    createdAt: new Date().toISOString()
  },
  {
    id: 'k2',
    nazev: 'Sklady ABC a.s.',
    ico: '87654321',
    sidlo: 'Průmyslová 10',
    mesto: 'Olomouc',
    psc: '779 00',
    kontaktOsoba: 'Eva Procházková',
    email: 'prochazkova@skladyabc.cz',
    telefon: '+420 721 987 654',
    pracoviste: [
      {
        id: 'p2',
        nazev: 'Sklad Olomouc',
        adresa: 'Průmyslová 10',
        mesto: 'Olomouc',
        kontaktOsoba: 'Eva Procházková',
        prostory: ['Sklad A', 'Sklad B', 'Expedice']
      }
    ],
    odpovedneOsoby: [
      {
        id: 'o2',
        jmeno: 'Eva',
        prijmeni: 'Procházková',
        pozice: 'vedoucí skladu',
        email: 'prochazkova@skladyabc.cz'
      }
    ],
    createdAt: new Date().toISOString()
  }
];

const SAMPLE_ZAZNAMY: Zaznam[] = [
  {
    id: 'z1',
    cislo: '2026/001/BOZPaPO',
    klientId: 'k1',
    pracovisteId: 'p1',
    typKontroly: 'BOZPaPO',
    datum: new Date().toISOString(),
    ucastnici: [{ jmeno: 'Jan Novák', pozice: 'vedoucí výroby' }],
    kontrolniBody: [],
    zavady: [
      {
        id: 'zv1',
        cislo: 1,
        popis: 'Chybějící označení únikových cest v hale B',
        navrhOpatreni: 'Doplnit fotoluminiscenční značení',
        terminOdstraneni: '2026-03-15',
        odpovednaOsoba: 'Jan Novák',
        stavOdstraneni: 'otevrena'
      },
      {
        id: 'zv2',
        cislo: 2,
        popis: 'Prošlá lhůta revize hasicího přístroje č. 4',
        navrhOpatreni: 'Zajistit novou revizi',
        terminOdstraneni: '2026-02-28',
        odpovednaOsoba: 'Jan Novák',
        stavOdstraneni: 'v_reseni'
      }
    ],
    stav: 'otevreny',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [klienti, setKlienti] = useState<Klient[]>([]);
  const [zaznamy, setZaznamy] = useState<Zaznam[]>([]);
  const [nastaveni, setNastaveni] = useState<Nastaveni>(INITIAL_NASTAVENI);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const storedKlienti = localStorage.getItem('bpyes_klienti');
    const storedZaznamy = localStorage.getItem('bpyes_zaznamy');
    const storedNastaveni = localStorage.getItem('bpyes_nastaveni');

    if (storedKlienti) setKlienti(JSON.parse(storedKlienti));
    else setKlienti(SAMPLE_KLIENTI);

    if (storedZaznamy) setZaznamy(JSON.parse(storedZaznamy));
    else setZaznamy(SAMPLE_ZAZNAMY);

    if (storedNastaveni) setNastaveni(JSON.parse(storedNastaveni));

    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (isLoading) return;
    
    const interval = setInterval(() => {
      localStorage.setItem('bpyes_klienti', JSON.stringify(klienti));
      localStorage.setItem('bpyes_zaznamy', JSON.stringify(zaznamy));
      localStorage.setItem('bpyes_nastaveni', JSON.stringify(nastaveni));
      console.log('Data auto-saved');
    }, 30000);

    return () => clearInterval(interval);
  }, [klienti, zaznamy, nastaveni, isLoading]);

  return (
    <DataContext.Provider value={{ klienti, zaznamy, nastaveni, setKlienti, setZaznamy, setNastaveni, isLoading }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used within DataProvider');
  return context;
}
