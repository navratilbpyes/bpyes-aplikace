'use client';

/**
 * AuditFlow — jednorázový import číselníku školení z „Lhůtníku školení BOZP a PO 2026".
 * Umístění: src/app/ciselniky/import-skoleni/page.tsx
 *
 * Běží pod přihlášeným ADMIN účtem (client SDK). Zápis do `ciselnikSkoleni`
 * chrání Firestore Rules (write = admin). Idempotentní: deterministické ID + merge.
 *
 * Zúženo oproti lhůtníku: vynechány položky, které jsou součástí školení BOZP/PO
 * (kategorizace, značky, ruční manipulace, zobrazovací jednotky), jednorázové
 * události bez periody (vstupní, mimořádné, seznámení při zařazení) a osvědčení
 * externích odborníků (revizní technici, koordinátor, OZO). Zůstávají periodická
 * školení a doklady, které drží zaměstnanec klienta.
 *
 * Po naplnění lze stránku smazat.
 */

import { useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db, useData } from '@/components/data-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, CheckCircle2, AlertTriangle, GraduationCap } from 'lucide-react';

/** Kdo lhůtu určuje — 'predpis' nelze prodloužit, 'zamestnavatel' je doporučení. */
type ZdrojLhuty = 'predpis' | 'zamestnavatel';

interface PolozkaSkoleni {
  id: string;
  /** ID řádku v lhůtníku (A1, C3…) — pro dohledání ve zdrojovém dokumentu */
  kod: string;
  oblast: string;
  nazev: string;
  periodaMesice: number;
  lhutaText: string;
  provadi: string;
  predpis: string;
  zdrojLhuty: ZdrojLhuty;
  /** mapování na řádek požární knihy (POZARNI_RADKY) */
  pozarniRadek?: string | null;
  /** doklad s vlastní platností — hlídá se konec platnosti, ne datum školení */
  doklad?: boolean;
  poznamka?: string;
}

const LHUTNIK: PolozkaSkoleni[] = [
  // A — obecná BOZP
  { id: 'a2-bozp-vedouci', kod: 'A2', oblast: 'BOZP', nazev: 'Opakované školení BOZP vedoucích zaměstnanců', periodaMesice: 36, lhutaText: '1x za 3 roky', provadi: 'OZO v prevenci rizik', predpis: '§ 103 odst. 2 a 3 zákoníku práce', zdrojLhuty: 'zamestnavatel' },
  { id: 'a3-bozp-zamestnanci', kod: 'A3', oblast: 'BOZP', nazev: 'Opakované školení BOZP zaměstnanců', periodaMesice: 24, lhutaText: '1x za 2 roky; u rizikových prací 1x ročně', provadi: 'vedoucí zaměstnanec nebo OZO v prevenci rizik', predpis: '§ 103 odst. 2 a 3 zákoníku práce', zdrojLhuty: 'zamestnavatel', poznamka: 'Zahrnuje seznámení s riziky, kategorizací, značkami, ruční manipulací a prací se zobrazovací jednotkou.' },

  // B — požární ochrana
  { id: 'b1-po-vedouci', kod: 'B1', oblast: 'PO', nazev: 'Školení vedoucích zaměstnanců o požární ochraně', periodaMesice: 36, lhutaText: '1x za 3 roky', provadi: 'technik PO nebo OZO v PO', predpis: '§ 16 zákona č. 133/1985 Sb.; § 23 odst. 4 vyhlášky č. 246/2001 Sb.', zdrojLhuty: 'predpis', pozarniRadek: 'skoleni-vedouci' },
  { id: 'b2-po-zamestnanci', kod: 'B2', oblast: 'PO', nazev: 'Školení zaměstnanců o požární ochraně', periodaMesice: 24, lhutaText: '1x za 2 roky', provadi: 'proškolený vedoucí zaměstnanec, technik PO nebo OZO v PO', predpis: '§ 16 zákona č. 133/1985 Sb.; § 23 odst. 3 vyhlášky č. 246/2001 Sb.', zdrojLhuty: 'predpis', pozarniRadek: 'skoleni-zamestnanci' },
  { id: 'b3-po-snizeny-provoz', kod: 'B3', oblast: 'PO', nazev: 'Školení osob pověřených PO v době sníženého provozu a v mimopracovní době', periodaMesice: 12, lhutaText: '1x ročně', provadi: 'technik PO nebo OZO v PO', predpis: '§ 23 odst. 5 vyhlášky č. 246/2001 Sb.', zdrojLhuty: 'predpis' },
  { id: 'b4-po-hlidka', kod: 'B4', oblast: 'PO', nazev: 'Odborná příprava členů preventivní požární hlídky', periodaMesice: 12, lhutaText: '1x ročně', provadi: 'technik PO nebo OZO v PO', predpis: '§ 16 odst. 2 zákona č. 133/1985 Sb.; § 24 vyhlášky č. 246/2001 Sb.', zdrojLhuty: 'predpis', pozarniRadek: 'priprava-hlidky' },
  { id: 'b5-po-preventista', kod: 'B5', oblast: 'PO', nazev: 'Odborná příprava preventisty požární ochrany', periodaMesice: 12, lhutaText: '1x ročně', provadi: 'technik PO nebo OZO v PO', predpis: '§ 16 odst. 2 zákona č. 133/1985 Sb.; § 25 vyhlášky č. 246/2001 Sb.', zdrojLhuty: 'predpis', pozarniRadek: 'priprava-preventiste' },

  // C — doprava a mobilní technika
  { id: 'c1-ridici-referenti', kod: 'C1', oblast: 'Doprava', nazev: 'Školení řidičů referentů', periodaMesice: 12, lhutaText: '1x ročně, nejméně 1x za 2 roky', provadi: 'OZO v prevenci rizik nebo vedoucí zaměstnanec', predpis: '§ 103 odst. 2 a 3 zákoníku práce; zákon č. 361/2000 Sb.', zdrojLhuty: 'zamestnavatel' },
  { id: 'c2-profesni-zpusobilost-ridicu', kod: 'C2', oblast: 'Doprava', nazev: 'Zdokonalování odborné způsobilosti řidičů (profesní průkaz)', periodaMesice: 12, lhutaText: 'roční kurz 7 hodin, celkem 35 hodin za 5 let', provadi: 'akreditované školicí středisko', predpis: '§ 46 až § 48 zákona č. 247/2000 Sb.', zdrojLhuty: 'predpis', doklad: true },
  { id: 'c3-obsluha-voziku', kod: 'C3', oblast: 'Doprava', nazev: 'Školení a přezkoušení obsluhy manipulačních vozíků', periodaMesice: 12, lhutaText: '1x ročně', provadi: 'instruktor manipulační techniky nebo akreditovaná organizace', predpis: '§ 103 ZP; NV č. 378/2001 Sb.; ČSN EN ISO 3691', zdrojLhuty: 'zamestnavatel' },
  { id: 'c4-obsluha-stavebnich-stroju', kod: 'C4', oblast: 'Doprava', nazev: 'Školení a přezkoušení obsluhy stavebních a zemních strojů', periodaMesice: 24, lhutaText: '1x za 2 roky', provadi: 'instruktor nebo akreditovaná organizace', predpis: 'NV č. 378/2001 Sb. a č. 591/2006 Sb.', zdrojLhuty: 'zamestnavatel' },
  { id: 'c5-adr-ridici', kod: 'C5', oblast: 'Doprava', nazev: 'Školení řidičů přepravujících nebezpečné věci (ADR)', periodaMesice: 60, lhutaText: 'osvědčení platí 5 let', provadi: 'akreditované školicí středisko', predpis: 'Dohoda ADR, kapitola 8.2; zákon č. 111/1994 Sb.', zdrojLhuty: 'predpis', doklad: true },
  { id: 'c6-adr-ostatni-osoby', kod: 'C6', oblast: 'Doprava', nazev: 'Školení osob podílejících se na přepravě nebezpečných věcí (ADR 1.3)', periodaMesice: 24, lhutaText: '1x za 2 roky', provadi: 'bezpečnostní poradce ADR', predpis: 'Dohoda ADR, oddíl 1.3', zdrojLhuty: 'zamestnavatel' },

  // D — OOPP
  { id: 'd1-oopp', kod: 'D1', oblast: 'OOPP', nazev: 'Školení o používání OOPP a mycích prostředků', periodaMesice: 24, lhutaText: 'při přidělení a při změně, dále 1x za 2 roky', provadi: 'vedoucí zaměstnanec nebo OZO v prevenci rizik', predpis: '§ 104 zákoníku práce; NV č. 390/2021 Sb.', zdrojLhuty: 'zamestnavatel' },
  { id: 'd2-oopp-proti-padu', kod: 'D2', oblast: 'OOPP', nazev: 'Školení o používání OOPP proti pádu z výšky', periodaMesice: 12, lhutaText: '1x ročně, není-li v návodu jinak', provadi: 'osoba pověřená výrobcem nebo dovozcem', predpis: 'NV č. 390/2021 Sb. a č. 362/2005 Sb.; návod výrobce', zdrojLhuty: 'predpis' },

  // E — elektro
  { id: 'e1-elektro-rocni-skoleni', kod: 'E1', oblast: 'Elektro', nazev: 'Školení o rizicích elektrických zařízení a první pomoci při úrazu el. proudem', periodaMesice: 12, lhutaText: '1x ročně; dle vnitřního předpisu nejdéle 1x za 3 roky', provadi: 'osoba znalá nebo OZO v prevenci rizik', predpis: '§ 3 odst. 4 NV č. 194/2022 Sb.', zdrojLhuty: 'predpis' },
  { id: 'e2-osoba-poucena', kod: 'E2', oblast: 'Elektro', nazev: 'Osoba poučená — poučení a ověření znalostí', periodaMesice: 36, lhutaText: 'nejdéle 1x za 3 roky', provadi: 'osoba znalá (elektrotechnik nebo vedoucí elektrotechnik)', predpis: '§ 4 NV č. 194/2022 Sb.; zákon č. 250/2021 Sb.', zdrojLhuty: 'predpis' },
  { id: 'e3-elektrotechnik', kod: 'E3', oblast: 'Elektro', nazev: 'Elektrotechnik — doklad o odborné způsobilosti', periodaMesice: 36, lhutaText: 'doklad platí 3 roky', provadi: 'vedoucí elektrotechnik nebo revizní technik', predpis: '§ 6 NV č. 194/2022 Sb.', zdrojLhuty: 'predpis', doklad: true },
  { id: 'e4-vedouci-elektrotechnik', kod: 'E4', oblast: 'Elektro', nazev: 'Vedoucí elektrotechnik — doklad o odborné způsobilosti', periodaMesice: 36, lhutaText: 'doklad platí 3 roky', provadi: 'revizní technik', predpis: '§ 7 NV č. 194/2022 Sb.', zdrojLhuty: 'predpis', doklad: true },

  // F — tlaková zařízení
  { id: 'f1-obsluha-tns', kod: 'F1', oblast: 'Tlak', nazev: 'Školení a ověření znalostí obsluhy tlakových nádob stabilních', periodaMesice: 36, lhutaText: 'nejméně 1x za 3 roky', provadi: 'revizní technik tlakových zařízení', predpis: 'zákon č. 250/2021 Sb.; NV č. 192/2022 Sb.; ČSN 69 0012', zdrojLhuty: 'predpis' },
  { id: 'f2-tlakove-lahve', kod: 'F2', oblast: 'Tlak', nazev: 'Školení osob nakládajících s tlakovými lahvemi na technické plyny', periodaMesice: 36, lhutaText: '1x za 3 roky', provadi: 'OZO v prevenci rizik nebo revizní technik tlakových zařízení', predpis: '§ 103 ZP; ČSN 07 8304', zdrojLhuty: 'zamestnavatel' },
  { id: 'f3-topic', kod: 'F3', oblast: 'Tlak', nazev: 'Zkouška topiče nízkotlakých kotelen (od 50 kW)', periodaMesice: 60, lhutaText: 'osvědčení platí 5 let', provadi: 'zkušební komise s revizním technikem kotlů', predpis: '§ 14 vyhlášky č. 91/1993 Sb.', zdrojLhuty: 'predpis', doklad: true },
  { id: 'f4-obsluha-kotlu-do-50kw', kod: 'F4', oblast: 'Tlak', nazev: 'Poučení obsluhy kotlů o výkonu nižším než 50 kW', periodaMesice: 12, lhutaText: '1x ročně', provadi: 'provozovatel nebo revizní technik kotlů', predpis: '§ 14 vyhlášky č. 91/1993 Sb.; § 103 ZP', zdrojLhuty: 'zamestnavatel' },

  // G — plyn
  { id: 'g1-obsluha-plynovych-zarizeni', kod: 'G1', oblast: 'Plyn', nazev: 'Školení a přezkoušení obsluhy vyhrazených plynových zařízení', periodaMesice: 36, lhutaText: '1x za 3 roky', provadi: 'revizní technik plynových zařízení', predpis: 'zákon č. 250/2021 Sb.; NV č. 191/2022 Sb.; § 103 ZP', zdrojLhuty: 'zamestnavatel' },

  // H — zdvihací zařízení
  { id: 'h1-jerabnici', kod: 'H1', oblast: 'Zdvihací', nazev: 'Školení a přezkoušení jeřábníků', periodaMesice: 12, lhutaText: '1x ročně', provadi: 'revizní technik ZZ nebo osoba pověřená systémem bezpečné práce', predpis: 'zákon č. 250/2021 Sb.; NV č. 193/2022 Sb.; ČSN ISO 12480-1', zdrojLhuty: 'zamestnavatel' },
  { id: 'h2-vazaci', kod: 'H2', oblast: 'Zdvihací', nazev: 'Školení a přezkoušení vazačů břemen', periodaMesice: 12, lhutaText: '1x ročně', provadi: 'revizní technik ZZ nebo pověřená osoba', predpis: 'ČSN ISO 12480-1; § 103 ZP', zdrojLhuty: 'zamestnavatel' },
  { id: 'h3-signaliste', kod: 'H3', oblast: 'Zdvihací', nazev: 'Školení signalistů řídících pohyb břemene', periodaMesice: 12, lhutaText: '1x ročně', provadi: 'osoba pověřená systémem bezpečné práce', predpis: 'ČSN ISO 12480-1', zdrojLhuty: 'zamestnavatel' },
  { id: 'h4-obsluha-plosin', kod: 'H4', oblast: 'Zdvihací', nazev: 'Školení obsluhy pojízdných zdvihacích pracovních plošin', periodaMesice: 24, lhutaText: '1x za 2 roky', provadi: 'akreditovaná organizace nebo pověřená osoba', predpis: 'NV č. 378/2001 Sb.; ČSN ISO 18878; návod výrobce', zdrojLhuty: 'zamestnavatel' },
  { id: 'h5-zz-bez-pohonu', kod: 'H5', oblast: 'Zdvihací', nazev: 'Školení obsluhy zdvihacích zařízení bez vlastního pohonu', periodaMesice: 24, lhutaText: '1x za 2 roky', provadi: 'vedoucí zaměstnanec nebo pověřená osoba', predpis: 'NV č. 378/2001 Sb.; návod výrobce', zdrojLhuty: 'zamestnavatel' },
  { id: 'h7-dozorce-vytahu', kod: 'H7', oblast: 'Zdvihací', nazev: 'Odborná příprava osoby pověřené dozorem nad provozem výtahu', periodaMesice: 36, lhutaText: '1x za 3 roky', provadi: 'servisní organizace nebo pověřená osoba', predpis: 'ČSN 27 4002; ČSN 27 4007', zdrojLhuty: 'zamestnavatel' },

  // J — první pomoc
  { id: 'j1-prvni-pomoc', kod: 'J1', oblast: 'První pomoc', nazev: 'Školení o poskytování první pomoci', periodaMesice: 24, lhutaText: '1x za 2 roky', provadi: 'zdravotnický pracovník, instruktor první pomoci nebo PLS', predpis: '§ 102 odst. 6 zákoníku práce', zdrojLhuty: 'zamestnavatel' },
  { id: 'j2-prvni-pomoc-rozsirena', kod: 'J2', oblast: 'První pomoc', nazev: 'Rozšířená příprava osob určených k organizaci první pomoci a obsluze AED', periodaMesice: 12, lhutaText: '1x ročně', provadi: 'zdravotnický pracovník', predpis: '§ 102 odst. 6 ZP; NV č. 361/2007 Sb.', zdrojLhuty: 'zamestnavatel' },

  // K — rizikové faktory
  { id: 'k1-hluk', kod: 'K1', oblast: 'Rizikové faktory', nazev: 'Školení k práci v hluku', periodaMesice: 24, lhutaText: '1x za 2 roky', provadi: 'vedoucí zaměstnanec nebo OZO v prevenci rizik', predpis: 'NV č. 272/2011 Sb.; § 103 ZP', zdrojLhuty: 'zamestnavatel' },
  { id: 'k2-vibrace', kod: 'K2', oblast: 'Rizikové faktory', nazev: 'Školení k práci s vibracemi', periodaMesice: 24, lhutaText: '1x za 2 roky', provadi: 'vedoucí zaměstnanec nebo OZO v prevenci rizik', predpis: 'NV č. 272/2011 Sb.; § 103 ZP', zdrojLhuty: 'zamestnavatel' },
  { id: 'k3-chemicke-latky', kod: 'K3', oblast: 'Rizikové faktory', nazev: 'Školení k nakládání s chemickými látkami a směsmi', periodaMesice: 12, lhutaText: '1x ročně a vždy při změně písemných pravidel', provadi: 'OZO v prevenci rizik nebo odborně způsobilá osoba', predpis: '§ 44a zákona č. 258/2000 Sb.; NV č. 361/2007 Sb.', zdrojLhuty: 'zamestnavatel' },
  { id: 'k4-toxicke-a-zirave', kod: 'K4', oblast: 'Rizikové faktory', nazev: 'Školení k nakládání s vysoce toxickými a žíravými látkami', periodaMesice: 24, lhutaText: 'nejméně 1x za 2 roky', provadi: 'odborně způsobilá osoba podle § 44b', predpis: '§ 44b zákona č. 258/2000 Sb.', zdrojLhuty: 'predpis' },
  { id: 'k5-karcinogeny', kod: 'K5', oblast: 'Rizikové faktory', nazev: 'Školení k práci s karcinogeny, mutageny a látkami toxickými pro reprodukci', periodaMesice: 12, lhutaText: '1x ročně', provadi: 'OZO v prevenci rizik nebo PLS', predpis: 'NV č. 361/2007 Sb.; § 39 a násl. zákona č. 258/2000 Sb.', zdrojLhuty: 'zamestnavatel' },
  { id: 'k6-azbest', kod: 'K6', oblast: 'Rizikové faktory', nazev: 'Školení k práci s azbestem a k jeho odstraňování', periodaMesice: 12, lhutaText: 'před zahájením prací, dále 1x ročně', provadi: 'OZO v prevenci rizik nebo odborně způsobilá osoba', predpis: '§ 21 NV č. 361/2007 Sb.; § 41 zákona č. 258/2000 Sb.', zdrojLhuty: 'zamestnavatel' },
  { id: 'k7-biologicke-cinitele', kod: 'K7', oblast: 'Rizikové faktory', nazev: 'Školení k práci s biologickými činiteli', periodaMesice: 12, lhutaText: '1x ročně', provadi: 'OZO v prevenci rizik nebo PLS', predpis: 'NV č. 361/2007 Sb.; zákon č. 258/2000 Sb.', zdrojLhuty: 'zamestnavatel' },
  { id: 'k10-vybusne-prostredi', kod: 'K10', oblast: 'Rizikové faktory', nazev: 'Školení k práci v prostředí s nebezpečím výbuchu', periodaMesice: 12, lhutaText: '1x ročně', provadi: 'OZO v prevenci rizik nebo odborně způsobilá osoba', predpis: 'NV č. 406/2004 Sb.; dokumentace o ochraně před výbuchem', zdrojLhuty: 'zamestnavatel' },
  { id: 'k11-radiacni-pracovnici', kod: 'K11', oblast: 'Rizikové faktory', nazev: 'Školení radiačních pracovníků', periodaMesice: 12, lhutaText: 'dle podmínek povolení SÚJB, zpravidla 1x ročně', provadi: 'dohlížející osoba nebo držitel povolení SÚJB', predpis: 'zákon č. 263/2016 Sb.; vyhláška č. 422/2016 Sb.', zdrojLhuty: 'predpis' },
  { id: 'k12-neionizujici-zareni', kod: 'K12', oblast: 'Rizikové faktory', nazev: 'Školení k práci se zdroji neionizujícího záření a s lasery', periodaMesice: 12, lhutaText: '1x ročně', provadi: 'pověřená osoba nebo OZO v prevenci rizik', predpis: 'NV č. 291/2015 Sb.; ČSN EN 60825-1', zdrojLhuty: 'zamestnavatel' },

  // L — práce ve výškách a stavební práce
  { id: 'l1-prace-ve-vyskach', kod: 'L1', oblast: 'Výšky a stavby', nazev: 'Školení k práci ve výškách a nad volnou hloubkou', periodaMesice: 12, lhutaText: '1x ročně', provadi: 'OZO v prevenci rizik nebo vedoucí zaměstnanec', predpis: 'NV č. 362/2005 Sb., příloha část XI; § 103 ZP', zdrojLhuty: 'zamestnavatel' },
  { id: 'l2-prostredky-osobniho-zajisteni', kod: 'L2', oblast: 'Výšky a stavby', nazev: 'Školení k práci ve výškách s prostředky osobního zajištění proti pádu', periodaMesice: 12, lhutaText: '1x ročně', provadi: 'instruktor prací ve výškách nebo odborně způsobilá osoba', predpis: 'NV č. 362/2005 Sb., části IV a XI; NV č. 390/2021 Sb.', zdrojLhuty: 'zamestnavatel' },
  { id: 'l3-lanovy-pristup', kod: 'L3', oblast: 'Výšky a stavby', nazev: 'Školení k lanovému přístupu a k práci na laně', periodaMesice: 12, lhutaText: '1x ročně', provadi: 'instruktor s odbornou způsobilostí pro lanový přístup', predpis: 'NV č. 362/2005 Sb. a č. 591/2006 Sb.', zdrojLhuty: 'zamestnavatel' },
  { id: 'l4-lesenari', kod: 'L4', oblast: 'Výšky a stavby', nazev: 'Školení lešenářů — montáž, demontáž a přestavba lešení', periodaMesice: 12, lhutaText: '1x ročně', provadi: 'odborně způsobilá osoba nebo akreditovaná organizace', predpis: 'NV č. 362/2005 Sb., část VII; ČSN 73 8101; ČSN EN 12811-1', zdrojLhuty: 'zamestnavatel' },
  { id: 'l5-zemni-prace', kod: 'L5', oblast: 'Výšky a stavby', nazev: 'Školení k zemním pracím a k práci ve výkopech', periodaMesice: 12, lhutaText: '1x ročně', provadi: 'OZO v prevenci rizik nebo vedoucí zaměstnanec', predpis: 'NV č. 591/2006 Sb., příloha č. 3', zdrojLhuty: 'zamestnavatel' },
  { id: 'l6-stisnene-prostory', kod: 'L6', oblast: 'Výšky a stavby', nazev: 'Školení k práci ve stísněných prostorech, nádržích, jímkách a šachtách', periodaMesice: 12, lhutaText: '1x ročně', provadi: 'OZO v prevenci rizik nebo odborně způsobilá osoba', predpis: '§ 103 ZP; NV č. 361/2007 Sb.; vnitřní předpis', zdrojLhuty: 'zamestnavatel' },

  // M — svařování
  { id: 'm1-svarec-prezkouseni', kod: 'M1', oblast: 'Svařování', nazev: 'Přezkoušení svářeče z bezpečnostních předpisů', periodaMesice: 24, lhutaText: '1x za 2 roky', provadi: 'svářečská škola', predpis: 'ČSN 05 0705; ČSN 05 0601; ČSN 05 0610', zdrojLhuty: 'predpis' },
  { id: 'm2-zkouska-svarece', kod: 'M2', oblast: 'Svařování', nazev: 'Zkouška svářeče (kvalifikace)', periodaMesice: 36, lhutaText: 'osvědčení platí 3 roky, u hliníku 2 roky', provadi: 'akreditovaná zkušební organizace', predpis: 'ČSN EN ISO 9606-1 / -2; ČSN EN ISO 13585', zdrojLhuty: 'predpis', doklad: true },
  { id: 'm3-operatori-svarovacich-zarizeni', kod: 'M3', oblast: 'Svařování', nazev: 'Kvalifikace operátorů a seřizovačů svařovacích zařízení', periodaMesice: 36, lhutaText: 'zpravidla 3 roky', provadi: 'akreditovaná zkušební organizace', predpis: 'ČSN EN ISO 14732', zdrojLhuty: 'predpis', doklad: true },
  { id: 'm5-zvysene-pozarni-nebezpeci', kod: 'M5', oblast: 'Svařování', nazev: 'Školení k pracím se zvýšeným požárním nebezpečím a k vydávání písemných příkazů', periodaMesice: 12, lhutaText: 'před zahájením prací, dále 1x ročně', provadi: 'technik PO nebo OZO v PO', predpis: '§ 6a zákona č. 133/1985 Sb.; vyhláška č. 87/2000 Sb.', zdrojLhuty: 'zamestnavatel', pozarniRadek: 'skoleni-zvysene-nebezpeci' },

  // N — ostatní činnosti
  { id: 'n2-retezove-pily', kod: 'N2', oblast: 'Ostatní', nazev: 'Školení obsluhy motorových řetězových pil a křovinořezů', periodaMesice: 12, lhutaText: '1x ročně', provadi: 'akreditovaná organizace nebo odborně způsobilá osoba', predpis: 'NV č. 339/2017 Sb.; § 103 ZP; návod výrobce', zdrojLhuty: 'zamestnavatel' },
  { id: 'n3-prace-v-lese', kod: 'N3', oblast: 'Ostatní', nazev: 'Školení k práci v lese a na pracovištích obdobného charakteru', periodaMesice: 12, lhutaText: '1x ročně', provadi: 'OZO v prevenci rizik nebo vedoucí zaměstnanec', predpis: 'NV č. 339/2017 Sb.', zdrojLhuty: 'zamestnavatel' },
  { id: 'n4-obrabeci-stroje', kod: 'N4', oblast: 'Ostatní', nazev: 'Školení obsluhy dřevoobráběcích a kovoobráběcích strojů', periodaMesice: 24, lhutaText: '1x za 2 roky', provadi: 'vedoucí zaměstnanec nebo pověřená osoba', predpis: 'NV č. 378/2001 Sb.; návod výrobce', zdrojLhuty: 'zamestnavatel' },
  { id: 'n6-horlave-kapaliny', kod: 'N6', oblast: 'Ostatní', nazev: 'Školení obsluhy zařízení pro plnění a stáčení hořlavých kapalin', periodaMesice: 12, lhutaText: '1x ročně', provadi: 'odborně způsobilá osoba', predpis: 'ČSN 65 0201; vyhláška č. 246/2001 Sb.', zdrojLhuty: 'zamestnavatel' },
  { id: 'n7-prace-na-dalku', kod: 'N7', oblast: 'Ostatní', nazev: 'Školení zaměstnanců pracujících na dálku', periodaMesice: 24, lhutaText: 'před zahájením, dále ve lhůtě dle A3', provadi: 'OZO v prevenci rizik nebo vedoucí zaměstnanec', predpis: '§ 103 odst. 1 a § 317 zákoníku práce', zdrojLhuty: 'zamestnavatel' },
];

export default function ImportSkoleniPage() {
  const { userProfile } = useData();
  const isAdmin = userProfile?.role === 'admin';

  const [bezi, setBezi] = useState(false);
  const [hotovo, setHotovo] = useState(0);
  const [celkem] = useState(LHUTNIK.length);
  const [chyby, setChyby] = useState<string[]>([]);
  const [dokonceno, setDokonceno] = useState(false);

  async function spustImport() {
    if (bezi) return;
    setBezi(true);
    setHotovo(0);
    setChyby([]);
    setDokonceno(false);
    const noveChyby: string[] = [];
    let n = 0;

    for (const p of LHUTNIK) {
      try {
        await setDoc(
          doc(db, 'ciselnikSkoleni', p.id),
          {
            nazev: p.nazev,
            periodaMesice: p.periodaMesice,
            provadi: p.provadi,
            pozarniRadek: p.pozarniRadek ?? null,
            stav: 'aktivni',
            kod: p.kod,
            oblast: p.oblast,
            predpis: p.predpis,
            lhutaText: p.lhutaText,
            zdrojLhuty: p.zdrojLhuty,
            doklad: p.doklad ?? false,
            poznamka: p.poznamka ?? null,
          },
          { merge: true },
        );
        n += 1;
        setHotovo(n);
      } catch (e: any) {
        noveChyby.push(`${p.kod} ${p.nazev}: ${e?.message ?? 'chyba'}`);
        setChyby([...noveChyby]);
      }
    }
    setBezi(false);
    setDokonceno(true);
  }

  if (!isAdmin) {
    return (
      <div className="p-8 text-muted-foreground">
        Import číselníku je dostupný jen pro administrátora.
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 md:p-8 space-y-6">
      <header>
        <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
          <GraduationCap className="h-6 w-6 text-blue-600" /> Import číselníku školení
        </h1>
        <p className="text-muted-foreground mt-1">
          Naplní <code className="text-xs bg-muted px-1 py-0.5 rounded">ciselnikSkoleni</code> z lhůtníku
          školení BOZP a PO ({celkem} položek). Lze spustit opakovaně — existující položky se
          aktualizují, ručně přidané se nemažou.
        </p>
      </header>

      <Card>
        <CardContent className="py-6 space-y-4">
          <Button onClick={spustImport} disabled={bezi} size="lg">
            {bezi ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <GraduationCap className="h-4 w-4 mr-2" />}
            {bezi ? `Importuji… (${hotovo}/${celkem})` : `Spustit import (${celkem} položek)`}
          </Button>

          {(bezi || dokonceno) && (
            <div className="space-y-2">
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all"
                  style={{ width: `${celkem ? (hotovo / celkem) * 100 : 0}%` }}
                />
              </div>
              <p className="text-sm text-muted-foreground">{hotovo} / {celkem} položek</p>
            </div>
          )}

          {dokonceno && chyby.length === 0 && (
            <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 rounded-lg p-3 text-sm font-medium">
              <CheckCircle2 className="h-5 w-5" /> Hotovo — {hotovo} položek naimportováno bez chyby.
            </div>
          )}

          {chyby.length > 0 && (
            <div className="space-y-2 rounded-lg border border-red-200 bg-red-50/50 p-3">
              <div className="flex items-center gap-2 text-red-700 font-bold text-sm">
                <AlertTriangle className="h-4 w-4" /> {chyby.length} chyb
              </div>
              <ul className="text-xs text-red-700 space-y-1 max-h-48 overflow-auto">
                {chyby.map((c, i) => <li key={i}>• {c}</li>)}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
