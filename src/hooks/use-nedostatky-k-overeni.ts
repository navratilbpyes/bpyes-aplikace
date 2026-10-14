'use client';

/**
 * AuditFlow — nedostatky z revizí, které klient nahlásil jako odstraněné
 * a čekají na ověření OZO (admin, dashboard „Čeká na vaši revizi").
 * Umístění: src/hooks/use-nedostatky-k-overeni.ts
 *
 * Bez collectionGroup (nevyžaduje index ani změnu Rules): projde klienty
 * z DataProvideru a načte jejich revize, stejně jako ProtokolyKeKontrole.
 */

import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db, useData } from '@/components/data-provider';
import { stavNedostatku } from '@/lib/nedostatky';
import type { RevizeKlienta } from '@/lib/revize';

export interface NedostatekKOvereni {
  klientId: string;
  klientNazev: string;
  revizeId: string;
  revizeNazev: string;
  nedostatekId: string;
  popis: string;
  jmeno?: string | null;
  datumIso?: string | null;
}

export function useNedostatkyKOvereni(): { polozky: NedostatekKOvereni[]; nacitam: boolean } {
  const { klienti, userProfile } = useData();
  const jeAdmin = userProfile?.role === 'admin';
  const [polozky, setPolozky] = useState<NedostatekKOvereni[]>([]);
  const [nacitam, setNacitam] = useState(true);

  // stabilní klíč, ať se efekt nespouští po každém renderu
  const klientiKlic = useMemo(() => klienti.map((k) => k.id).join(','), [klienti]);

  useEffect(() => {
    if (!jeAdmin) { setNacitam(false); return; }
    let zruseno = false;

    (async () => {
      setNacitam(true);
      try {
        const nalezene: NedostatekKOvereni[] = [];
        await Promise.all(
          klienti.map(async (k) => {
            try {
              const snap = await getDocs(collection(db, 'klienti', k.id, 'revize'));
              snap.docs.forEach((d) => {
                const r = { id: d.id, ...d.data() } as RevizeKlienta;
                if (r.stav === 'smazano') return;
                for (const n of r.nedostatky ?? []) {
                  if (stavNedostatku(n) !== 'ceka_na_overeni') continue;
                  nalezene.push({
                    klientId: k.id,
                    klientNazev: k.nazev ?? 'Neznámý klient',
                    revizeId: r.id,
                    revizeNazev: r.nazev ?? '(bez názvu)',
                    nedostatekId: n.id,
                    popis: n.popis || 'Nedostatek bez popisu',
                    jmeno: n.jmenoVyresitele,
                    datumIso: n.datumVyreseniKlientem,
                  });
                }
              });
            } catch {
              /* jednoho klienta přeskoč, ostatní pokračují */
            }
          }),
        );
        nalezene.sort(
          (a, b) => new Date(b.datumIso ?? 0).getTime() - new Date(a.datumIso ?? 0).getTime(),
        );
        if (!zruseno) setPolozky(nalezene);
      } finally {
        if (!zruseno) setNacitam(false);
      }
    })();

    return () => { zruseno = true; };
  }, [jeAdmin, klientiKlic, klienti]);

  return { polozky, nacitam };
}
