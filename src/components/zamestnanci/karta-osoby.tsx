'use client';

/**
 * AuditFlow — karta osoby.
 * Umístění: src/components/zamestnanci/karta-osoby.tsx
 *
 * Nástup a Ukončení: odškrtávací kroky procesní mapy.
 * Provoz: živý přehled školení, pověření a prohlídky osoby (z jejích položek
 *         v číselníku „Školení a činnosti"), u každé položky „Zapsat" — opakovaně.
 * Mimořádné události: deník s libovolným počtem záznamů (přerušení od–do,
 *         úrazy s DPN, ostatní události). Úrazy se podrobněji řeší později.
 * Historie: sloučené záznamy školení, pověření a prohlídek.
 */

import { useState, useMemo, useEffect } from 'react';
import { updateDoc, doc, addDoc, collection } from 'firebase/firestore';
import { db, useData } from '@/components/data-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Check, Circle, ChevronDown, ChevronRight, FileText, Loader2, Stethoscope, GraduationCap,
  AlertTriangle, RotateCw, BadgeCheck, Plus, X,
} from 'lucide-react';
import type { Osoba } from '@/lib/osoby';
import { celeJmeno, aktivniCinnosti } from '@/lib/osoby';
import type { CiselnikCinnost } from '@/lib/cinnosti';
import type { Udalost, ZaverProhlidky } from '@/lib/udalosti';
import {
  formatDatum, POPIS_DRUHU, POPIS_ZAVERU, nactiPrah, posledni, dalsiTermin, stavTerminu, polozkaLogu,
} from '@/lib/udalosti';
import type { CiselnikUzel, VyhodnocenyUzel, FazeUzlu } from '@/lib/uzly';
import { vyhodnotMapu, POPIS_FAZE, souhrnMapy } from '@/lib/uzly';
import type { CiselnikSkoleni } from '@/lib/skoleni';
import { pridejMesice } from '@/lib/skoleni';
import type { CiselnikPovereni } from '@/lib/povereni';
import { posledniPovereni, stavPovereni, popisPlatnosti } from '@/lib/povereni';

/** Fáze zobrazené jako odškrtávací kroky. Provoz a události mají vlastní sekce níže. */
const FAZE_KROKY: FazeUzlu[] = ['nastup', 'ukonceni'];

type Stav = 'ok' | 'blizi' | 'po' | 'chybi';

interface Preruseni { id: string; od: string; do: string; poznamka: string }
interface Uraz { id: string; cislo: string; dpn: boolean }
interface Udalost2 { id: string; typ: string; datum: string; poznamka: string }

const TYPY_UDALOSTI: { hodnota: string; popis: string; formular?: string }[] = [
  { hodnota: 'zmena', popis: 'Změna pozice nebo činnosti', formular: 'F006 + F001 + F010' },
  { hodnota: 'jina', popis: 'Jiná událost' },
];

const novyId = () => Math.random().toString(36).slice(2, 10);

function dnesLokalne(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const BARVA_STAVU: Record<Stav, string> = {
  po: 'border-red-600 bg-red-600 text-white',
  blizi: 'border-amber-500 bg-amber-500 text-white',
  chybi: 'border-slate-300 text-slate-300',
  ok: 'border-emerald-600 bg-emerald-600 text-white',
};
const TEXT_STAVU: Record<Stav, string> = {
  po: 'text-red-700 font-bold',
  blizi: 'text-amber-700 font-medium',
  chybi: 'text-slate-400 italic',
  ok: 'text-emerald-700 font-medium',
};

function Kolecko({ stav }: { stav: Stav }) {
  return (
    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${BARVA_STAVU[stav]}`}>
      {stav === 'ok' ? <Check className="h-3 w-3" />
        : stav === 'po' ? <AlertTriangle className="h-3 w-3" />
        : stav === 'blizi' ? <RotateCw className="h-3 w-3" />
        : <Circle className="h-2 w-2 fill-current" />}
    </span>
  );
}

/** Řádek přehledu Provoz. */
interface RadekProvozu {
  klic: string;
  druh: 'skoleni' | 'povereni' | 'prohlidka';
  nazev: string;
  podnazev?: string;
  stav: Stav;
  posledniDatum: string | null;
  dalsi: string | null;
  /** ID tématu (školení) nebo druhu pověření */
  temaId?: string;
  provadi?: string | null;
  def?: CiselnikPovereni;
  naNeurcito?: boolean;
}

export default function KartaOsoby({
  osoba, klientId, uzly, cinnosti, udalosti, jeVedouci, skoleni, povereni = [], periodaProhlidky, zavri, poZmene,
}: {
  osoba: Osoba | null;
  klientId: string | null;
  uzly: CiselnikUzel[];
  cinnosti: CiselnikCinnost[];
  udalosti: Udalost[];
  jeVedouci: boolean;
  skoleni: CiselnikSkoleni[];
  povereni?: CiselnikPovereni[];
  periodaProhlidky?: number;
  zavri: () => void;
  poZmene: () => void;
}) {
  const { toast } = useToast();
  const { user } = useData();
  const [rozbaleny, setRozbaleny] = useState<string | null>(null);
  const [uklada, setUklada] = useState<string | null>(null);
  /** řádek Provozu, u kterého je otevřený rychlý zápis */
  const [zapisKlic, setZapisKlic] = useState<string | null>(null);

  const prah = nactiPrah();

  const mojeUdalosti = useMemo(
    () => (osoba
      ? udalosti
        .filter((u) => u.osobaId === osoba.id)
        .sort((a, b) => (b.datum ?? '').localeCompare(a.datum ?? ''))
      : []),
    [osoba, udalosti],
  );

  /** Mapa jen pro Nástup a Ukončení (Provoz a události se řeší níže). */
  const mapa: VyhodnocenyUzel[] = useMemo(
    () => (osoba
      ? vyhodnotMapu(
        uzly.filter((u) => FAZE_KROKY.includes(u.faze)),
        osoba, cinnosti, udalosti, jeVedouci, skoleni, periodaProhlidky, prah,
      )
      : []),
    [osoba, uzly, cinnosti, udalosti, jeVedouci, skoleni, periodaProhlidky, prah],
  );

  /** Živý přehled Provozu. */
  const provoz = useMemo<RadekProvozu[]>(() => {
    if (!osoba) return [];
    const skMap = new Map(skoleni.map((s) => [s.id, s]));
    const povMap = new Map(povereni.map((p) => [p.id, p]));
    const radky: RadekProvozu[] = [];

    // školení: z přiřazených položek (cinnosti už obsahují i související)
    const idsSkoleni = new Set<string>();
    cinnosti.forEach((c) => (c.skoleniIds ?? []).forEach((id) => idsSkoleni.add(id)));
    for (const id of idsSkoleni) {
      const t = skMap.get(id);
      if (!t || !(t.periodaMesice > 0) || t.bezSkoleniPovereni) continue;
      const p = posledni(udalosti, osoba.id, 'skoleni', id);
      const dalsi = dalsiTermin(p, t.periodaMesice) ?? null;
      radky.push({
        klic: `s-${id}`, druh: 'skoleni', nazev: t.nazev,
        podnazev: [t.oblast, t.doklad ? 'doklad' : '', t.prezkouseni ? 'vč. přezkoušení' : ''].filter(Boolean).join(' · '),
        stav: (p ? stavTerminu(dalsi, prah) : 'chybi') as Stav,
        posledniDatum: p?.datum ?? null, dalsi, temaId: id, provadi: t.provadi ?? null,
      });
    }

    // pověření: z přiřazených položek s přepínačem „Vyžaduje pověření"
    const videnaPov = new Set<string>();
    for (const a of aktivniCinnosti(osoba)) {
      const t = skMap.get(a.cinnostId);
      if (!t?.vyzadujePovereni || t.bezSkoleniPovereni) continue;
      const def = t.povereniId ? povMap.get(t.povereniId) : undefined;
      const k = def?.id ?? `bez-${t.id}`;
      if (videnaPov.has(k)) continue;
      videnaPov.add(k);
      if (!def) {
        radky.push({
          klic: `p-${k}`, druh: 'povereni', nazev: `Pověření — ${t.nazev}`,
          podnazev: 'u položky není vybraný druh pověření', stav: 'chybi', posledniDatum: null, dalsi: null,
        });
        continue;
      }
      const z = posledniPovereni(udalosti, osoba.id, def.id);
      const r = stavPovereni(z, def, prah);
      radky.push({
        klic: `p-${def.id}`, druh: 'povereni', nazev: def.nazev,
        podnazev: `pověření · platnost ${popisPlatnosti(def.platnostMesice)}`,
        stav: (r.stav === 'neurcito' ? 'ok' : r.stav) as Stav,
        posledniDatum: z?.datum ?? null,
        dalsi: r.konec, naNeurcito: r.stav === 'neurcito',
        temaId: def.id, def, provadi: def.kdoVydava ?? null,
      });
    }

    // periodická lékařská prohlídka
    const prohlidky = mojeUdalosti.filter((u) => u.typ === 'prohlidka');
    if (periodaProhlidky || prohlidky.length > 0) {
      const p = prohlidky[0];
      const dalsi = periodaProhlidky ? (dalsiTermin(p, periodaProhlidky) ?? null) : null;
      radky.push({
        klic: 'prohlidka', druh: 'prohlidka', nazev: 'Lékařská prohlídka',
        podnazev: periodaProhlidky ? `perioda ${periodaProhlidky} měsíců` : 'perioda se nepočítá',
        stav: (p && dalsi ? stavTerminu(dalsi, prah) : p ? 'ok' : 'chybi') as Stav,
        posledniDatum: p?.datum ?? null, dalsi,
      });
    }

    const poradi: Record<string, number> = { skoleni: 0, povereni: 1, prohlidka: 2 };
    return radky.sort((a, b) => poradi[a.druh] - poradi[b.druh] || a.nazev.localeCompare(b.nazev, 'cs'));
  }, [osoba, skoleni, povereni, cinnosti, udalosti, mojeUdalosti, periodaProhlidky, prah]);

  const souhrnKroku = useMemo(() => souhrnMapy(mapa), [mapa]);
  const problemyProvozu = provoz.filter((r) => r.stav === 'po' || r.stav === 'chybi').length;
  const celkem = souhrnKroku.celkem + provoz.length;
  const problemy = souhrnKroku.problemy + problemyProvozu;
  const splneno = celkem - problemy;

  /** Ruční uzavření uzlu — datum se ukládá do mapy `uzavreneUzly` na osobě. */
  async function uzavriRucne(uzelId: string, datum: string) {
    if (!osoba || !klientId) return;
    setUklada(uzelId);
    try {
      const stavajici = ((osoba as any).uzavreneUzly ?? {}) as Record<string, string>;
      const nove = { ...stavajici };
      if (datum) nove[uzelId] = new Date(datum).toISOString();
      else delete nove[uzelId];
      await updateDoc(doc(db, 'klienti', klientId, 'osoby', osoba.id), { uzavreneUzly: nove });
      (osoba as any).uzavreneUzly = nove;
      poZmene();
    } catch (e: any) {
      toast({ title: 'Uložení selhalo', description: e?.message ?? '', variant: 'destructive' });
    } finally {
      setUklada(null);
    }
  }

  /** Rychlý zápis k řádku Provozu (opakovaně, žádný limit jednoho záznamu). */
  async function zapis(r: RadekProvozu, v: {
    datum: string; platnostDo: string; naNeurcito: boolean; provedl: string; zaver: ZaverProhlidky; poznamka: string;
  }) {
    if (!osoba || !klientId || !v.datum) return;
    const kdo = user?.email ?? 'neznámý';
    const odIso = new Date(v.datum).toISOString();
    try {
      await addDoc(collection(db, 'klienti', klientId, 'udalosti'), {
        osobaId: osoba.id,
        typ: r.druh === 'prohlidka' ? 'prohlidka' : r.druh,
        temaId: r.druh === 'prohlidka' ? null : (r.temaId ?? null),
        temaNazev: r.druh === 'prohlidka' ? null : r.nazev,
        datum: odIso,
        datumDo: null,
        datumPosudku: null,
        druhProhlidky: r.druh === 'prohlidka' ? 'periodicka' : null,
        zaver: r.druh === 'prohlidka' ? v.zaver : null,
        platnostDo: r.druh === 'povereni' && !v.naNeurcito && v.platnostDo ? new Date(v.platnostDo).toISOString() : null,
        naNeurcito: r.druh === 'povereni' ? v.naNeurcito : false,
        cisloDokladu: null,
        provedl: v.provedl.trim() || null,
        poznamka: v.poznamka.trim() || null,
        stav: 'aktivni',
        log: [polozkaLogu(kdo, 'zalozeno', null, odIso)],
      });
      toast({ title: 'Záznam zapsán' });
      setZapisKlic(null);
      poZmene();
    } catch (e: any) {
      toast({ title: 'Zápis selhal', description: e?.message ?? '', variant: 'destructive' });
    }
  }

  /* ── deník mimořádných událostí (pole na dokumentu osoby) ── */
  const [preruseni, setPreruseni] = useState<Preruseni[]>([]);
  const [urazy, setUrazy] = useState<Uraz[]>([]);
  const [udalosti2, setUdalosti2] = useState<Udalost2[]>([]);

  useEffect(() => {
    const o = osoba as any;
    setPreruseni(o?.preruseni ?? []);
    setUrazy(o?.urazy ?? []);
    setUdalosti2(o?.mimoradneUdalosti ?? []);
    setZapisKlic(null);
    setRozbaleny(null);
  }, [osoba?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function ulozPole(pole: 'preruseni' | 'urazy' | 'mimoradneUdalosti', hodnota: unknown[]) {
    if (!osoba || !klientId) return;
    try {
      await updateDoc(doc(db, 'klienti', klientId, 'osoby', osoba.id), { [pole]: hodnota });
      (osoba as any)[pole] = hodnota;
    } catch (e: any) {
      toast({ title: 'Uložení selhalo', description: e?.message ?? '', variant: 'destructive' });
    }
  }

  function upravPreruseni(nove: Preruseni[], uloz = false) {
    setPreruseni(nove);
    if (uloz) ulozPole('preruseni', nove);
  }
  function upravUrazy(nove: Uraz[], uloz = false) {
    setUrazy(nove);
    if (uloz) ulozPole('urazy', nove);
  }
  function upravUdalosti(nove: Udalost2[], uloz = false) {
    setUdalosti2(nove);
    if (uloz) ulozPole('mimoradneUdalosti', nove);
  }

  return (
    <Dialog open={!!osoba} onOpenChange={(o) => !o && zavri()}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>{osoba ? celeJmeno(osoba) : ''}</DialogTitle>
          <DialogDescription>
            {splneno} z {celkem} v pořádku
            {problemy > 0 ? ` · ${problemy} vyžaduje pozornost` : ''}.
            Zobrazuje se jen to, co se této osoby týká.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* ───── Nástup ───── */}
          {renderKroky('nastup')}

          {/* ───── Provoz ───── */}
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
              Provoz
              <span className="ml-2 normal-case font-normal tracking-normal">termín dalšího</span>
            </p>
            {provoz.length === 0 ? (
              <p className="rounded-lg border px-3 py-3 text-xs text-muted-foreground">
                Osobě zatím nejsou přiřazeny žádné položky s periodou ani pověřením. Přiřaďte je v Matici.
              </p>
            ) : (
              <div className="rounded-lg border divide-y">
                {provoz.map((r) => (
                  <div key={r.klic}>
                    <div className="flex items-center gap-2 sm:gap-3 px-2.5 sm:px-3 py-2.5">
                      <Kolecko stav={r.stav} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] sm:text-sm font-medium leading-tight">{r.nazev}</p>
                        {r.podnazev && <p className="text-[11px] text-muted-foreground">{r.podnazev}</p>}
                      </div>
                      <span className="text-xs whitespace-nowrap text-right">
                        <span className={TEXT_STAVU[r.stav]}>
                          {r.stav === 'chybi' ? 'bez záznamu'
                            : r.naNeurcito ? 'na neurčito'
                            : r.dalsi ? formatDatum(r.dalsi) : 'zapsáno'}
                        </span>
                        {r.posledniDatum && (
                          <span className="block text-[10px] text-muted-foreground">
                            poslední {formatDatum(r.posledniDatum)}
                          </span>
                        )}
                      </span>
                      {r.klic.startsWith('p-bez-') ? null : (
                        <Button
                          size="sm" variant="outline" className="h-7 text-xs shrink-0"
                          onClick={() => setZapisKlic(zapisKlic === r.klic ? null : r.klic)}
                        >
                          Zapsat
                        </Button>
                      )}
                    </div>
                    {zapisKlic === r.klic && (
                      <RychlyZapis radek={r} zrusit={() => setZapisKlic(null)} ulozit={(v) => zapis(r, v)} />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ───── Mimořádné události ───── */}
          <div className="space-y-3">
            <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
              Mimořádné události
            </p>

            <Sekce
              nadpis="Přerušení výkonu práce"
              napoveda="Nemoc nad 8 týdnů, úraz s těžkými následky nebo přerušení nad 6 měsíců zakládá mimořádnou prohlídku do 5 pracovních dnů od návratu (§ 12 vyhlášky č. 79/2013 Sb.). Mimořádnou prohlídku zapíšete v záložce Prohlídky."
              pridat={() => upravPreruseni([...preruseni, { id: novyId(), od: dnesLokalne(), do: '', poznamka: '' }], true)}
              pocet={preruseni.length}
            >
              {preruseni.map((p) => (
                <div key={p.id} className="grid gap-2 sm:grid-cols-[150px_150px_1fr_auto] items-center">
                  <Input type="date" value={p.od} className="h-8 text-xs"
                    onChange={(e) => upravPreruseni(preruseni.map((x) => x.id === p.id ? { ...x, od: e.target.value } : x))}
                    onBlur={() => ulozPole('preruseni', preruseni)} />
                  <Input type="date" value={p.do} className="h-8 text-xs" title="do (prázdné = stále trvá)"
                    onChange={(e) => upravPreruseni(preruseni.map((x) => x.id === p.id ? { ...x, do: e.target.value } : x))}
                    onBlur={() => ulozPole('preruseni', preruseni)} />
                  <Input value={p.poznamka} placeholder="důvod / poznámka" className="h-8 text-xs"
                    onChange={(e) => upravPreruseni(preruseni.map((x) => x.id === p.id ? { ...x, poznamka: e.target.value } : x))}
                    onBlur={() => ulozPole('preruseni', preruseni)} />
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => upravPreruseni(preruseni.filter((x) => x.id !== p.id), true)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {preruseni.length > 0 && (
                <p className="text-[10px] text-muted-foreground">Sloupce: od · do (prázdné = stále trvá) · poznámka</p>
              )}
            </Sekce>

            <Sekce
              nadpis="Pracovní úrazy"
              napoveda="Zatím jen jednoduchý záznam. Podrobná evidence úrazů přibude později."
              pridat={() => upravUrazy([...urazy, { id: novyId(), cislo: '', dpn: false }], true)}
              pocet={urazy.length}
            >
              {urazy.map((u) => (
                <div key={u.id} className="grid gap-2 sm:grid-cols-[1fr_auto_auto] items-center">
                  <Input value={u.cislo} placeholder="číslo úrazu" className="h-8 text-xs"
                    onChange={(e) => upravUrazy(urazy.map((x) => x.id === u.id ? { ...x, cislo: e.target.value } : x))}
                    onBlur={() => ulozPole('urazy', urazy)} />
                  <label className="flex items-center gap-2 text-xs">
                    <Checkbox
                      checked={u.dpn}
                      onCheckedChange={(v) => upravUrazy(urazy.map((x) => x.id === u.id ? { ...x, dpn: !!v } : x), true)}
                    />
                    DPN
                  </label>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => upravUrazy(urazy.filter((x) => x.id !== u.id), true)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </Sekce>

            <Sekce
              nadpis="Ostatní události"
              napoveda="Změna pozice nebo činnosti spouští lékařskou prohlídku, doškolení a úpravu OOPP (F006 + F001 + F010)."
              pridat={() => upravUdalosti([...udalosti2, { id: novyId(), typ: 'zmena', datum: dnesLokalne(), poznamka: '' }], true)}
              pocet={udalosti2.length}
            >
              {udalosti2.map((u) => (
                <div key={u.id} className="grid gap-2 sm:grid-cols-[210px_150px_1fr_auto] items-center">
                  <Select value={u.typ} onValueChange={(v) => upravUdalosti(udalosti2.map((x) => x.id === u.id ? { ...x, typ: v } : x), true)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TYPY_UDALOSTI.map((t) => <SelectItem key={t.hodnota} value={t.hodnota}>{t.popis}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input type="date" value={u.datum} className="h-8 text-xs"
                    onChange={(e) => upravUdalosti(udalosti2.map((x) => x.id === u.id ? { ...x, datum: e.target.value } : x))}
                    onBlur={() => ulozPole('mimoradneUdalosti', udalosti2)} />
                  <Input value={u.poznamka} placeholder="poznámka" className="h-8 text-xs"
                    onChange={(e) => upravUdalosti(udalosti2.map((x) => x.id === u.id ? { ...x, poznamka: e.target.value } : x))}
                    onBlur={() => ulozPole('mimoradneUdalosti', udalosti2)} />
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => upravUdalosti(udalosti2.filter((x) => x.id !== u.id), true)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </Sekce>
          </div>

          {/* ───── Ukončení ───── */}
          {renderKroky('ukonceni')}

          {/* ───── Historie ───── */}
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
              Historie
            </p>
            {mojeUdalosti.length === 0 ? (
              <p className="py-3 text-xs text-muted-foreground">Zatím žádné záznamy.</p>
            ) : (
              <div className="rounded-lg border divide-y">
                {mojeUdalosti.map((u) => (
                  <div key={u.id} className="flex items-start gap-3 px-3 py-2">
                    {u.typ === 'prohlidka'
                      ? <Stethoscope className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                      : u.typ === 'povereni'
                        ? <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                        : <GraduationCap className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {u.typ === 'prohlidka'
                          ? `${POPIS_DRUHU[u.druhProhlidky ?? 'periodicka']} prohlídka`
                          : u.typ === 'povereni'
                            ? `Pověření: ${u.temaNazev ?? ''}`
                            : (u.temaNazev ?? 'Školení')}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {u.datumDo ? `zácvik do ${formatDatum(u.datumDo)} · ` : ''}
                        {u.typ === 'povereni' ? (u.naNeurcito ? 'na neurčito · ' : u.platnostDo ? `do ${formatDatum(u.platnostDo)} · ` : '') : ''}
                        {u.zaver ? `${POPIS_ZAVERU[u.zaver]} · ` : ''}
                        {u.provedl ?? ''}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDatum(u.datum)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  /** Odškrtávací kroky mapy pro danou fázi (Nástup, Ukončení). */
  function renderKroky(faze: FazeUzlu) {
    const vFazi = mapa.filter((m) => m.uzel.faze === faze);
    if (vFazi.length === 0) return null;
    return (
      <div key={faze} className="space-y-1">
        <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
          {POPIS_FAZE[faze]}
        </p>
        <div className="rounded-lg border divide-y">
          {vFazi.map((m) => {
            const rozbaleno = rozbaleny === m.uzel.id;
            const rucni = m.uzel.uzavreni === 'rucne';
            const stavKolecka: Stav = m.stav === 'splneno' || m.stav === 'ok' ? 'ok'
              : m.stav === 'blizi' ? 'blizi' : m.stav === 'po' ? 'po' : 'chybi';
            return (
              <div key={m.uzel.id}>
                <button
                  type="button"
                  onClick={() => setRozbaleny(rozbaleno ? null : m.uzel.id)}
                  className="flex w-full items-center gap-2 sm:gap-3 px-2.5 sm:px-3 py-2.5 text-left hover:bg-muted/40"
                >
                  <Kolecko stav={stavKolecka} />
                  <span className="flex-1 text-[13px] sm:text-sm font-medium leading-tight">
                    {m.uzel.nazev}
                    {m.uzel.volitelny && (
                      <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">volitelné</span>
                    )}
                  </span>
                  {m.uzel.formular && (
                    <span className="hidden sm:flex items-center gap-1 text-[11px] text-muted-foreground">
                      <FileText className="h-3 w-3" />{m.uzel.formular}
                    </span>
                  )}
                  <span className={`text-xs whitespace-nowrap ${m.stav === 'splneno' ? 'text-emerald-700 font-medium' : 'text-muted-foreground'}`}>
                    {m.stav === 'splneno' ? formatDatum(m.datum) : 'čeká'}
                  </span>
                  {rozbaleno ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </button>

                {rozbaleno && (
                  <div className="space-y-3 border-t bg-muted/20 px-3 py-3">
                    {m.uzel.napoveda && (
                      <p className="text-xs leading-relaxed text-muted-foreground">{m.uzel.napoveda}</p>
                    )}
                    {m.uzel.predpis && (
                      <p className="text-[11px] text-muted-foreground">{m.uzel.predpis}</p>
                    )}
                    {rucni ? (
                      <div className="flex items-end gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Splněno dne</Label>
                          <Input
                            type="date"
                            value={m.datum ? m.datum.split('T')[0] : ''}
                            onChange={(e) => uzavriRucne(m.uzel.id, e.target.value)}
                            className="h-9 w-[170px]"
                          />
                        </div>
                        {uklada === m.uzel.id && <Loader2 className="h-4 w-4 animate-spin mb-2" />}
                        {m.datum && (
                          <Button
                            variant="ghost" size="sm"
                            onClick={() => uzavriRucne(m.uzel.id, '')}
                            className="mb-0.5 text-xs text-muted-foreground"
                          >
                            Zrušit
                          </Button>
                        )}
                      </div>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">
                        Uzavře se automaticky zápisem na záložce {m.uzel.uzavreni === 'prohlidkou' ? 'Prohlídky' : 'Zápis školení'}{m.uzel.uzavreni === 'skolenim' ? ' (volba Vstupní)' : ''}.
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }
}

/* ─────────────────────────  POMOCNÉ KOMPONENTY  ───────────────────────── */

function Sekce({
  nadpis, napoveda, pridat, pocet, children,
}: {
  nadpis: string;
  napoveda?: string;
  pridat: () => void;
  pocet: number;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border">
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">
            {nadpis} {pocet > 0 && <span className="text-xs font-normal text-muted-foreground">({pocet})</span>}
          </p>
          {napoveda && <p className="text-[11px] leading-snug text-muted-foreground">{napoveda}</p>}
        </div>
        <Button size="sm" variant="outline" className="h-7 shrink-0 text-xs" onClick={pridat}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Přidat
        </Button>
      </div>
      {pocet > 0 && <div className="space-y-2 border-t bg-muted/20 px-3 py-3">{children}</div>}
    </div>
  );
}

function RychlyZapis({
  radek, zrusit, ulozit,
}: {
  radek: RadekProvozu;
  zrusit: () => void;
  ulozit: (v: {
    datum: string; platnostDo: string; naNeurcito: boolean; provedl: string; zaver: ZaverProhlidky; poznamka: string;
  }) => void;
}) {
  const [datum, setDatum] = useState(dnesLokalne());
  const mesicu = radek.def?.platnostMesice ?? 0;
  const [naNeurcito, setNaNeurcito] = useState(radek.druh === 'povereni' && mesicu === 0);
  const [platnostDo, setPlatnostDo] = useState(
    radek.druh === 'povereni' && mesicu > 0 ? pridejMesice(dnesLokalne(), mesicu).slice(0, 10) : '',
  );
  const [provedl, setProvedl] = useState(radek.provadi ?? '');
  const [zaver, setZaver] = useState<ZaverProhlidky>('zpusobily');
  const [poznamka, setPoznamka] = useState('');
  const [uklada, setUklada] = useState(false);

  return (
    <div className="grid gap-3 border-t bg-muted/20 px-3 py-3 sm:grid-cols-2">
      <div className="space-y-1">
        <Label className="text-xs">{radek.druh === 'povereni' ? 'Pověřen od' : radek.druh === 'prohlidka' ? 'Datum prohlídky' : 'Datum školení'}</Label>
        <Input
          type="date" value={datum} className="h-9"
          onChange={(e) => {
            setDatum(e.target.value);
            if (radek.druh === 'povereni' && mesicu > 0 && !naNeurcito && e.target.value) {
              setPlatnostDo(pridejMesice(e.target.value, mesicu).slice(0, 10));
            }
          }}
        />
      </div>

      {radek.druh === 'povereni' && (
        <div className="space-y-1">
          <Label className="text-xs">Platí do</Label>
          <div className="flex items-center gap-3">
            <Input type="date" value={platnostDo} disabled={naNeurcito} className="h-9"
              onChange={(e) => setPlatnostDo(e.target.value)} />
            <label className="flex items-center gap-1.5 text-xs whitespace-nowrap">
              <Checkbox checked={naNeurcito} onCheckedChange={(v) => setNaNeurcito(!!v)} />
              na neurčito
            </label>
          </div>
        </div>
      )}

      {radek.druh === 'prohlidka' && (
        <div className="space-y-1">
          <Label className="text-xs">Závěr posudku</Label>
          <Select value={zaver} onValueChange={(v) => setZaver(v as ZaverProhlidky)}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(POPIS_ZAVERU) as ZaverProhlidky[]).map((z) => (
                <SelectItem key={z} value={z}>{POPIS_ZAVERU[z]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-1">
        <Label className="text-xs">
          {radek.druh === 'povereni' ? 'Pověřil' : radek.druh === 'prohlidka' ? 'Poskytovatel PLS' : 'Lektor'}
        </Label>
        <Input value={provedl} onChange={(e) => setProvedl(e.target.value)} className="h-9" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Poznámka</Label>
        <Input value={poznamka} onChange={(e) => setPoznamka(e.target.value)} className="h-9" />
      </div>

      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button size="sm" variant="ghost" onClick={zrusit}>Zrušit</Button>
        <Button
          size="sm"
          disabled={uklada || !datum || (radek.druh === 'povereni' && !naNeurcito && !platnostDo)}
          onClick={async () => {
            setUklada(true);
            await ulozit({ datum, platnostDo, naNeurcito, provedl, zaver, poznamka });
            setUklada(false);
          }}
        >
          {uklada && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
          Zapsat
        </Button>
      </div>
    </div>
  );
}
