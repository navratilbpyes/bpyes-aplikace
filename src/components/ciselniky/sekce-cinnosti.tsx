'use client';

/**
 * AuditFlow — číselník činností a kategorií práce.
 * Umístění: src/components/ciselniky/sekce-cinnosti.tsx
 *
 * Vkládá se jako záložka do /ciselniky. Globální katalog — při přiřazení
 * klientovi se hodnoty kopírují (snapshot), stejně jako u školení.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  collection, addDoc, updateDoc, setDoc, doc, query, where, getDocs,
} from 'firebase/firestore';
import { db } from '@/components/data-provider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Plus, X, Loader2, ChevronDown, ChevronRight, Stethoscope } from 'lucide-react';
import type { CiselnikSkoleni } from '@/lib/skoleni';
import type { CiselnikCinnost, CiselnikKategorie } from '@/lib/cinnosti';
import {
  PERIODY_PROHLIDKY, VYCHOZI_KATEGORIE, popisPeriodyProhlidky,
} from '@/lib/cinnosti';

export default function SekceCinnosti() {
  const [polozky, setPolozky] = useState<CiselnikCinnost[]>([]);
  const [skoleni, setSkoleni] = useState<CiselnikSkoleni[]>([]);
  const [nacitam, setNacitam] = useState(true);
  const [nazev, setNazev] = useState('');
  const [otevrene, setOtevrene] = useState<string | null>(null);

  const nacti = useCallback(async () => {
    try {
      const [snapC, snapS] = await Promise.all([
        getDocs(query(collection(db, 'ciselnikCinnosti'), where('stav', '==', 'aktivni'))),
        getDocs(query(collection(db, 'ciselnikSkoleni'), where('stav', '==', 'aktivni'))),
      ]);
      setPolozky(
        snapC.docs
          .map((d) => ({ id: d.id, ...d.data() }) as CiselnikCinnost)
          .sort((a, b) => a.nazev.localeCompare(b.nazev, 'cs')),
      );
      setSkoleni(
        snapS.docs
          .map((d) => ({ id: d.id, ...d.data() }) as CiselnikSkoleni)
          .sort((a, b) => a.nazev.localeCompare(b.nazev, 'cs')),
      );
    } catch (e) {
      console.error('Načtení číselníku činností selhalo:', e);
    } finally {
      setNacitam(false);
    }
  }, []);

  useEffect(() => { nacti(); }, [nacti]);

  async function pridej() {
    if (nazev.trim() === '') return;
    await addDoc(collection(db, 'ciselnikCinnosti'), {
      nazev: nazev.trim(),
      skoleniIds: [],
      zacvik: false,
      profesniRiziko: false,
      prohlidkaDo50: null,
      prohlidkaNad50: null,
      stav: 'aktivni',
    });
    setNazev('');
    nacti();
  }

  async function uprav(id: string, zmeny: Partial<CiselnikCinnost>) {
    setPolozky((p) => p.map((x) => (x.id === id ? { ...x, ...zmeny } : x)));
    const cistec = Object.fromEntries(
      Object.entries(zmeny).map(([k, v]) => [k, v === undefined || v === '' ? null : v]),
    );
    await updateDoc(doc(db, 'ciselnikCinnosti', id), cistec);
  }

  async function smaz(id: string) {
    setPolozky((p) => p.filter((x) => x.id !== id));
    await updateDoc(doc(db, 'ciselnikCinnosti', id), { stav: 'smazano' });
  }

  function prepniSkoleni(c: CiselnikCinnost, skoleniId: string) {
    const stav = c.skoleniIds ?? [];
    uprav(c.id, {
      skoleniIds: stav.includes(skoleniId)
        ? stav.filter((x) => x !== skoleniId)
        : [...stav, skoleniId],
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Činnosti</CardTitle>
          <CardDescription>
            Rizikový profil osoby. Z činnosti vyplývají povinná školení, zácvik a profesní
            riziko podle přílohy č. 1 vyhlášky č. 79/2013 Sb. OOPP se řeší u konkrétního
            klienta, ne zde.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-[1fr_auto] items-end">
            <div className="space-y-1">
              <Label className="text-xs">Název činnosti</Label>
              <Input
                value={nazev}
                onChange={(e) => setNazev(e.target.value)}
                placeholder="např. Práce ve výškách a nad volnou hloubkou"
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
              Zatím žádné činnosti. Začni deseti nejčastějšími — katalog nemusí být úplný,
              aby systém fungoval.
            </p>
          ) : (
            <div className="divide-y border-t">
              {polozky.map((c) => {
                const rozbaleno = otevrene === c.id;
                const pocetSkoleni = (c.skoleniIds ?? []).length;
                return (
                  <div key={c.id} className="py-3 space-y-3">
                    <div className="grid gap-2 sm:grid-cols-[auto_1fr_auto_auto] items-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => setOtevrene(rozbaleno ? null : c.id)}
                      >
                        {rozbaleno ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </Button>
                      <Input
                        value={c.nazev}
                        onChange={(e) => uprav(c.id, { nazev: e.target.value })}
                        className="h-9"
                      />
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground whitespace-nowrap">
                        {pocetSkoleni > 0 && <span>{pocetSkoleni}× školení</span>}
                        {c.zacvik && <span className="rounded bg-blue-50 px-1.5 py-0.5 text-blue-700 font-medium">zácvik</span>}
                        {c.profesniRiziko && (
                          <span className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-700 font-medium">
                            prohlídka {popisPeriodyProhlidky(c.prohlidkaDo50)} / {popisPeriodyProhlidky(c.prohlidkaNad50)}
                          </span>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => smaz(c.id)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    {rozbaleno && (
                      <div className="ml-10 space-y-4 rounded-lg border bg-muted/20 p-4">
                        <div className="space-y-2">
                          <Label className="text-xs font-semibold">Povinná školení</Label>
                          {skoleni.length === 0 ? (
                            <p className="text-xs text-muted-foreground">
                              Číselník školení je prázdný.
                            </p>
                          ) : (
                            <div className="max-h-56 overflow-y-auto rounded border bg-background divide-y">
                              {skoleni.map((s) => {
                                const vybrano = (c.skoleniIds ?? []).includes(s.id);
                                return (
                                  <button
                                    key={s.id}
                                    type="button"
                                    onClick={() => prepniSkoleni(c, s.id)}
                                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-muted ${vybrano ? 'bg-blue-50/60 font-medium' : ''}`}
                                  >
                                    <span className={`h-3.5 w-3.5 shrink-0 rounded border ${vybrano ? 'border-blue-600 bg-blue-600' : 'border-slate-300'}`} />
                                    <span className="flex-1">{s.nazev}</span>
                                    {s.kod && <span className="text-[10px] text-muted-foreground">{s.kod}</span>}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between rounded border bg-background px-3 py-2">
                          <div>
                            <Label className="text-xs font-semibold">Vyžaduje praktický zácvik</Label>
                            <p className="text-[11px] text-muted-foreground">
                              Zácvik s mentorem a záznamem (F002–F005), až po vstupním odborném školení.
                            </p>
                          </div>
                          <Switch
                            checked={!!c.zacvik}
                            onCheckedChange={(v) => uprav(c.id, { zacvik: v })}
                          />
                        </div>

                        <div className="rounded border bg-background px-3 py-2 space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <Label className="text-xs font-semibold flex items-center gap-1.5">
                                <Stethoscope className="h-3.5 w-3.5" /> Profesní riziko
                              </Label>
                              <p className="text-[11px] text-muted-foreground">
                                Vynucuje vstupní i výstupní prohlídku i v kategorii 1 a nese vlastní periodu.
                              </p>
                            </div>
                            <Switch
                              checked={!!c.profesniRiziko}
                              onCheckedChange={(v) => uprav(c.id, { profesniRiziko: v })}
                            />
                          </div>

                          {c.profesniRiziko && (
                            <>
                              <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-1">
                                  <Label className="text-xs">Perioda do 50 let</Label>
                                  <Select
                                    value={c.prohlidkaDo50 ? String(c.prohlidkaDo50) : ''}
                                    onValueChange={(v) => uprav(c.id, { prohlidkaDo50: Number(v) })}
                                  >
                                    <SelectTrigger className="h-9"><SelectValue placeholder="vyber…" /></SelectTrigger>
                                    <SelectContent>
                                      {PERIODY_PROHLIDKY.map((p) => (
                                        <SelectItem key={p.hodnota} value={String(p.hodnota)}>{p.popis}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Perioda nad 50 let</Label>
                                  <Select
                                    value={c.prohlidkaNad50 ? String(c.prohlidkaNad50) : ''}
                                    onValueChange={(v) => uprav(c.id, { prohlidkaNad50: Number(v) })}
                                  >
                                    <SelectTrigger className="h-9"><SelectValue placeholder="vyber…" /></SelectTrigger>
                                    <SelectContent>
                                      {PERIODY_PROHLIDKY.map((p) => (
                                        <SelectItem key={p.hodnota} value={String(p.hodnota)}>{p.popis}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Odborná vyšetření (text do F006)</Label>
                                <Textarea
                                  value={c.odbornaVysetreni ?? ''}
                                  onChange={(e) => uprav(c.id, { odbornaVysetreni: e.target.value })}
                                  placeholder="např. spirometrie, RTG hrudníku, ORL vyšetření"
                                  className="min-h-[60px] text-sm"
                                />
                              </div>
                            </>
                          )}
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs">Poznámka</Label>
                          <Input
                            value={c.poznamka ?? ''}
                            onChange={(e) => uprav(c.id, { poznamka: e.target.value })}
                            className="h-9"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <SekceKategorie />
    </div>
  );
}

/* ─────────────────────────  KATEGORIE PRÁCE  ───────────────────────── */

function SekceKategorie() {
  const [polozky, setPolozky] = useState<CiselnikKategorie[]>([]);
  const [nacitam, setNacitam] = useState(true);

  const nacti = useCallback(async () => {
    try {
      const snap = await getDocs(collection(db, 'ciselnikKategorii'));
      if (snap.empty) {
        // první otevření — založí výchozí periody dle vyhlášky
        await Promise.all(
          VYCHOZI_KATEGORIE.map((k) =>
            setDoc(doc(db, 'ciselnikKategorii', `kat-${k.kod}`), k, { merge: true }),
          ),
        );
        setPolozky(VYCHOZI_KATEGORIE.map((k) => ({ id: `kat-${k.kod}`, ...k })));
      } else {
        const poradi = ['1', '2', '2R', '3', '4'];
        setPolozky(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }) as CiselnikKategorie)
            .sort((a, b) => poradi.indexOf(a.kod) - poradi.indexOf(b.kod)),
        );
      }
    } catch (e) {
      console.error('Načtení kategorií selhalo:', e);
    } finally {
      setNacitam(false);
    }
  }, []);

  useEffect(() => { nacti(); }, [nacti]);

  async function uprav(id: string, zmeny: Partial<CiselnikKategorie>) {
    setPolozky((p) => p.map((x) => (x.id === id ? { ...x, ...zmeny } : x)));
    await updateDoc(doc(db, 'ciselnikKategorii', id), zmeny as any);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Kategorie práce — periody prohlídek</CardTitle>
        <CardDescription>
          Výchozí lhůty podle vyhlášky č. 79/2013 Sb. Perioda osoby je vždy nejkratší
          z její kategorie a ze všech jejích činností s profesním rizikem.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {nacitam ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Načítám…
          </div>
        ) : (
          <div className="divide-y border-t">
            <div className="grid grid-cols-[80px_1fr_1fr] gap-3 py-2 text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
              <span>Kategorie</span><span>Do 50 let</span><span>Nad 50 let</span>
            </div>
            {polozky.map((k) => (
              <div key={k.id} className="grid grid-cols-[80px_1fr_1fr] gap-3 py-2 items-center">
                <span className="font-bold text-sm">{k.kod}</span>
                <Select
                  value={String(k.prohlidkaDo50)}
                  onValueChange={(v) => uprav(k.id, { prohlidkaDo50: Number(v) })}
                >
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PERIODY_PROHLIDKY.map((p) => (
                      <SelectItem key={p.hodnota} value={String(p.hodnota)}>{p.popis}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={String(k.prohlidkaNad50)}
                  onValueChange={(v) => uprav(k.id, { prohlidkaNad50: Number(v) })}
                >
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PERIODY_PROHLIDKY.map((p) => (
                      <SelectItem key={p.hodnota} value={String(p.hodnota)}>{p.popis}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
