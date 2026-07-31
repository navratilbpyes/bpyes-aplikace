'use client';

/**
 * AuditFlow — widget nejbližších termínů pro úvodní přehled.
 * Umístění: src/components/dashboard/widget-terminy.tsx
 *
 * Kompaktní výřez: po termínu + blížící se, napříč klienty.
 * Odkaz na plný časový plán.
 *
 * Použití na úvodní stránce: <WidgetTerminy />
 */

import { useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Zap, GraduationCap, ShieldAlert, ClipboardCheck, Loader2, ArrowRight, ChevronRight,
} from 'lucide-react';
import { cn } from '@/app/lib/utils';
import { usePlanVsech } from '@/hooks/use-plan-vsech';
import type { PolozkaSKlientem } from '@/hooks/use-plan-vsech';
import type { TypPolozky, Naliehavost } from '@/lib/casovy-plan';

const IKONA: Record<TypPolozky, typeof Zap> = {
  revize: Zap, skoleni: GraduationCap, nalez: ShieldAlert, prohlidka: ClipboardCheck,
};
const BARVA: Record<Naliehavost, string> = {
  po_terminu: 'border-l-red-500', blizi_se: 'border-l-amber-500', ok: 'border-l-emerald-600',
};
const BARVA_TEXT: Record<Naliehavost, string> = {
  po_terminu: 'text-red-600', blizi_se: 'text-amber-600', ok: 'text-emerald-700',
};
const BARVA_IKONA: Record<Naliehavost, string> = {
  po_terminu: 'text-red-500', blizi_se: 'text-amber-500', ok: 'text-emerald-600',
};

const LIMIT = 6;

export default function WidgetTerminy() {
  const { polozky, nacitam } = usePlanVsech();

  // jen po termínu + blížící se, prvních LIMIT
  const naliehave = useMemo(
    () => polozky
      .filter((p) => p.naliehavost === 'po_terminu' || p.naliehavost === 'blizi_se')
      .slice(0, LIMIT),
    [polozky],
  );

  const poTerminu = useMemo(
    () => polozky.filter((p) => p.naliehavost === 'po_terminu').length,
    [polozky],
  );
  const blizi = useMemo(
    () => polozky.filter((p) => p.naliehavost === 'blizi_se').length,
    [polozky],
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">Nejbližší termíny</CardTitle>
        <Link
          href="/plan"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          Celý plán <ArrowRight className="h-3 w-3" />
        </Link>
      </CardHeader>

      <CardContent>
        {nacitam ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Načítám…
          </div>
        ) : naliehave.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Žádné termíny po lhůtě ani do 30 dní. Klid.
          </p>
        ) : (
          <>
            <div className="mb-3 flex gap-4 text-xs">
              <span className="text-red-600">
                <strong>{poTerminu}</strong> po termínu
              </span>
              <span className="text-amber-600">
                <strong>{blizi}</strong> blíží se
              </span>
            </div>
            <div>
              {naliehave.map((p) => <RadekMini key={`${p.klientId}_${p.id}`} p={p} />)}
            </div>
            {(poTerminu + blizi) > LIMIT && (
              <Link
                href="/plan"
                className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                a další… <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function RadekMini({ p }: { p: PolozkaSKlientem }) {
  const Ikona = IKONA[p.typ];

  const obsah = (
    <>
      <Ikona className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', BARVA_IKONA[p.naliehavost])} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{p.nazev}</div>
        <div className="truncate text-xs text-muted-foreground">{p.klientNazev}</div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <span className={cn('whitespace-nowrap text-xs font-medium', BARVA_TEXT[p.naliehavost])}>
          {p.stitek}
        </span>
        {p.odkaz && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />}
      </div>
    </>
  );

  const trida = cn('flex items-start gap-2.5 border-t border-l-[3px] py-2 pl-2.5', BARVA[p.naliehavost]);

  if (p.odkaz) {
    return (
      <Link href={p.odkaz} className={cn(trida, 'pr-1.5 transition-colors hover:bg-muted/50')}>
        {obsah}
      </Link>
    );
  }
  return <div className={trida}>{obsah}</div>;
}
