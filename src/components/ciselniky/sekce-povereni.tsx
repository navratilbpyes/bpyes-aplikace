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
  collection, addDoc, setDoc, updateDoc, doc, query, where, getDocs,
} from 'firebase/firestore';
import { db } from '@/components/data-provider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Plus, X, Loader2, Sparkles } from 'lucide-react';
import type { CiselnikPovereni } from '@/lib/povereni';
import { PLATNOSTI_POVERENI } from '@/lib/povereni';

/** Základní sada obvyklých pověření. Platnost je výchozí „na neurčito“ — upravte podle vnitřních předpisů klienta. */
const ZAKLADNI_SADA: { id: string; nazev: string; predpis: string; kdoVydava: string }[] = [
  { id: 'pov-preventista-po', nazev: 'Preventista požární ochrany', predpis: '§ 25 vyhlášky č. 246/2001 Sb.', kdoVydava: 'zaměstnavatel / vedoucí' },
  { id: 'pov-hlidka-po', nazev: 'Člen preventivní požární hlídky', predpis: '§ 24 vyhlášky č. 246/2001 Sb.', kdoVydava: 'zaměstnavatel / vedoucí' },
  { id: 'pov-snizeny-provoz-po', nazev: 'Osoba pověřená zajištěním PO při sníženém provozu a mimo pracovní dobu', predpis: '§ 23 odst. 5 vyhlášky č. 246/2001 Sb.', kdoVydava: 'zaměstnavatel / vedoucí' },
  { id: 'pov-prace-zvysene-nebezpeci', nazev: 'Vydávání písemných příkazů k pracím se zvýšeným požárním nebezpečím', predpis: '§ 6a zákona č. 133/1985 Sb.', kdoVydava: 'zaměstnavatel' },
  { id: 'pov-prvni-pomoc', nazev: 'Osoba pověřená poskytováním první pomoci', predpis: '§ 102 zákoníku práce', kdoVydava: 'zaměstnavatel / vedoucí' },
  { id: 'pov-zdvihaci-zarizeni', nazev: 'Obsluha zdvihacích zařízení (jeřábník, vazač, signalista)', predpis: 'NV č. 193/2022 Sb.; ČSN ISO 12480-1', kdoVydava: 'provozovatel' },
  { id: 'pov-manipulacni-vozik', nazev: 'Obsluha manipulačních vozíků a mobilních strojů', predpis: 'NV č. 378/2001 Sb.', kdoVydava: 'provozovatel' },
  { id: 'pov-vyhrazena-zarizeni', nazev: 'Obsluha vyhrazených technických zařízení (tlaková, plynová)', predpis: 'zákon č. 250/2021 Sb.', kdoVydava: 'provozovatel' },
  { id: 'pov-vozidlo-zamestnavatele', nazev: 'Řízení vozidla zaměstnavatele', predpis: 'vnitřní předpis', kdoVydava: 'zaměstnavatel' },
];

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

  async function doplnZakladniSadu() {
    for (const z of ZAKLADNI_SADA) {
      // merge + pevné ID → opakované spuštění nic nezduplikuje; už upravené položky se nepřepisují
      const stav = polozky.find((p) => p.id === z.id);
      if (stav) continue;
      await setDoc(doc(db, 'ciselnikPovereni', z.id), {
        nazev: z.nazev,
        platnostMesice: 0,
        kdoVydava: z.kdoVydava,
        predpis: z.predpis,
        stav: 'aktivni',
      }, { merge: true });
    }
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
          <div className="py-6 space-y-3">
            <p className="text-sm text-muted-foreground">Zatím žádné druhy pověření.</p>
            {!chyba && (
              <Button variant="outline" onClick={doplnZakladniSadu}>
                <Sparkles className="mr-2 h-4 w-4" /> Doplnit základní sadu ({ZAKLADNI_SADA.length} pověření)
              </Button>
            )}
          </div>
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
