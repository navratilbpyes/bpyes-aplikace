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
import { PERIODY as PERIODY_REVIZE, generujLhutaText } from '@/lib/revize';
import type { CiselnikSkoleni } from '@/lib/skoleni';
import type { CiselnikRevize, Oblast, TypLhuty } from '@/lib/revize';
import { POZARNI_RADKY } from '@/lib/pozarni-kniha';

const OBLASTI: Oblast[] = ['Elektro', 'Tlak', 'Zdvihací', 'PO', 'Ostatní'];
const TYPY_LHUTY: { hodnota: TypLhuty; popis: string }[] = [
  { hodnota: 'kalendarni', popis: 'Kalendářní (1× ročně, na daný měsíc)' },
  { hodnota: 'klouzava', popis: 'Klouzavá (přesně od poslední, „za N měsíců")' },
  { hodnota: 'text', popis: 'Textová (dle návodu / bez výpočtu)' },
];

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
                className="grid gap-2 py-3 sm:grid-cols-[1fr_150px_160px_180px_auto] items-center"
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
                <Select
                  value={s.pozarniRadek ?? '__zadny__'}
                  onValueChange={(v) => uprav(s.id, { pozarniRadek: v === '__zadny__' ? null : v })}
                >
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Řádek PK…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__zadny__">— bez požární knihy —</SelectItem>
                    {POZARNI_RADKY.map((pr) => (
                      <SelectItem key={pr.id} value={pr.id} className="text-xs">{pr.nazev}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
  const [filtrOblast, setFiltrOblast] = useState<'vse' | Oblast>('vse');

  // formulář pro přidání nové položky
  const [nOblast, setNOblast] = useState<Oblast>('Elektro');
  const [nZarizeni, setNZarizeni] = useState('');
  const [nUkon, setNUkon] = useState('');
  const [nKdo, setNKdo] = useState('');
  const [nPerioda, setNPerioda] = useState(12);
  const [nTyp, setNTyp] = useState<TypLhuty>('kalendarni');
  const [nLhutaText, setNLhutaText] = useState('');

  const nacti = useCallback(async () => {
    try {
      const snap = await getDocs(
        query(collection(db, 'ciselnikRevizi'), where('stav', '==', 'aktivni')),
      );
      setPolozky(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as CiselnikRevize)
          .sort((a, b) => {
            const o = (a.oblast ?? '').localeCompare(b.oblast ?? '', 'cs');
            return o !== 0 ? o : a.nazev.localeCompare(b.nazev, 'cs');
          }),
      );
    } catch (e) {
      console.error('Načtení číselníku revizí selhalo:', e);
    } finally {
      setNacitam(false);
    }
  }, []);

  useEffect(() => { nacti(); }, [nacti]);

  async function pridej() {
    if (nZarizeni.trim() === '' || nUkon.trim() === '') return;
    const lhuta = nTyp === 'text'
      ? (nLhutaText.trim() || 'dle návodu')
      : generujLhutaText(nPerioda, nTyp);
    await addDoc(collection(db, 'ciselnikRevizi'), {
      nazev: `${nZarizeni.trim()} – ${nUkon.trim()}`,
      oblast: nOblast,
      zarizeni: nZarizeni.trim(),
      druhUkonu: nUkon.trim(),
      kdoProvadi: nKdo.trim() || null,
      periodaMesice: nTyp === 'text' ? 0 : nPerioda,
      typLhuty: nTyp,
      lhutaText: lhuta,
      stav: 'aktivni',
    });
    setNZarizeni(''); setNUkon(''); setNKdo(''); setNLhutaText('');
    nacti();
  }

  async function uprav(id: string, zmeny: Partial<CiselnikRevize>) {
    setPolozky((p) => p.map((x) => (x.id === id ? { ...x, ...zmeny } : x)));
    const cistec = Object.fromEntries(
      Object.entries(zmeny).map(([k, v]) => [k, v === undefined || v === '' ? null : v]),
    );
    await updateDoc(doc(db, 'ciselnikRevizi', id), cistec);
  }

  /** Změna periody nebo typu → přegeneruj lhutaText (pokud není textová). */
  async function upravLhutu(r: CiselnikRevize, perioda: number, typ: TypLhuty) {
    const zmeny: Partial<CiselnikRevize> =
      typ === 'text'
        ? { periodaMesice: 0, typLhuty: typ }
        : { periodaMesice: perioda, typLhuty: typ, lhutaText: generujLhutaText(perioda, typ) };
    await uprav(r.id, zmeny);
  }

  async function smaz(id: string) {
    setPolozky((p) => p.filter((x) => x.id !== id));
    await updateDoc(doc(db, 'ciselnikRevizi', id), { stav: 'smazano' });
  }

  const zobrazene = filtrOblast === 'vse'
    ? polozky
    : polozky.filter((r) => r.oblast === filtrOblast);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Matice revizí a kontrol</CardTitle>
        <CardDescription>
          Oblast · Zařízení/Prostředí · Druh úkonu · Lhůta · Kdo provádí. Při přiřazení
          klientovi se hodnoty zkopírují (snapshot) — pozdější úprava zde přiřazené položky nezmění.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Přidání nové položky */}
        <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Přidat položku</p>
          <div className="grid gap-2 md:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Oblast</Label>
              <Select value={nOblast} onValueChange={(v) => setNOblast(v as Oblast)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {OBLASTI.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Zařízení / prostředí</Label>
              <Input value={nZarizeni} onChange={(e) => setNZarizeni(e.target.value)}
                placeholder="např. Administrativa" className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Druh úkonu</Label>
              <Input value={nUkon} onChange={(e) => setNUkon(e.target.value)}
                placeholder="např. Revize" className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Kdo provádí</Label>
              <Input value={nKdo} onChange={(e) => setNKdo(e.target.value)}
                placeholder="např. Revizní technik elektro" className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Typ lhůty</Label>
              <Select value={nTyp} onValueChange={(v) => setNTyp(v as TypLhuty)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPY_LHUTY.map((t) => <SelectItem key={t.hodnota} value={t.hodnota}>{t.popis}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {nTyp === 'text' ? (
              <div className="space-y-1">
                <Label className="text-xs">Lhůta (text)</Label>
                <Input value={nLhutaText} onChange={(e) => setNLhutaText(e.target.value)}
                  placeholder="např. dle místního řádu" className="h-9" />
              </div>
            ) : (
              <div className="space-y-1">
                <Label className="text-xs">Perioda</Label>
                <Select value={String(nPerioda)} onValueChange={(v) => setNPerioda(Number(v))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PERIODY_REVIZE.map((p) => (
                      <SelectItem key={p.hodnota} value={String(p.hodnota)}>{p.popis}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <Button onClick={pridej} disabled={nZarizeni.trim() === '' || nUkon.trim() === ''}>
            <Plus className="mr-2 h-4 w-4" /> Přidat do matice
          </Button>
        </div>

        {/* Filtr oblasti */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Filtr:</span>
          <button
            onClick={() => setFiltrOblast('vse')}
            className={`px-3 py-1 text-xs font-bold rounded-full border ${filtrOblast === 'vse' ? 'bg-primary text-primary-foreground' : 'bg-background'}`}
          >
            Vše ({polozky.length})
          </button>
          {OBLASTI.map((o) => {
            const n = polozky.filter((r) => r.oblast === o).length;
            return (
              <button key={o}
                onClick={() => setFiltrOblast(o)}
                className={`px-3 py-1 text-xs font-bold rounded-full border ${filtrOblast === o ? 'bg-primary text-primary-foreground' : 'bg-background'}`}
              >
                {o} ({n})
              </button>
            );
          })}
        </div>

        {nacitam ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Načítám…
          </div>
        ) : zobrazene.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">Žádné položky v této oblasti.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b">
                  <th className="text-left font-bold px-2 py-2 w-[110px]">Oblast</th>
                  <th className="text-left font-bold px-2 py-2">Zařízení / prostředí</th>
                  <th className="text-left font-bold px-2 py-2">Druh úkonu</th>
                  <th className="text-left font-bold px-2 py-2 w-[200px]">Lhůta</th>
                  <th className="text-left font-bold px-2 py-2">Kdo provádí</th>
                  <th className="text-left font-bold px-2 py-2 w-[180px]">Řádek požární knihy</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {zobrazene.map((r) => (
                  <tr key={r.id} className="align-top">
                    <td className="px-2 py-2">
                      <Select value={r.oblast ?? 'Ostatní'} onValueChange={(v) => uprav(r.id, { oblast: v as Oblast })}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {OBLASTI.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-2 py-2">
                      <Input value={r.zarizeni ?? ''} onChange={(e) => uprav(r.id, { zarizeni: e.target.value })} className="h-8 text-xs" />
                    </td>
                    <td className="px-2 py-2">
                      <Input value={r.druhUkonu ?? ''} onChange={(e) => uprav(r.id, { druhUkonu: e.target.value })} className="h-8 text-xs" />
                    </td>
                    <td className="px-2 py-2 space-y-1">
                      <Select
                        value={r.typLhuty ?? 'klouzava'}
                        onValueChange={(v) => upravLhutu(r, r.periodaMesice || 12, v as TypLhuty)}
                      >
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {TYPY_LHUTY.map((t) => <SelectItem key={t.hodnota} value={t.hodnota}>{t.popis}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {r.typLhuty === 'text' ? (
                        <Input value={r.lhutaText ?? ''} onChange={(e) => uprav(r.id, { lhutaText: e.target.value })}
                          placeholder="dle návodu" className="h-8 text-xs" />
                      ) : (
                        <Select
                          value={String(r.periodaMesice)}
                          onValueChange={(v) => upravLhutu(r, Number(v), r.typLhuty ?? 'klouzava')}
                        >
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {PERIODY_REVIZE.map((p) => (
                              <SelectItem key={p.hodnota} value={String(p.hodnota)}>{p.popis}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <Input value={r.kdoProvadi ?? ''} onChange={(e) => uprav(r.id, { kdoProvadi: e.target.value })} className="h-8 text-xs" />
                    </td>
                    <td className="px-2 py-2">
                      {r.oblast === 'PO' ? (
                        <Select
                          value={r.pozarniRadek ?? '__zadny__'}
                          onValueChange={(v) => uprav(r.id, { pozarniRadek: v === '__zadny__' ? null : v })}
                        >
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__zadny__">— nemapováno —</SelectItem>
                            {POZARNI_RADKY.map((pr) => (
                              <SelectItem key={pr.id} value={pr.id} className="text-xs">{pr.nazev}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-[10px] text-muted-foreground/50">jen pro oblast PO</span>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <Button variant="ghost" size="icon" onClick={() => smaz(r.id)}
                        className="h-8 w-8 text-muted-foreground hover:text-destructive">
                        <X className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
