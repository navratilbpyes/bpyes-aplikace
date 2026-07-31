'use client';

/**
 * AuditFlow — přepínač úrovně přístupu klienta.
 * Umístění: src/components/admin/uroven-pristupu.tsx
 *
 * Plný klient (full) — vidí celý dashboard.
 * Jen audit (basic) — jednorázový, vidí jen /audit.
 *
 * Mění `uroven` všem účtům klienta přes API route nastavit-uroven.
 *
 * Použití: <UrovenPristupu klientId={klient.id} />
 */

import { useState, useEffect, useCallback } from 'react';
import { auth } from '@/components/data-provider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Check } from 'lucide-react';
import { cn } from '@/app/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface Props {
  klientId: string;
}

type Uroven = 'full' | 'basic';

export default function UrovenPristupu({ klientId }: Props) {
  const { toast } = useToast();
  const [uroven, setUroven] = useState<Uroven>('full');
  const [nacitam, setNacitam] = useState(true);
  const [uklada, setUklada] = useState<Uroven | null>(null);

  const nacti = useCallback(async () => {
    setNacitam(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/nastavit-uroven?klientId=${encodeURIComponent(klientId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setUroven(data.uroven === 'basic' ? 'basic' : 'full');
    } catch {
      // ticho — zůstane výchozí full
    } finally {
      setNacitam(false);
    }
  }, [klientId]);

  useEffect(() => { nacti(); }, [nacti]);

  async function zmen(nova: Uroven) {
    if (nova === uroven || uklada) return;
    setUklada(nova);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/nastavit-uroven', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ klientId, uroven: nova }),
      });
      const data = await res.json();
      if (data.success) {
        setUroven(nova);
        toast({
          title: 'Úroveň změněna',
          description: nova === 'basic'
            ? 'Klient nyní vidí jen výsledky auditu.'
            : 'Klient má plný přístup k dashboardu.',
        });
      } else {
        toast({
          title: 'Nepodařilo se',
          description: data.error === 'Klient nemá žádné účty.'
            ? 'Klient zatím nemá vytvořený přístup. Nejdřív mu vytvořte účet.'
            : (data.error ?? 'Zkuste to znovu.'),
          variant: 'destructive',
        });
      }
    } catch {
      toast({ title: 'Chyba sítě', description: 'Zkuste to znovu.', variant: 'destructive' });
    } finally {
      setUklada(null);
    }
  }

  const MOZNOSTI: { klic: Uroven; nazev: string; popis: string }[] = [
    { klic: 'full', nazev: 'Plný přístup', popis: 'Celý dashboard — plán, revize, školení, dokumentace.' },
    { klic: 'basic', nazev: 'Jen audit', popis: 'Jednorázový klient — vidí pouze výsledky auditu a může psát dotazy.' },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Úroveň přístupu</CardTitle>
        <CardDescription>
          Určuje, co klient po přihlášení uvidí. Platí pro všechny jeho účty.
        </CardDescription>
      </CardHeader>

      <CardContent>
        {nacitam ? (
          <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Načítám…
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {MOZNOSTI.map((m) => {
              const aktivni = uroven === m.klic;
              const pracuje = uklada === m.klic;
              return (
                <button
                  key={m.klic}
                  type="button"
                  onClick={() => zmen(m.klic)}
                  disabled={!!uklada}
                  className={cn(
                    'relative rounded-lg border p-4 text-left transition-colors',
                    aktivni
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'hover:border-muted-foreground/40',
                    uklada && 'opacity-60',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{m.nazev}</span>
                    {pracuje
                      ? <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      : aktivni && <Check className="h-4 w-4 text-primary" />}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{m.popis}</p>
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
