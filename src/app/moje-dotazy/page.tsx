'use client';

/**
 * AuditFlow — přehled dotazů klienta.
 * Umístění: src/app/moje-dotazy/page.tsx
 *
 * Klientský protějšek administrátorské stránky /dotazy. Dotaz se zakládá
 * u konkrétního nedostatku v reportu; tady je klient najde všechny pohromadě,
 * i zpětně napříč kontrolami, a proklikne se zpět k nálezu.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db, useData } from '@/components/data-provider';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, MessageSquare, CheckCircle2, Clock, ExternalLink } from 'lucide-react';
import type { Dotaz } from '@/lib/dotazy';

export default function MojeDotazyPage() {
  const { userProfile, zaznamy } = useData();
  const router = useRouter();
  const klientId = userProfile?.klientId;

  const [dotazy, setDotazy] = useState<Dotaz[]>([]);
  const [nacitam, setNacitam] = useState(true);
  const [filtr, setFiltr] = useState<'vse' | 'ceka' | 'zodpovezene'>('vse');

  const nacti = useCallback(async () => {
    if (!klientId) { setNacitam(false); return; }
    setNacitam(true);
    try {
      const snap = await getDocs(
        query(collection(db, 'dotazy'), where('klientId', '==', klientId)),
      );
      setDotazy(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as Dotaz)
          .sort((a, b) => (b.vytvorenoIso ?? '').localeCompare(a.vytvorenoIso ?? '')),
      );
    } catch (e) {
      console.error('Načtení dotazů selhalo:', e);
    } finally {
      setNacitam(false);
    }
  }, [klientId]);

  useEffect(() => { nacti(); }, [nacti]);

  const videt = useMemo(() => dotazy.filter((d) => {
    if (filtr === 'ceka') return !d.odpoved;
    if (filtr === 'zodpovezene') return !!d.odpoved;
    return true;
  }), [dotazy, filtr]);

  const cekaPocet = dotazy.filter((d) => !d.odpoved).length;

  /** Popis kontroly, ke které se dotaz váže — z už načtených záznamů. */
  function popisZaznamu(zaznamId?: string) {
    const z = (zaznamy ?? []).find((x: any) => x.id === zaznamId);
    if (!z) return null;
    return `Kontrola č. ${z.cislo}${z.datum ? ` · ${new Date(z.datum).toLocaleDateString('cs-CZ')}` : ''}`;
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <MessageSquare className="h-7 w-7 text-blue-600" /> Moje dotazy
        </h1>
        <p className="text-sm text-muted-foreground">
          Dotazy, které jste položili k jednotlivým zjištěním. Odpověď technika
          se zobrazí zde i přímo u nálezu v reportu.
        </p>
      </div>

      <div className="flex gap-2">
        {([
          ['vse', `Vše (${dotazy.length})`],
          ['ceka', `Čeká na odpověď (${cekaPocet})`],
          ['zodpovezene', 'Zodpovězené'],
        ] as const).map(([klic, popis]) => (
          <Button
            key={klic}
            size="sm"
            variant={filtr === klic ? 'default' : 'outline'}
            onClick={() => setFiltr(klic)}
          >
            {popis}
          </Button>
        ))}
      </div>

      {nacitam ? (
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Načítám…
        </div>
      ) : videt.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-1">
            <p className="text-sm font-medium">
              {dotazy.length === 0 ? 'Zatím jste nepoložili žádný dotaz.' : 'Nic k zobrazení.'}
            </p>
            {dotazy.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Dotaz položíte přímo u konkrétního zjištění v reportu z kontroly.
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {videt.map((d) => (
            <Card key={d.id}>
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 space-y-0.5">
                    {popisZaznamu(d.zaznamId) && (
                      <p className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">
                        {popisZaznamu(d.zaznamId)}
                      </p>
                    )}
                    {d.zavadaPopis && (
                      <p className="text-sm font-medium text-slate-800">{d.zavadaPopis}</p>
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                    {d.vytvorenoIso ? new Date(d.vytvorenoIso).toLocaleDateString('cs-CZ') : ''}
                  </span>
                </div>

                <p className="text-sm">{d.text}</p>

                {d.odpoved ? (
                  <div className="rounded border-l-[3px] border-emerald-500 bg-emerald-50/60 px-3 py-2">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                      <CheckCircle2 className="h-3 w-3" /> Odpověď technika OZO
                    </div>
                    <p className="mt-1 text-sm text-slate-800">{d.odpoved}</p>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 rounded bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700">
                    <Clock className="h-3 w-3" /> Čeká na odpověď
                  </div>
                )}

                {d.zaznamId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => router.push(`/zaznamy/${d.zaznamId}`)}
                  >
                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Otevřít report
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
