'use client';

/**
 * AuditFlow — časový plán napříč všemi klienty (admin, plná stránka).
 * Umístění: src/app/plan/page.tsx
 *
 * Jeden proud řazený podle naléhavosti. Filtry: typ, klient, naléhavost.
 */

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Zap, GraduationCap, ShieldAlert, ClipboardCheck, Loader2, ChevronRight,
} from 'lucide-react';
import { cn } from '@/app/lib/utils';
import { usePlanVsech } from '@/hooks/use-plan-vsech';
import type { PolozkaSKlientem } from '@/hooks/use-plan-vsech';
import type { TypPolozky, Naliehavost } from '@/lib/casovy-plan';

const IKONA: Record<TypPolozky, typeof Zap> = {
  revize: Zap, skoleni: GraduationCap, nalez: ShieldAlert, prohlidka: ClipboardCheck,
};
const NAZEV_TYPU: Record<TypPolozky, string> = {
  revize: 'revize', skoleni: 'školení', nalez: 'nález', prohlidka: 'prohlídka',
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

type FiltrTyp = 'vse' | TypPolozky;
type FiltrNal = 'vse' | Naliehavost;

export default function PlanPage() {
  const { polozky, klienti, nacitam, chyba } = usePlanVsech();
  const [typ, setTyp] = useState<FiltrTyp>('vse');
  const [klient, setKlient] = useState('vse');
  const [naliehavost, setNaliehavost] = useState<FiltrNal>('vse');

  const zobraz = useMemo(() => polozky.filter((p) => {
    if (typ !== 'vse' && p.typ !== typ) return false;
    if (klient !== 'vse' && p.klientId !== klient) return false;
    if (naliehavost !== 'vse' && p.naliehavost !== naliehavost) return false;
    return true;
  }), [polozky, typ, klient, naliehavost]);

  const poctyNal = useMemo(() => ({
    po_terminu: polozky.filter((p) => p.naliehavost === 'po_terminu').length,
    blizi_se: polozky.filter((p) => p.naliehavost === 'blizi_se').length,
  }), [polozky]);

  const TYPY: { klic: FiltrTyp; popis: string }[] = [
    { klic: 'vse', popis: 'vše' },
    { klic: 'revize', popis: 'revize' },
    { klic: 'skoleni', popis: 'školení' },
    { klic: 'prohlidka', popis: 'prohlídky' },
    { klic: 'nalez', popis: 'nálezy' },
  ];

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Časový plán</h1>
        <p className="text-sm text-muted-foreground">
          Termíny a nálezy napříč všemi klienty, seřazené podle naléhavosti.
        </p>
      </div>

      {/* rychlé počty */}
      {!nacitam && !chyba && (
        <div className="flex gap-3">
          <div className="rounded-lg border bg-red-50 px-4 py-3">
            <div className="text-2xl font-bold text-red-600">{poctyNal.po_terminu}</div>
            <div className="text-xs text-muted-foreground">po termínu</div>
          </div>
          <div className="rounded-lg border bg-amber-50 px-4 py-3">
            <div className="text-2xl font-bold text-amber-600">{poctyNal.blizi_se}</div>
            <div className="text-xs text-muted-foreground">blíží se (30 dní)</div>
          </div>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Přehled termínů</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* filtry typu */}
          <div className="flex flex-wrap gap-1.5">
            {TYPY.map((t) => (
              <Button
                key={t.klic}
                size="sm"
                variant={typ === t.klic ? 'default' : 'secondary'}
                className="h-7 rounded-full px-3 text-xs"
                onClick={() => setTyp(t.klic)}
              >
                {t.popis}
              </Button>
            ))}
          </div>

          {/* filtry klient + naléhavost */}
          <div className="flex flex-wrap gap-2">
            <Select value={klient} onValueChange={setKlient}>
              <SelectTrigger className="h-8 w-auto min-w-[200px] text-xs">
                <SelectValue placeholder="Klient" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vse">Všichni klienti</SelectItem>
                {klienti.map((k) => (
                  <SelectItem key={k.id} value={k.id}>{k.nazev}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={naliehavost} onValueChange={(v) => setNaliehavost(v as FiltrNal)}>
              <SelectTrigger className="h-8 w-auto min-w-[160px] text-xs">
                <SelectValue placeholder="Naléhavost" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vse">Vše</SelectItem>
                <SelectItem value="po_terminu">Po termínu</SelectItem>
                <SelectItem value="blizi_se">Blíží se</SelectItem>
                <SelectItem value="ok">V pořádku</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {nacitam ? (
            <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Načítám plán napříč klienty…
            </div>
          ) : chyba ? (
            <p className="py-6 text-sm text-red-600">{chyba}</p>
          ) : zobraz.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {polozky.length === 0
                ? 'Zatím žádné termíny ani nálezy.'
                : 'Nic k zobrazení pro zvolený filtr.'}
            </p>
          ) : (
            <div>
              {zobraz.map((p) => <Radek key={`${p.klientId}_${p.id}`} p={p} />)}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Radek({ p }: { p: PolozkaSKlientem }) {
  const Ikona = IKONA[p.typ];

  const obsah = (
    <>
      <Ikona className={cn('mt-0.5 h-4 w-4 shrink-0', BARVA_IKONA[p.naliehavost])} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{p.nazev}</span>
          <Badge variant="outline" className="h-4 text-[10px] font-normal">
            {NAZEV_TYPU[p.typ]}
          </Badge>
        </div>
        <div className="mt-0.5 text-xs font-medium text-primary/80">{p.klientNazev}</div>
        {p.meta && <div className="mt-0.5 text-xs text-muted-foreground">{p.meta}</div>}
        {p.zdroj && <div className="mt-0.5 text-xs text-muted-foreground/70">{p.zdroj}</div>}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <span className={cn('whitespace-nowrap text-xs font-medium', BARVA_TEXT[p.naliehavost])}>
          {p.stitek}
        </span>
        {p.odkaz && <ChevronRight className="h-4 w-4 text-muted-foreground/50" />}
      </div>
    </>
  );

  const trida = cn('flex items-start gap-3 border-t border-l-[3px] py-3 pl-3', BARVA[p.naliehavost]);

  if (p.odkaz) {
    return (
      <Link href={p.odkaz} className={cn(trida, 'pr-2 transition-colors hover:bg-muted/50')}>
        {obsah}
      </Link>
    );
  }
  return <div className={trida}>{obsah}</div>;
}
