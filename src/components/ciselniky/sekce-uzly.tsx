'use client';

/**
 * AuditFlow — číselník uzlů procesní mapy.
 * Umístění: src/components/ciselniky/sekce-uzly.tsx
 *
 * Uzly určují, co se komu zobrazí na kartě osoby. Při prvním otevření
 * se založí výchozí sada; dál se edituje tady, aby texty ani podmínky
 * nebyly v kódu.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  collection, addDoc, updateDoc, setDoc, doc, getDocs, query, where,
} from 'firebase/firestore';
import { db } from '@/components/data-provider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Plus, X, Loader2, ChevronDown, ChevronRight, Route } from 'lucide-react';
import type { CiselnikCinnost } from '@/lib/cinnosti';
import type { CiselnikSkoleni } from '@/lib/skoleni';
import type {
  CiselnikUzel, FazeUzlu, PodminkaUzlu, UzavreniUzlu,
} from '@/lib/uzly';
import {
  VYCHOZI_UZLY, POPIS_FAZE, POPIS_PODMINKY, POPIS_UZAVRENI,
} from '@/lib/uzly';

const FAZE: FazeUzlu[] = ['nastup', 'provoz', 'udalost', 'ukonceni'];
const DRUHY_PROHLIDEK = ['vstupni', 'periodicka', 'mimoradna', 'vystupni', 'nasledna'];

export default function SekceUzly() {
  const [uzly, setUzly] = useState<CiselnikUzel[]>([]);
  const [cinnosti, setCinnosti] = useState<CiselnikCinnost[]>([]);
  const [skoleni, setSkoleni] = useState<CiselnikSkoleni[]>([]);
  const [nacitam, setNacitam] = useState(true);
  const [nazev, setNazev] = useState('');
  const [novaFaze, setNovaFaze] = useState<FazeUzlu>('nastup');
  const [otevreny, setOtevreny] = useState<string | null>(null);

  const nacti = useCallback(async () => {
    try {
      const [snapU, snapC, snapS] = await Promise.all([
        getDocs(query(collection(db, 'ciselnikUzlu'), where('stav', '==', 'aktivni'))),
        getDocs(query(collection(db, 'ciselnikCinnosti'), where('stav', '==', 'aktivni'))),
        getDocs(query(collection(db, 'ciselnikSkoleni'), where('stav', '==', 'aktivni'))),
      ]);

      if (snapU.empty) {
        // první otevření — založí výchozí sadu uzlů
        await Promise.all(
          VYCHOZI_UZLY.map((u, i) =>
            setDoc(doc(db, 'ciselnikUzlu', `uzel-${String(u.poradi).padStart(3, '0')}`), u, { merge: true }),
          ),
        );
        setUzly(VYCHOZI_UZLY.map((u) => ({ id: `uzel-${String(u.poradi).padStart(3, '0')}`, ...u })));
      } else {
        setUzly(
          snapU.docs
            .map((d) => ({ id: d.id, ...d.data() }) as CiselnikUzel)
            .sort((a, b) => (a.poradi ?? 0) - (b.poradi ?? 0)),
        );
      }

      setCinnosti(
        snapC.docs.map((d) => ({ id: d.id, ...d.data() }) as CiselnikCinnost)
          .sort((a, b) => a.nazev.localeCompare(b.nazev, 'cs')),
      );
      setSkoleni(
        snapS.docs.map((d) => ({ id: d.id, ...d.data() }) as CiselnikSkoleni)
          .sort((a, b) => a.nazev.localeCompare(b.nazev, 'cs')),
      );
    } catch (e) {
      console.error('Načtení uzlů selhalo:', e);
    } finally {
      setNacitam(false);
    }
  }, []);

  useEffect(() => { nacti(); }, [nacti]);

  async function pridej() {
    if (!nazev.trim()) return;
    const posledni = Math.max(0, ...uzly.filter((u) => u.faze === novaFaze).map((u) => u.poradi ?? 0));
    await addDoc(collection(db, 'ciselnikUzlu'), {
      nazev: nazev.trim(),
      faze: novaFaze,
      poradi: posledni + 10,
      podminka: 'vzdy' as PodminkaUzlu,
      uzavreni: 'rucne' as UzavreniUzlu,
      stav: 'aktivni',
    });
    setNazev('');
    nacti();
  }

  async function uprav(id: string, zmeny: Partial<CiselnikUzel>) {
    setUzly((p) => p.map((u) => (u.id === id ? { ...u, ...zmeny } : u)));
    const cistec = Object.fromEntries(
      Object.entries(zmeny).map(([k, v]) => [k, v === undefined || v === '' ? null : v]),
    );
    await updateDoc(doc(db, 'ciselnikUzlu', id), cistec);
  }

  async function smaz(id: string) {
    setUzly((p) => p.filter((u) => u.id !== id));
    await updateDoc(doc(db, 'ciselnikUzlu', id), { stav: 'smazano' });
  }

  function prepniCinnost(u: CiselnikUzel, cinnostId: string) {
    const stav = u.cinnostiIds ?? [];
    uprav(u.id, {
      cinnostiIds: stav.includes(cinnostId)
        ? stav.filter((x) => x !== cinnostId)
        : [...stav, cinnostId],
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Route className="h-4 w-4 text-blue-600" /> Uzly procesní mapy
        </CardTitle>
        <CardDescription>
          Kroky, kterými prochází zaměstnanec od nástupu po ukončení. Zobrazují se
          na kartě osoby podle podmínky — nováček v kanceláři uvidí jiné než svářeč.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="grid gap-2 sm:grid-cols-[1fr_180px_auto] items-end">
          <div className="space-y-1">
            <Label className="text-xs">Název uzlu</Label>
            <Input
              value={nazev}
              onChange={(e) => setNazev(e.target.value)}
              placeholder="např. Předání pracovních pomůcek"
              onKeyDown={(e) => e.key === 'Enter' && pridej()}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Fáze</Label>
            <Select value={novaFaze} onValueChange={(v) => setNovaFaze(v as FazeUzlu)}>
              <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                {FAZE.map((f) => <SelectItem key={f} value={f}>{POPIS_FAZE[f]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={pridej} disabled={!nazev.trim()}>
            <Plus className="mr-2 h-4 w-4" /> Přidat
          </Button>
        </div>

        {nacitam ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Načítám…
          </div>
        ) : FAZE.map((faze) => {
          const vFazi = uzly.filter((u) => u.faze === faze);
          if (vFazi.length === 0) return null;
          return (
            <div key={faze} className="space-y-1">
              <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                {POPIS_FAZE[faze]}
              </p>
              <div className="divide-y border-t">
                {vFazi.map((u) => {
                  const rozbaleno = otevreny === u.id;
                  return (
                    <div key={u.id} className="py-2 space-y-3">
                      <div className="grid gap-2 sm:grid-cols-[auto_1fr_auto_auto] items-center">
                        <Button
                          variant="ghost" size="icon" className="h-8 w-8 shrink-0"
                          onClick={() => setOtevreny(rozbaleno ? null : u.id)}
                        >
                          {rozbaleno ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </Button>
                        <Input
                          value={u.nazev}
                          onChange={(e) => uprav(u.id, { nazev: e.target.value })}
                          className="h-9"
                        />
                        <div className="text-[11px] text-muted-foreground whitespace-nowrap flex gap-2">
                          <span>{POPIS_PODMINKY[u.podminka]}</span>
                          {u.formular && <span className="font-medium">{u.formular}</span>}
                        </div>
                        <Button
                          variant="ghost" size="icon"
                          onClick={() => smaz(u.id)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>

                      {rozbaleno && (
                        <div className="ml-10 space-y-3 rounded-lg border bg-muted/20 p-4">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1">
                              <Label className="text-xs">Zobrazit komu</Label>
                              <Select
                                value={u.podminka}
                                onValueChange={(v) => uprav(u.id, { podminka: v as PodminkaUzlu })}
                              >
                                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {(Object.keys(POPIS_PODMINKY) as PodminkaUzlu[]).map((p) => (
                                    <SelectItem key={p} value={p}>{POPIS_PODMINKY[p]}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Čím se uzavírá</Label>
                              <Select
                                value={u.uzavreni}
                                onValueChange={(v) => uprav(u.id, { uzavreni: v as UzavreniUzlu })}
                              >
                                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {(Object.keys(POPIS_UZAVRENI) as UzavreniUzlu[]).map((p) => (
                                    <SelectItem key={p} value={p}>{POPIS_UZAVRENI[p]}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {u.podminka === 'priCinnosti' && (
                            <div className="space-y-1">
                              <Label className="text-xs">Spouštějící činnosti</Label>
                              <p className="text-[11px] text-muted-foreground">
                                Nevybrat žádnou znamená „při jakékoli přiřazené činnosti".
                              </p>
                              <div className="max-h-40 overflow-y-auto rounded border bg-background divide-y">
                                {cinnosti.map((c) => {
                                  const vybrano = (u.cinnostiIds ?? []).includes(c.id);
                                  return (
                                    <button
                                      key={c.id} type="button"
                                      onClick={() => prepniCinnost(u, c.id)}
                                      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-muted ${vybrano ? 'bg-blue-50/60 font-medium' : ''}`}
                                    >
                                      <span className={`h-3.5 w-3.5 shrink-0 rounded border ${vybrano ? 'border-blue-600 bg-blue-600' : 'border-slate-300'}`} />
                                      {c.nazev}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {u.uzavreni === 'doklady' && (
                            <p className="rounded border bg-background px-3 py-2 text-[11px] text-muted-foreground">
                              Uzel vypíše všechna témata z číselníku školení označená jako
                              doklad a u každého hlídá datum platnosti zapsané u osoby.
                            </p>
                          )}

                          {(u.uzavreni === 'skolenim' || u.uzavreni === 'zacvikem' || u.uzavreni === 'kolem') && (
                            <div className="space-y-1">
                              <Label className="text-xs">Téma školení</Label>
                              <Select
                                value={u.skoleniId ?? '__libovolne__'}
                                onValueChange={(v) => uprav(u.id, { skoleniId: v === '__libovolne__' ? null : v })}
                              >
                                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__libovolne__">— libovolné školení —</SelectItem>
                                  {skoleni.map((s) => (
                                    <SelectItem key={s.id} value={s.id}>{s.nazev}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}

                          {u.uzavreni === 'prohlidkou' && (
                            <div className="space-y-1">
                              <Label className="text-xs">Druh prohlídky</Label>
                              <Select
                                value={u.druhProhlidky ?? '__libovolna__'}
                                onValueChange={(v) => uprav(u.id, { druhProhlidky: v === '__libovolna__' ? null : v })}
                              >
                                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__libovolna__">— libovolná —</SelectItem>
                                  {DRUHY_PROHLIDEK.map((d) => (
                                    <SelectItem key={d} value={d}>{d}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}

                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1">
                              <Label className="text-xs">Formulář</Label>
                              <Input
                                value={u.formular ?? ''}
                                onChange={(e) => uprav(u.id, { formular: e.target.value })}
                                placeholder="F001"
                                className="h-9"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Právní opora</Label>
                              <Input
                                value={u.predpis ?? ''}
                                onChange={(e) => uprav(u.id, { predpis: e.target.value })}
                                className="h-9"
                              />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs">Vysvětlivka pro klienta</Label>
                            <Textarea
                              value={u.napoveda ?? ''}
                              onChange={(e) => uprav(u.id, { napoveda: e.target.value })}
                              className="min-h-[60px] text-sm"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
