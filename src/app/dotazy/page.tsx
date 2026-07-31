'use client';

/**
 * AuditFlow — dotazy klientů (admin).
 * Umístění: src/app/dotazy/page.tsx
 *
 * Seznam dotazů k nálezům. Admin odpovídá — nastaví odpoved, stav vyrizeno.
 * Zápis jde přímo přes updateDoc (Rules povolí update jen adminovi).
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  collection, getDocs, doc, updateDoc, query, orderBy,
} from 'firebase/firestore';
import { db, useData } from '@/components/data-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, Clock, CheckCircle2, ExternalLink, MessageSquare,
} from 'lucide-react';
import { cn } from '@/app/lib/utils';
import { useToast } from '@/hooks/use-toast';
import type { Dotaz } from '@/lib/dotazy';

export default function DotazyPage() {
  const { klienti } = useData();
  const { toast } = useToast();
  const [dotazy, setDotazy] = useState<Dotaz[]>([]);
  const [nacitam, setNacitam] = useState(true);
  const [filtr, setFiltr] = useState<'nevyrizene' | 'vse'>('nevyrizene');

  const nacti = useCallback(async () => {
    setNacitam(true);
    try {
      // orderBy vyžaduje, aby všechny dokumenty měly vytvorenoIso (mají).
      const snap = await getDocs(
        query(collection(db, 'dotazy'), orderBy('vytvorenoIso', 'desc')),
      );
      setDotazy(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Dotaz));
    } catch (e) {
      // fallback bez orderBy, kdyby chyběl index
      try {
        const snap = await getDocs(collection(db, 'dotazy'));
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Dotaz);
        list.sort((a, b) => (b.vytvorenoIso ?? '').localeCompare(a.vytvorenoIso ?? ''));
        setDotazy(list);
      } catch (e2) {
        console.error('Načtení dotazů selhalo:', e2);
      }
    } finally {
      setNacitam(false);
    }
  }, []);

  useEffect(() => { nacti(); }, [nacti]);

  const jmenoKlienta = useCallback(
    (klientId: string) => klienti?.find((k) => k.id === klientId)?.nazev ?? '—',
    [klienti],
  );

  const zobraz = useMemo(() => {
    if (filtr === 'nevyrizene') return dotazy.filter((d) => d.stav === 'nevyrizeno');
    return dotazy;
  }, [dotazy, filtr]);

  const pocetNevyrizenych = useMemo(
    () => dotazy.filter((d) => d.stav === 'nevyrizeno').length,
    [dotazy],
  );

  async function odpovez(id: string, odpoved: string) {
    const cistec = {
      odpoved: odpoved.trim(),
      stav: 'vyrizeno' as const,
      odpovezenoIso: new Date().toISOString(),
    };
    setDotazy((p) => p.map((d) => (d.id === id ? { ...d, ...cistec } : d)));
    try {
      await updateDoc(doc(db, 'dotazy', id), cistec);
      toast({ title: 'Odpověď odeslána', description: 'Klient ji uvidí ve svém přehledu.' });
    } catch (e) {
      console.error('Uložení odpovědi selhalo:', e);
      toast({ title: 'Nepodařilo se', description: 'Zkuste to znovu.', variant: 'destructive' });
      nacti();
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 md:p-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Dotazy klientů</h1>
        <p className="text-sm text-muted-foreground">
          Dotazy k nálezům z auditů. Odpověď se klientovi zobrazí u příslušného nálezu.
        </p>
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          variant={filtr === 'nevyrizene' ? 'default' : 'secondary'}
          className="h-8 rounded-full px-4"
          onClick={() => setFiltr('nevyrizene')}
        >
          Nevyřízené
          {pocetNevyrizenych > 0 && (
            <Badge className="ml-2 h-5 bg-red-500 px-1.5 text-white hover:bg-red-500">
              {pocetNevyrizenych}
            </Badge>
          )}
        </Button>
        <Button
          size="sm"
          variant={filtr === 'vse' ? 'default' : 'secondary'}
          className="h-8 rounded-full px-4"
          onClick={() => setFiltr('vse')}
        >
          Vše
        </Button>
      </div>

      {nacitam ? (
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Načítám dotazy…
        </div>
      ) : zobraz.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {filtr === 'nevyrizene'
              ? 'Žádné nevyřízené dotazy. Klid.'
              : 'Zatím žádné dotazy.'}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {zobraz.map((d) => (
            <DotazKarta
              key={d.id}
              d={d}
              klientNazev={jmenoKlienta(d.klientId)}
              onOdpoved={(text) => odpovez(d.id, text)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DotazKarta({
  d, klientNazev, onOdpoved,
}: {
  d: Dotaz;
  klientNazev: string;
  onOdpoved: (text: string) => void;
}) {
  const [text, setText] = useState(d.odpoved ?? '');
  const [edituje, setEdituje] = useState(false);
  const vyrizeno = d.stav === 'vyrizeno';

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5">
            {vyrizeno
              ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              : <Clock className="h-4 w-4 text-amber-500" />}
            <CardTitle className="text-sm font-semibold">{klientNazev}</CardTitle>
          </div>
          <span className="text-xs text-muted-foreground">
            {new Date(d.vytvorenoIso).toLocaleDateString('cs-CZ')}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* nález, kterého se dotaz týká */}
        {d.zavadaPopis && (
          <Link
            href={`/zaznamy/${d.zaznamId}`}
            className="flex items-start gap-1.5 rounded-md bg-muted/50 p-2 text-xs text-muted-foreground hover:bg-muted"
          >
            <MessageSquare className="mt-0.5 h-3 w-3 shrink-0" />
            <span className="flex-1">{d.zavadaPopis}</span>
            <ExternalLink className="mt-0.5 h-3 w-3 shrink-0" />
          </Link>
        )}

        {/* dotaz */}
        <div className="text-sm">
          <span className="font-medium">{d.autorJmeno ?? 'Klient'}: </span>
          {d.text}
        </div>

        {/* odpověď / pole na odpověď */}
        {vyrizeno && !edituje ? (
          <div className="rounded-md border bg-emerald-50/50 p-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-medium text-emerald-700">Vaše odpověď</span>
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setEdituje(true)}
              >
                upravit
              </button>
            </div>
            <p className="text-sm">{d.odpoved}</p>
          </div>
        ) : (
          <div className="space-y-2">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Napište odpověď klientovi…"
              rows={3}
              className="text-sm"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => { onOdpoved(text); setEdituje(false); }}
                disabled={text.trim() === ''}
              >
                {vyrizeno ? 'Uložit změnu' : 'Odeslat odpověď'}
              </Button>
              {edituje && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => { setText(d.odpoved ?? ''); setEdituje(false); }}
                >
                  Zrušit
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
