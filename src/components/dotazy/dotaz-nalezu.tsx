'use client';

/**
 * AuditFlow — dotaz klienta ke konkrétnímu nálezu.
 * Umístění: src/components/dotazy/dotaz-nalezu.tsx
 *
 * Klient položí dotaz u nedostatku v reportu, OZO odpovídá v /dotazy.
 * Odpověď se zobrazí zpět zde. Admin tu jen čte (odpovídá v /dotazy).
 *
 * Čte se přes where('klientId') — přesně to, co kontrolují Rules;
 * zaznamId/zavadaId se dofiltrují v paměti (žádný composite index).
 */

import { useEffect, useState, useCallback } from 'react';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { db, useData } from '@/components/data-provider';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, MessageSquare, Send, CheckCircle2, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Dotaz } from '@/lib/dotazy';

interface Props {
  klientId: string;
  zaznamId: string;
  /** id závady; u starších dat bez rozpadu použij `bod_<cislo>` */
  zavadaId: string;
  zavadaPopis?: string;
}

export default function DotazNalezu({ klientId, zaznamId, zavadaId, zavadaPopis }: Props) {
  const { user, userProfile } = useData();
  const { toast } = useToast();
  const jeAdmin = userProfile?.role === 'admin';

  const [dotazy, setDotazy] = useState<Dotaz[]>([]);
  const [nacitam, setNacitam] = useState(true);
  const [pisu, setPisu] = useState(false);
  const [text, setText] = useState('');
  const [odesilam, setOdesilam] = useState(false);

  const nacti = useCallback(async () => {
    if (!klientId) { setNacitam(false); return; }
    setNacitam(true);
    try {
      const snap = await getDocs(
        query(collection(db, 'dotazy'), where('klientId', '==', klientId)),
      );
      const vse = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Dotaz);
      setDotazy(
        vse
          .filter((d) => d.zaznamId === zaznamId && d.zavadaId === zavadaId)
          .sort((a, b) => (a.vytvorenoIso ?? '').localeCompare(b.vytvorenoIso ?? '')),
      );
    } catch (e) {
      console.error('Načtení dotazů selhalo:', e);
    } finally {
      setNacitam(false);
    }
  }, [klientId, zaznamId, zavadaId]);

  useEffect(() => { nacti(); }, [nacti]);

  async function odesli() {
    if (!text.trim() || !user) return;
    setOdesilam(true);
    try {
      await addDoc(collection(db, 'dotazy'), {
        klientId,
        zaznamId,
        zavadaId,
        zavadaPopis: zavadaPopis ?? null,
        text: text.trim(),
        stav: 'nevyrizeno',
        autorJmeno: user.email ?? null,
        autorUid: user.uid,
        vytvorenoIso: new Date().toISOString(),
      });
      setText('');
      setPisu(false);
      toast({ title: 'Dotaz odeslán', description: 'Technik OZO vám odpoví zde.' });
      nacti();
    } catch (e: any) {
      toast({ title: 'Odeslání selhalo', description: e?.message ?? '', variant: 'destructive' });
    } finally {
      setOdesilam(false);
    }
  }

  if (nacitam) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Loader2 className="h-3 w-3 animate-spin" /> Načítám dotazy…
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {dotazy.map((d) => (
        <div key={d.id} className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <MessageSquare className="h-3 w-3" /> Dotaz
              {d.autorJmeno ? ` · ${d.autorJmeno}` : ''}
            </span>
            <span className="text-[10px] text-slate-400">
              {d.vytvorenoIso ? new Date(d.vytvorenoIso).toLocaleDateString('cs-CZ') : ''}
            </span>
          </div>
          <p className="text-sm text-slate-800">{d.text}</p>

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
        </div>
      ))}

      {!jeAdmin && (
        pisu ? (
          <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Na co se chcete zeptat k tomuto nedostatku?"
              className="min-h-[70px] text-sm"
            />
            <div className="flex gap-2">
              <Button size="sm" disabled={odesilam || !text.trim()} onClick={odesli}>
                {odesilam ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
                Odeslat dotaz
              </Button>
              <Button size="sm" variant="ghost" disabled={odesilam} onClick={() => { setPisu(false); setText(''); }}>
                Zrušit
              </Button>
            </div>
          </div>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs font-bold text-slate-600 hover:text-slate-900"
            onClick={() => setPisu(true)}
          >
            <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
            {dotazy.length > 0 ? 'Další dotaz k tomuto nedostatku' : 'Zeptat se na tento nedostatek'}
          </Button>
        )
      )}
    </div>
  );
}
