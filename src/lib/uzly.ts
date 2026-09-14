/**
 * AuditFlow — procesní mapa osoby: uzly a jejich vyhodnocení.
 * Umístění: src/lib/uzly.ts
 *
 * Mapa je osobní, ne firemní. Ukazuje, kde konkrétní člověk stojí:
 * co má za sebou, co ho čeká a co chybí. Firemní pohled vzniká
 * agregací osobních map, ne vlastní strukturou.
 *
 * Uzel má tři vlastnosti:
 *   1. podmínku zobrazení — komu se vůbec ukáže,
 *   2. způsob uzavření — ručně / událostí / kolem,
 *   3. formulář, který k němu patří.
 */

import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/components/data-provider';
import type { StavZaznamu } from './skoleni';
import type { CiselnikCinnost } from './cinnosti';
import type { Osoba } from './osoby';
import { aktivniCinnosti } from './osoby';
import type { Udalost } from './udalosti';
import { dalsiTermin, stavTerminu, PRAH_VYCHOZI } from './udalosti';
import type { CiselnikSkoleni } from './skoleni';

export type FazeUzlu = 'nastup' | 'provoz' | 'udalost' | 'ukonceni';

/** Komu se uzel zobrazí. */
export type PodminkaUzlu =
  | 'vzdy'
  | 'priCinnosti'      // osoba má některou z uvedených činností
  | 'priZacviku'       // osoba má činnost vyžadující zácvik
  | 'priVedouci'       // pozice je vedoucí
  | 'priProfesnimRiziku'
  | 'priUkonceni';     // osoba má vyplněné datum ukončení

/** Čím se uzel odškrtne. */
export type UzavreniUzlu =
  | 'rucne'            // datum a poznámka přímo na kartě
  | 'skolenim'         // záznam školení daného tématu
  | 'zacvikem'         // záznam školení s vyplněným datem ukončení
  | 'prohlidkou'       // záznam lékařské prohlídky
  | 'kolem';           // účast na centrálním termínu (zatím nepoužito)

export interface CiselnikUzel {
  id: string;
  poradi: number;
  faze: FazeUzlu;
  nazev: string;
  podminka: PodminkaUzlu;
  /** u podmínky priCinnosti — ID činností, které uzel spouštějí */
  cinnostiIds?: string[];
  uzavreni: UzavreniUzlu;
  /** u uzavření skolenim/zacvikem — ID tématu z ciselnikSkoleni */
  skoleniId?: string | null;
  /** u uzavření prohlidkou — druh prohlídky */
  druhProhlidky?: string | null;
  /** označení formuláře, např. „F001" */
  formular?: string | null;
  /** vysvětlivka pro klienta — co má udělat a proč */
  napoveda?: string | null;
  predpis?: string | null;
  stav: StavZaznamu;
}

export const POPIS_FAZE: Record<FazeUzlu, string> = {
  nastup: 'Nástup',
  provoz: 'Provoz',
  udalost: 'Mimořádné události',
  ukonceni: 'Ukončení',
};

export const POPIS_PODMINKY: Record<PodminkaUzlu, string> = {
  vzdy: 'Vždy',
  priCinnosti: 'Při vybrané činnosti',
  priZacviku: 'Při činnosti se zácvikem',
  priVedouci: 'U vedoucí pozice',
  priProfesnimRiziku: 'Při profesním riziku',
  priUkonceni: 'Při ukončení poměru',
};

export const POPIS_UZAVRENI: Record<UzavreniUzlu, string> = {
  rucne: 'Ručně (datum a poznámka)',
  skolenim: 'Záznamem školení',
  zacvikem: 'Záznamem zácviku',
  prohlidkou: 'Záznamem prohlídky',
  kolem: 'Účastí na centrálním termínu',
};

/**
 * Výchozí sada uzlů. Zakládá se při prvním otevření číselníku, dál se edituje
 * v aplikaci — texty ani podmínky nepatří do kódu, mění se s předpisy.
 */
export const VYCHOZI_UZLY: Omit<CiselnikUzel, 'id'>[] = [
  {
    poradi: 10, faze: 'nastup', nazev: 'Zařazení: pozice, činnosti, kategorie',
    podminka: 'vzdy', uzavreni: 'rucne', stav: 'aktivni',
    napoveda: 'Přiřaďte osobě pracovní pozici a činnosti, které bude vykonávat. Z nich systém odvodí povinná školení i lhůtu lékařské prohlídky.',
  },
  {
    poradi: 20, faze: 'nastup', nazev: 'Vstupní lékařská prohlídka',
    podminka: 'vzdy', uzavreni: 'prohlidkou', druhProhlidky: 'vstupni',
    formular: 'F006', stav: 'aktivni',
    napoveda: 'Musí proběhnout před nástupem. U kategorie 1 bez profesního rizika ji lze vynechat — jakmile má ale osoba činnost s profesním rizikem, je povinná vždy.',
    predpis: '§ 59 zákona č. 373/2011 Sb.',
  },
  {
    poradi: 30, faze: 'nastup', nazev: 'Dopravně psychologické vyšetření',
    podminka: 'priCinnosti', uzavreni: 'rucne', formular: 'F007', stav: 'aktivni',
    napoveda: 'Řidiči z povolání před zahájením činnosti, řidiči referenti od 65 let věku.',
    predpis: '§ 87a zákona č. 361/2000 Sb.',
  },
  {
    poradi: 40, faze: 'nastup', nazev: 'Vstupní školení BOZP a PO',
    podminka: 'vzdy', uzavreni: 'skolenim', formular: 'F001', stav: 'aktivni',
    napoveda: 'První den nástupu, před zahájením práce. Od jeho data se počítá perioda dalšího školení.',
    predpis: '§ 103 odst. 2 zákoníku práce · § 16 zákona č. 133/1985 Sb.',
  },
  {
    poradi: 50, faze: 'nastup', nazev: 'Školení vedoucích zaměstnanců',
    podminka: 'priVedouci', uzavreni: 'skolenim', formular: 'F001', stav: 'aktivni',
    napoveda: 'Vedoucí potřebují rozšířené školení — odpovídají za BOZP na svěřeném úseku.',
    predpis: '§ 103 odst. 2 a 3 zákoníku práce',
  },
  {
    poradi: 60, faze: 'nastup', nazev: 'Vstupní odborné školení k činnostem',
    podminka: 'priCinnosti', uzavreni: 'skolenim', formular: 'F001', stav: 'aktivni',
    napoveda: 'Školení, která plynou z přiřazených činností — výšky, vozíky, svařování a další. Musí předcházet praktickému zácviku.',
  },
  {
    poradi: 70, faze: 'nastup', nazev: 'Praktický zácvik',
    podminka: 'priZacviku', uzavreni: 'zacvikem', formular: 'F002–F005', stav: 'aktivni',
    napoveda: 'Začíná dnem odborného školení a končí ověřením. Délka se liší podle schopností konkrétního člověka. Provádí se pouze u osob, které vstupní odborné školení absolvovaly.',
  },
  {
    poradi: 80, faze: 'nastup', nazev: 'Přidělení OOPP',
    podminka: 'vzdy', uzavreni: 'rucne', formular: 'F010', stav: 'aktivni',
    napoveda: 'Podle vlastního seznamu OOPP zpracovaného na základě vyhodnocení rizik. Zapište, co bylo vydáno, na evidenční kartu.',
    predpis: '§ 104 zákoníku práce · NV č. 390/2021 Sb.',
  },

  {
    poradi: 110, faze: 'provoz', nazev: 'Periodické školení BOZP a PO',
    podminka: 'vzdy', uzavreni: 'skolenim', formular: 'F001', stav: 'aktivni',
    napoveda: 'Opakuje se v periodě podle vnitřního předpisu. Termín běží od data vstupního školení konkrétní osoby.',
  },
  {
    poradi: 120, faze: 'provoz', nazev: 'Periodická odborná školení a přezkoušení',
    podminka: 'priCinnosti', uzavreni: 'skolenim', formular: 'F001', stav: 'aktivni',
    napoveda: 'Opakovaná školení k jednotlivým činnostem. U jeřábníků, vazačů a obsluhy plošin zahrnuje i přezkoušení.',
  },
  {
    poradi: 130, faze: 'provoz', nazev: 'Periodická lékařská prohlídka',
    podminka: 'vzdy', uzavreni: 'prohlidkou', druhProhlidky: 'periodicka',
    formular: 'F006', stav: 'aktivni',
    napoveda: 'Lhůta vychází z kategorie práce a z činností s profesním rizikem — platí vždy ta nejkratší. Prohlídka musí být nejpozději 10 dnů před koncem platnosti posudku.',
    predpis: '§ 11 vyhlášky č. 79/2013 Sb.',
  },
  {
    poradi: 140, faze: 'provoz', nazev: 'Platnost průkazů a osvědčení',
    podminka: 'priCinnosti', uzavreni: 'rucne', stav: 'aktivni',
    napoveda: 'Svářečský průkaz, profesní průkaz řidiče, doklad o odborné způsobilosti v elektrotechnice. Hlídá se konec platnosti dokladu, ne datum školení.',
  },
  {
    poradi: 150, faze: 'provoz', nazev: 'Odborná kontrola OOPP',
    podminka: 'priCinnosti', uzavreni: 'rucne', stav: 'aktivni',
    napoveda: 'Prostředky proti pádu, přilby a dýchací technika mají vlastní lhůtu kontroly nebo exspiraci. Běžné OOPP se jen evidují.',
  },

  {
    poradi: 210, faze: 'udalost', nazev: 'Změna pozice nebo činnosti',
    podminka: 'vzdy', uzavreni: 'rucne', formular: 'F006 + F001 + F010', stav: 'aktivni',
    napoveda: 'Převedení na jinou práci spouští tři věci najednou: lékařskou prohlídku, doškolení k nové činnosti a úpravu přidělených OOPP.',
  },
  {
    poradi: 220, faze: 'udalost', nazev: 'Přerušení výkonu práce',
    podminka: 'vzdy', uzavreni: 'rucne', stav: 'aktivni',
    napoveda: 'Zaznamenejte delší nepřítomnost. Nemoc nad 8 týdnů, úraz s těžkými následky nebo přerušení nad 6 měsíců zakládá mimořádnou prohlídku do 5 pracovních dnů od návratu.',
    predpis: '§ 12 vyhlášky č. 79/2013 Sb.',
  },
  {
    poradi: 230, faze: 'udalost', nazev: 'Mimořádná lékařská prohlídka',
    podminka: 'vzdy', uzavreni: 'prohlidkou', druhProhlidky: 'mimoradna',
    formular: 'F006', stav: 'aktivni',
    napoveda: 'Prohlídka v úplném rozsahu resetuje periodu periodické prohlídky, v neúplném nikoli.',
  },
  {
    poradi: 240, faze: 'udalost', nazev: 'Pracovní úraz',
    podminka: 'vzdy', uzavreni: 'rucne', stav: 'aktivni',
    napoveda: 'Zapište do knihy úrazů. U úrazu s hospitalizací nad 5 dnů nebo s opakovanou pracovní neschopností následuje mimořádná prohlídka.',
    predpis: 'NV č. 201/2010 Sb.',
  },

  {
    poradi: 310, faze: 'ukonceni', nazev: 'Výstupní lékařská prohlídka',
    podminka: 'priUkonceni', uzavreni: 'prohlidkou', druhProhlidky: 'vystupni',
    formular: 'F008', stav: 'aktivni',
    napoveda: 'Povinná u kategorie 2R, 3 a 4, dále při nemoci z povolání nebo úrazu s opakovanou neschopností. V ostatních případech na žádost zaměstnance nebo zaměstnavatele.',
    predpis: '§ 13 vyhlášky č. 79/2013 Sb.',
  },
  {
    poradi: 320, faze: 'ukonceni', nazev: 'Vrácení OOPP',
    podminka: 'priUkonceni', uzavreni: 'rucne', formular: 'F010', stav: 'aktivni',
    napoveda: 'Zaznamenejte vrácení na evidenční kartu OOPP.',
  },
  {
    poradi: 330, faze: 'ukonceni', nazev: 'Následná lékařská prohlídka',
    podminka: 'priProfesnimRiziku', uzavreni: 'prohlidkou', druhProhlidky: 'nasledna',
    stav: 'aktivni',
    napoveda: 'U prací s rizikem pozdních následků. Běží až po skončení expozice, tedy i po ukončení pracovního poměru.',
  },
];

export async function nactiUzly(): Promise<CiselnikUzel[]> {
  const snap = await getDocs(
    query(collection(db, 'ciselnikUzlu'), where('stav', '==', 'aktivni')),
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as CiselnikUzel)
    .sort((a, b) => (a.poradi ?? 0) - (b.poradi ?? 0));
}

/**
 * Stav uzlu.
 * Nástup, události a ukončení jsou binární — vstupní školení se nekoná podruhé.
 * Provoz je cyklus, a tam „splněno" nic neříká: rozhoduje termín dalšího.
 */
export type StavUzlu = 'splneno' | 'ceka' | 'ok' | 'blizi' | 'po' | 'chybi';

export interface VyhodnocenyUzel {
  uzel: CiselnikUzel;
  stav: StavUzlu;
  /** datum posledního splnění */
  datum?: string | null;
  /** termín dalšího — jen u cyklických uzlů ve fázi Provoz */
  dalsi?: string | null;
  /** perioda v měsících, ze které se termín počítá */
  perioda?: number;
}

/** Uzel vyžaduje pozornost — po lhůtě, nebo úplně bez záznamu. */
export function jeProblem(v: VyhodnocenyUzel): boolean {
  return v.stav === 'po' || v.stav === 'chybi'
    || (v.uzel.faze === 'nastup' && v.stav === 'ceka');
}

/** Souhrn mapy pro seznam osob — nejhorší stav rozhoduje. */
export function souhrnMapy(mapa: VyhodnocenyUzel[]): {
  stav: 'ok' | 'blizi' | 'po' | 'nekompletni';
  splneno: number;
  celkem: number;
  problemy: number;
} {
  const celkem = mapa.length;
  const splneno = mapa.filter((m) => m.stav === 'splneno' || m.stav === 'ok' || m.stav === 'blizi').length;
  const po = mapa.filter((m) => m.stav === 'po').length;
  const chybi = mapa.filter((m) => jeProblem(m) && m.stav !== 'po').length;
  const blizi = mapa.filter((m) => m.stav === 'blizi').length;
  return {
    stav: po > 0 ? 'po' : chybi > 0 ? 'nekompletni' : blizi > 0 ? 'blizi' : 'ok',
    splneno,
    celkem,
    problemy: po + chybi,
  };
}

/** Zobrazí se uzel této osobě? */
function zobrazit(
  u: CiselnikUzel,
  osoba: Osoba,
  cinnosti: CiselnikCinnost[],
  jeVedouci: boolean,
): boolean {
  switch (u.podminka) {
    case 'vzdy':
      return true;
    case 'priVedouci':
      return jeVedouci;
    case 'priZacviku':
      return cinnosti.some((c) => c.zacvik);
    case 'priProfesnimRiziku':
      return cinnosti.some((c) => c.profesniRiziko);
    case 'priUkonceni':
      return !!osoba.datumUkonceni;
    case 'priCinnosti': {
      const sada = u.cinnostiIds ?? [];
      if (sada.length === 0) return cinnosti.length > 0;
      return cinnosti.some((c) => sada.includes(c.id));
    }
    default:
      return true;
  }
}

/**
 * Vyhodnotí mapu pro jednu osobu.
 * Uzly uzavírané záznamem se čtou z `udalosti`; ručně uzavírané z pole
 * `uzavreneUzly` na osobě (klíč = ID uzlu, hodnota = datum).
 */
export function vyhodnotMapu(
  uzly: CiselnikUzel[],
  osoba: Osoba,
  cinnosti: CiselnikCinnost[],
  udalosti: Udalost[],
  jeVedouci: boolean,
  /** číselník školení — kvůli periodám u cyklických uzlů */
  skoleni: CiselnikSkoleni[] = [],
  /** perioda prohlídky osoby v měsících (počítá se z kategorie a činností) */
  periodaProhlidkyMesicu?: number,
  prahMesicu: number = PRAH_VYCHOZI,
): VyhodnocenyUzel[] {
  const mojeUdalosti = udalosti.filter((x) => x.osobaId === osoba.id);
  const rucni = (osoba as any).uzavreneUzly as Record<string, string> | undefined;

  return uzly
    .filter((u) => zobrazit(u, osoba, cinnosti, jeVedouci))
    .map((u) => {
      let datum: string | null | undefined;

      if (u.uzavreni === 'prohlidkou') {
        const z = mojeUdalosti
          .filter((x) => x.typ === 'prohlidka'
            && (!u.druhProhlidky || x.druhProhlidky === u.druhProhlidky))
          .sort((a, b) => (b.datum ?? '').localeCompare(a.datum ?? ''))[0];
        datum = z?.datum;
      } else if (u.uzavreni === 'skolenim' || u.uzavreni === 'kolem') {
        const z = mojeUdalosti
          .filter((x) => x.typ === 'skoleni'
            && (!u.skoleniId || x.temaId === u.skoleniId))
          .sort((a, b) => (b.datum ?? '').localeCompare(a.datum ?? ''))[0];
        datum = z?.datum;
      } else if (u.uzavreni === 'zacvikem') {
        const z = mojeUdalosti
          .filter((x) => x.typ === 'skoleni' && !!x.datumDo
            && (!u.skoleniId || x.temaId === u.skoleniId))
          .sort((a, b) => (b.datumDo ?? '').localeCompare(a.datumDo ?? ''))[0];
        datum = z?.datumDo;
      } else {
        datum = rucni?.[u.id];
      }

      // Fáze Provoz je cyklus — nezajímá nás, že něco proběhlo, ale kdy je to zas.
      if (u.faze === 'provoz') {
        const perioda = u.uzavreni === 'prohlidkou'
          ? (periodaProhlidkyMesicu ?? 0)
          : (skoleni.find((s) => s.id === u.skoleniId)?.periodaMesice ?? 0);

        const posledniZaznam = mojeUdalosti
          .filter((x) => (u.uzavreni === 'prohlidkou'
            ? x.typ === 'prohlidka' && (!u.druhProhlidky || x.druhProhlidky === u.druhProhlidky)
            : x.typ === 'skoleni' && (!u.skoleniId || x.temaId === u.skoleniId)))
          .sort((a, b) => (b.datum ?? '').localeCompare(a.datum ?? ''))[0];

        const dalsi = dalsiTermin(posledniZaznam, perioda);
        return {
          uzel: u,
          stav: stavTerminu(dalsi, prahMesicu) as StavUzlu,
          datum: datum ?? null,
          dalsi: dalsi ?? null,
          perioda,
        };
      }

      return {
        uzel: u,
        stav: (datum ? 'splneno' : 'ceka') as StavUzlu,
        datum: datum ?? null,
      };
    });
}
