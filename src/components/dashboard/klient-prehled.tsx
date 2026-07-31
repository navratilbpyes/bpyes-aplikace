'use client';

/**
 * AuditFlow — klientská část úvodního přehledu (reálná data).
 * Umístění: src/components/dashboard/klient-prehled.tsx
 *
 * Pro přihlášeného plného klienta: stavový signál dle nejhoršího termínu,
 * časový plán, dokumentace. Vše čte reálná data podle jeho klientId.
 *
 * Použití na / :  {!isAdmin && profil?.klientId && <KlientPrehled klientId={profil.klientId} />}
 */

import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/app/lib/utils';
import { useCasovyPlan } from '@/hooks/use-casovy-plan';
import CasovyPlan from '@/components/dashboard/casovy-plan';
import Dokumentace from '@/components/dashboard/dokumentace';

interface Props {
  klientId: string;
}

// Banka hlášek podle nálady (severity nejhoršího termínu).
const HLASKY = {
  ok: [
    'Všechno v pořádku. Nejbližší problém je ten zapomenutý jogurt v lednici.',
    'Čistý stůl. Kontrola by nenašla, o co zakopnout.',
    'Žádné resty. Tohle je ten vzácný stav, kdy BOZP nikoho netrápí.',
  ],
  soon: [
    'Pár věcí klepe na dveře. Zatím zdvořile.',
    'Do měsíce něco čeká. Klidně to stihnete, když to nenecháte na poslední den.',
  ],
  critical: [
    'Něco je po termínu. Doporučuji začít shora v časovém plánu.',
    'Máte otevřené resty po lhůtě. Bez servítků: začněte tím červeným nahoře.',
  ],
} as const;

type Ton = 'ok' | 'soon' | 'critical';

export default function KlientPrehled({ klientId }: Props) {
  const { metriky, polozky } = useCasovyPlan(klientId);

  const ton: Ton = useMemo(() => {
    if (metriky.poTerminu > 0) return 'critical';
    if (metriky.do30dni > 0 || metriky.otevreneNalezy > 0) return 'soon';
    return 'ok';
  }, [metriky]);

  // stabilní denní varianta hlášky
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
      {/* Stavový signál */}
      <Card className={cn('border-l-[6px]', okraj)}>
        <CardContent className="py-5">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            {popis}
          </div>
          <div className="mt-1 text-lg font-semibold leading-snug">{hlaska}</div>

          <div className="mt-4 flex flex-wrap gap-6 border-t pt-4">
            <Metrika n={metriky.do30dni} l="termíny do 30 dní" />
            <Metrika n={metriky.otevreneNalezy} l="otevřené nálezy" />
            <Metrika n={metriky.poTerminu} l="po termínu" hot={metriky.poTerminu > 0} />
          </div>
        </CardContent>
      </Card>

      {/* Časový plán — reálná data, tisk, filtry */}
      <CasovyPlan klientId={klientId} />

      {/* Dokumentace — odkaz na Drive složku, pokud je nastavená */}
      <Dokumentace klientId={klientId} />
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
