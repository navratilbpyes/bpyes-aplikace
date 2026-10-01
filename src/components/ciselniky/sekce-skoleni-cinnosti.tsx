'use client';

/**
 * AuditFlow — číselník „Školení a činnosti".
 * Umístění: src/components/ciselniky/sekce-skoleni-cinnosti.tsx
 *
 * Jedna položka = školení, činnost (rizikový profil), nebo obojí. Dříve dva
 * oddělené číselníky (Školení + Činnosti), které se v řadě oblastí zdvojovaly.
 * Globální katalog — při přiřazení klientovi se hodnoty kopírují (snapshot).
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  collection, addDoc, updateDoc, doc, query, where, getDocs,
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
import {
  Plus, X, Loader2, ChevronDown, ChevronRight, Stethoscope, ArrowRightLeft,
} from 'lucide-react';
import EditorFaktoru from '@/components/ciselniky/editor-faktoru';
import { PERIODY_S_NULOU, popisPeriody } from '@/lib/skoleni';
import type { CiselnikSkoleni } from '@/lib/skoleni';
import { PERIODY_PROHLIDKY, popisPeriodyProhlidky } from '@/lib/cinnosti';
import { POZARNI_RADKY } from '@/lib/pozarni-kniha';
import type { CiselnikPovereni } from '@/lib/povereni';
import { popisPlatnosti } from '@/lib/povereni';

/** Oblasti dle lhůtníku; položky s jinou (importovanou) oblastí se přidají automaticky. */
const ZAKLADNI_OBLASTI = [
  'BOZP', 'PO', 'První pomoc', 'Doprava', 'OOPP', 'Elektro', 'Tlak', 'Plyn',
  'Zdvihací', 'Výšky a stavby', 'Svařování', 'Rizikové faktory', 'Ostatní',
];
const BEZ_OBLASTI = '__bez__';

export default function SekceSkoleniCinnosti() {
  const [polozky, setPolozky] = useState<CiselnikSkoleni[]>([]);
  const [povereni, setPovereni] = useState<CiselnikPovereni[]>([]);
  const [nacitam, setNacitam] = useState(true);
  const [neprevedeno, setNeprevedeno] = useState(0);
  const [otevrene, setOtevrene] = useState<string | null>(null);
  const [filtr, setFiltr] = useState<string>('vse');
  const [hledej, setHledej] = useState('');

  // formulář pro přidání
  const [nNazev, setNNazev] = useState('');
  const [nOblast, setNOblast] = useState<string>('BOZP');
  const [nPerioda, setNPerioda] = useState(12);
  const [nProvadi, setNProvadi] = useState('');

  const nacti = useCallback(async () => {
    try {
      const [snap, snapC] = await Promise.all([
        getDocs(query(collection(db, 'ciselnikSkoleni'), where('stav', '==', 'aktivni'))),
        getDocs(query(collection(db, 'ciselnikCinnosti'), where('stav', '==', 'aktivni'))),
      ]);
      setPolozky(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as CiselnikSkoleni)
          .filter((x) => !x.klientId)
          .sort((a, b) => a.nazev.localeCompare(b.nazev, 'cs')),
      );
      setNeprevedeno(snapC.docs.filter((d) => !d.data().prevedeno).length);
      // číselník pověření je samostatný; jeho selhání (např. chybějící pravidla) nesmí shodit seznam
      try {
        const snapP = await getDocs(query(collection(db, 'ciselnikPovereni'), where('stav', '==', 'aktivni')));
        setPovereni(
          snapP.docs.map((d) => ({ id: d.id, ...d.data() }) as CiselnikPovereni)
            .sort((a, b) => a.nazev.localeCompare(b.nazev, 'cs')),
        );
      } catch (e) {
        console.warn('Číselník pověření nelze načíst:', e);
      }
    } catch (e) {
      console.error('Načtení číselníku školení a činností selhalo:', e);
    } finally {
      setNacitam(false);
    }
  }, []);

  useEffect(() => { nacti(); }, [nacti]);

  const oblasti = useMemo(() => {
    const extra = polozky
      .map((p) => p.oblast)
      .filter((o): o is string => !!o && !ZAKLADNI_OBLASTI.includes(o));
    return [...ZAKLADNI_OBLASTI, ...Array.from(new Set(extra))];
  }, [polozky]);

  async function pridej() {
    if (nNazev.trim() === '') return;
    await addDoc(collection(db, 'ciselnikSkoleni'), {
      nazev: nNazev.trim(),
      oblast: nOblast,
      periodaMesice: nPerioda,
      provadi: nProvadi.trim() || null,
      stav: 'aktivni',
    });
    setNNazev('');
    setNProvadi('');
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

  function prepniSouvisejici(p: CiselnikSkoleni, id: string) {
    const stav = p.souvisejiciIds ?? [];
    uprav(p.id, {
      souvisejiciIds: stav.includes(id) ? stav.filter((x) => x !== id) : [...stav, id],
    });
  }

  const zobrazene = useMemo(() => {
    const h = hledej.trim().toLowerCase();
    return polozky.filter((p) => {
      if (filtr !== 'vse' && (p.oblast || BEZ_OBLASTI) !== filtr) return false;
      if (h && !p.nazev.toLowerCase().includes(h)) return false;
      return true;
    });
  }, [polozky, filtr, hledej]);

  /** skupiny podle oblasti v pořadí oblastí */
  const skupiny = useMemo(() => {
    const mapa = new Map<string, CiselnikSkoleni[]>();
    for (const p of zobrazene) {
      const k = p.oblast || BEZ_OBLASTI;
      if (!mapa.has(k)) mapa.set(k, []);
      mapa.get(k)!.push(p);
    }
    const poradi = [...oblasti, BEZ_OBLASTI];
    return poradi
      .filter((k) => mapa.has(k))
      .map((k) => ({ klic: k, nazev: k === BEZ_OBLASTI ? 'Bez oblasti' : k, polozky: mapa.get(k)! }));
  }, [zobrazene, oblasti]);

  const pocetBezOblasti = polozky.filter((p) => !p.oblast).length;

  return (
    <div className="space-y-6">
      {neprevedeno > 0 && (
        <div className="flex items-center justify-between gap-3 flex-wrap rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
          <div className="text-sm text-amber-900">
            <p className="font-semibold">
              Zbývá převést {neprevedeno} {neprevedeno === 1 ? 'dosavadní činnost' : neprevedeno < 5 ? 'dosavadní činnosti' : 'dosavadních činností'}.
            </p>
            <p className="text-xs">
              Činnosti se slučují do tohoto číselníku. Převod je bezpečný a opakovatelný — původní data se nemažou.
            </p>
          </div>
          <Button asChild size="sm" variant="outline" className="border-amber-400 bg-white">
            <Link href="/ciselniky/prevod-cinnosti">
              <ArrowRightLeft className="mr-2 h-4 w-4" /> Převést činnosti
            </Link>
          </Button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Školení a činnosti</CardTitle>
          <CardDescription>
            Jedna položka může být školení, činnost s rizikovým profilem, nebo obojí. U každé nastavíte
            periodu, zácvik, přezkoušení, pověření, profesní riziko a kategorizaci faktorů.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-[1fr_160px_170px_180px_auto] items-end">
            <div className="space-y-1">
              <Label className="text-xs">Název</Label>
              <Input
                value={nNazev}
                onChange={(e) => setNNazev(e.target.value)}
                placeholder="např. Práce ve výškách a nad volnou hloubkou"
                onKeyDown={(e) => e.key === 'Enter' && pridej()}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Oblast</Label>
              <Select value={nOblast} onValueChange={setNOblast}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {oblasti.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Perioda</Label>
              <Select value={String(nPerioda)} onValueChange={(v) => setNPerioda(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PERIODY_S_NULOU.map((p) => (
                    <SelectItem key={p.hodnota} value={String(p.hodnota)}>{p.popis}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Kdo provádí</Label>
              <Input
                value={nProvadi}
                onChange={(e) => setNProvadi(e.target.value)}
                placeholder="např. OZO"
                onKeyDown={(e) => e.key === 'Enter' && pridej()}
              />
            </div>
            <Button onClick={pridej} disabled={nNazev.trim() === ''}>
              <Plus className="mr-2 h-4 w-4" /> Přidat
            </Button>
          </div>

          {/* Filtr a hledání */}
          <div className="flex items-center gap-2 flex-wrap border-t pt-4">
            <button
              onClick={() => setFiltr('vse')}
              className={`px-3 py-1 text-xs font-bold rounded-full border ${filtr === 'vse' ? 'bg-primary text-primary-foreground' : 'bg-background'}`}
            >
              Vše ({polozky.length})
            </button>
            {oblasti.map((o) => {
              const n = polozky.filter((p) => p.oblast === o).length;
              if (n === 0) return null;
              return (
                <button
                  key={o}
                  onClick={() => setFiltr(o)}
                  className={`px-3 py-1 text-xs font-bold rounded-full border ${filtr === o ? 'bg-primary text-primary-foreground' : 'bg-background'}`}
                >
                  {o} ({n})
                </button>
              );
            })}
            {pocetBezOblasti > 0 && (
              <button
                onClick={() => setFiltr(BEZ_OBLASTI)}
                className={`px-3 py-1 text-xs font-bold rounded-full border ${filtr === BEZ_OBLASTI ? 'bg-primary text-primary-foreground' : 'bg-background'}`}
              >
                Bez oblasti ({pocetBezOblasti})
              </button>
            )}
            <Input
              value={hledej}
              onChange={(e) => setHledej(e.target.value)}
              placeholder="Hledat…"
              className="h-8 w-44 ml-auto text-xs"
            />
          </div>

          {nacitam ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Načítám…
            </div>
          ) : zobrazene.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">
              Žádné položky. Přidejte první výše, nebo upravte filtr.
            </p>
          ) : (
            <div className="space-y-6">
              {skupiny.map((sk) => (
                <section key={sk.klic} className="space-y-1">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {sk.nazev} <span className="font-normal">({sk.polozky.length})</span>
                  </h3>
                  <div className="divide-y border-y">
                    {sk.polozky.map((p) => (
                      <RadekPolozky
                        key={p.id}
                        p={p}
                        oblasti={oblasti}
                        vsechny={polozky}
                        povereni={povereni}
                        rozbaleno={otevrene === p.id}
                        onToggle={() => setOtevrene(otevrene === p.id ? null : p.id)}
                        uprav={uprav}
                        smaz={smaz}
                        prepniSouvisejici={prepniSouvisejici}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ─────────────────────────  ŘÁDEK POLOŽKY  ───────────────────────── */

function RadekPolozky({
  p, oblasti, vsechny, povereni, rozbaleno, onToggle, uprav, smaz, prepniSouvisejici,
}: {
  p: CiselnikSkoleni;
  oblasti: string[];
  vsechny: CiselnikSkoleni[];
  povereni: CiselnikPovereni[];
  rozbaleno: boolean;
  onToggle: () => void;
  uprav: (id: string, zmeny: Partial<CiselnikSkoleni>) => void;
  smaz: (id: string) => void;
  prepniSouvisejici: (p: CiselnikSkoleni, id: string) => void;
}) {
  const evidencni = !!p.bezSkoleniPovereni;
  const pocetSouv = (p.souvisejiciIds ?? []).length;

  return (
    <div className="py-3 space-y-3">
      <div className="grid gap-2 sm:grid-cols-[auto_1fr_150px_auto] items-center">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onToggle}>
          {rozbaleno ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
        <div className="space-y-1">
          <Input
            value={p.nazev}
            onChange={(e) => uprav(p.id, { nazev: e.target.value })}
            className="h-9"
          />
          <div className="flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
            {evidencni && <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium">evidenční položka</span>}
            {p.zacvik && <span className="rounded bg-blue-50 px-1.5 py-0.5 text-blue-700 font-medium">zácvik</span>}
            {p.prezkouseni && <span className="rounded bg-violet-50 px-1.5 py-0.5 text-violet-700 font-medium">přezkoušení</span>}
            {p.vyzadujePovereni && <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700 font-medium">pověření</span>}
            {p.profesniRiziko && (
              <span className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-700 font-medium">
                prohlídka {popisPeriodyProhlidky(p.prohlidkaDo50)} / {popisPeriodyProhlidky(p.prohlidkaNad50)}
              </span>
            )}
            {(p.faktory ?? []).length > 0 && <span>{p.faktory!.length}× faktor</span>}
            {pocetSouv > 0 && <span>+ {pocetSouv}× související</span>}
          </div>
        </div>
        <Select
          value={String(p.periodaMesice ?? 0)}
          onValueChange={(v) => uprav(p.id, { periodaMesice: Number(v) })}
          disabled={evidencni}
        >
          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PERIODY_S_NULOU.map((x) => (
              <SelectItem key={x.hodnota} value={String(x.hodnota)}>{x.popis}</SelectItem>
            ))}
            {/* nestandardní perioda z importu */}
            {p.periodaMesice > 0 && !PERIODY_S_NULOU.some((x) => x.hodnota === p.periodaMesice) && (
              <SelectItem value={String(p.periodaMesice)}>{popisPeriody(p.periodaMesice)}</SelectItem>
            )}
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => smaz(p.id)}
          className="text-muted-foreground hover:text-destructive"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {rozbaleno && (
        <div className="ml-10 space-y-4 rounded-lg border bg-muted/20 p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs">Oblast</Label>
              <Select
                value={p.oblast || BEZ_OBLASTI}
                onValueChange={(v) => uprav(p.id, { oblast: v === BEZ_OBLASTI ? undefined : v })}
              >
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={BEZ_OBLASTI}>— bez oblasti —</SelectItem>
                  {oblasti.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Kdo provádí</Label>
              <Input
                value={p.provadi ?? ''}
                onChange={(e) => uprav(p.id, { provadi: e.target.value })}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Řádek požární knihy</Label>
              <Select
                value={p.pozarniRadek ?? '__zadny__'}
                onValueChange={(v) => uprav(p.id, { pozarniRadek: v === '__zadny__' ? null : v })}
              >
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__zadny__">— bez požární knihy —</SelectItem>
                  {POZARNI_RADKY.map((pr) => (
                    <SelectItem key={pr.id} value={pr.id} className="text-xs">{pr.nazev}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded border bg-background divide-y">
            <Prepinac
              nadpis="Nevyžaduje školení ani pověření"
              popis="Čistě evidenční položka (např. činnost, která jen zakládá profesní riziko). Nemá periodu ani termíny."
              hodnota={evidencni}
              onZmena={(v) =>
                uprav(p.id, v
                  ? { bezSkoleniPovereni: true, periodaMesice: 0, zacvik: false, prezkouseni: false, vyzadujePovereni: false }
                  : { bezSkoleniPovereni: false })}
            />
            <Prepinac
              nadpis="Vyžaduje praktický zácvik"
              popis="Zácvik s mentorem a záznamem (F002–F005), až po vstupním odborném školení."
              hodnota={!!p.zacvik}
              onZmena={(v) => uprav(p.id, { zacvik: v })}
              zakazano={evidencni}
            />
            <Prepinac
              nadpis="Vyžaduje přezkoušení"
              popis="Po školení následuje přezkoušení. Eviduje se jen datum."
              hodnota={!!p.prezkouseni}
              onZmena={(v) => uprav(p.id, { prezkouseni: v })}
              zakazano={evidencni}
              odsazeno
            />
            <Prepinac
              nadpis="Vyžaduje pověření"
              popis="Osoba musí být k činnosti písemně pověřena. Druh a platnost pověření nastavíte níže (číselník Pověření)."
              hodnota={!!p.vyzadujePovereni}
              onZmena={(v) => uprav(p.id, { vyzadujePovereni: v })}
              zakazano={evidencni}
            />
            {p.vyzadujePovereni && !evidencni && (
              <div className="px-3 py-2 pl-8 space-y-1">
                <Label className="text-xs">Druh pověření</Label>
                <Select
                  value={p.povereniId ?? '__zadne__'}
                  onValueChange={(v) => uprav(p.id, { povereniId: v === '__zadne__' ? null : v })}
                >
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="vyberte…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__zadne__">— nevybráno —</SelectItem>
                    {povereni.map((x) => (
                      <SelectItem key={x.id} value={x.id} className="text-xs">
                        {x.nazev} ({popisPlatnosti(x.platnostMesice)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {povereni.length === 0 && (
                  <p className="text-[11px] text-amber-700">
                    Číselník pověření je prázdný — druhy pověření založíte v záložce Pověření.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold">Související školení a činnosti</Label>
            <p className="text-[11px] text-muted-foreground">
              Co z této položky dále vyplývá (např. činnost „Svářeč“ → Školení BOZP, Práce se zvýšeným požárním nebezpečím).
            </p>
            <div className="max-h-48 overflow-y-auto rounded border bg-background divide-y">
              {vsechny.filter((x) => x.id !== p.id).map((x) => {
                const vybrano = (p.souvisejiciIds ?? []).includes(x.id);
                return (
                  <button
                    key={x.id}
                    type="button"
                    onClick={() => prepniSouvisejici(p, x.id)}
                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-muted ${vybrano ? 'bg-blue-50/60 font-medium' : ''}`}
                  >
                    <span className={`h-3.5 w-3.5 shrink-0 rounded border ${vybrano ? 'border-blue-600 bg-blue-600' : 'border-slate-300'}`} />
                    <span className="flex-1">{x.nazev}</span>
                    {x.oblast && <span className="text-[10px] text-muted-foreground">{x.oblast}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded border bg-background px-3 py-2 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Stethoscope className="h-3.5 w-3.5" /> Profesní riziko
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Vynucuje vstupní i výstupní prohlídku i v kategorii 1 a nese vlastní periodu
                  (příloha č. 1 vyhlášky č. 79/2013 Sb.).
                </p>
              </div>
              <Switch
                checked={!!p.profesniRiziko}
                onCheckedChange={(v) => uprav(p.id, { profesniRiziko: v })}
              />
            </div>

            {p.profesniRiziko && (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Perioda prohlídky do 50 let</Label>
                    <Select
                      value={p.prohlidkaDo50 ? String(p.prohlidkaDo50) : ''}
                      onValueChange={(v) => uprav(p.id, { prohlidkaDo50: Number(v) })}
                    >
                      <SelectTrigger className="h-9"><SelectValue placeholder="vyber…" /></SelectTrigger>
                      <SelectContent>
                        {PERIODY_PROHLIDKY.map((x) => (
                          <SelectItem key={x.hodnota} value={String(x.hodnota)}>{x.popis}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Perioda prohlídky nad 50 let</Label>
                    <Select
                      value={p.prohlidkaNad50 ? String(p.prohlidkaNad50) : ''}
                      onValueChange={(v) => uprav(p.id, { prohlidkaNad50: Number(v) })}
                    >
                      <SelectTrigger className="h-9"><SelectValue placeholder="vyber…" /></SelectTrigger>
                      <SelectContent>
                        {PERIODY_PROHLIDKY.map((x) => (
                          <SelectItem key={x.hodnota} value={String(x.hodnota)}>{x.popis}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Odborná vyšetření (text do F006)</Label>
                  <Textarea
                    value={p.odbornaVysetreni ?? ''}
                    onChange={(e) => uprav(p.id, { odbornaVysetreni: e.target.value })}
                    placeholder="např. spirometrie, RTG hrudníku, ORL vyšetření"
                    className="min-h-[60px] text-sm"
                  />
                </div>
              </>
            )}
          </div>

          <div className="rounded border bg-background px-3 py-3">
            <EditorFaktoru
              faktory={p.faktory}
              onZmena={(nove) => uprav(p.id, { faktory: nove })}
              popis="Faktory, které plynou přímo z této položky (např. vibrace u křovinořezu). Sčítají se s faktory pozice."
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Poznámka</Label>
            <Input
              value={p.poznamka ?? ''}
              onChange={(e) => uprav(p.id, { poznamka: e.target.value })}
              className="h-9"
            />
          </div>

          {(p.predpis || p.lhutaText) && (
            <p className="text-[11px] text-muted-foreground">
              {p.lhutaText && <>Lhůta dle lhůtníku: {p.lhutaText}. </>}
              {p.predpis && <>Předpis: {p.predpis}.</>}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Prepinac({
  nadpis, popis, hodnota, onZmena, zakazano, odsazeno,
}: {
  nadpis: string;
  popis: string;
  hodnota: boolean;
  onZmena: (v: boolean) => void;
  zakazano?: boolean;
  odsazeno?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between gap-3 px-3 py-2 ${odsazeno ? 'pl-8' : ''} ${zakazano ? 'opacity-50' : ''}`}>
      <div>
        <Label className="text-xs font-semibold">{nadpis}</Label>
        <p className="text-[11px] text-muted-foreground">{popis}</p>
      </div>
      <Switch checked={hodnota} onCheckedChange={onZmena} disabled={zakazano} />
    </div>
  );
}
