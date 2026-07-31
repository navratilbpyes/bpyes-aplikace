'use client';

/**
 * AuditFlow — načtení časového plánu klienta z Firestore.
 * Umístění: src/hooks/use-casovy-plan.ts
 *
 * Sesbírá čtyři zdroje a vrátí sjednocené, seřazené položky.
 * Komponenta dashboardu se tak nestará o Firestore vůbec.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  collection, query, where, getDocs,
} from 'firebase/firestore';
import { db } from '@/components/data-provider';
import { sestavCasovyPlan, spoctiMetriky } from '@/lib/casovy-plan';
import type { PolozkaPlanu, Metriky } from '@/lib/casovy-plan';
import type { RevizeKlienta } from '@/lib/revize';
import type { SkoleniKlienta } from '@/lib/skoleni';
import type { Prohlidka } from '@/lib/prohlidky';
import type { Zaznam } from '@/app/lib/types';

interface Vysledek {
  polozky: PolozkaPlanu[];
  metriky: Metriky;
  nacitam: boolean;
  chyba: string | null;
  obnovit: () => void;
}

export function useCasovyPlan(klientId: string | undefined): Vysledek {
  const [polozky, setPolozky] = useState<PolozkaPlanu[]>([]);
  const [metriky, setMetriky] = useState<Metriky>({ do30dni: 0, otevreneNalezy: 0, poTerminu: 0 });
  const [nacitam, setNacitam] = useState(true);
  const [chyba, setChyba] = useState<string | null>(null);

  const nacti = useCallback(async () => {
    if (!klientId) {
      setNacitam(false);
      return;
    }
    setNacitam(true);
    setChyba(null);
    try {
      const [revSnap, skoSnap, proSnap, zazSnap] = await Promise.all([
        getDocs(query(
          collection(db, 'klienti', klientId, 'revize'),
          where('stav', '==', 'aktivni'),
        )),
        getDocs(query(
          collection(db, 'klienti', klientId, 'skoleni'),
          where('stav', '==', 'aktivni'),
        )),
        getDocs(query(
          collection(db, 'prohlidky'),
          where('klientId', '==', klientId),
          where('stav', '==', 'aktivni'),
        )),
        getDocs(query(
          collection(db, 'zaznamy'),
          where('klientId', '==', klientId),
        )),
      ]);

      const revize = revSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as RevizeKlienta);
      const skoleni = skoSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as SkoleniKlienta);
      const prohlidky = proSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Prohlidka);
      const zaznamy = zazSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Zaznam);

      const plan = sestavCasovyPlan({ revize, skoleni, prohlidky, zaznamy });
      setPolozky(plan);
      setMetriky(spoctiMetriky(plan));
    } catch (e) {
      console.error('Načtení časového plánu selhalo:', e);
      setChyba('Časový plán se nepodařilo načíst.');
    } finally {
      setNacitam(false);
    }
  }, [klientId]);

  useEffect(() => { nacti(); }, [nacti]);

  return { polozky, metriky, nacitam, chyba, obnovit: nacti };
}
