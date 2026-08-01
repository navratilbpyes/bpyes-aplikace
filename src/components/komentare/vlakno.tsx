'use client';

/**
 * AuditFlow — vlákno komentářů u nálezu / revize / školení.
 * Umístění: src/components/komentare/vlakno.tsx
 *
 * Znovupoužitelná komponenta. Načte komentáře daného cíle (cil + cilId),
 * zobrazí je jako vlákno a umožní přidat nový. Píše klient i OZO.
 *
 * Použití:
 *   <VlaknoKomentaru
 *     klientId={klientId}
 *     cil="revize"
 *     cilId={revizeId}
 *     cilPopis="Revize hromosvodu"
 *   />
 */

import { useEffect, useState, useCallback } from 'react';
import { db, useData } from '@/components/data-provider';
import {
  collection, addDoc, getDocs, query, where,
} from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, MessageSquare, Send } from 'lucide-react';
import { cn } from '@/app/lib/utils';
import { useToast } from '@/hooks/use-toast';
import type { Komentar, CilKomentare } from '@/lib/komentare';

interface Props {
  klientId: string;
  cil: CilKomentare;
  cilId: string;
  cilPopis?: string;
  /** kompaktní režim (menší nadpis) */
  kompaktni?: boolean;
}

export default function VlaknoKomentaru({ klientId, cil, cilId, cilPopis, kompaktni }: Props) {
  const { user, userProfile } = useData();
  const { toast } = useToast();
  const jeAdmin = userProfile?.role === 'admin';

  const [vlakno, setVlakno] = useState<Komentar[]>([]);
  const [nacitam, setNacitam] = useState(true);
  const [text, setText] = useState('');
  const [odesilam, setOdesilam] = useState(false);

  const nacti = useCallback(async () => {
    setNacitam(true);
    try {
      // Čteme podle klientId — přesně to, co kontrolují Firestore Rules
      // (allow read: resource.data.klientId == mujKlientId). Díky tomu
      // collection query projde i klientovi. cilId dofiltrujeme v paměti.
      // klientId je single-field, index Firestore vytvoří automaticky.
      const q = query(
        collection(db, 'komentare'),
        where('klientId', '==', klientId),
      );
      const snap = await getDocs(q);
      const nactene = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as Komentar)
        .filter((k) => k.cilId === cilId);
      nactene.sort((a, b) => a.kdyIso.localeCompare(b.kdyIso));
      setVlakno(nactene);
    } catch (e) {
      console.error('Načtení komentářů selhalo:', e);
    } finally {
      setNacitam(false);
    }
  }, [cilId, klientId]);

  useEffect(() => { nacti(); }, [nacti]);

  async function odeslat() {
    const t = text.trim();
    if (!t || odesilam || !user) return;
    setOdesilam(true);
    try {
      await addDoc(collection(db, 'komentare'), {
        klientId,
        cil,
        cilId,
        cilPopis: cilPopis ?? '',
        text: t,
        zadal: jeAdmin ? 'ozo' : 'klient',
        autorUid: user.uid,
        autorEmail: user.email ?? '',
        kdyIso: new Date().toISOString(),
      });
      setText('');
      await nacti();
    } catch (e) {
      console.error('Odeslání komentáře selhalo:', e);
      toast({ title: 'Nepodařilo se odeslat', description: 'Zkuste to znovu.', variant: 'destructive' });
    } finally {
      setOdesilam(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        <MessageSquare className="h-4 w-4" />
        <span className={cn('font-bold', kompaktni ? 'text-xs' : 'text-sm')}>
          Komentáře{vlakno.length > 0 && ` (${vlakno.length})`}
        </span>
      </div>

      {nacitam ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Načítám…
        </div>
      ) : vlakno.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">Zatím bez komentářů.</p>
      ) : (
        <div className="space-y-2">
          {vlakno.map((k) => {
            const jeOzo = k.zadal === 'ozo';
            return (
              <div
                key={k.id}
                className={cn(
                  'rounded-lg border p-3 text-sm',
                  jeOzo ? 'bg-blue-50/60 border-blue-100' : 'bg-muted/40',
                )}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className={cn('text-[11px] font-bold uppercase tracking-wide',
                    jeOzo ? 'text-blue-700' : 'text-slate-600')}>
                    {jeOzo ? 'OZO technik' : (k.autorEmail || 'Klient')}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(k.kdyIso).toLocaleString('cs-CZ')}
                  </span>
                </div>
                <p className="whitespace-pre-wrap">{k.text}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Přidání komentáře */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={jeAdmin ? 'Odpovědět klientovi…' : 'Napsat komentář nebo dotaz…'}
          className="min-h-[64px] text-sm"
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') odeslat();
          }}
        />
        <Button onClick={odeslat} disabled={!text.trim() || odesilam} className="shrink-0">
          {odesilam ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          <span className="ml-2">Odeslat</span>
        </Button>
      </div>
    </div>
  );
}
