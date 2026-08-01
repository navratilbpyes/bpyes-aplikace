'use client';

/**
 * AuditFlow — klientská část úvodního přehledu (reálná data).
 * Umístění: src/components/dashboard/klient-prehled.tsx
 *
 * Pro přihlášeného plného klienta: stavový signál + 4 metriky, časový plán,
 * panel dotazů, dokumentace, Freelo dlaždice, kontakt na OZO.
 */

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/app/lib/utils';
import { db } from '@/components/data-provider';
import { collection, getDocs, query, where, getDoc, doc } from 'firebase/firestore';
import { useCasovyPlan } from '@/hooks/use-casovy-plan';
import CasovyPlan from '@/components/dashboard/casovy-plan';
import Dokumentace from '@/components/dashboard/dokumentace';
import {
  ExternalLink, Mail, Phone, User, MessageCircle,
} from 'lucide-react';
import type { Dotaz } from '@/lib/dotazy';

interface Props {
  klientId: string;
}

// Kontakt na OZO — vždy Martin. Uprav zde, pokud se změní.
// whatsapp: číslo v mezinárodním formátu bez + a mezer, např. '420777123456'
const OZO = {
  jmeno: 'Martin Navrátil',
  telefon: '+420 772 722 763',
  email: 'navratil@bpyes.cz',
  whatsapp: '420772722763',
  iniciály: 'MN',
};

const HLASKY = {
  ok: [
    'Všechno v pořádku. Nejbližší problém je ten zapomenutý jogurt v lednici.',
    'Čistý stůl. Kontrola by nenašla, o co zakopnout.',
    'Žádné resty. Tohle je ten vzácný stav, kdy BOZP nikoho netrápí.',
  ],
  soon: [
    'Pár věcí klepe na dveře. Zatím zdvořile.',
    'Do měsíce něco čeká. Klidně to stihnete, když to nenecháte na poslední den.',
    'Zatím ok, ale některým úkolům je už potřeba se věnovat.',
  ],
  critical: [
    'Něco je po termínu. Doporučuji začít shora v časovém plánu.',
    'Máte otevřené resty po lhůtě. Beze srandy: začněte tím červeným nahoře.',
    'Ajéje, tady už to začíná hořet.',
  ],
} as const;

type Ton = 'ok' | 'soon' | 'critical';

export default function KlientPrehled({ klientId }: Props) {
  const { metriky } = useCasovyPlan(klientId);
  const [dotazy, setDotazy] = useState<Dotaz[]>([]);
  const [freeloUrl, setFreeloUrl] = useState('');

  // Dotazy klienta + Freelo odkaz
  useEffect(() => {
    if (!klientId) return;
    (async () => {
      try {
        const [dSnap, kSnap] = await Promise.all([
          getDocs(query(collection(db, 'dotazy'), where('klientId', '==', klientId))),
          getDoc(doc(db, 'klienti', klientId)),
        ]);
        setDotazy(dSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Dotaz));
        if (kSnap.exists()) setFreeloUrl((kSnap.data() as any).freeloUrl ?? '');
      } catch (e) {
        console.error('Načtení dotazů/Freelo selhalo:', e);
      }
    })();
  }, [klientId]);

  const nevyrizeneDotazy = useMemo(
    () => dotazy.filter((d) => d.stav === 'nevyrizeno'),
    [dotazy],
  );

  const ton: Ton = useMemo(() => {
    if (metriky.poTerminu > 0) return 'critical';
    if (metriky.do30dni > 0 || metriky.otevreneNalezy > 0) return 'soon';
    return 'ok';
  }, [metriky]);

  const hlaska = useMemo(() => {
    const d = new Date();
    const seed = d.getFullYear() * 366 + d.getMonth() * 31 + d.getDate();
    const pole = HLASKY[ton];
    return pole[seed % pole.length];
  }, [ton]);

  const okraj = ton === 'critical'
    ? 'border-l-red-500'
    : ton === 'soon' ? 'border-l-amber-500' : 'border-l-emerald-600';

  const popis = ton === 'ok'
    ? 'Vše v pořádku'
    : ton === 'soon' ? 'Blíží se termíny' : 'Vyžaduje pozornost';

  return (
    <div className="space-y-4">
      {/* Stavový signál + 4 metriky */}
      <Card className={cn('border-l-[6px]', okraj)}>
        <CardContent className="py-5">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{popis}</div>
          <div className="mt-1 text-lg font-semibold leading-snug">{hlaska}</div>
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 border-t pt-4">
            <Metrika n={metriky.do30dni} l="termíny do 30 dní" />
            <Metrika n={metriky.otevreneNalezy} l="otevřené nálezy" />
            <Metrika n={metriky.poTerminu} l="po termínu" hot={metriky.poTerminu > 0} />
            <Metrika n={nevyrizeneDotazy.length} l="nevyřízené dotazy" hot={nevyrizeneDotazy.length > 0} />
          </div>
        </CardContent>
      </Card>

      {/* Časový plán */}
      <CasovyPlan klientId={klientId} />

      {/* Tři dlaždice vedle sebe: Dokumentace + Freelo + Kontakt OZO */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Dokumentace */}
        <Dokumentace klientId={klientId} />
        {/* Freelo dlaždice */}
        {freeloUrl ? (
          <a href={freeloUrl} target="_blank" rel="noopener noreferrer" className="block">
            <Card className="hover:bg-slate-50 transition-colors h-full">
              <CardContent className="py-5 flex items-center justify-between">
                <div>
                  <h3 className="font-bold">Úkoly ve Freelu</h3>
                  <p className="text-sm text-muted-foreground">Otevřít projekt s úkoly</p>
                </div>
                <ExternalLink className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>
          </a>
        ) : (
          <Card className="h-full">
            <CardContent className="py-5">
              <h3 className="font-bold text-muted-foreground">Úkoly ve Freelu</h3>
              <p className="text-sm text-muted-foreground mt-1">Odkaz zatím nenastaven.</p>
            </CardContent>
          </Card>
        )}

        {/* Kontakt OZO */}
        <Card className="h-full">
          <CardContent className="py-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary shrink-0">
                {OZO.iniciály}
              </div>
              <div className="min-w-0">
                <div className="font-bold flex items-center gap-1"><User className="h-3.5 w-3.5" /> {OZO.jmeno}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" /> {OZO.telefon}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-1 truncate"><Mail className="h-3 w-3" /> {OZO.email}</div>
              </div>
            </div>
            <a href={`https://wa.me/${OZO.whatsapp}`} target="_blank" rel="noopener noreferrer" className="shrink-0">
              <Button size="sm" variant="outline" className="border-green-600 text-green-700 hover:bg-green-50">
                <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp
              </Button>
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Metrika({ n, l, hot }: { n: number; l: string; hot?: boolean }) {
  return (
    <div>
      <div className={cn('text-2xl font-bold leading-none', hot && 'text-red-600')}>{n}</div>
      <div className="mt-1 text-xs text-muted-foreground">{l}</div>
    </div>
  );
}
