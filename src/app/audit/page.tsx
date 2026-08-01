'use client';

/**
 * AuditFlow — odlehčená stránka jednorázového klienta.
 * Umístění: src/app/audit/page.tsx
 *
 * Vidí: své audity (reporty) + nálezy, ke kterým může psát dotazy.
 * Nevidí: časový plán, revize, školení, prohlídky, dokumentaci.
 *
 * Přístup: role 'client' + uroven 'basic'. Guard řeší layout (níže v návodu),
 * ale stránka si pro jistotu ověří profil sama.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  collection, query, where, getDocs, addDoc, doc,
} from 'firebase/firestore';
import { db, useData } from '@/components/data-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, ShieldAlert, MessageSquarePlus, CheckCircle2, Clock,
} from 'lucide-react';
import { cn } from '@/app/lib/utils';
import type { Zaznam, Zavada } from '@/app/lib/types';
import type { Dotaz } from '@/lib/dotazy';
import VlaknoKomentaru from '@/components/komentare/vlakno';
import { cilIdNalezu } from '@/lib/komentare';

interface NalezRadek {
  zaznamId: string;
  zaznamCislo: string;
  datum: string;
  zavada: Zavada;
}

export default function AuditPage() {
  const { user, userProfile, authLoading } = useData();
  const klientId = userProfile?.klientId;

  const [zaznamy, setZaznamy] = useState<Zaznam[]>([]);
  const [dotazy, setDotazy] = useState<Dotaz[]>([]);
  const [nacitam, setNacitam] = useState(true);
  const [chyba, setChyba] = useState<string | null>(null);

  const nacti = useCallback(async () => {
    if (!klientId) { setNacitam(false); return; }
    setNacitam(true);
    setChyba(null);
    try {
      const [zazSnap, dotSnap] = await Promise.all([
        getDocs(query(collection(db, 'zaznamy'), where('klientId', '==', klientId))),
        getDocs(query(collection(db, 'dotazy'), where('klientId', '==', klientId))),
      ]);
      setZaznamy(zazSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Zaznam));
      setDotazy(dotSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Dotaz));
    } catch (e) {
      console.error('Načtení auditu selhalo:', e);
      setChyba('Data se nepodařilo načíst.');
    } finally {
      setNacitam(false);
    }
  }, [klientId]);

  useEffect(() => { nacti(); }, [nacti]);

  // Rozbalí závady ze všech (nearchivovaných) záznamů do plochého seznamu nálezů.
  const nalezy = useMemo<NalezRadek[]>(() => {
    const out: NalezRadek[] = [];
    for (const z of zaznamy) {
      if (z.stav === 'archivovany') continue;
      for (const zavada of z.zavady ?? []) {
        out.push({
          zaznamId: z.id,
          zaznamCislo: z.cisloKlientske ?? z.cislo,
          datum: z.datum,
          zavada,
        });
      }
    }
    return out;
  }, [zaznamy]);

  async function polozDotaz(nalez: NalezRadek, text: string) {
    if (!klientId || !user) return;
    const novy = {
      klientId,
      zaznamId: nalez.zaznamId,
      zavadaId: nalez.zavada.id,
      zavadaPopis: nalez.zavada.popis,
      text: text.trim(),
      stav: 'nevyrizeno' as const,
      autorJmeno: user.displayName ?? user.email ?? 'Klient',
      autorUid: user.uid,
      vytvorenoIso: new Date().toISOString(),
    };
    // optimisticky do UI
    setDotazy((p) => [...p, { id: `tmp_${Date.now()}`, ...novy }]);
    try {
      await addDoc(collection(db, 'dotazy'), novy);
      nacti();
    } catch (e) {
      console.error('Uložení dotazu selhalo:', e);
      setChyba('Dotaz se nepodařilo odeslat.');
    }
  }

  const dotazyKZavade = useCallback(
    (zavadaId: string) => dotazy.filter((d) => d.zavadaId === zavadaId),
    [dotazy],
  );

  if (authLoading || nacitam) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Načítám…
      </div>
    );
  }

  if (!klientId) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
        Účet nemá přiřazeného klienta. Kontaktujte OZO technika.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 md:p-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Výsledky auditu</h1>
        <p className="text-sm text-muted-foreground">
          Nálezy z kontroly a prostor pro vaše dotazy k nim.
        </p>
      </div>

      {chyba && <p className="text-sm text-red-600">{chyba}</p>}

      {nalezy.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Zatím zde nejsou žádné nálezy.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {nalezy.map((n) => (
            <NalezKarta
              key={`${n.zaznamId}_${n.zavada.id}`}
              nalez={n}
              klientId={klientId}
              dotazy={dotazyKZavade(n.zavada.id)}
              onDotaz={(text) => polozDotaz(n, text)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function NalezKarta({
  nalez, klientId, dotazy, onDotaz,
}: {
  nalez: NalezRadek;
  klientId: string;
  dotazy: Dotaz[];
  onDotaz: (text: string) => void;
}) {
  const [otevreno, setOtevreno] = useState(false);
  const [text, setText] = useState('');
  const z = nalez.zavada;

  function odeslat() {
    if (text.trim() === '') return;
    onDotaz(text);
    setText('');
    setOtevreno(false);
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start gap-2">
          <ShieldAlert className={cn(
            'mt-0.5 h-4 w-4 shrink-0',
            z.odstraneno ? 'text-emerald-600' : 'text-amber-500',
          )} />
          <div className="flex-1">
            <CardTitle className="text-sm font-medium leading-snug">{z.popis}</CardTitle>
            <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
              <span>kontrola {nalez.zaznamCislo}</span>
              {z.lokalizace && <span>{z.lokalizace}</span>}
              {z.terminOdstraneni && <span>termín: {z.terminOdstraneni}</span>}
              {z.odstraneno && (
                <Badge variant="outline" className="h-4 text-[10px] text-emerald-700">
                  odstraněno
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {z.navrhOpatreni && (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Návrh opatření: </span>
            {z.navrhOpatreni}
          </p>
        )}

        {/* existující dotazy */}
        {dotazy.length > 0 && (
          <div className="space-y-2 rounded-md border bg-muted/30 p-3">
            {dotazy.map((d) => (
              <div key={d.id} className="text-xs">
                <div className="flex items-center gap-1.5">
                  {d.stav === 'vyrizeno'
                    ? <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                    : <Clock className="h-3 w-3 text-amber-500" />}
                  <span className="font-medium">{d.autorJmeno ?? 'Vy'}</span>
                  <span className="text-muted-foreground">
                    {new Date(d.vytvorenoIso).toLocaleDateString('cs-CZ')}
                  </span>
                </div>
                <p className="mt-1 pl-5">{d.text}</p>
                {d.odpoved && (
                  <div className="mt-1 rounded bg-background p-2 pl-3">
                    <span className="font-medium text-primary">OZO: </span>
                    {d.odpoved}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* nový dotaz */}
        {otevreno ? (
          <div className="space-y-2">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Napište dotaz k tomuto nálezu…"
              rows={3}
              className="text-sm"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={odeslat} disabled={text.trim() === ''}>
                Odeslat dotaz
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setOtevreno(false); setText(''); }}>
                Zrušit
              </Button>
            </div>
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            onClick={() => setOtevreno(true)}
          >
            <MessageSquarePlus className="mr-2 h-4 w-4" /> Zeptat se OZO
          </Button>
        )}

        {/* Vlákno komentářů k nálezu */}
        <div className="pt-3 border-t">
          <VlaknoKomentaru
            klientId={klientId}
            cil="nalez"
            cilId={cilIdNalezu(nalez.zaznamId, z.id)}
            cilPopis={z.popis}
            kompaktni
          />
        </div>
      </CardContent>
    </Card>
  );
}
