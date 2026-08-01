'use client';

/**
 * AuditFlow — přehled komentářů pro OZO (admin).
 * Umístění: src/app/komentare/page.tsx
 *
 * Načte všechny komentáře, seskupí je do vláken (cil + cilId) a ukáže
 * hlavně NEVYŘÍZENÁ vlákna — ta, jejichž poslední příspěvek napsal klient.
 * Odpovídat lze přímo přes VlaknoKomentaru (píše jako OZO).
 */

import { useEffect, useMemo, useState, useCallback } from 'react';
import { db, useData } from '@/components/data-provider';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, MessageSquare, Clock, CheckCircle2, Wrench, GraduationCap, ShieldAlert } from 'lucide-react';
import { cn } from '@/app/lib/utils';
import VlaknoKomentaru from '@/components/komentare/vlakno';
import { jeNevyrizeno } from '@/lib/komentare';
import type { Komentar, CilKomentare } from '@/lib/komentare';

interface Vlakno {
  klientId: string;
  cil: CilKomentare;
  cilId: string;
  cilPopis: string;
  prispevky: Komentar[];
  nevyrizeno: boolean;
  posledniIso: string;
}

const IKONA: Record<CilKomentare, typeof Wrench> = {
  nalez: ShieldAlert,
  revize: Wrench,
  skoleni: GraduationCap,
};

const NAZEV_CILE: Record<CilKomentare, string> = {
  nalez: 'Nález',
  revize: 'Revize',
  skoleni: 'Školení',
};

export default function KomentarePage() {
  const { klienti, userProfile } = useData();
  const jeAdmin = userProfile?.role === 'admin';

  const [komentare, setKomentare] = useState<Komentar[]>([]);
  const [nacitam, setNacitam] = useState(true);
  const [filtr, setFiltr] = useState<'nevyrizene' | 'vse'>('nevyrizene');

  const nacti = useCallback(async () => {
    setNacitam(true);
    try {
      const snap = await getDocs(query(collection(db, 'komentare'), orderBy('kdyIso', 'asc')));
      setKomentare(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Komentar));
    } catch (e) {
      console.error('Načtení komentářů selhalo:', e);
    } finally {
      setNacitam(false);
    }
  }, []);

  useEffect(() => { nacti(); }, [nacti]);

  const nazevKlienta = useCallback(
    (klientId: string) => klienti.find((k) => k.id === klientId)?.nazev ?? 'Neznámý klient',
    [klienti],
  );

  const vlakna = useMemo<Vlakno[]>(() => {
    const mapa = new Map<string, Komentar[]>();
    for (const k of komentare) {
      const klic = `${k.cil}:${k.cilId}`;
      if (!mapa.has(klic)) mapa.set(klic, []);
      mapa.get(klic)!.push(k);
    }
    const out: Vlakno[] = [];
    for (const prispevky of mapa.values()) {
      const serazene = [...prispevky].sort((a, b) => a.kdyIso.localeCompare(b.kdyIso));
      const prvni = serazene[0];
      out.push({
        klientId: prvni.klientId,
        cil: prvni.cil,
        cilId: prvni.cilId,
        cilPopis: serazene.find((p) => p.cilPopis)?.cilPopis ?? '(bez popisu)',
        prispevky: serazene,
        nevyrizeno: jeNevyrizeno(serazene),
        posledniIso: serazene.at(-1)!.kdyIso,
      });
    }
    // nevyřízená první, pak podle posledního příspěvku sestupně
    out.sort((a, b) => {
      if (a.nevyrizeno !== b.nevyrizeno) return a.nevyrizeno ? -1 : 1;
      return b.posledniIso.localeCompare(a.posledniIso);
    });
    return out;
  }, [komentare]);

  const zobrazena = useMemo(
    () => (filtr === 'nevyrizene' ? vlakna.filter((v) => v.nevyrizeno) : vlakna),
    [vlakna, filtr],
  );

  const pocetNevyrizenych = useMemo(() => vlakna.filter((v) => v.nevyrizeno).length, [vlakna]);

  if (!jeAdmin) {
    return <div className="p-8 text-muted-foreground">Přístup jen pro administrátora.</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-6 md:p-8 space-y-6">
      <header>
        <h1 className="text-3xl font-black tracking-tight">Komentáře klientů</h1>
        <p className="text-muted-foreground mt-1">
          Vlákna u nálezů, revizí a školení. Nevyřízená čekají na vaši odpověď.
        </p>
      </header>

      <div className="inline-flex rounded-lg border bg-muted p-1">
        <button
          onClick={() => setFiltr('nevyrizene')}
          className={cn('px-4 py-1.5 text-sm font-bold rounded-md transition-all inline-flex items-center gap-2',
            filtr === 'nevyrizene' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500')}
        >
          <Clock className="h-3.5 w-3.5" /> Nevyřízené
          {pocetNevyrizenych > 0 && (
            <span className="bg-amber-500 text-white text-[11px] font-bold rounded-full px-1.5 min-w-[18px] text-center">
              {pocetNevyrizenych}
            </span>
          )}
        </button>
        <button
          onClick={() => setFiltr('vse')}
          className={cn('px-4 py-1.5 text-sm font-bold rounded-md transition-all',
            filtr === 'vse' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500')}
        >
          Vše
        </button>
      </div>

      {nacitam ? (
        <div className="flex items-center gap-2 text-muted-foreground py-8">
          <Loader2 className="h-5 w-5 animate-spin" /> Načítám…
        </div>
      ) : zobrazena.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm border border-dashed rounded-lg">
          {filtr === 'nevyrizene'
            ? <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Žádné nevyřízené komentáře. Klid.</span>
            : 'Zatím žádné komentáře.'}
        </div>
      ) : (
        <div className="space-y-4">
          {zobrazena.map((v) => {
            const Ikona = IKONA[v.cil];
            return (
              <Card key={`${v.cil}:${v.cilId}`} className={cn(v.nevyrizeno && 'border-amber-200')}>
                <CardContent className="py-4 space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Ikona className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-bold">{v.cilPopis}</span>
                    <span className="text-[11px] text-muted-foreground uppercase tracking-wide">
                      {NAZEV_CILE[v.cil]}
                    </span>
                    <span className="text-xs text-muted-foreground">· {nazevKlienta(v.klientId)}</span>
                    {v.nevyrizeno && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded ml-auto">
                        <Clock className="h-3 w-3" /> Čeká na odpověď
                      </span>
                    )}
                  </div>
                  <VlaknoKomentaru
                    klientId={v.klientId}
                    cil={v.cil}
                    cilId={v.cilId}
                    cilPopis={v.cilPopis}
                    kompaktni
                  />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
