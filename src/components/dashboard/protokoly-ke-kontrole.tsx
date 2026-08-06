'use client';

/**
 * AuditFlow — dashboard panel „Nové protokoly od klientů".
 * Umístění: src/components/dashboard/protokoly-ke-kontrole.tsx
 *
 * Sesbírá revize a školení všech klientů, které mají protokolStav === 'ceka'
 * (klient nahrál protokol, čeká na OZO). Admin-only.
 *
 * Záměrně NEČTE přes collectionGroup (vyžadovalo by index + rozšíření Rules).
 * Místo toho projde klienty (už v paměti z useData) a načte jejich revize/
 * školení přes getDocs. Řazení v paměti, žádný index — v souladu se zbytkem app.
 *
 * Odkaz „Otevřít" vede na admin kartu klienta, kde protokol OZO odklikne
 * (Viděl jsem / Odmítnout) přes komponentu ProtokolUpload.
 */

import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db, useData } from '@/components/data-provider';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Clock, Eye, Loader2, Inbox } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface CekajiciProtokol {
  klientId: string;
  klientNazev: string;
  druh: 'revize' | 'skoleni';
  nazev: string;
  soubor: string;
}

export default function ProtokolyKeKontrole() {
  const { klienti, userProfile } = useData();
  const router = useRouter();
  const isAdmin = userProfile?.role === 'admin';

  const [polozky, setPolozky] = useState<CekajiciProtokol[]>([]);
  const [nacitam, setNacitam] = useState(true);

  // stabilní klíč, ať se efekt nespouští po každém renderu
  const klientiKlic = useMemo(
    () => klienti.map((k) => k.id).join(','),
    [klienti],
  );

  useEffect(() => {
    if (!isAdmin) { setNacitam(false); return; }
    let zruseno = false;

    (async () => {
      setNacitam(true);
      try {
        const nalezene: CekajiciProtokol[] = [];
        await Promise.all(
          klienti.map(async (k) => {
            for (const druh of ['revize', 'skoleni'] as const) {
              try {
                const snap = await getDocs(collection(db, 'klienti', k.id, druh));
                snap.docs.forEach((d) => {
                  const f = d.data() as any;
                  if (f.stav !== 'smazano' && f.protokolStav === 'ceka') {
                    nalezene.push({
                      klientId: k.id,
                      klientNazev: k.nazev ?? 'Neznámý klient',
                      druh,
                      nazev: f.nazev ?? '(bez názvu)',
                      soubor: f.protokolNazev ?? 'protokol',
                    });
                  }
                });
              } catch {
                /* jednoho klienta přeskoč, ostatní pokračují */
              }
            }
          }),
        );
        nalezene.sort((a, b) => a.klientNazev.localeCompare(b.klientNazev, 'cs'));
        if (!zruseno) setPolozky(nalezene);
      } finally {
        if (!zruseno) setNacitam(false);
      }
    })();

    return () => { zruseno = true; };
  }, [isAdmin, klientiKlic, klienti]);

  if (!isAdmin) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold tracking-tight text-blue-800">Nové protokoly od klientů</h2>
        {polozky.length > 0 && (
          <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded-full border border-blue-200">
            {polozky.length} ke kontrole
          </span>
        )}
      </div>

      <Card className="border-blue-200 shadow-sm bg-blue-50/30">
        <CardContent className="p-0">
          {nacitam ? (
            <div className="p-8 flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Načítám protokoly…
            </div>
          ) : polozky.length > 0 ? (
            <div className="divide-y divide-blue-100">
              {polozky.map((p, idx) => (
                <div key={idx} className="p-4 hover:bg-blue-50/80 transition-colors">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-blue-600 tracking-wider mb-2">
                    <Clock className="h-3 w-3" /> Čeká na kontrolu
                  </div>
                  <div className="space-y-1 mb-3">
                    <p className="text-sm font-bold text-slate-900 leading-tight line-clamp-2">
                      {p.nazev} <span className="text-xs font-medium text-slate-400">· {p.druh === 'revize' ? 'revize' : 'školení'}</span>
                    </p>
                    <p className="text-xs font-medium text-slate-500 truncate">{p.klientNazev}</p>
                    <p className="inline-flex items-center gap-1 text-xs text-blue-700">
                      <FileText className="h-3 w-3" /> {p.soubor}
                    </p>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      size="sm" variant="outline"
                      className="h-7 text-xs font-bold border-blue-300 text-blue-700 hover:bg-blue-100"
                      onClick={() => router.push(`/klienti/${p.klientId}`)}
                    >
                      <Eye className="h-3 w-3 mr-1.5" /> Otevřít
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center flex flex-col items-center justify-center space-y-3">
              <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                <Inbox className="h-6 w-6 text-blue-600" />
              </div>
              <p className="text-sm font-medium text-slate-500">Žádné nové protokoly nečekají na kontrolu.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
