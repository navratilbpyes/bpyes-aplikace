'use client';

/**
 * AuditFlow — časový plán napříč všemi klienty (admin).
 * Umístění: src/hooks/use-plan-vsech.ts
 *
 * Projde klienty z DataProvideru a načte jejich termíny. Ke každé
 * položce doplní jméno klienta a odkaz do jeho karty.
 */

import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db, useData } from '@/components/data-provider';
import { sestavCasovyPlan } from '@/lib/casovy-plan';
import type { PolozkaPlanu } from '@/lib/casovy-plan';
import type { RevizeKlienta } from '@/lib/revize';
import type { SkoleniKlienta } from '@/lib/skoleni';
import type { Prohlidka } from '@/lib/prohlidky';
import type { Zaznam } from '@/app/lib/types';

/** Položka rozšířená o klienta. */
export interface PolozkaSKlientem extends PolozkaPlanu {
  klientId: string;
  klientNazev: string;
}

interface Vysledek {
  polozky: PolozkaSKlientem[];
  klienti: { id: string; nazev: string }[];
  nacitam: boolean;
  chyba: string | null;
  obnovit: () => void;
}

export function usePlanVsech(): Vysledek {
  const { klienti } = useData();
  const [polozky, setPolozky] = useState<PolozkaSKlientem[]>([]);
  const [nacitam, setNacitam] = useState(true);
  const [chyba, setChyba] = useState<string | null>(null);

  const nacti = useCallback(async () => {
    if (!klienti || klienti.length === 0) {
      setPolozky([]);
      setNacitam(false);
      return;
    }
    setNacitam(true);
    setChyba(null);
    try {
      // Nálezy a prohlídky umí jeden dotaz napříč všemi klienty.
      const [zazSnap, proSnap] = await Promise.all([
        getDocs(collection(db, 'zaznamy')),
        getDocs(query(collection(db, 'prohlidky'), where('stav', '==', 'aktivni'))),
      ]);
      const vsechnyZaznamy = zazSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Zaznam);
      const vsechnyProhlidky = proSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Prohlidka);

      // Revize a školení jsou subkolekce → načteme per klient paralelně.
      const perKlient = await Promise.all(
        klienti.map(async (k) => {
          const [revSnap, skoSnap] = await Promise.all([
            getDocs(query(
              collection(db, 'klienti', k.id, 'revize'),
              where('stav', '==', 'aktivni'),
            )),
            getDocs(query(
              collection(db, 'klienti', k.id, 'skoleni'),
              where('stav', '==', 'aktivni'),
            )),
          ]);
          const revize = revSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as RevizeKlienta);
          const skoleni = skoSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as SkoleniKlienta);

          const plan = sestavCasovyPlan({
            klientId: k.id,
            revize,
            skoleni,
            prohlidky: vsechnyProhlidky.filter((p) => p.klientId === k.id),
            zaznamy: vsechnyZaznamy.filter((z) => z.klientId === k.id),
          });

          return plan.map((p): PolozkaSKlientem => ({
            ...p,
            klientId: k.id,
            klientNazev: k.nazev,
          }));
        }),
      );

      // Sloučit a znovu seřadit napříč klienty podle naléhavosti a data.
      const RANK = { po_terminu: 0, blizi_se: 1, ok: 2 };
      const vse = perKlient.flat().sort((a, b) => {
        const r = RANK[a.naliehavost] - RANK[b.naliehavost];
        if (r !== 0) return r;
        const ta = a.terminDatum?.getTime() ?? Infinity;
        const tb = b.terminDatum?.getTime() ?? Infinity;
        return ta - tb;
      });

      setPolozky(vse);
    } catch (e) {
      console.error('Načtení plánu napříč klienty selhalo:', e);
      setChyba('Plán se nepodařilo načíst.');
    } finally {
      setNacitam(false);
    }
  }, [klienti]);

  useEffect(() => { nacti(); }, [nacti]);

  const seznamKlientu = (klienti ?? [])
    .map((k) => ({ id: k.id, nazev: k.nazev }))
    .sort((a, b) => a.nazev.localeCompare(b.nazev, 'cs'));

  return { polozky, klienti: seznamKlientu, nacitam, chyba, obnovit: nacti };
}
