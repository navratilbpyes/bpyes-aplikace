'use client';

/**
 * AuditFlow — číselníky školení a revizí.
 * Umístění: src/app/ciselniky/page.tsx
 *
 * Globální katalogy témat. Při přiřazení klientovi se hodnoty
 * zkopírují (snapshot) — pozdější úprava zde už přiřazené položky nezmění.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  collection, addDoc, updateDoc, doc, query, where, getDocs,
} from 'firebase/firestore';
import { db } from '@/components/data-provider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { GraduationCap, Wrench, Plus, X, Loader2 } from 'lucide-react';
import { PERIODY as PERIODY_SKOLENI, popisPeriody } from '@/lib/skoleni';
import { PERIODY as PERIODY_REVIZE } from '@/lib/revize';
import type { CiselnikSkoleni } from '@/lib/skoleni';
import type { CiselnikRevize } from '@/lib/revize';

export default function CiselnikyPage() {
  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Číselníky</h1>
        <p className="text-sm text-muted-foreground">
          Katalogy témat školení a revizí. Při přiřazení klientovi se hodnoty zkopírují —
          pozdější úprava zde už přiřazené položky nezmění.
        </p>
      </div>

      <Tabs defaultValue="skoleni" className="space-y-6">
        <TabsList className="w-full justify-start h-auto p-1 bg-secondary">
          <TabsTrigger value="skoleni" className="px-6 py-2">
            <GraduationCap className="mr-2 h-4 w-4" /> Školení
          </TabsTrigger>
          <TabsTrigger value="revize" className="px-6 py-2">
            <Wrench className="mr-2 h-4 w-4" /> Revize
          </TabsTrigger>
        </TabsList>

        <TabsContent value="skoleni">
          <SekceSkoleni />
        </TabsContent>

        <TabsContent value="revize">
          <SekceRevize />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ─────────────────────────  ŠKOLENÍ  ───────────────────────── */

function SekceSkoleni() {
  const [polozky, setPolozky] = useState<CiselnikSkoleni[]>([]);
  const [nacitam, setNacitam] = useState(true);
  const [nazev, setNazev] = useState('');
  const [perioda, setPerioda] = useState(12);
  const [provadi, setProvadi] = useState('');

  const nacti = useCallback(async () => {
    try {
      const snap = await getDocs(
        query(collection(db, 'ciselnikSkoleni'), where('stav', '==', 'aktivni')),
      );
      setPolozky(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as CiselnikSkoleni)
          .sort((a, b) => a.nazev.localeCompare(b.nazev, 'cs')),
      );
    } catch (e) {
      console.error('Načtení číselníku školení selhalo:', e);
    } finally {
      setNacitam(false);
    }
  }, []);

  useEffect(() => { nacti(); }, [nacti]);

  async function pridej() {
    if (nazev.trim() === '') return;
    await addDoc(collection(db, 'ciselnikSkoleni'), {
      nazev: nazev.trim(),
      periodaMesice: perioda,
      provadi: provadi.trim() || null,
      stav: 'aktivni',
    });
    setNazev('');
    setProvadi('');
    nacti();
  }

  async function uprav(id: string, zmeny: Partial<CiselnikSkoleni>) {
    setPolozky((p) => p.map((x) => (x.id === id ? { ...x, ...zmeny } : x)));
    const cistec = Object.fromEntries(
      Object.entries(zmeny).map(([k, v]) => [k, v === undefined || v === '' ? null : v]),
    );
    await updateDoc(doc(db, 'ciselnikSkoleni', id), cistec);
  }

  async function smaz(id: string) {
    setPolozky((p) => p.filter((x) => x.id !== id));
    await updateDoc(doc(db, 'ciselnikSkoleni', id), { stav: 'smazano' });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Témata školení</CardTitle>
        <CardDescription>
          Téma, výchozí perioda a kdo školení provádí (OZO, externí dodavatel, jméno).
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-[1fr_180px_200px_auto] items-end">
          <div className="space-y-1">
            <Label className="text-xs">Téma školení</Label>
            <Input
              value={nazev}
              onChange={(e) => setNazev(e.target.value)}
              placeholder="např. Školení BOZP"
              onKeyDown={(e) => e.key === 'Enter' && pridej()}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Perioda</Label>
            <Select value={String(perioda)} onValueChange={(v) => setPerioda(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PERIODY_SKOLENI.map((p) => (
                  <SelectItem key={p.hodnota} value={String(p.hodnota)}>{p.popis}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Kdo provádí</Label>
            <Input
              value={provadi}
              onChange={(e) => setProvadi(e.target.value)}
              placeholder="např. OZO"
              onKeyDown={(e) => e.key === 'Enter' && pridej()}
            />
          </div>
          <Button onClick={pridej} disabled={nazev.trim() === ''}>
            <Plus className="mr-2 h-4 w-4" /> Přidat
          </Button>
        </div>

        {nacitam ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Načítám…
          </div>
        ) : polozky.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">
            Zatím žádná témata. Přidej první výše.
          </p>
        ) : (
          <div className="divide-y border-t">
            {polozky.map((s) => (
              <div
                key={s.id}
                className="grid gap-2 py-3 sm:grid-cols-[1fr_180px_200px_auto] items-center"
              >
                <Input
                  value={s.nazev}
                  onChange={(e) => uprav(s.id, { nazev: e.target.value })}
                  className="h-9"
                />
                <Select
                  value={String(s.periodaMesice)}
                  onValueChange={(v) => uprav(s.id, { periodaMesice: Number(v) })}
                >
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PERIODY_SKOLENI.map((p) => (
                      <SelectItem key={p.hodnota} value={String(p.hodnota)}>{p.popis}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={s.provadi ?? ''}
                  onChange={(e) => uprav(s.id, { provadi: e.target.value })}
                  placeholder="kdo provádí"
                  className="h-9"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => smaz(s.id)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ─────────────────────────  REVIZE  ───────────────────────── */

function SekceRevize() {
  const [polozky, setPolozky] = useState<CiselnikRevize[]>([]);
  const [nacitam, setNacitam] = useState(true);
  const [nazev, setNazev] = useState('');
  const [perioda, setPerioda] = useState(12);

  const nacti = useCallback(async () => {
    try {
      const snap = await getDocs(
        query(collection(db, 'ciselnikRevizi'), where('stav', '==', 'aktivni')),
      );
      setPolozky(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as CiselnikRevize)
          .sort((a, b) => a.nazev.localeCompare(b.nazev, 'cs')),
      );
    } catch (e) {
      console.error('Načtení číselníku revizí selhalo:', e);
    } finally {
      setNacitam(false);
    }
  }, []);

  useEffect(() => { nacti(); }, [nacti]);

  async function pridej() {
    if (nazev.trim() === '') return;
    await addDoc(collection(db, 'ciselnikRevizi'), {
      nazev: nazev.trim(),
      periodaMesice: perioda,
      stav: 'aktivni',
    });
    setNazev('');
    nacti();
  }

  async function uprav(id: string, zmeny: Partial<CiselnikRevize>) {
    setPolozky((p) => p.map((x) => (x.id === id ? { ...x, ...zmeny } : x)));
    await updateDoc(doc(db, 'ciselnikRevizi', id), zmeny);
  }

  async function smaz(id: string) {
    setPolozky((p) => p.filter((x) => x.id !== id));
    await updateDoc(doc(db, 'ciselnikRevizi', id), { stav: 'smazano' });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Témata revizí</CardTitle>
        <CardDescription>
          Téma a výchozí perioda. Revizní firmu zadáváš až u konkrétní revize
          v kartě klienta — u každého klienta bývá jiná.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-[1fr_180px_auto] items-end">
          <div className="space-y-1">
            <Label className="text-xs">Téma revize</Label>
            <Input
              value={nazev}
              onChange={(e) => setNazev(e.target.value)}
              placeholder="např. Revize hromosvodu"
              onKeyDown={(e) => e.key === 'Enter' && pridej()}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Perioda</Label>
            <Select value={String(perioda)} onValueChange={(v) => setPerioda(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PERIODY_REVIZE.map((p) => (
                  <SelectItem key={p.hodnota} value={String(p.hodnota)}>{p.popis}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={pridej} disabled={nazev.trim() === ''}>
            <Plus className="mr-2 h-4 w-4" /> Přidat
          </Button>
        </div>

        {nacitam ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Načítám…
          </div>
        ) : polozky.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">
            Zatím žádná témata. Přidej první výše.
          </p>
        ) : (
          <div className="divide-y border-t">
            {polozky.map((r) => (
              <div
                key={r.id}
                className="grid gap-2 py-3 sm:grid-cols-[1fr_180px_auto] items-center"
              >
                <Input
                  value={r.nazev}
                  onChange={(e) => uprav(r.id, { nazev: e.target.value })}
                  className="h-9"
                />
                <Select
                  value={String(r.periodaMesice)}
                  onValueChange={(v) => uprav(r.id, { periodaMesice: Number(v) })}
                >
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PERIODY_REVIZE.map((p) => (
                      <SelectItem key={p.hodnota} value={String(p.hodnota)}>{p.popis}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => smaz(r.id)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
