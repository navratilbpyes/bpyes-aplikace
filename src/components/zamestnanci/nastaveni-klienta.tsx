'use client';

/**
 * AuditFlow — nastavení relevantních školení a činností klienta.
 * Umístění: src/components/zamestnanci/nastaveni-klienta.tsx
 *
 * Admin tu zaškrtne položky z číselníku „Školení a činnosti", které se týkají
 * konkrétního klienta. Uloží se jako `relevantniPolozky` na dokumentu klienta.
 * Lidské zdroje pak zobrazují jen tyto položky.
 */

import { useEffect, useMemo, useState } from 'react';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/components/data-provider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, X } from 'lucide-react';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { synchronizujSouhrn } from '@/lib/souhrn-skoleni';
import type { CiselnikSkoleni } from '@/lib/skoleni';
import { popisPeriody, PERIODY_S_NULOU } from '@/lib/skoleni';
import { poradiOblasti } from '@/lib/cinnosti-adapter';

export default function NastaveniKlienta({
  klientId, klientNazev, ulozene, polozky: vsechnyPolozky, poZmene,
}: {
  klientId: string | null;
  klientNazev?: string;
  /** aktuálně uložené ID relevantních položek (undefined = nenastaveno) */
  ulozene: string[] | undefined;
  /** všechny položky číselníku včetně vlastních položek (filtruje se zde) */
  polozky: CiselnikSkoleni[];
  /** znovunačtení dat v Lidských zdrojích po změně vlastních položek */
  poZmene?: () => void;
}) {
  const polozky = useMemo(() => vsechnyPolozky.filter((p) => !p.klientId), [vsechnyPolozky]);
  const vlastni = useMemo(
    () => vsechnyPolozky.filter((p) => !!klientId && p.klientId === klientId)
      .sort((a, b) => a.nazev.localeCompare(b.nazev, 'cs')),
    [vsechnyPolozky, klientId],
  );
  const [vNazev, setVNazev] = useState('');
  const [vPerioda, setVPerioda] = useState(12);
  const [vProvadi, setVProvadi] = useState('');
  const { toast } = useToast();
  const [vybrane, setVybrane] = useState<Set<string>>(new Set(ulozene ?? []));
  const [uklada, setUklada] = useState(false);
  const [hledej, setHledej] = useState('');

  // změna klienta nebo příchod dat ze serveru
  useEffect(() => { setVybrane(new Set(ulozene ?? [])); }, [klientId, ulozene]);

  const skupiny = useMemo(() => {
    const h = hledej.trim().toLowerCase();
    const mapa = new Map<string, CiselnikSkoleni[]>();
    for (const p of polozky) {
      if (h && !p.nazev.toLowerCase().includes(h)) continue;
      const k = p.oblast || 'Bez oblasti';
      if (!mapa.has(k)) mapa.set(k, []);
      mapa.get(k)!.push(p);
    }
    return Array.from(mapa.entries())
      .sort((a, b) => poradiOblasti(a[0]) - poradiOblasti(b[0]))
      .map(([oblast, items]) => ({
        oblast,
        items: items.sort((a, b) => a.nazev.localeCompare(b.nazev, 'cs')),
      }));
  }, [polozky, hledej]);

  async function uloz(nove: Set<string>) {
    if (!klientId) return;
    setVybrane(nove);
    setUklada(true);
    try {
      await updateDoc(doc(db, 'klienti', klientId), { relevantniPolozky: Array.from(nove) });
      synchronizujSouhrn(klientId).catch((e) => console.warn('Souhrn školení:', e));
    } catch (e) {
      console.error('Uložení relevantních položek selhalo:', e);
      toast({ title: 'Uložení selhalo', variant: 'destructive' });
      setVybrane(new Set(ulozene ?? []));
    } finally {
      setUklada(false);
    }
  }

  async function pridejVlastni() {
    if (!klientId || !vNazev.trim()) return;
    await addDoc(collection(db, 'ciselnikSkoleni'), {
      nazev: vNazev.trim(),
      oblast: 'Vlastní',
      periodaMesice: vPerioda,
      provadi: vProvadi.trim() || null,
      klientId,
      stav: 'aktivni',
    });
    setVNazev(''); setVProvadi('');
    poZmene?.();
    setTimeout(() => synchronizujSouhrn(klientId).catch(() => {}), 500);
  }

  async function upravVlastni(id: string, zmeny: Partial<CiselnikSkoleni>) {
    const cistec = Object.fromEntries(
      Object.entries(zmeny).map(([k, v]) => [k, v === undefined || v === '' ? null : v]),
    );
    await updateDoc(doc(db, 'ciselnikSkoleni', id), cistec);
  }

  async function smazVlastni(id: string) {
    await updateDoc(doc(db, 'ciselnikSkoleni', id), { stav: 'smazano' });
    poZmene?.();
    if (klientId) setTimeout(() => synchronizujSouhrn(klientId).catch(() => {}), 500);
  }

  function prepni(id: string) {
    const n = new Set(vybrane);
    if (n.has(id)) n.delete(id); else n.add(id);
    uloz(n);
  }

  function prepniOblast(items: CiselnikSkoleni[]) {
    const n = new Set(vybrane);
    const vsechnyVybrane = items.every((x) => n.has(x.id));
    items.forEach((x) => (vsechnyVybrane ? n.delete(x.id) : n.add(x.id)));
    uloz(n);
  }

  if (!klientId) {
    return (
      <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
        Nastavení se zobrazí po výběru konkrétního klienta.
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-6">
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Relevantní školení a činnosti{klientNazev ? ` — ${klientNazev}` : ''}</CardTitle>
        <CardDescription>
          Zaškrtněte, co se klienta týká. V Lidských zdrojích se pak zobrazují jen tyto položky
          (ostatní lze dočasně zobrazit přepínačem). Změny se ukládají hned.
        </CardDescription>
        <div className="flex items-center gap-3 pt-2 flex-wrap">
          <Input
            value={hledej}
            onChange={(e) => setHledej(e.target.value)}
            placeholder="Hledat…"
            className="h-8 w-48 text-xs"
          />
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            {uklada && <Loader2 className="h-3 w-3 animate-spin" />}
            Vybráno: <strong>{vybrane.size}</strong> z {polozky.length}
          </span>
          {vybrane.size > 0 && (
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => uloz(new Set())}>
              Zrušit výběr
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {polozky.length === 0 && (
          <p className="text-sm text-muted-foreground">Číselník „Školení a činnosti“ je prázdný.</p>
        )}
        {skupiny.map((sk) => {
          const pocet = sk.items.filter((x) => vybrane.has(x.id)).length;
          return (
            <section key={sk.oblast} className="space-y-1">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {sk.oblast} <span className="font-normal">({pocet}/{sk.items.length})</span>
                </h3>
                <Button size="sm" variant="ghost" className="h-6 text-[11px]" onClick={() => prepniOblast(sk.items)}>
                  {pocet === sk.items.length ? 'Zrušit oblast' : 'Vybrat celou oblast'}
                </Button>
              </div>
              <div className="rounded border divide-y bg-background">
                {sk.items.map((p) => {
                  const v = vybrane.has(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => prepni(p.id)}
                      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-muted ${v ? 'bg-blue-50/60 font-medium' : ''}`}
                    >
                      <span className={`h-3.5 w-3.5 shrink-0 rounded border ${v ? 'border-blue-600 bg-blue-600' : 'border-slate-300'}`} />
                      <span className="flex-1">{p.nazev}</span>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {p.bezSkoleniPovereni ? 'evidenční' : popisPeriody(p.periodaMesice ?? 0)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </CardContent>
    </Card>

    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Vlastní položky klienta</CardTitle>
        <CardDescription>
          Školení nebo činnost, která se týká jen tohoto klienta a není v globálním číselníku.
          Je automaticky relevantní, objeví se v matici, zápisu školení i v souhrnu u klienta.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-[1fr_170px_180px_auto] items-end">
          <div className="space-y-1">
            <Label className="text-xs">Název</Label>
            <Input
              value={vNazev}
              onChange={(e) => setVNazev(e.target.value)}
              placeholder="např. Obsluha lisu XY"
              onKeyDown={(e) => e.key === 'Enter' && pridejVlastni()}
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Perioda</Label>
            <Select value={String(vPerioda)} onValueChange={(v) => setVPerioda(Number(v))}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PERIODY_S_NULOU.map((p) => (
                  <SelectItem key={p.hodnota} value={String(p.hodnota)}>{p.popis}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Kdo provádí</Label>
            <Input value={vProvadi} onChange={(e) => setVProvadi(e.target.value)} placeholder="např. OZO" className="h-9" />
          </div>
          <Button onClick={pridejVlastni} disabled={!vNazev.trim()}>
            <Plus className="mr-2 h-4 w-4" /> Přidat
          </Button>
        </div>

        {vlastni.length > 0 && (
          <div className="divide-y border-y">
            {vlastni.map((p) => (
              <div key={p.id} className="grid gap-2 py-2 sm:grid-cols-[1fr_170px_180px_auto] items-center">
                <Input
                  defaultValue={p.nazev}
                  onBlur={(e) => e.target.value.trim() && e.target.value !== p.nazev && upravVlastni(p.id, { nazev: e.target.value.trim() })}
                  className="h-9"
                />
                <Select
                  defaultValue={String(p.periodaMesice ?? 0)}
                  onValueChange={(v) => upravVlastni(p.id, { periodaMesice: Number(v) })}
                >
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PERIODY_S_NULOU.map((x) => (
                      <SelectItem key={x.hodnota} value={String(x.hodnota)}>{x.popis}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  defaultValue={p.provadi ?? ''}
                  onBlur={(e) => upravVlastni(p.id, { provadi: e.target.value.trim() })}
                  placeholder="kdo provádí"
                  className="h-9"
                />
                <Button
                  variant="ghost" size="icon"
                  onClick={() => smazVlastni(p.id)}
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
    </div>
  );
}
