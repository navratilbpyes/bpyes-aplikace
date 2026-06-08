
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

export const CHECKLIST_SECTIONS: ChecklistSection[] = [
  {
    id: "A",
    title: "Pracovněprávní oblast",
    points: [
      { id: 1, text: "Pracovní řád", nText: "Zaměstnavatel nemá zpracován pracovní řád nebo není aktuální." },
      { id: 2, text: "Všichni zaměstnanci mají vystaveny pracovní smlouvy nebo dohody i pracích konaných mimopracovní poměr" },
      { id: 3, text: "Evidence pracovní doby a její dodržování" },
      { id: 4, text: "Seznam druhů prací" },
      { id: 5, text: "Popisy pracovního místa / pozice, náplň funkce" },
      { id: 6, text: "Provedeno informování o rizicích a koordinace BOZP, plní-li na jednom pracovišti úkoly zaměstnanci dvou a více zaměstnavatelů" }
    ]
  },
  {
    id: "B",
    title: "Vyhledávání a hodnocení rizik",
    points: [
      { id: 7, text: "Provedení vyhledávání a hodnocení rizik – směrnice, pokyny apod.", nText: "Zaměstnavatel nemá provedeno vyhledávání a hodnocení rizik nebo není aktuální." },
      { id: 8, text: "Seznamování zaměstnanců s riziky a opatřeními proti jejich působení" }
    ]
  },
  {
    id: "C",
    title: "Systém BOZP a odpovědnost",
    points: [
      { id: 9, text: "Organizační struktura – systém nadřízenosti a podřízenosti" },
      { id: 10, text: "Dokumentace BOZP (směrnice, provozní řády, bezpečnostní pokyny apod., aktuálnost předpisů)", nText: "Dokumentace BOZP není kompletní nebo není aktuální." },
      { id: 11, text: "Seznamování zaměstnanců s dokumentací BOZP" },
      { id: 12, text: "Stanovení osob(y) odpovídající za BOZP ve společnosti" },
      { id: 13, text: "Stanovení osob(y) odpovídající za vedení dokumentace BOZP a PO" },
      { id: 14, text: "Stanovení odpovědné osoby za jednotlivé prostory, sklady apod." }
    ]
  },
  {
    id: "D",
    title: "Školení a odborná způsobilost",
    points: [
      { id: 15, text: "Směrnice o školení", nText: "Zaměstnavatel nemá zpracovánu směrnici o školení zaměstnanců." },
      { id: 16, text: "Plán školení, sledování termínů" },
      { id: 17, text: "Osnovy školení (aktuálnost, schválení zaměstnavatelem)" },
      { id: 18, text: "Vstupní školení BOZP a PO (dokumentace, vedení dokumentace, náplň)", nText: "Vstupní školení BOZP a PO není prováděno nebo není řádně dokumentováno." },
      { id: 19, text: "Periodická a mimořádní školení BOZP a PO" },
      { id: 20, text: "Odborná školení (druhy, vstupní, periodická, plán, zácvik, náplň)" },
      { id: 21, text: "Evidence odborných způsobilostí" }
    ]
  },
  {
    id: "E",
    title: "Pracovnělékařská péče",
    points: [
      { id: 22, text: "Směrnice k poskytování pracovnělékařské péče" },
      { id: 23, text: "Plán lékařských prohlídek a vyšetření" },
      { id: 24, text: "Smlouva s poskytovatelem pracovnělékařské péče" },
      { id: 25, text: "Vstupní lékařské prohlídky (provádění, vedení dokumentace), včetně mladistvých" },
      { id: 26, text: "Periodické a mimořádné lékařské prohlídky (provádění, vedení dokumentace), včetně mladistvých" },
      { id: 27, text: "Výstupní a následné lékařské prohlídky (provádění, vedení dokumentace)" },
      { id: 28, text: "Školení zaměstnanců o poskytování první pomoci" },
      { id: 29, text: "Provedení dohledu poskytovatelem pracovnělékařské péče" },
      { id: 30, text: "Kategorizace prací (zatřídění, schválení od KHS apod.)" },
      { id: 31, text: "Seznámení zaměstnanců se zařazením do kategorií" },
      { id: 32, text: "Předání kopie rozhodnutí poskytovateli pracovnělékařské péče" },
      { id: 33, text: "Vyhledávání a opakovaná hodnocení rizikových faktorů, měření" },
      { id: 34, text: "Lékárničky (umístění na pracovišti, stanovený obsah, provádění kontrol obsahu)", nText: "Lékárnička není umístěna na dostupném místě nebo není prováděna kontrola obsahu." },
      { id: 35, text: "Stanovení bezpečnostních přestávek" },
      { id: 36, text: "Evidence rizikových prací (u kategorie 2R, 3 a 4)" }
    ]
  },
  {
    id: "F",
    title: "Úrazy",
    points: [
      { id: 37, text: "Směrnice o postupu při úrazu, registrace na portálu SUIP" },
      { id: 38, text: "Kniha úrazů (vedení, umístění)", nText: "Zaměstnavatel nevede knihu úrazů nebo není vedena v souladu s právními předpisy." },
      { id: 39, text: "Stanovení opatření proti opakování úrazu a jeho kontrola" },
      { id: 40, text: "Odškodnění pracovního úrazu" }
    ]
  },
  {
    id: "G",
    title: "Poskytování OOPP, MČDP a ON",
    points: [
      { id: 41, text: "Směrnice o poskytování OOPP, MČDP a ON" },
      { id: 42, text: "Hodnocení rizik pro poskytnutí OOPP" },
      { id: 43, text: "Stanovena kritéria pro výběr OOPP" },
      { id: 44, text: "Výměna a skladování OOPP" },
      { id: 45, text: "Kontroly používání OOPP" },
      { id: 46, text: "Evidence poskytování OOPP" },
      { id: 47, text: "Poskytování OOPP návštěvám, externím pracovníkům apod." },
      { id: 48, text: "Údržba OOPP (praní, impregnace, opravy apod.)" },
      { id: 49, text: "Poskytování MČDP" },
      { id: 50, text: "Poskytování ON" }
    ]
  },
  {
    id: "H",
    title: "Kontrolní činnost",
    points: [
      { id: 51, text: "Směrnice o kontrolní činnosti, či jiný předpis upravující kontroly BOZP, PO, revize, inspekce apod." },
      { id: 52, text: "Provádění kontrol BOZP (perioda, prokazatelnost, vedení dokumentace, odstraňování zjištěných nedostatků apod.)" },
      { id: 53, text: "Kontroly na alkohol a návykové látky" },
      { id: 54, text: "Kontroly orgánů státní zprávy" }
    ]
  },
  {
    id: "CH",
    title: "Bezpečnostní značení",
    points: [
      { id: 55, text: "Bezpečnostní tabulky" },
      { id: 56, text: "Značení dopravních cest" },
      { id: 57, text: "Značení snížených / zúžených profilů" },
      { id: 58, text: "Značení únikových cest" },
      { id: 59, text: "Značení druhu a směru proudění médií v potrubí" },
      { id: 60, text: "Značení prostředků první pomoci, věcných prostředků PO" },
      { id: 61, text: "Zajištění pracoviště / areálu proti vstupu nepovolaných osob" }
    ]
  },
  {
    id: "I",
    title: "Provozování dopravy",
    points: [
      { id: 62, text: "Směrnice o provozování dopravy – dopravní řád" },
      { id: 63, text: "Stanovení odpovědných osob" },
      { id: 64, text: "Evidence dopravních prostředků" },
      { id: 65, text: "Vedení knihy jízd (dodržování bezpečnostních přestávek)" },
      { id: 66, text: "Provádění státní technické kontroly" },
      { id: 67, text: "Stanovení maximální rychlosti v areálu a v budovách" }
    ]
  },
  {
    id: "J",
    title: "Manipulační technika",
    points: [
      { id: 68, text: "Směrnice / pokyny pro provoz manipulační techniky" },
      { id: 69, text: "Stanovení odpovědné osoby" },
      { id: 70, text: "Provedení technické kontroly" },
      { id: 71, text: "Vedení průvodní a provozní dokumentace" }
    ]
  },
  {
    id: "K",
    title: "Skladování",
    points: [
      { id: 72, text: "Místní řád skladu" },
      { id: 73, text: "Vyznačení únosnosti podlah" },
      { id: 74, text: "Vyznačení skladovacích prostor, komunikací" },
      { id: 75, text: "Označení regálů" },
      { id: 76, text: "Provádění kontrola skladovacího zařízení min. 1x ročně" },
      { id: 77, text: "Způsoby skladování (materiál, tlakové lahve apod.)" }
    ]
  },
  {
    id: "L",
    title: "Vyhrazená technická elektrická zařízení",
    points: [
      { id: 78, text: "Řádu prohlídek, údržby a revizí" },
      { id: 79, text: "Protokol o určení vnějších vlivů" },
      { id: 80, text: "Pověření odpovědné osoby za provoz elektrických zařízení" },
      { id: 81, text: "Harmonogram revizí a kontrol" },
      { id: 82, text: "Provedení revizí a kontrol (instalace, hromosvody atd.)" },
      { id: 83, text: "Vedení dokumentace (návody, technická dokumentace, revizní zprávy, karty spotřebičů, odstraňování nedostatků apod.)" }
    ]
  },
  {
    id: "M",
    title: "Vyhrazená technická tlaková zařízení",
    points: [
      { id: 84, text: "Směrnice / pokyny k provozu tlakových nádob stabilních" },
      { id: 85, text: "Pověření odpovědné osoby za bezpečný a hospodárný provoz tlakových nádob stabilních" },
      { id: 86, text: "Harmonogram revizí a kontrol" },
      { id: 87, text: "Provedení revizí a kontrol" },
      { id: 88, text: "Školení a zdravotní způsobilost obsluh" },
      { id: 89, text: "Vedení dokumentace (návody, technická dokumentace, revizní zprávy, odstraňování nedostatků apod.)" }
    ]
  },
  {
    id: "N",
    title: "Vyhrazená technická zdvihací zařízení",
    points: [
      { id: 90, text: "Systém bezpečné práce zdvihacích zařízení / provozní předpis" },
      { id: 91, text: "Pověření odpovědné osoby za provoz zdvihacích zařízení" },
      { id: 92, text: "Harmonogram revizí, inspekcí a kontrol" },
      { id: 93, text: "Provedení revizí a kontrol (zdvihací zařízení, příslušenství)" },
      { id: 94, text: "Školení a zdravotní způsobilost jeřábníka a vazače" },
      { id: 95, text: "Vedení dokumentace (návody, technická dokumentace, revizní zprávy, odstraňování nedostatků apod.)" }
    ]
  },
  {
    id: "O",
    title: "Vyhrazená technická plynová zařízení",
    points: [
      { id: 96, text: "Směrnice / pokyny k provozu plynových zařízení / spotřebičů" },
      { id: 97, text: "Pověření odpovědné osoby za provoz plynových zařízení / spotřebičů" },
      { id: 98, text: "Harmonogram revizí a kontrol" },
      { id: 99, text: "Provedení revizí a kontrol" },
      { id: 100, text: "Školení a zdravotní způsobilost obsluh" },
      { id: 101, text: "Vedení dokumentace (návody, technická dokumentace, revizní zprávy, odstraňování nedostatků apod.)" }
    ]
  },
  {
    id: "P",
    title: "Stroje a ostatní technická zařízení",
    points: [
      { id: 102, text: "Evidence strojů a ostatních technických zařízení (kovoobráběcí a tvářecí stroje, dřevozpracující stroje, žebříky a schůdky, sekční vrata apod.)" },
      { id: 103, text: "Provádění kontrol technického stavu min. 1x ročně" },
      { id: 104, text: "Vedení průvodní a provozní dokumentace", nText: "Zaměstnavatel nevede průvodní a provozní dokumentaci stroje nebo není vedena v celém rozsahu." },
      { id: 105, text: "Dostupnost návodů ke strojům a technickým zařízením" },
      { id: 106, text: "Seznámení zaměstnanců s návody, bezpečnostními pokyny, stanovení obsluh" }
    ]
  },
  {
    id: "Q",
    title: "Kotelna",
    points: [
      { id: 107, text: "Provozní řád kotelny" },
      { id: 108, text: "Provozní dokumentace kotelny" },
      { id: 109, text: "Pověření odpovědné osoby za provoz kotelny" },
      { id: 110, text: "Školení a zdravotní způsobilosti obsluhy / topiče" },
      { id: 111, text: "Větrání / přívod vzduchu, větrání neuzavíratelným otvorem u podlahy" },
      { id: 112, text: "Úniková cesta (do volného prostoru u kotelny nad 150m2)" },
      { id: 113, text: "Dveře z nehořlavého materiálu" },
      { id: 114, text: "Vedení provozního deníku / dokumentace" },
      { id: 115, text: "Zařízení pro zjišťování přítomnost oxidu uhelnatého" },
      { id: 116, text: "Přenosné hasicí přístroje (počet, druh)" },
      { id: 117, text: "Prostředky pro poskytnutí první pomoci" },
      { id: 118, text: "Odborná prohlídka kotelny (min. 1x za 12 měsíců)" },
      { id: 119, text: "Osvědčení a oprávnění osob k provádění revizí" }
    ]
  },
  {
    id: "R",
    title: "Nebezpečné chemické látky a směsi",
    points: [
      { id: 120, text: "Evidence nebezpečných chemických látek a směsí" },
      { id: 121, text: "Bezpečnostní listy (umístění, aktualizace apod.)" },
      { id: 122, text: "Seznámení zaměstnanců s bezpečnostními listy" },
      { id: 123, text: "Skladování a ukládání nebezpečných chemických látek (vyhrazené sklady, na pracovišti, bezpečné nádoby, označení apod.)" },
      { id: 124, text: "OOPP pro práci s nebezpečnými chemickými látkami" },
      { id: 125, text: "Prostředky pro zachycení úniku" }
    ]
  },
  {
    id: "S",
    title: "Hygienické požadavky na pracovišti",
    points: [
      { id: 126, text: "Osvětlení pracoviště" },
      { id: 127, text: "Větrání pracoviště / výměna vzduchu" },
      { id: 128, text: "Teplota na pracovišti, vytápění" },
      { id: 129, text: "Dostatečný pracovní prostor pro jednoho zaměstnance" },
      { id: 130, text: "Výška pracovní desky stolu" },
      { id: 131, text: "Umístění výpočetní techniky" },
      { id: 132, text: "Prostory pro převlékání a osobní hygienu" },
      { id: 133, text: "Místnost pro odpočinek (vybavení nábytkem, teplota min. 20°C, osvětlení, tekoucí teplá voda apod.)" }
    ]
  },
  {
    id: "T",
    title: "Kontrola dokumentace PO",
    points: [
      { id: 134, text: "Kolaudační rozhodnutí a užívání stavby v souladu s rozhodnutím" },
      { id: 135, text: "Požárně bezpečnostní řešení stavby" },
      { id: 136, text: "Dokumentace o začlenění do kategorie činností podle požárního nebezpečí" },
      { id: 136, text: "Stanovení organizace PO" },
      { id: 137, text: "Tematický plán a časový rozvrh školení PO vedoucích zaměstnanců" },
      { id: 138, text: "Tematický plán a časový rozvrh školení PO zaměstnanců" },
      { id: 139, text: "Tematický plán a časový rozvrh školení preventisty PO" },
      { id: 140, text: "Tematický plán a časový rozvrh školení preventivních požárních hlídek" },
      { id: 141, text: "Provedení školení o PO vedoucích zaměstnanců" },
      { id: 142, text: "Provedení školení o PO zaměstnanců" },
      { id: 143, text: "Provedení odborné přípravy a jmenování preventisty PO" },
      { id: 144, text: "Provedení odborné přípravy a jmenování preventivní požární hlídky" },
      { id: 145, text: "Požárně poplachová směrnice" },
      { id: 146, text: "Požární řád(y)" },
      { id: 147, text: "Pokyny pro činnost preventivní požární hlídky" },
      { id: 148, text: "Řád ohlašovny požáru" },
      { id: 149, text: "Požární evakuační plán" },
      { id: 150, text: "Dokumentace o zdolávání požáru" },
      { id: 151, text: "Požární kniha (umístění, vedení apod.)" },
      { id: 152, text: "Provádění preventivních požárních prohlídek (dodržování termínu, dokumentace, odstraňování zjištěných nedostatků)" },
      { id: 153, text: "Cvičný poplach (provedení, dokumentace apod.)" },
      { id: 154, text: "Dokumentace PBZ (doklad o montáži, funkční zkoušce, kontrole provozuschopnosti, údržbě a opravách)" },
      { id: 155, text: "Kontroly PBZ" },
      { id: 156, text: "Přenosné hasicí přístroje" },
      { id: 157, text: "Hydranty" },
      { id: 158, text: "Požární nádrž (kontroly, provozní řád)" },
      { id: 159, text: "Nouzové osvětlení (měsíční, roční)" },
      { id: 160, text: "Požární dveře" },
      { id: 161, text: "Požární nebo evakuační výtah" },
      { id: 162, text: "Zařízení pro požární signalizaci" },
      { id: 163, text: "Zařízení pro potlačení požáru nebo výbuchu" },
      { id: 164, text: "Zařízení pro usměrňování pohybu kouře při požáru" },
      { id: 165, text: "Zařízení pro omezení šíření požáru" },
      { id: 167, text: "Náhradní zdroje a prostředky pro požárně bezpečnostní zařízení" },
      { id: 168, text: "Zařízení zamezující iniciaci požáru nebo výbuchu" }
    ]
  }
];
