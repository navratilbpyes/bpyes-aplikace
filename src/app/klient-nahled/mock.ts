import type { Termin, Nedostatek, Zaznam, Navsteva, Dotaz } from '@/types/dashboard';

// Prototyp běží na mock datech ve tvaru budoucích Firestore dokumentů.
// Nasazení na ostrá data = nahradit tento soubor čtením přes useData().

export const DNES = new Date('2026-07-22T09:00:00+02:00');
const DEN = 86400000;
const zaDni = (n: number) => new Date(DNES.getTime() + n * DEN).toISOString();
const KLIENT = 'klient_demo';

export const MOCK_TERMINY: Termin[] = [
  { id: 't1', klientId: KLIENT, typ: 'revize', nazev: 'Revize hromosvodu', terminIso: zaDni(-8), zdroj: 'protokol HR-2025/14', autor: 'ozo', odpovednaOsoba: 'Martin Navrátil', stav: 'aktivni' },
  { id: 't2', klientId: KLIENT, typ: 'revize', nazev: 'Revize elektro spotřebičů', terminIso: zaDni(9), periodicitaMesice: 24, zdroj: 'protokol EL-2024/07', autor: 'ozo', odpovednaOsoba: 'Martin Navrátil', stav: 'aktivni' },
  { id: 't3', klientId: KLIENT, typ: 'skoleni', nazev: 'Školení první pomoci', terminIso: zaDni(92), periodicitaMesice: 24, dodavatel: 'ozo', autor: 'ozo', odpovednaOsoba: 'Martin Navrátil', stav: 'aktivni' },
  { id: 't4', klientId: KLIENT, typ: 'skoleni', nazev: 'Školení řidičů referentů', terminIso: zaDni(11), dodavatel: 'jiny_dodavatel', autor: 'klient', odpovednaOsoba: 'Jana Nováková', stav: 'aktivni' },
  { id: 't5', klientId: KLIENT, typ: 'lekarska', nazev: 'Periodická lékařská prohlídka — sklad', terminIso: zaDni(45), autor: 'klient', odpovednaOsoba: 'Jana Nováková', stav: 'aktivni' },
];

export const MOCK_NEDOSTATKY: Record<string, Nedostatek[]> = {
  t1: [
    { id: 'n1', popis: 'Přerušený svod na severní straně objektu', stav: 'aktivni' },
    { id: 'n2', popis: 'Chybí zkušební svorka u jímací soustavy', stav: 'aktivni' },
  ],
};

export const MOCK_ZAZNAMY: Zaznam[] = [
  { id: 'z1', klientId: KLIENT, nazev: 'Chybí značení únikové cesty', zdroj: 'kontrola BOZP 3/2026', terminIso: zaDni(6), autor: 'ozo', odpovednaOsoba: 'Martin Navrátil', stav: 'aktivni', puvodZjisteni: 'ozo' },
  { id: 'z2', klientId: KLIENT, nazev: 'Nepřístupný hasicí přístroj v hale B', zdroj: 'kontrola BOZP 3/2026', terminIso: zaDni(20), autor: 'ozo', odpovednaOsoba: 'Petr Svoboda', stav: 'aktivni', puvodZjisteni: 'ozo' },
  { id: 'z3', klientId: KLIENT, nazev: 'Poškozený žebřík u regálu 12', zdroj: 'kontrola BOZP 3/2026', terminIso: zaDni(20), autor: 'ozo', odpovednaOsoba: 'Petr Svoboda', stav: 'aktivni', puvodZjisteni: 'ozo' },
];

export const MOCK_NAVSTEVY: Navsteva[] = [
  { id: 'v1', klientId: KLIENT, datumIso: zaDni(18), poznamka: 'Periodická prověrka pracoviště + školení první pomoci', stav: 'aktivni' },
];

export const MOCK_DOTAZY: Dotaz[] = [
  { id: 'd1', klientId: KLIENT, text: 'Platí revize hromosvodu i pro nově přistavěný sklad?', stav: 'nevyrizeno', autor: { kdo: 'Jana Nováková', kdyIso: zaDni(-4) }, vytvoreno: zaDni(-4) },
  { id: 'd2', klientId: KLIENT, text: 'Kdy nejpozději musíme mít proškolené nové brigádníky?', stav: 'vyrizeno', autor: { kdo: 'Petr Svoboda', kdyIso: zaDni(-15) }, vytvoreno: zaDni(-15) },
];
