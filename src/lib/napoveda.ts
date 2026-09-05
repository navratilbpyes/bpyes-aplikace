/**
 * AuditFlow — texty nápovědy.
 * Umístění: src/lib/napoveda.ts
 *
 * Nápověda je vrstva, ne sekce: klient ji najde tam, kde na problém narazí.
 * Texty jsou tady, ne v komponentách, aby se při novele předpisu opravovaly
 * na jednom místě. Až jich bude víc, přesune se to do `konfigurace/napoveda`
 * a půjde je editovat z admina bez nasazení.
 */

export interface TextNapovedy {
  nadpis: string;
  /** odstavce — každý se vykreslí zvlášť */
  text: string[];
  /** právní opora, vypíše se drobným písmem dole */
  predpis?: string;
}

export const NAPOVEDA: Record<string, TextNapovedy> = {
  osoby: {
    nadpis: 'K čemu je evidence osob',
    text: [
      'Bez seznamu zaměstnanců nelze evidovat školení ani lékařské prohlídky — všechno ostatní na osobách visí.',
      'Osoby nahrajete hromadně z CSV, nebo je přidáte po jedné. U každé stačí jméno; datum narození je potřeba kvůli tomu, že se po padesátce zkracují lhůty lékařských prohlídek.',
      'Kategorie práce a perioda prohlídky se nikde nezadávají — systém je počítá z pozice a z přiřazených činností. Vždy platí ta nejkratší lhůta.',
    ],
  },

  pozice: {
    nadpis: 'Pozice, kategorizace a výchozí činnosti',
    text: [
      'Pozice je organizační zařazení: údržbář, skladník, operátor výroby. Každá osoba má jednu.',
      'Po rozkliknutí šipky nastavíte kategorizaci rizikových faktorů — hluk, vibrace, prach a další. Kategorizace se dělá na jednotlivý faktor, ne na pozici jako celek: zaměstnanec může být kategorie 2 pro hluk a 3 pro vibrace. Výsledná kategorie je nejvyšší z nich.',
      'Ve stejném panelu zaškrtnete výchozí činnosti pozice. Když každý svářeč u vás zároveň obsluhuje jeřáb a váže břemena, zaškrtnete to jednou a nové osoby to dostanou automaticky. Tlačítkem to doplníte i lidem, kteří už v evidenci jsou.',
      'Přepínač „vedoucí zaměstnanec" je vlastnost pozice, ne člověka. Plynou z něj školení vedoucích.',
    ],
    predpis: '§ 103 zákoníku práce · příloha č. 1 vyhlášky č. 432/2003 Sb.',
  },

  matice: {
    nadpis: 'Proč přiřazovat činnosti',
    text: [
      'Činnost je to, co člověk reálně dělá — svařuje, leze do výšek, jezdí vozíkem. Dva údržbáři mají stejnou pozici, ale každý jiné povinnosti, a právě to matice zachycuje.',
      'Z přiřazené činnosti systém odvodí, jaká školení a jaká lékařská prohlídka jsou povinné. Nic dalšího zadávat nemusíte.',
      'Barva políčka ukazuje stav školení: modrá v pořádku, žlutá se blíží termín, červená po lhůtě, šedá znamená, že člověk činnost dělá, ale školení nemá vůbec zaznamenané. Najetím myší se zobrazí konkrétní termíny.',
      'Odebrání činnosti ji ukončí k dnešnímu dni, nesmaže. Historie zůstává — musí být doložitelné, proč měl někdo v minulosti školení, které dnes nepotřebuje.',
    ],
  },

  skoleni: {
    nadpis: 'Zápis školení',
    text: [
      'Termín dalšího školení se počítá od data konkrétní osoby, ne od firemního termínu. Dva lidé proškolení s odstupem dvou týdnů mají termíny posunuté o dva týdny.',
      'Zapisovat lze hromadně: vyberete datum, do kterého komu končí platnost, systém tyto osoby zaškrtne a vy zapíšete jedním datem všem najednou. Výběr jde ručně upravit.',
      'U zácviku vyplňte i datum ukončení — zácvik začíná dnem školení a končí podle toho, jak rychle se člověk zapracuje.',
      'Každá změna se ukládá do historie, kterou najdete pod ikonou hodin u každé osoby. Opravy se tedy nemusíte bát, ale původní hodnota zůstane dohledatelná.',
    ],
    predpis: '§ 103 odst. 2 a 3 zákoníku práce',
  },

  prohlidky: {
    nadpis: 'Lékařské prohlídky',
    text: [
      'Perioda se počítá od data vydání posudku, ne ode dne prohlídky — proto jsou zde dvě data.',
      'Lhůta vyplývá z kategorie práce a z činností s profesním rizikem; platí vždy ta nejkratší. Po dovršení padesáti let se u většiny kategorií zkracuje.',
      'U závěru zapisujte jen to, co smí mít zaměstnavatel v ruce: způsobilý, způsobilý s podmínkou, nezpůsobilý, pozbyl dlouhodobě způsobilost. Diagnózy ani zdravotní nálezy do systému nepatří.',
      'Vstupní prohlídka je povinná vždy, když má člověk činnost s profesním rizikem — a to i v kategorii 1.',
    ],
    predpis: 'zákon č. 373/2011 Sb. · vyhláška č. 79/2013 Sb.',
  },

  cinnostiCiselnik: {
    nadpis: 'Číselník činností',
    text: [
      'Činnost nese tři věci: která školení z ní plynou, zda vyžaduje praktický zácvik, a zda je profesním rizikem podle přílohy č. 1 vyhlášky o pracovnělékařských službách.',
      'Profesní riziko vynucuje vstupní i výstupní prohlídku i u kategorie 1 a nese vlastní periodu. Text odborných vyšetření se přenáší do žádosti o prohlídku.',
      'Ochranné pracovní prostředky zde nejsou schválně — liší se klient od klienta a řeší se u konkrétní firmy.',
    ],
    predpis: 'příloha č. 1 vyhlášky č. 79/2013 Sb.',
  },

  kategorie: {
    nadpis: 'Kategorie práce a lhůty prohlídek',
    text: [
      'Lhůty odpovídají vyhlášce o pracovnělékařských službách. Změní-li se předpis, opravíte je tady a platí okamžitě pro všechny klienty.',
      'Perioda konkrétní osoby je vždy nejkratší z její kategorie a ze všech jejích činností s profesním rizikem.',
    ],
    predpis: '§ 11 vyhlášky č. 79/2013 Sb.',
  },

  pls: {
    nadpis: 'Poskytovatelé pracovnělékařských služeb',
    text: [
      'Zaměstnavatel musí mít uzavřenou písemnou smlouvu o pracovnělékařských službách. Bez ní nelze provádět prohlídky u jiného než registrujícího lékaře.',
      'Poskytovatelů může být víc — pro každé pracoviště jiný, nebo zvlášť pro dopravně psychologické vyšetření. Do pole Rozsah napište, čeho se který týká.',
      'Poskytovatel označený jako hlavní se předvyplní do žádostí o prohlídku.',
    ],
    predpis: '§ 54 zákona č. 373/2011 Sb.',
  },
};
