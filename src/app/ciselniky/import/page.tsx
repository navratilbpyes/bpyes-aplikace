'use client';

/**
 * AuditFlow — jednorázový import číselníku revizí z „Matice revizí/kontrol BOZP/PO".
 * Umístění: src/app/ciselniky/import/page.tsx
 *
 * Běží pod přihlášeným ADMIN účtem v prohlížeči (client SDK, žádný service account).
 * Zápis do `ciselnikRevizi` chrání Firestore Rules (write = admin).
 *
 * Idempotentní: každá položka má deterministické ID (slug). Import používá
 * setDoc(merge:true) — existující položku aktualizuje, novou založí, ručně
 * přidané položky mimo matici nemaže.
 *
 * Po naplnění lze tuto stránku klidně smazat.
 */

import { useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db, useData } from '@/components/data-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, CheckCircle2, AlertTriangle, Database } from 'lucide-react';
import type { Oblast, TypLhuty } from '@/lib/revize';

interface MaticePolozka {
  id: string;
  oblast: Oblast;
  zarizeni: string;
  druhUkonu: string;
  lhutaText: string;
  kdoProvadi: string;
  periodaMesice: number;
  typLhuty: TypLhuty;
  nazev: string;
}

/** Data z matice (52 položek). Víceúkonové řádky rozděleny, lhůty převedeny. */
const MATICE: MaticePolozka[] = [
  { id: 'elektro-administrativa-revize-5-let', oblast: 'Elektro', zarizeni: 'Administrativa', druhUkonu: 'Revize', lhutaText: '5 let', kdoProvadi: 'Revizní technik elektro', periodaMesice: 60, typLhuty: 'kalendarni', nazev: 'Administrativa – Revize' },
  { id: 'elektro-vyroba-skoly-hotely-lekarske-ucely-revize-3-roky', oblast: 'Elektro', zarizeni: 'Výroba, školy, hotely, lékařské účely', druhUkonu: 'Revize', lhutaText: '3 roky', kdoProvadi: 'Revizní technik elektro', periodaMesice: 36, typLhuty: 'kalendarni', nazev: 'Výroba, školy, hotely, lékařské účely – Revize' },
  { id: 'elektro-prostory-s-pritomnosti-200-osob-revize-2-roky', oblast: 'Elektro', zarizeni: 'Prostory s přítomností > 200 osob', druhUkonu: 'Revize', lhutaText: '2 roky', kdoProvadi: 'Revizní technik elektro', periodaMesice: 24, typLhuty: 'kalendarni', nazev: 'Prostory s přítomností > 200 osob – Revize' },
  { id: 'elektro-prozatimni-zarizeni-stavenist-revize-0-5-roku', oblast: 'Elektro', zarizeni: 'Prozatímní zařízení stavenišť', druhUkonu: 'Revize', lhutaText: '0.5 roku', kdoProvadi: 'Revizní technik elektro', periodaMesice: 6, typLhuty: 'klouzava', nazev: 'Prozatímní zařízení stavenišť – Revize' },
  { id: 'elektro-pojizdne-a-prevozne-prostredky-revize-1-rok', oblast: 'Elektro', zarizeni: 'Pojízdné a převozné prostředky', druhUkonu: 'Revize', lhutaText: '1 rok', kdoProvadi: 'Revizní technik elektro', periodaMesice: 12, typLhuty: 'kalendarni', nazev: 'Pojízdné a převozné prostředky – Revize' },
  { id: 'elektro-prostory-s-nebezpecim-pozaru-vybuchu-revize-3-roky', oblast: 'Elektro', zarizeni: 'Prostory s nebezpečím požáru/výbuchu', druhUkonu: 'Revize', lhutaText: '3 roky', kdoProvadi: 'Revizní technik elektro', periodaMesice: 36, typLhuty: 'kalendarni', nazev: 'Prostory s nebezpečím požáru/výbuchu – Revize' },
  { id: 'elektro-lps-kriticke-systemy-vizualni-kontrola-1-rok', oblast: 'Elektro', zarizeni: 'LPS - Kritické systémy', druhUkonu: 'Vizuální kontrola', lhutaText: '1 rok', kdoProvadi: 'Pověřený zaměstnanec', periodaMesice: 12, typLhuty: 'kalendarni', nazev: 'LPS - Kritické systémy – Vizuální kontrola' },
  { id: 'elektro-lps-kriticke-systemy-revize-2-roky', oblast: 'Elektro', zarizeni: 'LPS - Kritické systémy', druhUkonu: 'Revize', lhutaText: '2 roky', kdoProvadi: 'Revizní technik elektro', periodaMesice: 24, typLhuty: 'kalendarni', nazev: 'LPS - Kritické systémy – Revize' },
  { id: 'elektro-lps-ostatni-objekty-vizualni-kontrola-1-rok', oblast: 'Elektro', zarizeni: 'LPS - Ostatní objekty', druhUkonu: 'Vizuální kontrola', lhutaText: '1 rok', kdoProvadi: 'Pověřený zaměstnanec', periodaMesice: 12, typLhuty: 'kalendarni', nazev: 'LPS - Ostatní objekty – Vizuální kontrola' },
  { id: 'elektro-lps-ostatni-objekty-revize-4-roky', oblast: 'Elektro', zarizeni: 'LPS - Ostatní objekty', druhUkonu: 'Revize', lhutaText: '4 roky', kdoProvadi: 'Revizní technik elektro', periodaMesice: 48, typLhuty: 'kalendarni', nazev: 'LPS - Ostatní objekty – Revize' },
  { id: 'tlak-nadoby-stabilni-i-a-ii-trida-provozni-revize-1x-za-1-rok', oblast: 'Tlak', zarizeni: 'Nádoby stabilní (I. a II. třída)', druhUkonu: 'Provozní revize', lhutaText: '1x za 1 rok', kdoProvadi: 'Revizní technik tlakových zařízení', periodaMesice: 12, typLhuty: 'kalendarni', nazev: 'Nádoby stabilní (I. a II. třída) – Provozní revize' },
  { id: 'tlak-nadoby-stabilni-i-a-ii-trida-vnitrni-revize-1x-za-5-let', oblast: 'Tlak', zarizeni: 'Nádoby stabilní (I. a II. třída)', druhUkonu: 'Vnitřní revize', lhutaText: '1x za 5 let', kdoProvadi: 'Revizní technik tlakových zařízení', periodaMesice: 60, typLhuty: 'kalendarni', nazev: 'Nádoby stabilní (I. a II. třída) – Vnitřní revize' },
  { id: 'tlak-nadoby-stabilni-i-a-ii-trida-tlakova-zkouska-1x-za-10-let', oblast: 'Tlak', zarizeni: 'Nádoby stabilní (I. a II. třída)', druhUkonu: 'Tlaková zkouška', lhutaText: '1x za 10 let', kdoProvadi: 'Revizní technik tlakových zařízení', periodaMesice: 120, typLhuty: 'kalendarni', nazev: 'Nádoby stabilní (I. a II. třída) – Tlaková zkouška' },
  { id: 'tlak-plynovody-do-4-baru-v-sidlech-provozni-revize-6-let', oblast: 'Tlak', zarizeni: 'Plynovody (do 4 barů) v sídlech', druhUkonu: 'Provozní revize', lhutaText: '6 let', kdoProvadi: 'Revizní technik plynových', periodaMesice: 72, typLhuty: 'kalendarni', nazev: 'Plynovody (do 4 barů) v sídlech – Provozní revize' },
  { id: 'tlak-plynovody-do-4-baru-v-sidlech-kontrola-1-rok', oblast: 'Tlak', zarizeni: 'Plynovody (do 4 barů) v sídlech', druhUkonu: 'Kontrola', lhutaText: '1 rok', kdoProvadi: 'Osoba pověřená kontrolou', periodaMesice: 12, typLhuty: 'kalendarni', nazev: 'Plynovody (do 4 barů) v sídlech – Kontrola' },
  { id: 'tlak-ostatni-plynarenska-zarizeni-provozni-revize-6-let', oblast: 'Tlak', zarizeni: 'Ostatní plynárenská zařízení', druhUkonu: 'Provozní revize', lhutaText: '6 let', kdoProvadi: 'Revizní technik plyn. zař.', periodaMesice: 72, typLhuty: 'kalendarni', nazev: 'Ostatní plynárenská zařízení – Provozní revize' },
  { id: 'tlak-ostatni-plynarenska-zarizeni-kontrola-1-rok', oblast: 'Tlak', zarizeni: 'Ostatní plynárenská zařízení', druhUkonu: 'Kontrola', lhutaText: '1 rok', kdoProvadi: 'Osoba pověřená kontrolou', periodaMesice: 12, typLhuty: 'kalendarni', nazev: 'Ostatní plynárenská zařízení – Kontrola' },
  { id: 'zdvihaci-skupina-jerabu-1-4-kontrola-prohlidka-3-mesice', oblast: 'Zdvihací', zarizeni: 'Skupina jeřábu 1-4', druhUkonu: 'Kontrola / prohlídka', lhutaText: '3 měsíce', kdoProvadi: 'Pověřená osoba (obsluha)', periodaMesice: 3, typLhuty: 'klouzava', nazev: 'Skupina jeřábu 1-4 – Kontrola / prohlídka' },
  { id: 'zdvihaci-skupina-jerabu-3-revize-2-roky', oblast: 'Zdvihací', zarizeni: 'Skupina jeřábu 3', druhUkonu: 'Revize', lhutaText: '2 roky', kdoProvadi: 'Revizní technik zdvihacích zařízení', periodaMesice: 24, typLhuty: 'kalendarni', nazev: 'Skupina jeřábu 3 – Revize' },
  { id: 'zdvihaci-skupina-jerabu-3-zkouska-4-roky', oblast: 'Zdvihací', zarizeni: 'Skupina jeřábu 3', druhUkonu: 'Zkouška', lhutaText: '4 roky', kdoProvadi: 'Revizní technik zdvihacích zařízení', periodaMesice: 48, typLhuty: 'kalendarni', nazev: 'Skupina jeřábu 3 – Zkouška' },
  { id: 'zdvihaci-pracovni-plosiny-stavebni-vytahy-kontrola-3-mesice', oblast: 'Zdvihací', zarizeni: 'Pracovní plošiny / Stavební výtahy', druhUkonu: 'Kontrola', lhutaText: '3 měsíce', kdoProvadi: 'Obsluha', periodaMesice: 3, typLhuty: 'klouzava', nazev: 'Pracovní plošiny / Stavební výtahy – Kontrola' },
  { id: 'zdvihaci-pracovni-plosiny-stavebni-vytahy-revize-1-rok', oblast: 'Zdvihací', zarizeni: 'Pracovní plošiny / Stavební výtahy', druhUkonu: 'Revize', lhutaText: '1 rok', kdoProvadi: 'Revizní technik zdvihacích zařízení', periodaMesice: 12, typLhuty: 'kalendarni', nazev: 'Pracovní plošiny / Stavební výtahy – Revize' },
  { id: 'zdvihaci-pracovni-plosiny-stavebni-vytahy-zkouska-1-rok', oblast: 'Zdvihací', zarizeni: 'Pracovní plošiny / Stavební výtahy', druhUkonu: 'Zkouška', lhutaText: '1 rok', kdoProvadi: 'Revizní technik zdvihacích zařízení', periodaMesice: 12, typLhuty: 'kalendarni', nazev: 'Pracovní plošiny / Stavební výtahy – Zkouška' },
  { id: 'zdvihaci-vytah-osobni-nakladni-po-r-1993-odborna-prohlidka-3-mesice', oblast: 'Zdvihací', zarizeni: 'Výtah (osobní/nákladní po r. 1993)', druhUkonu: 'Odborná prohlídka', lhutaText: '3 měsíce', kdoProvadi: 'Odborný servisní zaměstnanec', periodaMesice: 3, typLhuty: 'klouzava', nazev: 'Výtah (osobní/nákladní po r. 1993) – Odborná prohlídka' },
  { id: 'zdvihaci-vytah-osobni-nakladni-po-r-1993-odborna-zkouska-3-roky', oblast: 'Zdvihací', zarizeni: 'Výtah (osobní/nákladní po r. 1993)', druhUkonu: 'Odborná zkouška', lhutaText: '3 roky', kdoProvadi: 'Zkušební technik (servisní organizace)', periodaMesice: 36, typLhuty: 'kalendarni', nazev: 'Výtah (osobní/nákladní po r. 1993) – Odborná zkouška' },
  { id: 'zdvihaci-vytah-osobni-nakladni-inspekcni-prohlidka-6-let', oblast: 'Zdvihací', zarizeni: 'Výtah (osobní/nákladní)', druhUkonu: 'Inspekční prohlídka', lhutaText: '6 let', kdoProvadi: 'Inspekční orgán (např. TIČR / TÜV)', periodaMesice: 72, typLhuty: 'kalendarni', nazev: 'Výtah (osobní/nákladní) – Inspekční prohlídka' },
  { id: 'zdvihaci-vytah-vsechny-typy-bezna-prohlidka-pokud-neni-zrusena-14-dni-dle-navodu', oblast: 'Zdvihací', zarizeni: 'Výtah (všechny typy)', druhUkonu: 'Běžná prohlídka (pokud není zrušena)', lhutaText: '14 dní / dle návodu', kdoProvadi: 'Dozorce výtahu (proškolený zaměstnanec)', periodaMesice: 0, typLhuty: 'text', nazev: 'Výtah (všechny typy) – Běžná prohlídka (pokud není zrušena)' },
  { id: 'po-pbz-hasici-pristroje-kontrola-provozuschopnosti-1x-za-rok', oblast: 'PO', zarizeni: 'Hasicí přístroje', druhUkonu: 'Kontrola provozuschopnosti', lhutaText: '1x za rok', kdoProvadi: 'Osoba s odbornou způsobilostí pro kontroly HP', periodaMesice: 12, typLhuty: 'kalendarni', nazev: 'Hasicí přístroje – Kontrola provozuschopnosti' },
  { id: 'po-pbz-hasici-pristroje-vodni-penove-periodicka-zkouska-tlakova-1x-za-3-roky', oblast: 'PO', zarizeni: 'Hasicí přístroje (vodní, pěnové)', druhUkonu: 'Periodická zkouška (tlaková)', lhutaText: '1x za 3 roky', kdoProvadi: 'Revizní technik / Servisní organizace', periodaMesice: 36, typLhuty: 'kalendarni', nazev: 'Hasicí přístroje (vodní, pěnové) – Periodická zkouška (tlaková)' },
  { id: 'po-pbz-hasici-pristroje-ostatni-periodicka-zkouska-tlakova-1x-za-5-let', oblast: 'PO', zarizeni: 'Hasicí přístroje (ostatní)', druhUkonu: 'Periodická zkouška (tlaková)', lhutaText: '1x za 5 let', kdoProvadi: 'Revizní technik / Servisní organizace', periodaMesice: 60, typLhuty: 'kalendarni', nazev: 'Hasicí přístroje (ostatní) – Periodická zkouška (tlaková)' },
  { id: 'po-pbz-elektricka-pozarni-signalizace-eps-kontrola-provozuschopnosti-1x-za-rok', oblast: 'PO', zarizeni: 'Elektrická požární signalizace (EPS)', druhUkonu: 'Kontrola provozuschopnosti', lhutaText: '1x za rok', kdoProvadi: 'Osoba oprávněná výrobcem k montáži a údržbě', periodaMesice: 12, typLhuty: 'kalendarni', nazev: 'Elektrická požární signalizace (EPS) – Kontrola provozuschopnosti' },
  { id: 'po-pbz-eps-pulrocni-zkouska-cinnosti-2x-za-rok', oblast: 'PO', zarizeni: 'EPS', druhUkonu: 'Půlroční zkouška činnosti', lhutaText: '2x za rok', kdoProvadi: 'Pověřená osoba / Osoba oprávněná výrobcem', periodaMesice: 6, typLhuty: 'klouzava', nazev: 'EPS – Půlroční zkouška činnosti' },
  { id: 'po-pbz-eps-mesicni-kontrola-ustredny-1x-za-mesic', oblast: 'PO', zarizeni: 'EPS', druhUkonu: 'Měsíční kontrola ústředny', lhutaText: '1x za měsíc', kdoProvadi: 'Zaškolená obsluha EPS', periodaMesice: 1, typLhuty: 'klouzava', nazev: 'EPS – Měsíční kontrola ústředny' },
  { id: 'po-pbz-zarizeni-dalkoveho-prenosu-zdp-kontrola-provozuschopnosti-1x-za-rok', oblast: 'PO', zarizeni: 'Zařízení dálkového přenosu (ZDP)', druhUkonu: 'Kontrola provozuschopnosti', lhutaText: '1x za rok', kdoProvadi: 'Osoba oprávněná výrobcem / provozovatel ZDP', periodaMesice: 12, typLhuty: 'kalendarni', nazev: 'Zařízení dálkového přenosu (ZDP) – Kontrola provozuschopnosti' },
  { id: 'po-pbz-stabilni-hasici-zarizeni-shz-kontrola-provozuschopnosti-1x-za-rok', oblast: 'PO', zarizeni: 'Stabilní hasicí zařízení (SHZ)', druhUkonu: 'Kontrola provozuschopnosti', lhutaText: '1x za rok', kdoProvadi: 'Osoba oprávněná výrobcem k montáži a údržbě', periodaMesice: 12, typLhuty: 'kalendarni', nazev: 'Stabilní hasicí zařízení (SHZ) – Kontrola provozuschopnosti' },
  { id: 'po-pbz-zarizeni-pro-odvod-koure-a-tepla-zokt-kontrola-provozuschopnosti-1x-za-ro', oblast: 'PO', zarizeni: 'Zařízení pro odvod kouře a tepla (ZOKT)', druhUkonu: 'Kontrola provozuschopnosti', lhutaText: '1x za rok', kdoProvadi: 'Osoba oprávněná výrobcem k montáži a údržbě', periodaMesice: 12, typLhuty: 'kalendarni', nazev: 'Zařízení pro odvod kouře a tepla (ZOKT) – Kontrola provozuschopnosti' },
  { id: 'po-pbz-pozarni-klapky-kontrola-provozuschopnosti-1x-za-rok', oblast: 'PO', zarizeni: 'Požární klapky', druhUkonu: 'Kontrola provozuschopnosti', lhutaText: '1x za rok', kdoProvadi: 'Osoba oprávněná výrobcem', periodaMesice: 12, typLhuty: 'kalendarni', nazev: 'Požární klapky – Kontrola provozuschopnosti' },
  { id: 'po-pbz-pozarni-dvere-a-uzavery-otvoru-kontrola-provozuschopnosti-1x-za-rok', oblast: 'PO', zarizeni: 'Požární dveře a uzávěry otvorů', druhUkonu: 'Kontrola provozuschopnosti', lhutaText: '1x za rok', kdoProvadi: 'Osoba oprávněná (proškolená) výrobcem', periodaMesice: 12, typLhuty: 'kalendarni', nazev: 'Požární dveře a uzávěry otvorů – Kontrola provozuschopnosti' },
  { id: 'po-pbz-nouzove-osvetleni-kontrola-provozuschopnosti-1x-za-rok', oblast: 'PO', zarizeni: 'Nouzové osvětlení', druhUkonu: 'Kontrola provozuschopnosti', lhutaText: '1x za rok', kdoProvadi: 'Revizní technik elektro / Osoba oprávněná výrobcem', periodaMesice: 12, typLhuty: 'kalendarni', nazev: 'Nouzové osvětlení – Kontrola provozuschopnosti' },
  { id: 'po-pbz-vnitrni-pozarni-vodovod-hydranty-kontrola-provozuschopnosti-1x-za-rok', oblast: 'PO', zarizeni: 'Vnitřní požární vodovod (hydranty)', druhUkonu: 'Kontrola provozuschopnosti', lhutaText: '1x za rok', kdoProvadi: 'Osoba s odbornou způsobilostí (zaškolená)', periodaMesice: 12, typLhuty: 'kalendarni', nazev: 'Vnitřní požární vodovod (hydranty) – Kontrola provozuschopnosti' },
  { id: 'po-pbz-pozarni-ucpavky-a-prepazky-kontrola-provozuschopnosti-1x-za-rok', oblast: 'PO', zarizeni: 'Požární ucpávky a přepážky', druhUkonu: 'Kontrola provozuschopnosti', lhutaText: '1x za rok', kdoProvadi: 'Osoba oprávněná montážní organizací/výrobcem', periodaMesice: 12, typLhuty: 'kalendarni', nazev: 'Požární ucpávky a přepážky – Kontrola provozuschopnosti' },
  { id: 'ostatni-regaly-skladove-odborna-kontrola-1x-za-12-mesicu', oblast: 'Ostatní', zarizeni: 'Regály (skladové)', druhUkonu: 'Odborná kontrola', lhutaText: '1x za 12 měsíců', kdoProvadi: 'Pověřená osoba (proškolená) / Externí inspektor', periodaMesice: 12, typLhuty: 'klouzava', nazev: 'Regály (skladové) – Odborná kontrola' },
  { id: 'ostatni-regaly-bezna-vizualni-kontrola-dle-mistniho-radu-napr-1x-mesicne', oblast: 'Ostatní', zarizeni: 'Regály', druhUkonu: 'Běžná vizuální kontrola', lhutaText: 'Dle místního řádu (např. 1x měsíčně)', kdoProvadi: 'Obsluha / Vedoucí skladu', periodaMesice: 0, typLhuty: 'text', nazev: 'Regály – Běžná vizuální kontrola' },
  { id: 'ostatni-zebriky-a-stafle-pravidelna-kontrola-stavu-1x-za-12-mesicu', oblast: 'Ostatní', zarizeni: 'Žebříky a štafle', druhUkonu: 'Pravidelná kontrola stavu', lhutaText: '1x za 12 měsíců', kdoProvadi: 'Pověřená osoba (vedoucí úseku)', periodaMesice: 12, typLhuty: 'klouzava', nazev: 'Žebříky a štafle – Pravidelná kontrola stavu' },
  { id: 'ostatni-strojni-zarizeni-lisy-pily-atd-kontrola-bezpecnosti-provozu-1x-za-12-mes', oblast: 'Ostatní', zarizeni: 'Strojní zařízení (lisy, pily atd.)', druhUkonu: 'Kontrola bezpečnosti provozu', lhutaText: '1x za 12 měsíců', kdoProvadi: 'Pověřená osoba údržby / Technik BOZP', periodaMesice: 12, typLhuty: 'klouzava', nazev: 'Strojní zařízení (lisy, pily atd.) – Kontrola bezpečnosti provozu' },
  { id: 'ostatni-motorove-manipulacni-voziky-vzv-technicka-kontrola-1x-za-12-mesicu', oblast: 'Ostatní', zarizeni: 'Motorové manipulační vozíky (VZV)', druhUkonu: 'Technická kontrola', lhutaText: '1x za 12 měsíců', kdoProvadi: 'Odborný technický kontrolor vozíků', periodaMesice: 12, typLhuty: 'klouzava', nazev: 'Motorové manipulační vozíky (VZV) – Technická kontrola' },
  { id: 'ostatni-vzv-na-lpg-kontrola-plynoveho-zarizeni-1x-za-12-mesicu', oblast: 'Ostatní', zarizeni: 'VZV na LPG', druhUkonu: 'Kontrola plynového zařízení', lhutaText: '1x za 12 měsíců', kdoProvadi: 'Revizní technik plynových zařízení', periodaMesice: 12, typLhuty: 'klouzava', nazev: 'VZV na LPG – Kontrola plynového zařízení' },
  { id: 'ostatni-rucni-paletove-voziky-kontrola-bezpecnosti-provozu-1x-za-12-mesicu', oblast: 'Ostatní', zarizeni: 'Ruční paletové vozíky', druhUkonu: 'Kontrola bezpečnosti provozu', lhutaText: '1x za 12 měsíců', kdoProvadi: 'Pověřená osoba (údržba)', periodaMesice: 12, typLhuty: 'klouzava', nazev: 'Ruční paletové vozíky – Kontrola bezpečnosti provozu' },
  { id: 'ostatni-motorova-prumyslova-vrata-a-brany-kontrola-a-zkouska-bezpecnosti-1x-za-1', oblast: 'Ostatní', zarizeni: 'Motorová průmyslová vrata a brány', druhUkonu: 'Kontrola a zkouška bezpečnosti', lhutaText: '1x za 12 měsíců', kdoProvadi: 'Pověřený servisní technik / OZO', periodaMesice: 12, typLhuty: 'klouzava', nazev: 'Motorová průmyslová vrata a brány – Kontrola a zkouška bezpečnosti' },
  { id: 'ostatni-vazacske-prostredky-lana-popruhy-odborna-prohlidka-1x-za-12-mesicu', oblast: 'Ostatní', zarizeni: 'Vazačské prostředky (lana, popruhy)', druhUkonu: 'Odborná prohlídka', lhutaText: '1x za 12 měsíců', kdoProvadi: 'Pověřená osoba / Revizní technik ZZ', periodaMesice: 12, typLhuty: 'klouzava', nazev: 'Vazačské prostředky (lana, popruhy) – Odborná prohlídka' },
  { id: 'ostatni-oopp-proti-padu-periodicka-odborna-prohlidka-1x-za-12-mesicu', oblast: 'Ostatní', zarizeni: 'OOPP proti pádu', druhUkonu: 'Periodická odborná prohlídka', lhutaText: '1x za 12 měsíců', kdoProvadi: 'Odborně způsobilá osoba proškolená výrobcem', periodaMesice: 12, typLhuty: 'klouzava', nazev: 'OOPP proti pádu – Periodická odborná prohlídka' },
  { id: 'ostatni-lekarnicky-kontrola-expirace-a-doplneni-1x-za-12-mesicu', oblast: 'Ostatní', zarizeni: 'Lékárničky', druhUkonu: 'Kontrola expirace a doplnění', lhutaText: '1x za 12 měsíců', kdoProvadi: 'Pověřená osoba', periodaMesice: 12, typLhuty: 'klouzava', nazev: 'Lékárničky – Kontrola expirace a doplnění' },];

export default function ImportCiselnikuPage() {
  const { userProfile } = useData();
  const isAdmin = userProfile?.role === 'admin';

  const [bezi, setBezi] = useState(false);
  const [hotovo, setHotovo] = useState(0);
  const [celkem] = useState(MATICE.length);
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

    for (const p of MATICE) {
      try {
        await setDoc(
          doc(db, 'ciselnikRevizi', p.id),
          {
            nazev: p.nazev,
            periodaMesice: p.periodaMesice,
            stav: 'aktivni',
            oblast: p.oblast,
            zarizeni: p.zarizeni,
            druhUkonu: p.druhUkonu,
            lhutaText: p.lhutaText,
            kdoProvadi: p.kdoProvadi,
            typLhuty: p.typLhuty,
          },
          { merge: true },
        );
        n += 1;
        setHotovo(n);
      } catch (e: any) {
        noveChyby.push(`${p.nazev}: ${e?.message ?? 'chyba'}`);
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
          <Database className="h-6 w-6 text-blue-600" /> Import číselníku revizí
        </h1>
        <p className="text-muted-foreground mt-1">
          Naplní <code className="text-xs bg-muted px-1 py-0.5 rounded">ciselnikRevizi</code> z matice
          revizí/kontrol ({celkem} položek). Lze spustit opakovaně — existující položky se
          aktualizují, ručně přidané se nemažou.
        </p>
      </header>

      <Card>
        <CardContent className="py-6 space-y-4">
          <Button onClick={spustImport} disabled={bezi} size="lg">
            {bezi ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Database className="h-4 w-4 mr-2" />}
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
