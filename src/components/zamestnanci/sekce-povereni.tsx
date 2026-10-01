'use client';

/**
 * AuditFlow — pověření osob (Lidské zdroje → Pověření).
 * Umístění: src/components/zamestnanci/sekce-povereni.tsx
 *
 * Přehled: kdo má jaké pověření vyžadované svými přiřazenými položkami (přepínač
 * „Vyžaduje pověření" v číselníku „Školení a činnosti"), s platností a stavem.
 * Zápis: pověření se zapisuje jako událost typu 'povereni' (viz lib/povereni.ts).
 * Platnost se předvyplní z číselníku Pověření; lze ji přepsat nebo zvolit „na neurčito".
 */

import { useMemo, useState } from 'react';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db, useData } from '@/components/data-provider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, BadgeCheck, Trash2 } from 'lucide-react';
import type { Osoba } from '@/lib/osoby';
import { aktivniCinnosti, celeJmeno } from '@/lib/osoby';
import type { CiselnikSkoleni } from '@/lib/skoleni';
import { pridejMesice } from '@/lib/skoleni';
import type { Udalost } from '@/lib/udalosti';
import { polozkaLogu, formatDatum, nactiPrah } from '@/lib/udalosti';
import type { CiselnikPovereni, StavPovereni } from '@/lib/povereni';
import { posledniPovereni, stavPovereni, popisPlatnosti } from '@/lib/povereni';

function dnesLokalne(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const STAV_UI: Record<StavPovereni, { text: string; trida: string }> = {
  ok: { text: 'platné', trida: 'bg-emerald-100 text-emerald-800' },
  neurcito: { text: 'na neurčito', trida: 'bg-emerald-100 text-emerald-800' },
  blizi: { text: 'brzy končí', trida: 'bg-amber-100 text-amber-800' },
  po: { text: 'propadlé', trida: 'bg-red-100 text-red-800' },
  chybi: { text: 'chybí', trida: 'bg-slate-200 text-slate-700' },
};

interface Radek {
  klic: string;
  osoba: Osoba;
  polozka: CiselnikSkoleni;
  def?: CiselnikPovereni;
  zaznam?: Udalost;
  stav: StavPovereni;
  konec: string | null;
}

export default function SekcePovereniOsob({
  klientId, osoby, skoleni, povereni, udalosti, poZmene,
}: {
  klientId: string | null;
  osoby: Osoba[];
  skoleni: CiselnikSkoleni[];
  povereni: CiselnikPovereni[];
  udalosti: Udalost[];
  poZmene: () => void;
}) {
  const prah = typeof window !== 'undefined' ? nactiPrah() : 3;
  const povMap = useMemo(() => new Map(povereni.map((p) => [p.id, p])), [povereni]);
  const polozkyMap = useMemo(() => new Map(skoleni.map((s) => [s.id, s])), [skoleni]);

  /** řádky: osoba × pověření, které požaduje některá její přiřazená položka */
  const radky = useMemo<Radek[]>(() => {
    const out: Radek[] = [];
    for (const o of osoby) {
      const videno = new Set<string>();
      for (const a of aktivniCinnosti(o)) {
        const p = polozkyMap.get(a.cinnostId);
        if (!p?.vyzadujePovereni || p.bezSkoleniPovereni) continue;
        const klic = `${o.id}-${p.povereniId ?? p.id}`;
        if (videno.has(klic)) continue;
        videno.add(klic);
        const def = p.povereniId ? povMap.get(p.povereniId) : undefined;
        const zaznam = def ? posledniPovereni(udalosti, o.id, def.id) : undefined;
        const { stav, konec } = stavPovereni(zaznam, def, prah);
        out.push({ klic, osoba: o, polozka: p, def, zaznam, stav, konec });
      }
    }
    return out.sort((a, b) => celeJmeno(a.osoba).localeCompare(celeJmeno(b.osoba), 'cs'));
  }, [osoby, polozkyMap, povMap, udalosti, prah]);

  /** zapsaná pověření, která žádná přiřazená položka nevyžaduje */
  const ostatni = useMemo(() => {
    const kryte = new Set(radky.filter((r) => r.def).map((r) => `${r.osoba.id}-${r.def!.id}`));
    const out: { osoba: Osoba; def?: CiselnikPovereni; zaznam: Udalost; stav: StavPovereni; konec: string | null }[] = [];
    for (const o of osoby) {
      const ids = new Set(udalosti.filter((u) => u.typ === 'povereni' && u.osobaId === o.id).map((u) => u.temaId ?? ''));
      ids.forEach((id) => {
        if (!id || kryte.has(`${o.id}-${id}`)) return;
        const def = povMap.get(id);
        const zaznam = posledniPovereni(udalosti, o.id, id);
        if (!zaznam) return;
        const { stav, konec } = stavPovereni(zaznam, def, prah);
        out.push({ osoba: o, def, zaznam, stav, konec });
      });
    }
    return out;
  }, [osoby, udalosti, radky, povMap, prah]);

  const [dialog, setDialog] = useState<{ povereniId?: string; osobaId?: string } | null>(null);
  const { user } = useData();
  const { toast } = useToast();
  /** ID záznamu, u kterého čeká potvrzení smazání (dvoukrokové mazání) */
  const [potvrdit, setPotvrdit] = useState<string | null>(null);

  /** Smazání záznamu pověření = označení jako smazaný (historie v logu zůstává). */
  async function smazZaznam(u: Udalost) {
    if (!klientId) return;
    if (potvrdit !== u.id) { setPotvrdit(u.id); return; }
    try {
      await updateDoc(doc(db, 'klienti', klientId, 'udalosti', u.id), {
        stav: 'smazano',
        log: [...(u.log ?? []), polozkaLogu(user?.email ?? 'neznámý', 'smazano', u.datum, null)],
      });
      toast({ title: 'Záznam pověření smazán' });
      setPotvrdit(null);
      poZmene();
    } catch (e: any) {
      toast({ title: 'Smazání selhalo', description: e?.message ?? '', variant: 'destructive' });
    }
  }

  const tlacitkoSmazat = (u: Udalost) => (
    <Button
      size="sm"
      variant={potvrdit === u.id ? 'destructive' : 'ghost'}
      className="h-7 text-xs"
      onClick={() => smazZaznam(u)}
      onBlur={() => setPotvrdit((p) => (p === u.id ? null : p))}
      title="Smazat záznam pověření"
    >
      {potvrdit === u.id ? 'Opravdu smazat?' : <Trash2 className="h-3.5 w-3.5" />}
    </Button>
  );

  if (!klientId) {
    return (
      <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
        Pověření se zobrazí po výběru konkrétního klienta.
      </CardContent></Card>
    );
  }

  const bezDruhu = radky.filter((r) => !r.def);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-base flex items-center gap-1.5">
              <BadgeCheck className="h-4 w-4" /> Pověření
            </CardTitle>
            <CardDescription>
              Pověření vyžadují položky s přepínačem „Vyžaduje pověření“ (Číselníky → Školení a činnosti).
              Platnost se bere z číselníku Pověření, jde ale přepsat nebo zvolit „na neurčito“.
            </CardDescription>
          </div>
          <Button onClick={() => setDialog({})} disabled={povereni.length === 0 || osoby.length === 0}>
            <Plus className="mr-2 h-4 w-4" /> Zapsat pověření
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {povereni.length === 0 && (
          <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Číselník pověření je prázdný (nebo se nepodařilo načíst). Druhy pověření založíte v
            Číselníky → Pověření.
          </p>
        )}
        {bezDruhu.length > 0 && (
          <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Položky bez vybraného druhu pověření:{' '}
            {Array.from(new Set(bezDruhu.map((r) => r.polozka.nazev))).join(', ')}. Druh doplňte v
            Číselníky → Školení a činnosti.
          </p>
        )}

        {radky.length === 0 && ostatni.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">
            Žádné osoby nemají přiřazenou položku, která vyžaduje pověření.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b">
                  <th className="text-left font-bold px-2 py-2">Osoba</th>
                  <th className="text-left font-bold px-2 py-2">Pověření</th>
                  <th className="text-left font-bold px-2 py-2">Platí od</th>
                  <th className="text-left font-bold px-2 py-2">Platí do</th>
                  <th className="text-left font-bold px-2 py-2">Stav</th>
                  <th className="w-36" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {radky.map((r) => (
                  <tr key={r.klic}>
                    <td className="px-2 py-2 font-medium">{celeJmeno(r.osoba)}</td>
                    <td className="px-2 py-2">
                      {r.def ? r.def.nazev : <span className="text-amber-700">{r.polozka.nazev} — druh nevybrán</span>}
                      <div className="text-[11px] text-muted-foreground">
                        z položky: {r.polozka.nazev}{r.def && ` · platnost ${popisPlatnosti(r.def.platnostMesice)}`}
                      </div>
                    </td>
                    <td className="px-2 py-2">{r.zaznam ? formatDatum(r.zaznam.datum) : '—'}</td>
                    <td className="px-2 py-2">
                      {!r.zaznam ? '—' : r.konec ? formatDatum(r.konec) : 'na neurčito'}
                    </td>
                    <td className="px-2 py-2">
                      <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${STAV_UI[r.stav].trida}`}>
                        {STAV_UI[r.stav].text}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-right whitespace-nowrap">
                      {r.def && (
                        <Button
                          size="sm" variant="outline" className="h-7 text-xs"
                          onClick={() => setDialog({ povereniId: r.def!.id, osobaId: r.osoba.id })}
                        >
                          Zapsat
                        </Button>
                      )}
                      {r.zaznam && tlacitkoSmazat(r.zaznam)}
                    </td>
                  </tr>
                ))}
                {ostatni.map((r) => (
                  <tr key={`o-${r.osoba.id}-${r.def?.id ?? r.zaznam.id}`} className="text-muted-foreground">
                    <td className="px-2 py-2 font-medium">{celeJmeno(r.osoba)}</td>
                    <td className="px-2 py-2">
                      {r.def?.nazev ?? r.zaznam.temaNazev ?? 'Pověření'}
                      <div className="text-[11px]">není vyžadováno žádnou přiřazenou položkou</div>
                    </td>
                    <td className="px-2 py-2">{formatDatum(r.zaznam.datum)}</td>
                    <td className="px-2 py-2">{r.konec ? formatDatum(r.konec) : 'na neurčito'}</td>
                    <td className="px-2 py-2">
                      <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${STAV_UI[r.stav].trida}`}>
                        {STAV_UI[r.stav].text}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-right">{tlacitkoSmazat(r.zaznam)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      {dialog && (
        <DialogZapis
          klientId={klientId}
          osoby={osoby}
          povereni={povereni}
          radky={radky}
          vychozi={dialog}
          zavri={() => setDialog(null)}
          poHotovo={() => { setDialog(null); poZmene(); }}
        />
      )}
    </Card>
  );
}

/* ─────────────────────────  DIALOG ZÁPISU  ───────────────────────── */

function DialogZapis({
  klientId, osoby, povereni, radky, vychozi, zavri, poHotovo,
}: {
  klientId: string;
  osoby: Osoba[];
  povereni: CiselnikPovereni[];
  radky: Radek[];
  vychozi: { povereniId?: string; osobaId?: string };
  zavri: () => void;
  poHotovo: () => void;
}) {
  const { user } = useData();
  const { toast } = useToast();
  const [povereniId, setPovereniId] = useState(vychozi.povereniId ?? povereni[0]?.id ?? '');
  const def = povereni.find((p) => p.id === povereniId);

  const [datum, setDatum] = useState(dnesLokalne());
  const [naNeurcito, setNaNeurcito] = useState(!def || def.platnostMesice === 0);
  const [platnostDo, setPlatnostDo] = useState(
    def && def.platnostMesice > 0 ? pridejMesice(dnesLokalne(), def.platnostMesice).slice(0, 10) : '',
  );
  const [cislo, setCislo] = useState('');
  const [vydal, setVydal] = useState(def?.kdoVydava ?? '');
  const [poznamka, setPoznamka] = useState('');
  const [vybrani, setVybrani] = useState<Set<string>>(new Set(vychozi.osobaId ? [vychozi.osobaId] : []));
  const [uklada, setUklada] = useState(false);

  /** přepočet výchozí platnosti při změně druhu nebo data */
  function prepocti(novyDef: CiselnikPovereni | undefined, novyDatum: string) {
    if (!novyDef || novyDef.platnostMesice === 0) {
      setNaNeurcito(true);
      setPlatnostDo('');
    } else {
      setNaNeurcito(false);
      setPlatnostDo(novyDatum ? pridejMesice(novyDatum, novyDef.platnostMesice).slice(0, 10) : '');
    }
  }

  function zmenDruh(id: string) {
    setPovereniId(id);
    const d = povereni.find((p) => p.id === id);
    prepocti(d, datum);
    setVydal(d?.kdoVydava ?? '');
    // předvýběr: osoby, které toto pověření vyžadují a nemají platné
    setVybrani(new Set(
      radky.filter((r) => r.def?.id === id && r.stav !== 'ok' && r.stav !== 'neurcito').map((r) => r.osoba.id),
    ));
  }

  function prepni(id: string) {
    setVybrani((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  const vyzaduji = new Set(radky.filter((r) => r.def?.id === povereniId).map((r) => r.osoba.id));
  const seraditelne = [...osoby].sort((a, b) => {
    const d = Number(vyzaduji.has(b.id)) - Number(vyzaduji.has(a.id));
    return d !== 0 ? d : celeJmeno(a).localeCompare(celeJmeno(b), 'cs');
  });

  async function zapis() {
    if (!def || vybrani.size === 0 || !datum) return;
    if (!naNeurcito && !platnostDo) {
      toast({ title: 'Doplňte konec platnosti, nebo zvolte „na neurčito“', variant: 'destructive' });
      return;
    }
    setUklada(true);
    const kdo = user?.email ?? 'neznámý';
    const odIso = new Date(datum).toISOString();
    try {
      for (const osobaId of vybrani) {
        await addDoc(collection(db, 'klienti', klientId, 'udalosti'), {
          osobaId,
          typ: 'povereni',
          temaId: def.id,
          temaNazev: def.nazev,
          datum: odIso,
          datumDo: null,
          datumPosudku: null,
          druhProhlidky: null,
          zaver: null,
          platnostDo: naNeurcito ? null : new Date(platnostDo).toISOString(),
          naNeurcito,
          cisloDokladu: cislo.trim() || null,
          provedl: vydal.trim() || null,
          poznamka: poznamka.trim() || null,
          stav: 'aktivni',
          log: [polozkaLogu(kdo, 'zalozeno', null, odIso)],
        });
      }
      toast({ title: `Pověření zapsáno (${vybrani.size})` });
      poHotovo();
    } catch (e: any) {
      toast({ title: 'Zápis selhal', description: e?.message ?? '', variant: 'destructive' });
    } finally {
      setUklada(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && zavri()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Zápis pověření</DialogTitle>
          <DialogDescription>
            Vyberte druh pověření a osoby. Platnost se předvyplní z číselníku, můžete ji upravit.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">Druh pověření</Label>
            <Select value={povereniId} onValueChange={zmenDruh}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {povereni.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.nazev} ({popisPlatnosti(p.platnostMesice)})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Pověřen od</Label>
            <Input
              type="date" value={datum} className="h-9"
              onChange={(e) => { setDatum(e.target.value); if (!naNeurcito) prepocti(def, e.target.value); }}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Platí do</Label>
            <Input
              type="date" value={platnostDo} className="h-9"
              disabled={naNeurcito}
              onChange={(e) => setPlatnostDo(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-xs font-medium sm:col-span-2">
            <Switch
              checked={naNeurcito}
              onCheckedChange={(v) => { setNaNeurcito(v); if (!v) prepocti(def?.platnostMesice ? def : { ...(def as CiselnikPovereni), platnostMesice: 12 }, datum); else setPlatnostDo(''); }}
            />
            Platí na neurčito
          </label>
          <div className="space-y-1">
            <Label className="text-xs">Pověřil</Label>
            <Input value={vydal} onChange={(e) => setVydal(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Číslo / označení pověření</Label>
            <Input value={cislo} onChange={(e) => setCislo(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">Poznámka</Label>
            <Input value={poznamka} onChange={(e) => setPoznamka(e.target.value)} className="h-9" />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-semibold">Koho se pověření týká</Label>
          <div className="max-h-56 overflow-y-auto rounded border divide-y">
            {seraditelne.map((o) => {
              const v = vybrani.has(o.id);
              return (
                <button
                  key={o.id} type="button" onClick={() => prepni(o.id)}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-muted ${v ? 'bg-blue-50/60 font-medium' : ''}`}
                >
                  <span className={`h-3.5 w-3.5 shrink-0 rounded border ${v ? 'border-blue-600 bg-blue-600' : 'border-slate-300'}`} />
                  <span className="flex-1">{celeJmeno(o)}</span>
                  {vyzaduji.has(o.id) && <span className="text-[10px] text-amber-700">vyžaduje</span>}
                </button>
              );
            })}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={zavri}>Zrušit</Button>
          <Button onClick={zapis} disabled={uklada || vybrani.size === 0 || !datum || !def}>
            {uklada && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Zapsat ({vybrani.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
