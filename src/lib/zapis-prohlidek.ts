/**
 * AuditFlow — zápis prohlídek při uložení reportu.
 * Umístění: src/lib/zapis-prohlidek.ts
 *
 * Volá se po uložení záznamu v nova-kontrola a upravit-zaznam.
 * Pro každé pracoviště v reportu založí (nebo aktualizuje) prohlídku
 * a dopočte měsíc a rok dalšího provedení.
 */

import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '@/components/data-provider';
import {
  typyProhlidekZKontroly, idProhlidky, dopocitejDalsi, VYCHOZI_PERIODA,
} from '@/lib/prohlidky';
import type { Prohlidka } from '@/lib/prohlidky';
import type { Zaznam } from '@/app/lib/types';

interface Vstup {
  klientId: string;
  typKontroly: Zaznam['typKontroly'];
  datum: string;
  /** id pracovišť, kterých se kontrola týkala */
  pracovisteIds: string[];
  /** pracoviště klienta — pro název (snapshot) */
  pracoviste: { id: string; nazev: string }[];
  zaznamId: string;
  zaznamCislo?: string;
}

/**
 * Zapíše prohlídky pro všechna pracoviště reportu.
 *
 * Chování:
 *   - jedno pracoviště = jeden dokument (varianta B)
 *   - BOZPaPO založí prověrku i PPP
 *   - existující prohlídka se aktualizuje, nevzniká duplicita
 *   - perioda už nastavená u klienta zůstane zachována
 *
 * Chyba zápisu se jen zaloguje — nesmí shodit uložení reportu.
 */
export async function zapisProhlidky(v: Vstup): Promise<void> {
  const typy = typyProhlidekZKontroly(v.typKontroly);
  if (typy.length === 0 || v.pracovisteIds.length === 0) return;

  const nazvy = new Map(v.pracoviste.map((p) => [p.id, p.nazev]));

  for (const typ of typy) {
    for (const pracovisteId of v.pracovisteIds) {
      const id = idProhlidky(v.klientId, pracovisteId, typ);
      const ref = doc(db, 'prohlidky', id);

      try {
        // Perioda nastavená ručně u klienta má přednost před výchozí.
        const stavajici = await getDoc(ref);
        const perioda = stavajici.exists()
          ? (stavajici.data() as Prohlidka).periodaMesice ?? VYCHOZI_PERIODA[typ]
          : VYCHOZI_PERIODA[typ];

        const dalsi = dopocitejDalsi(v.datum, perioda);

        const zaznam: Prohlidka = {
          id,
          klientId: v.klientId,
          pracovisteId,
          pracovisteNazev: nazvy.get(pracovisteId) ?? '',
          typ,
          posledniIso: v.datum,
          dalsiMesic: dalsi.mesic,
          dalsiRok: dalsi.rok,
          periodaMesice: perioda,
          zdrojZaznamId: v.zaznamId,
          zdrojCislo: v.zaznamCislo ?? '',
          stav: 'aktivni',
          updatedAt: new Date().toISOString(),
        };

        await setDoc(ref, zaznam, { merge: true });
      } catch (e) {
        // Nezdařený zápis prohlídky nesmí zablokovat uložení reportu.
        console.error('Zápis prohlídky selhal:', id, e);
      }
    }
  }
}
