'use client';

/**
 * AuditFlow — číselník Pověření.
 * Umístění: src/components/ciselniky/sekce-povereni.tsx
 *
 * Druhy pověření (např. obsluha zdvihacího zařízení, preventista PO, osoba pověřená
 * první pomocí) a doba jejich platnosti — nebo „na neurčito". K položce číselníku
 * „Školení a činnosti" se druh pověření přiřazuje přepínačem „Vyžaduje pověření".
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Plus, X, Loader2 } from 'lucide-react';
import type { CiselnikPovereni } from '@/lib/povereni';
import { PLATNOSTI_POVERENI } from '@/lib/povereni';

export default function SekcePovereni() {
  const [polozky, setPolozky] = useState<CiselnikPovereni[]>([]);
  const [nacitam, setNacitam] = useState(true);
  const [chyba, setChyba] = useState(false);
  const [nazev, setNazev] = useState('');
  const [platnost, setPlatnost] = useState(0);
  const [kdo, setKdo] = useState('');

  const nacti = useCallback(async () => {
    try {
      const snap = await getDocs(
        query(collection(db, 'ciselnikPovereni'), where('stav', '==', 'aktivni')),
      );
      setPolozky(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as CiselnikPovereni)
          .sort((a, b) => a.nazev.localeCompare(b.nazev, 'cs')),
      );
      setChyba(false);
    } catch (e) {
      console.error('Načtení číselníku pověření selhalo:', e);
      setChyba(true);
    } finally {
      setNacitam(false);
    }
  }, []);

  useEffect(() => { nacti(); }, [nacti]);

  async function pridej() {
    if (!nazev.trim()) return;
    await addDoc(collection(db, 'ciselnikPovereni'), {
      nazev: nazev.trim(),
      platnostMesice: platnost,
      kdoVydava: kdo.trim() || null,
      stav: 'aktivni',
    });
    setNazev(''); setKdo('');
    nacti();
  }

  async function uprav(id: string, zmeny: Partial<CiselnikPovereni>) {
    setPolozky((p) => p.map((x) => (x.id === id ? { ...x, ...zmeny } : x)));
    const cistec = Object.fromEntries(
      Object.entries(zmeny).map(([k, v]) => [k, v === undefined || v === '' ? null : v]),
    );
    await updateDoc(doc(db, 'ciselnikPovereni', id), cistec);
  }

  async function smaz(id: string) {
    setPolozky((p) => p.filter((x) => x.id !== id));
    await updateDoc(doc(db, 'ciselnikPovereni', id), { stav: 'smazano' });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pověření</CardTitle>
        <CardDescription>
          Druhy pověření a doba jejich platnosti (nebo na neurčito). Druh pověření pak přiřadíte
          položce v číselníku „Školení a činnosti“ přepínačem „Vyžaduje pověření“. Konkrétní pověření
          osob se zapisují v Lidských zdrojích → Pověření.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {chyba && (
          <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Číselník pověření se nepodařilo načíst. Zkontrolujte, že jsou ve Firestore Rules
            publikována pravidla pro kolekci <code>ciselnikPovereni</code> (viz firestore.rules).
          </p>
        )}

        <div className="grid gap-2 sm:grid-cols-[1fr_170px_220px_auto] items-end">
          <div className="space-y-1">
            <Label className="text-xs">Druh pověření</Label>
            <Input
              value={nazev}
              onChange={(e) => setNazev(e.target.value)}
              placeholder="např. Pověření k obsluze zdvihacího zařízení"
              onKeyDown={(e) => e.key === 'Enter' && pridej()}
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Platnost</Label>
            <Select value={String(platnost)} onValueChange={(v) => setPlatnost(Number(v))}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PLATNOSTI_POVERENI.map((p) => (
                  <SelectItem key={p.hodnota} value={String(p.hodnota)}>{p.popis}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Kdo pověřuje</Label>
            <Input value={kdo} onChange={(e) => setKdo(e.target.value)} placeholder="např. vedoucí provozu" className="h-9" />
          </div>
          <Button onClick={pridej} disabled={!nazev.trim()}>
            <Plus className="mr-2 h-4 w-4" /> Přidat
          </Button>
        </div>

        {nacitam ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Načítám…
          </div>
        ) : polozky.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">Zatím žádné druhy pověření.</p>
        ) : (
          <div className="divide-y border-y">
            {polozky.map((p) => (
              <div key={p.id} className="grid gap-2 py-2 sm:grid-cols-[1fr_170px_220px_auto] items-center">
                <Input
                  value={p.nazev}
                  onChange={(e) => uprav(p.id, { nazev: e.target.value })}
                  className="h-9"
                />
                <Select
                  value={String(p.platnostMesice ?? 0)}
                  onValueChange={(v) => uprav(p.id, { platnostMesice: Number(v) })}
                >
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PLATNOSTI_POVERENI.map((x) => (
                      <SelectItem key={x.hodnota} value={String(x.hodnota)}>{x.popis}</SelectItem>
                    ))}
                    {p.platnostMesice > 0 && !PLATNOSTI_POVERENI.some((x) => x.hodnota === p.platnostMesice) && (
                      <SelectItem value={String(p.platnostMesice)}>{p.platnostMesice} měsíců</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <Input
                  value={p.kdoVydava ?? ''}
                  onChange={(e) => uprav(p.id, { kdoVydava: e.target.value })}
                  placeholder="kdo pověřuje"
                  className="h-9"
                />
                <Button
                  variant="ghost" size="icon"
                  onClick={() => smaz(p.id)}
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
