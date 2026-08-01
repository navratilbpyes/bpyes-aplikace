'use client';

/**
 * AuditFlow — časový plán v kartě klienta / dashboardu.
 * Umístění: src/components/dashboard/casovy-plan.tsx
 *
 * Čte reálná data přes useCasovyPlan. Filtry podle typu, naléhavosti
 * a předvolby (měsíc/kvartál). Barva = naléhavost, ikona = typ.
 *
 * Použití: <CasovyPlan klientId={klient.id} />
 */

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Zap, GraduationCap, ShieldAlert, ClipboardCheck, Loader2, ChevronRight, Printer,
} from 'lucide-react';
import { cn } from '@/app/lib/utils';
import { useCasovyPlan } from '@/hooks/use-casovy-plan';
import type { PolozkaPlanu, TypPolozky, Naliehavost } from '@/lib/casovy-plan';

interface Props {
  klientId: string;
}

const IKONA: Record<TypPolozky, typeof Zap> = {
  revize: Zap,
  skoleni: GraduationCap,
  nalez: ShieldAlert,
  prohlidka: ClipboardCheck,
};

const NAZEV_TYPU: Record<TypPolozky, string> = {
  revize: 'revize',
  skoleni: 'školení',
  nalez: 'nálezy',
  prohlidka: 'prohlídky',
};

const BARVA: Record<Naliehavost, string> = {
  po_terminu: 'border-l-red-500',
  blizi_se: 'border-l-amber-500',
  ok: 'border-l-emerald-600',
};

const BARVA_TEXT: Record<Naliehavost, string> = {
  po_terminu: 'text-red-600',
  blizi_se: 'text-amber-600',
  ok: 'text-emerald-700',
};

const BARVA_IKONA: Record<Naliehavost, string> = {
  po_terminu: 'text-red-500',
  blizi_se: 'text-amber-500',
  ok: 'text-emerald-600',
};

type FiltrTyp = 'vse' | 'po_terminu' | TypPolozky;

export default function CasovyPlan({ klientId }: Props) {
  const { polozky, nacitam, chyba } = useCasovyPlan(klientId);
  const [filtr, setFiltr] = useState<FiltrTyp>('vse');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  // QR na aktuální URL dashboardu — vygeneruje se v prohlížeči
  useEffect(() => {
    if (typeof window === 'undefined') return;
    QRCode.toDataURL(window.location.href, { width: 240, margin: 1 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(''));
  }, []);

  const zobraz = useMemo(() => {
    return polozky.filter((p) => {
      if (filtr === 'vse') return true;
      if (filtr === 'po_terminu') return p.naliehavost === 'po_terminu';
      return p.typ === filtr;
    });
  }, [polozky, filtr]);

  const dnesText = new Date().toLocaleDateString('cs-CZ', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const FILTRY: { klic: FiltrTyp; popis: string }[] = [
    { klic: 'vse', popis: 'vše' },
    { klic: 'po_terminu', popis: 'po termínu' },
    { klic: 'revize', popis: 'revize' },
    { klic: 'skoleni', popis: 'školení' },
    { klic: 'prohlidka', popis: 'prohlídky' },
    { klic: 'nalez', popis: 'nálezy' },
  ];

  return (
    <Card className="plan-card">
      <CardHeader className="flex flex-row items-center justify-between pb-3 no-print">
        <CardTitle className="text-base">Časový plán</CardTitle>
        <Button
          size="sm"
          variant="outline"
          className="h-8"
          onClick={() => window.print()}
        >
          <Printer className="mr-2 h-4 w-4" /> Tisk ToDo
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-1.5 no-print">
          {FILTRY.map((f) => (
            <Button
              key={f.klic}
              size="sm"
              variant={filtr === f.klic ? 'default' : 'secondary'}
              className="h-7 rounded-full px-3 text-xs"
              onClick={() => setFiltr(f.klic)}
            >
              {f.popis}
            </Button>
          ))}
        </div>

        {/* Tisková hlavička — jen při tisku */}
        <div className="print-only mb-4">
          <h1 className="text-xl font-bold">Časový plán BOZP / PO</h1>
          <p className="text-sm">Vytištěno {dnesText}</p>
        </div>

        {nacitam ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Načítám časový plán…
          </div>
        ) : chyba ? (
          <p className="py-6 text-sm text-red-600">{chyba}</p>
        ) : zobraz.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {polozky.length === 0
              ? 'Zatím žádné termíny ani nálezy.'
              : 'Nic k zobrazení pro zvolený filtr.'}
          </p>
        ) : (
          <div className="space-y-0">
            {zobraz.map((p) => (
              <Radek key={p.id} p={p} />
            ))}
          </div>
        )}

        {/* Legenda */}
        {!nacitam && !chyba && zobraz.length > 0 && (
          <div className="no-print flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-3 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1"><Zap className="h-3 w-3" /> revize</span>
            <span className="inline-flex items-center gap-1"><ShieldAlert className="h-3 w-3" /> nález</span>
            <span className="inline-flex items-center gap-1"><GraduationCap className="h-3 w-3" /> školení</span>
            <span className="inline-flex items-center gap-1"><ClipboardCheck className="h-3 w-3" /> prohlídka</span>
            <span className="ml-auto flex items-center gap-3">
              <span className="inline-flex items-center gap-1"><Tecka b="bg-red-500" /> po termínu</span>
              <span className="inline-flex items-center gap-1"><Tecka b="bg-amber-500" /> blíží se</span>
              <span className="inline-flex items-center gap-1"><Tecka b="bg-emerald-600" /> v pořádku</span>
            </span>
          </div>
        )}

        {/* Tisková patička s QR — jen při tisku */}
        <div className="print-only mt-6 flex items-center gap-4 border-t pt-4">
          {qrDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrDataUrl} alt="QR na živý přehled" className="h-24 w-24" />
          )}
          <div className="text-xs">
            <p className="font-medium">Aktuální stav online</p>
            <p>Naskenujte QR pro živý přehled termínů.</p>
            <p className="mt-1 text-muted-foreground">Vytištěno {dnesText} · AuditFlow</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Tecka({ b }: { b: string }) {
  return <span className={cn('inline-block h-2 w-2 rounded-full', b)} />;
}

function Radek({ p }: { p: PolozkaPlanu }) {
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
        {p.meta && <div className="mt-0.5 text-xs text-muted-foreground">{p.meta}</div>}
        {p.zdroj && (
          <div className="mt-0.5 text-xs text-muted-foreground/70">{p.zdroj}</div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <span className={cn('whitespace-nowrap text-xs font-medium', BARVA_TEXT[p.naliehavost])}>
          {p.stitek}
        </span>
        {p.odkaz && (
          <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
        )}
      </div>
    </>
  );

  const trida = cn(
    'plan-radek flex items-start gap-3 border-t border-l-[3px] py-3 pl-3',
    BARVA[p.naliehavost],
  );

  if (p.odkaz) {
    return (
      <Link href={p.odkaz} className={cn(trida, 'pr-2 transition-colors hover:bg-muted/50')}>
        {obsah}
      </Link>
    );
  }

  return <div className={trida}>{obsah}</div>;
}
