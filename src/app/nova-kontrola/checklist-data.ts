export interface ChecklistPoint {
  id: number;
  text: string;
  nText?: string;
}

export interface ChecklistSection {
  id: string;
  title: string;
  points: ChecklistPoint[];
}

  // ==========================================
// 1. KONTROLA: BOZP a PO
// ==========================================
export const CHECKLIST_SECTION = [
  "  {
    id: 'SEC_1',
    title: 'PRACOVNĚPRÁVNÍ OBLAST',
    items: [
      { id: '1', text: 'Pracovní řád' },"



      { id: '2', text: 'Pracovní smlouvy a dohody' },




      { id: '3', text: 'Evidence pracovní doby' },




      { id: '4', text: 'Seznam druhů prací' },


      { id: '5', text: 'Popisy pracovního místa / náplň funkce' },



      { id: '6', text: 'Informování o rizicích a koordinace BOZP na společném pracovišti' },


"    ]
  },
  {
    id: 'SEC_25',
    title: 'VYHLEDÁVÁNÍ A HODNOCENÍ RIZIK',
    items: [
      { id: '7', text: 'Vyhledávání a hodnocení rizik' },"




      { id: '8', text: 'Seznamování zaměstnanců s riziky' },



"    ]
  },
  {
    id: 'SEC_34',
    title: 'SYSTÉM BOZP A ODPOVĚDNOST',
    items: [
      { id: '9', text: 'Organizační struktura – nadřízenost a podřízenost' },"


      { id: '10', text: 'Dokumentace BOZP (aktuálnost předpisů)' },



      { id: '11', text: 'Seznamování zaměstnanců s dokumentací BOZP' },


      { id: '12', text: 'Osoba odpovědná za BOZP' },


      { id: '13', text: 'Osoba odpovědná za vedení dokumentace BOZP a PO' },


      { id: '14', text: 'Odpovědná osoba za jednotlivé prostory / sklady' },


"    ]
  },
  {
    id: 'SEC_53',
    title: 'ŠKOLENÍ A ODBORNÁ ZPŮSOBILOST',
    items: [
      { id: '15', text: 'Směrnice o školení' },"


      { id: '16', text: 'Plán školení, sledování termínů' },


      { id: '17', text: 'Osnovy školení (aktuálnost, schválení zaměstnavatelem)' },


      { id: '18', text: 'Vstupní školení BOZP a PO' },



      { id: '19', text: 'Periodická a mimořádná školení BOZP a PO' },


      { id: '20', text: 'Odborná školení (druhy, plán, zácvik, náplň)' },



      { id: '21', text: 'Evidence odborných způsobilostí' },


"    ]
  },
  {
    id: 'SEC_76',
    title: 'PRACOVNĚLÉKAŘSKÁ PÉČE, ZDRAVOTNÍ ZPŮSOBILOST, OCHRANA ZDRAVÍ',
    items: [
      { id: '22', text: 'Směrnice k poskytování pracovnělékařské péče' },"


      { id: '23', text: 'Plán lékařských prohlídek a vyšetření' },


      { id: '24', text: 'Smlouva s poskytovatelem PLP' },


      { id: '25', text: 'Vstupní lékařské prohlídky' },


      { id: '26', text: 'Periodické a mimořádné lékařské prohlídky' },


      { id: '27', text: 'Výstupní a následné lékařské prohlídky' },


      { id: '28', text: 'Školení zaměstnanců o poskytování první pomoci' },


      { id: '29', text: 'Dohled poskytovatelem PLP na pracovišti' },


      { id: '30', text: 'Kategorizace prací' },


      { id: '31', text: 'Seznámení zaměstnanců se zařazením do kategorií' },

      { id: '32', text: 'Předání kopie rozhodnutí poskytovateli PLP' },

      { id: '33', text: 'Vyhledávání a hodnocení rizikových faktorů, měření' },


      { id: '34', text: 'Lékárničky' },



      { id: '35', text: 'Stanovení bezpečnostních přestávek' },

      { id: '36', text: 'Evidence rizikových prací (kat. 2R, 3, 4)' },


"    ]
  },
  {
    id: 'SEC_119',
    title: 'ÚRAZY',
    items: [
      { id: '37', text: 'Směrnice o postupu při úrazu, registrace na portálu SUIP' },"


      { id: '38', text: 'Kniha úrazů (vedení, umístění)' },


      { id: '39', text: 'Opatření proti opakování úrazu a jeho kontrola' },

      { id: '40', text: 'Odškodnění pracovního úrazu' },

"    ]
  },
  {
    id: 'SEC_129',
    title: 'POSKYTOVÁNÍ OOPP, MČDP A ON',
    items: [
      { id: '41', text: 'Směrnice o poskytování OOPP, MČDP a ON' },"

      { id: '42', text: 'Hodnocení rizik pro poskytnutí OOPP' },

      { id: '43', text: 'Kritéria pro výběr OOPP' },

      { id: '44', text: 'Výměna a skladování OOPP' },

      { id: '45', text: 'Kontroly používání OOPP' },

      { id: '46', text: 'Evidence poskytování OOPP' },

      { id: '47', text: 'Poskytování OOPP návštěvám a externím pracovníkům' },

      { id: '48', text: 'Údržba OOPP' },

      { id: '49', text: 'Poskytování MČDP' },

      { id: '50', text: 'Poskytování ochranných nápojů (ON)' },

"    ]
  },
  {
    id: 'SEC_149',
    title: 'KONTROLNÍ ČINNOST',
    items: [
      { id: '51', text: 'Směrnice o kontrolní činnosti' },"

      { id: '52', text: 'Provádění kontrol BOZP (roční prověrka)' },



      { id: '53', text: 'Kontroly na alkohol a návykové látky' },


      { id: '54', text: 'Kontroly orgánů státní správy' },

"    ]
  },
  {
    id: 'SEC_160',
    title: 'BEZPEČNOSTNÍ ZNAČENÍ A ZAJIŠTĚNÍ PRACOVIŠTĚ PROTI VSTUPU NEPOVOLANÝCH OSOB',
    items: [
      { id: '55', text: 'Bezpečnostní tabulky' },"


      { id: '56', text: 'Značení dopravních cest' },

      { id: '57', text: 'Značení snížených / zúžených profilů' },

      { id: '58', text: 'Značení únikových cest' },


      { id: '59', text: 'Značení druhu a směru proudění médií v potrubí' },

      { id: '60', text: 'Značení prostředků první pomoci a věcných prostředků PO' },

      { id: '61', text: 'Zajištění pracoviště proti vstupu nepovolaných osob' },

"    ]
  },
  {
    id: 'SEC_176',
    title: 'PROVOZOVÁNÍ DOPRAVY',
    items: [
      { id: '62', text: 'Směrnice o provozování dopravy – dopravní řád' },"


      { id: '63', text: 'Stanovení odpovědných osob za dopravu' },

      { id: '64', text: 'Evidence dopravních prostředků' },

      { id: '65', text: 'Vedení knihy jízd (bezpečnostní přestávky)' },

      { id: '66', text: 'Provádění STK' },

      { id: '67', text: 'Stanovení maximální rychlosti v areálu a v budovách' },

"    ]
  },
  {
    id: 'SEC_189',
    title: 'MANIPULAČNÍ TECHNIKA',
    items: [
      { id: '68', text: 'Směrnice / pokyny pro provoz manipulační techniky' },"


      { id: '69', text: 'Stanovení odpovědné osoby za manipulační techniku' },

      { id: '70', text: 'Provedení technické kontroly manipulační techniky' },


      { id: '71', text: 'Vedení průvodní a provozní dokumentace' },


"    ]
  },
  {
    id: 'SEC_200',
    title: 'SKLADOVÁNÍ',
    items: [
      { id: '72', text: 'Místní řád skladu' },"


      { id: '73', text: 'Vyznačení únosnosti podlah' },

      { id: '74', text: 'Vyznačení skladovacích prostor, komunikací' },

      { id: '75', text: 'Označení regálů' },

      { id: '76', text: 'Kontrola skladovacího zařízení min. 1x ročně' },


      { id: '77', text: 'Způsoby skladování (materiál, tlakové lahve apod.)' },


"    ]
  },
  {
    id: 'SEC_215',
    title: 'VYHRAZENÁ TECHNICKÁ ELEKTRICKÁ ZAŘÍZENÍ',
    items: [
      { id: '78', text: 'Řád prohlídek, údržby a revizí' },"

      { id: '79', text: 'Protokol o určení vnějších vlivů' },

      { id: '80', text: 'Pověření odpovědné osoby za provoz el. zařízení' },

      { id: '81', text: 'Harmonogram revizí a kontrol el. zařízení' },

      { id: '82', text: 'Provedení revizí a kontrol (instalace, hromosvody)' },


      { id: '83', text: 'Vedení dokumentace el. zařízení' },


"    ]
  },
  {
    id: 'SEC_229',
    title: 'VYHRAZENÁ TECHNICKÁ TLAKOVÁ ZAŘÍZENÍ',
    items: [
      { id: '84', text: 'Směrnice / pokyny k provozu TNS' },"

      { id: '85', text: 'Pověření odpovědné osoby za provoz TNS' },

      { id: '86', text: 'Harmonogram revizí a kontrol TNS' },

      { id: '87', text: 'Provedení revizí a kontrol TNS' },

      { id: '88', text: 'Školení a zdravotní způsobilost obsluh TNS' },

      { id: '89', text: 'Vedení dokumentace TNS' },

"    ]
  },
  {
    id: 'SEC_241',
    title: 'VYHRAZENÁ TECHNICKÁ ZDVIHACÍ ZAŘÍZENÍ',
    items: [
      { id: '90', text: 'Systém bezpečné práce / provozní předpis ZZ' },"

      { id: '91', text: 'Pověření odpovědné osoby za provoz ZZ' },

      { id: '92', text: 'Harmonogram revizí, inspekcí a kontrol ZZ' },

      { id: '93', text: 'Provedení revizí a kontrol ZZ a příslušenství' },


      { id: '94', text: 'Školení a zdravotní způsobilost jeřábníka a vazače' },

      { id: '95', text: 'Vedení dokumentace ZZ' },

"    ]
  },
  {
    id: 'SEC_254',
    title: 'VYHRAZENÁ TECHNICKÁ PLYNOVÁ ZAŘÍZENÍ',
    items: [
      { id: '96', text: 'Směrnice / pokyny k provozu plynových zařízení' },"

      { id: '97', text: 'Pověření odpovědné osoby za plynová zařízení' },

      { id: '98', text: 'Harmonogram revizí a kontrol plynových zařízení' },

      { id: '99', text: 'Provedení revizí a kontrol plynových zařízení' },


      { id: '100', text: 'Školení a zdravotní způsobilost obsluh plynových zařízení' },

      { id: '101', text: 'Vedení dokumentace plynových zařízení' },

"    ]
  },
  {
    id: 'SEC_267',
    title: 'STROJE A OSTATNÍ TECHNICKÁ ZAŘÍZENÍ',
    items: [
      { id: '102', text: 'Evidence strojů a technických zařízení' },"

      { id: '103', text: 'Kontroly technického stavu min. 1x ročně' },

      { id: '104', text: 'Vedení průvodní a provozní dokumentace strojů' },

      { id: '105', text: 'Dostupnost návodů ke strojům' },

      { id: '106', text: 'Seznámení zaměstnanců s návody, stanovení obsluh' },


"    ]
  },
  {
    id: 'SEC_278',
    title: 'KOTELNA',
    items: [
      { id: '107', text: 'Provozní řád kotelny' },"

      { id: '108', text: 'Provozní dokumentace kotelny' },

      { id: '109', text: 'Pověření odpovědné osoby za provoz kotelny' },
      { id: '110', text: 'Školení a zdravotní způsobilost obsluhy / topiče' },

      { id: '111', text: 'Větrání / přívod vzduchu kotelny' },

      { id: '112', text: 'Úniková cesta z kotelny' },
      { id: '113', text: 'Dveře z nehořlavého materiálu' },
      { id: '114', text: 'Vedení provozního deníku kotelny' },

      { id: '115', text: 'Zařízení pro zjišťování přítomnosti CO' },

      { id: '116', text: 'Přenosné hasicí přístroje v kotelně' },

      { id: '117', text: 'Prostředky pro poskytnutí první pomoci v kotelně' },
      { id: '118', text: 'Odborná prohlídka kotelny (min. 1x za 12 měsíců)' },

      { id: '119', text: 'Osvědčení a oprávnění osob k revizím' },
"    ]
  },
  {
    id: 'SEC_299',
    title: 'NEBEZPEČNÉ CHEMICKÉ LÁTKY A SMĚSI',
    items: [
      { id: '120', text: 'Evidence NCHLaS' },"

      { id: '121', text: 'Bezpečnostní listy' },


      { id: '122', text: 'Seznámení zaměstnanců s bezpečnostními listy' },

      { id: '123', text: 'Skladování a ukládání NCHLaS' },


      { id: '124', text: 'OOPP pro práci s NCHLaS' },
      { id: '125', text: 'Prostředky pro zachycení úniku' },
"    ]
  },
  {
    id: 'SEC_311',
    title: 'HYGIENICKÉ POŽADAVKY NA PRACOVIŠTI',
    items: [
      { id: '126', text: 'Osvětlení pracoviště' },"

      { id: '127', text: 'Větrání pracoviště' },
      { id: '128', text: 'Teplota na pracovišti, vytápění' },
      { id: '129', text: 'Pracovní prostor pro jednoho zaměstnance' },
      { id: '130', text: 'Výška pracovní desky stolu' },
      { id: '131', text: 'Umístění výpočetní techniky' },
      { id: '132', text: 'Prostory pro převlékání a osobní hygienu' },

      { id: '133', text: 'Místnost pro odpočinek' },

"    ]
  },
  {
    id: 'SEC_322',
    title: 'KONTROLA DOKUMENTACE PO',
    items: [
      { id: '134', text: 'Kolaudační rozhodnutí a užívání stavby' },"

      { id: '135', text: 'Požárně bezpečnostní řešení stavby' },

      { id: '136', text: 'Dokumentace o začlenění do kategorie činností' },

      { id: '137', text: 'Stanovení organizace zabezpečení PO' },

      { id: '138', text: 'Tematický plán a rozvrh školení PO vedoucích zaměstnanců' },
      { id: '139', text: 'Tematický plán a rozvrh školení PO zaměstnanců' },
      { id: '140', text: 'Tematický plán a rozvrh školení preventisty PO' },
      { id: '141', text: 'Tematický plán a rozvrh školení preventivních požárních hlídek' },
      { id: '142', text: 'Provedení školení o PO vedoucích zaměstnanců' },

      { id: '143', text: 'Provedení školení o PO zaměstnanců' },

      { id: '144', text: 'Odborná příprava a jmenování preventisty PO' },

      { id: '145', text: 'Odborná příprava a jmenování PPH' },

      { id: '146', text: 'Požárně poplachová směrnice' },

      { id: '147', text: 'Požární řád(y)' },

      { id: '148', text: 'Pokyny pro činnost preventivní požární hlídky' },
      { id: '149', text: 'Řád ohlašovny požáru' },
      { id: '150', text: 'Požární evakuační plán' },

      { id: '151', text: 'Dokumentace o zdolávání požáru' },
      { id: '152', text: 'Požární kniha' },

      { id: '153', text: 'Preventivní požární prohlídky' },


      { id: '154', text: 'Cvičný požární poplach' },

      { id: '155', text: 'Dokumentace PBZ' },

      { id: '156', text: 'Kontroly provozuschopnosti PBZ' },

      { id: '157', text: 'Přenosné hasicí přístroje' },


      { id: '158', text: 'Hydranty' },

      { id: '159', text: 'Požární nádrž' },

      { id: '160', text: 'Nouzové osvětlení' },

      { id: '161', text: 'Požární dveře' },

      { id: '162', text: 'Požární / evakuační výtah' },
      { id: '163', text: 'Zařízení pro požární signalizaci (EPS)' },

      { id: '164', text: 'Zařízení pro potlačení požáru nebo výbuchu (SHZ)' },

      { id: '165', text: 'Zařízení pro usměrňování pohybu kouře (ZOKT)' },

      { id: '166', text: 'Zařízení pro omezení šíření požáru' },

      { id: '167', text: 'Náhradní zdroje a zásoba hasebních látek' },

      { id: '168', text: 'Zařízení zamezující iniciaci požáru nebo výbuchu' },
"    ]
  },
  {
    id: 'SEC_385',
    title: 'PRÁCE Z DOMOVA / HOME OFFICE',
    items: [
      { id: '169', text: 'Dohoda o práci na dálku' },"

      { id: '170', text: 'Náhrada nákladů při práci na dálku' },
      { id: '171', text: 'BOZP při práci na dálku' },


"    ]
  },
  {
    id: 'SEC_391',
    title: 'MLADISTVÍ A OSOBY SE ZDRAVOTNÍM POSTIŽENÍM',
    items: [
      { id: '172', text: 'Zakázané práce mladistvým' },"

      { id: '173', text: 'Zdravotní způsobilost mladistvých' },

      { id: '174', text: 'Úprava pracovišť pro osoby se ZP' },

"    ]
  },
  {
    id: 'SEC_397',
    title: 'NOČNÍ PRÁCE A OCHRANA TĚHOTNÝCH A MATEK',
    items: [
      { id: '175', text: 'Zvláštní režim noční práce' },"

      { id: '176', text: 'Zakázané práce těhotným a kojícím' },

      { id: '177', text: 'Úprava podmínek pro matky a těhotné' },

"    ]
  },
  {
    id: 'SEC_403',
    title: 'RUČNÍ MANIPULACE S BŘEMENY A ERGONOMIE',
    items: [
      { id: '178', text: 'Hodnocení rizik ruční manipulace' },"

      { id: '179', text: 'Organizace manipulace a pomůcky' },

      { id: '180', text: 'Ergonomie pracovního místa' },

"    ]
  },
  {
    id: 'SEC_409',
    title: 'PRÁCE VE VÝŠKÁCH A NAD VOLNOU HLOUBKOU',
    items: [
      { id: '181', text: 'Systém / pokyny pro práci ve výškách' },"

      { id: '182', text: 'Kolektivní a osobní ochrana proti pádu' },

      { id: '183', text: 'Žebříky a schůdky' },


"    ]
  },
  {
    id: 'SEC_416',
    title: 'AZBEST A NEBEZPEČNÉ STAVEBNÍ MATERIÁLY',
    items: [
      { id: '184', text: 'Evidence a identifikace azbestu' },"

      { id: '185', text: 'Práce s rizikem uvolnění azbestu' },

"    ]
  },
  {
    id: 'SEC_420',
    title: 'ODPADOVÉ HOSPODÁŘSTVÍ',
    items: [
      { id: '186', text: 'Nakládání s odpady' },"

      { id: '187', text: 'Nebezpečné odpady' },

"    ]
  },
  {
    id: 'SEC_424',
    title: 'OSAMOCENÁ PRÁCE',
    items: [
      { id: '188', text: 'Režim osamocené práce' },"

      { id: '189', text: 'Rizikové práce zákazané osamoceně' },

    ]
  }
]; // <-- ZDE KONČÍ BOZP


// ==========================================
// 2. KONTROLA: PPP
// ==========================================
export const CHECKLIST_PBOZP = [
  "    ]
  },
  {
    id: 'SEC_428',
    title: 'Společné',
    items: [
      { id: '190', text: 'Volný přístup / komunikace k pracovišti' },"


      { id: '191', text: 'Používání OOPP' },


      { id: '192', text: 'Uklizený pracovní prostor' },

      { id: '193', text: 'Stav pracovních prostředků / nářadí / strojů' },


      { id: '194', text: 'Dostatek světla na pracovišti' },

      { id: '195', text: 'Bezpečnostní značení' },

      { id: '196', text: 'Skladování materiálu dle zásad' },

      { id: '197', text: 'Manipulace a ukládání NCHLaS' },

      { id: '198', text: 'Lékárničky' },

      { id: '199', text: 'Volné únikové komunikace a východy' },
      { id: '200', text: 'Volné únikové komunikace a východy' },
"    ]
  },
  {
    id: 'SEC_451',
    title: 'Sklad',
    items: [
      { id: '201', text: 'Místní řád skladu' },"
      { id: '202', text: 'Únosnost podlah a regálů' },

      { id: '203', text: 'Stav a kontrola regálů' },

      { id: '204', text: 'Manipulace a dopravní cesty' },

      { id: '205', text: 'Stohování a ukládání' },
"    ]
  },
  {
    id: 'SEC_459',
    title: 'Sklad NCHLaS',
    items: [
      { id: '206', text: 'Skladování dle bezpečnostních listů' },"

      { id: '207', text: 'Záchytné prostředky (jímky, vany)' },

      { id: '208', text: 'Větrání skladu' },
      { id: '209', text: 'Havarijní prostředky a značení' },

      { id: '210', text: 'Písemná pravidla nakládání s NCHLaS' },
      { id: '211', text: 'Dovolené množství' },
"    ]
  },
  {
    id: 'SEC_468',
    title: 'Lakovna',
    items: [
      { id: '212', text: 'Prostředí s nebezpečím výbuchu (ATEX)' },"

      { id: '213', text: 'Odsávání a větrání' },

      { id: '214', text: 'Elektrická zařízení v nevýbušném provedení' },
      { id: '215', text: 'Zdroje iniciace a antistatika' },

      { id: '216', text: 'Skladování barev a ředidel' },

      { id: '217', text: 'OOPP proti chemickému riziku' },
"    ]
  },
  {
    id: 'SEC_478',
    title: 'Kuchyně',
    items: [
      { id: '218', text: 'Odsávání a vzduchotechnika' },"

      { id: '219', text: 'Plynové spotřebiče' },

      { id: '220', text: 'Kluzké podlahy' },
      { id: '221', text: 'Práce s noži a stroji' },

      { id: '222', text: 'Horké povrchy a tekutiny (opaření)' },
      { id: '223', text: 'Hygiena a HACCP vs. BOZP' },
    ]
  }
]; // <-- ZDE KONČÍ PPP


// ==========================================
// 3. KONTROLA: Třetí typ (např. ISO, ŽP, atd.)
// ==========================================
export const CHECKLIST_PPP = [
  "    ]
  },
  {
    id: 'SEC_487',
    title: 'Společné',
    items: [
      { id: '224', text: 'Požární poplachové směrnice / čísla na tísňové linky – umístění, počet, aktuálnost' },"
      { id: '225', text: 'Požární řád – umístění, aktuálnost, stav' },
      { id: '226', text: 'Únikové komunikace – přístup, značení' },
      { id: '227', text: 'Únikové východy – přístup, značení' },
      { id: '228', text: 'Přenosné hasicí přístroje – stav, přístup, kontrola, umístění' },
      { id: '229', text: 'Hydranty – stav, přístup, kontrola, umístění' },
      { id: '230', text: 'Suchovody – stav, přístup, kontrola' },
      { id: '231', text: 'Požární žebříky – stav, přístup' },
      { id: '232', text: 'Nouzové osvětlení – stav, funkčnost' },
      { id: '233', text: 'Tlačítka požárního poplachu – značení, stav, funkce' },
      { id: '234', text: 'Požární klapky – stav, funkčnost' },
      { id: '235', text: 'Funkce požární poplachové sirény' },
      { id: '236', text: 'Úklid a čistota pracoviště, vrstvy prachu' },
      { id: '237', text: 'Uložení a skladování tlakových lahví' },
      { id: '238', text: 'Uložení a skladování NCHLaS' },
      { id: '239', text: 'Skladování hořlavého materiálu – dovolené množství' },
      { id: '240', text: 'Umístění prostředků pro únik kapalin – sorbenty, havarijní souprava' },
      { id: '241', text: 'Přístup a označení hlavního uzávěru plynu' },
      { id: '242', text: 'Přístup a označení hlavního vypínače elektrické energie' },
      { id: '243', text: 'Skladování hořlavého materiálu v blízkosti rozvaděčů' },
      { id: '244', text: 'Značení potrubí – technické plyny, zemní plyn' },
      { id: '245', text: 'Evidence a revize / kontroly elektro spotřebičů a přívodů' },
      { id: '246', text: 'Revize elektro instalací' },
      { id: '247', text: 'Revize hromosvodu' },
      { id: '248', text: 'Revize plynu – spotřebiče a potrubí' },
      { id: '249', text: 'Provádění údržby strojů a zařízení' },
      { id: '250', text: 'Umístění a stav ostatního požárního značení' },
    ]
  }
]; // <-- ZDE KONČÍ TŘETÍ TYP
