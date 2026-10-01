/**
 * AuditFlow — automatický souhrn školení klienta z Lidských zdrojů.
 * Umístění: src/lib/souhrn-skoleni.ts
 *
 * Pro každou relevantní položku klienta (Nastavení klienta) vede v
 * `klienti/{id}/skoleni` jeden řádek `auto-{položka}`:
 *   • poslední = nejnovější školení kterékoli dotčené osoby,
 *   • další = nejbližší končící termín mezi dotčenými osobami,
 *   • osoba bez záznamu se počítá jako po termínu (dnešek).
 * Řádky se vedou jako zbytek školení klienta, takže je čte i časový plán, dashboard,
 * požární kniha a Moje revize. Ručně zadané (starší) řádky se nemění.
 * Volá se pod ADMINEM (zápis do podkolekce školení je jen admin).
 */

import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc,
} from 'firebase/firestore';
import { db } from '@/components/data-provider';
import type { CiselnikSkoleni } from './skoleni';
import { nactiOsoby, aktivniCinnosti, jeAktivni } from './osoby';
import { nactiUdalosti, dalsiTermin } from './udalosti';
import { sestavCinnosti, prepojOsobu } from './cinnosti-adapter';

export const AUTO_PREFIX = 'auto-';

/** Dnešek o půlnoci (místní čas) jako ISO — stabilní během dne, ať se zbytečně nepřepisuje. */
function dnesPulnoc(): string {
  return new Date(new Date().toDateString()).toISOString();
}

export interface VysledekSouhrnu {
  zapsano: number;
  odebrano: number;
}

export async function synchronizujSouhrn(klientId: string): Promise<VysledekSouhrnu | null> {
  const klientSnap = await getDoc(doc(db, 'klienti', klientId));
  if (!klientSnap.exists()) return null;
  const relevantni: string[] = klientSnap.data().relevantniPolozky ?? [];

  const [ciselnikSnap, osobyRaw, udalosti, existujiciSnap] = await Promise.all([
    getDocs(collection(db, 'ciselnikSkoleni')),
    nactiOsoby(klientId),
    nactiUdalosti(klientId),
    getDocs(collection(db, 'klienti', klientId, 'skoleni')),
  ]);

  const polozky = ciselnikSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as CiselnikSkoleni)
    .filter((s) => s.stav === 'aktivni' && (!s.klientId || s.klientId === klientId));
  const mapa = new Map(polozky.map((p) => [p.id, p]));
  const { cinnosti, alias } = sestavCinnosti(polozky);
  const cinnostMapa = new Map(cinnosti.map((c) => [c.id, c]));
  const osoby = osobyRaw.map((o) => prepojOsobu(o, alias)).filter(jeAktivni);

  // relevantní = zaškrtnuté + vlastní položky klienta; k tomu to, co z nich vyplývá
  const zakladni = new Set<string>([
    ...relevantni,
    ...polozky.filter((p) => p.klientId === klientId).map((p) => p.id),
  ]);
  const sledovane = new Set<string>();
  const pridej = (id: string) => {
    const p = mapa.get(id);
    if (p && !p.bezSkoleniPovereni && (p.periodaMesice ?? 0) > 0) sledovane.add(id);
  };
  zakladni.forEach((id) => {
    pridej(id);
    (mapa.get(id)?.souvisejiciIds ?? []).forEach(pridej);
  });
  // bez nastavení relevance se nic nevede
  if (relevantni.length === 0 && ![...zakladni].some((id) => mapa.get(id)?.klientId === klientId)) {
    sledovane.clear();
  }

  const dnes = dnesPulnoc();
  const zadane = new Map<string, Record<string, unknown>>();

  sledovane.forEach((id) => {
    const p = mapa.get(id)!;
    // osoby, kterých se školení týká: mají ho přiřazené přímo, nebo z činnosti
    const dotcene = osoby.filter((o) =>
      aktivniCinnosti(o).some((a) => a.cinnostId === id
        || (cinnostMapa.get(a.cinnostId)?.skoleniIds ?? []).includes(id)));

    let posledniIso: string | null = null;
    let dalsiIso: string | null = null;
    let bezZaznamu = 0;
    for (const o of dotcene) {
      const zaznamy = udalosti
        .filter((u) => u.osobaId === o.id && u.typ === 'skoleni' && u.temaId === id && u.vstupni !== true)
        .sort((a, b) => (b.datum ?? '').localeCompare(a.datum ?? ''));
      const nejnovejsi = zaznamy[0];
      const termin = dalsiTermin(nejnovejsi, p.periodaMesice);
      if (!nejnovejsi || !termin) {
        bezZaznamu += 1;
        if (!dalsiIso || dnes < dalsiIso) dalsiIso = dnes;
        continue;
      }
      if (!posledniIso || nejnovejsi.datum > posledniIso) posledniIso = nejnovejsi.datum;
      if (!dalsiIso || termin < dalsiIso) dalsiIso = termin;
    }

    zadane.set(AUTO_PREFIX + id, {
      ciselnikId: id,
      nazev: p.nazev,
      periodaMesice: p.periodaMesice,
      provadi: p.provadi ?? null,
      pozarniRadek: p.pozarniRadek ?? null,
      posledniIso,
      dalsiIso,
      dalsiRucne: !!dalsiIso,
      pocetOsob: dotcene.length,
      pocetBezZaznamu: bezZaznamu,
      auto: true,
      stav: 'aktivni',
      zadal: 'ozo',
      potvrzenoOzo: true,
    });
  });

  let zapsano = 0;
  let odebrano = 0;
  const existujici = new Map(existujiciSnap.docs.map((d) => [d.id, d.data()]));
  const pole = [
    'ciselnikId', 'nazev', 'periodaMesice', 'provadi', 'pozarniRadek', 'posledniIso',
    'dalsiIso', 'dalsiRucne', 'pocetOsob', 'pocetBezZaznamu', 'stav',
  ];

  for (const [docId, data] of zadane) {
    const stare = existujici.get(docId);
    const zmena = !stare || pole.some((k) => (stare[k] ?? null) !== (data[k] ?? null));
    if (!zmena) continue;
    // merge → nepřepíše protokolová pole, která mohl doplnit klient
    await setDoc(doc(db, 'klienti', klientId, 'skoleni', docId), data, { merge: true });
    zapsano += 1;
  }

  // řádky, které už nejsou relevantní
  for (const [docId, data] of existujici) {
    if (!docId.startsWith(AUTO_PREFIX) || zadane.has(docId) || data.stav === 'smazano') continue;
    await updateDoc(doc(db, 'klienti', klientId, 'skoleni', docId), { stav: 'smazano' });
    odebrano += 1;
  }

  return { zapsano, odebrano };
}
