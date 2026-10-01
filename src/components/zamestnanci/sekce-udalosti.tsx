'use client';

/**
 * AuditFlow — školení, zácviky a prohlídky osob.
 * Umístění: src/components/zamestnanci/sekce-udalosti.tsx
 *
 * Mřížka osoby × témata s termíny, hromadný zápis podle výběru osob
 * a historie změn u každého záznamu.
 *
 * Hromadný zápis je hlavní režim: filtr „termín končí do…" vybere lidi,
 * jedno datum se zapíše všem najednou. Čtyřicet lidí po jednom je peklo.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db, useData } from '@/components/data-provider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2, GraduationCap, Stethoscope, History, Users, Check,
} from 'lucide-react';
import type { Osoba } from '@/lib/osoby';
import Napoveda from '@/components/ui/napoveda';
import { celeJmeno, aktivniCinnosti } from '@/lib/osoby';
import type { CiselnikSkoleni } from '@/lib/skoleni';
import { maVstupniSkoleni } from '@/lib/skoleni';
import type { CiselnikCinnost, CiselnikKategorie } from '@/lib/cinnosti';
import { periodaProhlidky, jeNad50, popisPeriodyProhlidky } from '@/lib/cinnosti';
import type { Udalost, TypUdalosti, DruhProhlidky, ZaverProhlidky } from '@/lib/udalosti';
import {
  nactiUdalosti, posledni, dalsiTermin, formatDatum, stavTerminu,
  polozkaLogu, POPIS_ZAVERU, POPIS_DRUHU,
} from '@/lib/udalosti';

/** Dnešní datum v místním čase (YYYY-MM-DD) — toISOString by v noci vrátilo včerejšek. */
function dnesLokalne(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

const BARVA: Record<string, string> = {
  po: 'text-red-700 font-bold',
  blizi: 'text-amber-700 font-medium',
  ok: 'text-slate-700',
  chybi: 'text-slate-400 italic',
};

export default function SekceUdalosti({
  klientId, osoby, skoleni, cinnosti, kategorie, poziceKategorie, rezim,
}: {
  klientId: string | null;
  osoby: Osoba[];
  skoleni: CiselnikSkoleni[];
  cinnosti: CiselnikCinnost[];
  kategorie: CiselnikKategorie[];
  /** mapa osobaId → kód kategorie z její pozice */
  poziceKategorie: Record<string, string | null>;
  rezim: 'skoleni' | 'prohlidka';
}) {
  const { toast } = useToast();
  const { userProfile } = useData();
  const [udalosti, setUdalosti] = useState<Udalost[]>([]);
  const [nacitam, setNacitam] = useState(true);
  const [temaId, setTemaId] = useState<string>('');
  /** druh zápisu školení: vstupní (nástup / změna pozice) nebo periodické */
  const [zapisVstupni, setZapisVstupni] = useState(false);
  const [historie, setHistorie] = useState<{ osoba: Osoba; zaznamy: Udalost[] } | null>(null);

  const nacti = useCallback(async () => {
    if (!klientId) { setUdalosti([]); setNacitam(false); return; }
    setNacitam(true);
    try {
      setUdalosti(await nactiUdalosti(klientId));
    } catch (e) {
      console.error('Načtení záznamů selhalo:', e);
    } finally {
      setNacitam(false);
    }
  }, [klientId]);

  useEffect(() => { nacti(); }, [nacti]);

  const cinnostiMap = useMemo(
    () => Object.fromEntries(cinnosti.map((c) => [c.id, c])),
    [cinnosti],
  );

  /** Školení, která osobě plynou z jejích činností. */
  const povinnaSkoleni = useCallback((o: Osoba): string[] => {
    const ids = new Set<string>();
    aktivniCinnosti(o).forEach((p) => {
      (cinnostiMap[p.cinnostId]?.skoleniIds ?? []).forEach((s) => ids.add(s));
    });
    return [...ids];
  }, [cinnostiMap]);

  /** Perioda prohlídky osoby — z kategorie pozice a z jejích činností. */
  const periodaOsoby = useCallback((o: Osoba): number | undefined => {
    const kat = kategorie.find((k) => k.kod === poziceKategorie[o.id]);
    const jejiCinnosti = aktivniCinnosti(o)
      .map((p) => {
        const c = cinnostiMap[p.cinnostId];
        if (!c) return null;
        return p.profesniRizikoOverride == null ? c : { ...c, profesniRiziko: p.profesniRizikoOverride };
      })
      .filter((c): c is CiselnikCinnost => !!c);
    const nad50 = o.datumNarozeni ? jeNad50(o.datumNarozeni, new Date().toISOString()) : false;
    return periodaProhlidky(kat, jejiCinnosti, nad50);
  }, [kategorie, poziceKategorie, cinnostiMap]);

  const temaVybrane = skoleni.find((s) => s.id === temaId);
  const moznePeriodicke = (temaVybrane?.periodaMesice ?? 0) > 0;
  const mozneVstupni = !!temaVybrane && maVstupniSkoleni(temaVybrane);
  /** skutečně použitý druh: téma jen s jedním druhem ho určí samo */
  const vstupni = rezim === 'skoleni' && !!temaVybrane
    && (!moznePeriodicke || (mozneVstupni && zapisVstupni));

  /** Řádky přehledu: osoba + poslední záznam + termín dalšího. */
  const radky = useMemo(() => {
    const tema = skoleni.find((s) => s.id === temaId);
    return osoby.map((o) => {
      const p = rezim === 'skoleni'
        ? posledni(udalosti, o.id, 'skoleni', temaId || null, vstupni, !((tema?.periodaMesice ?? 0) > 0))
        : posledni(udalosti, o.id, 'prohlidka', null);
      const perioda = rezim === 'skoleni' ? (vstupni ? 0 : (tema?.periodaMesice ?? 0)) : (periodaOsoby(o) ?? 0);
      const dalsi = dalsiTermin(p, perioda);
      return { osoba: o, posledniZ: p, dalsi, perioda, povinne: rezim === 'skoleni' ? povinnaSkoleni(o).includes(temaId) : true };
    });
  }, [osoby, udalosti, rezim, temaId, skoleni, periodaOsoby, povinnaSkoleni, vstupni]);

  if (!klientId) {
    return (
      <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
        Vyber konkrétního klienta.
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-1.5">
            {rezim === 'skoleni' ? 'Školení a zácviky' : 'Lékařské prohlídky'}
            <Napoveda klic={rezim === 'skoleni' ? 'skoleni' : 'prohlidky'} />
          </CardTitle>
          <CardDescription>
            {rezim === 'skoleni'
              ? 'Termín se počítá od data konkrétní osoby, ne od firemního termínu. Každá změna se ukládá do historie.'
              : 'Perioda běží od data vydání posudku a vychází z kategorie práce a činností s profesním rizikem.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-[1fr_auto] items-end [&>button]:w-full sm:[&>button]:w-auto">
            {rezim === 'skoleni' ? (
              <div className="space-y-1">
                <Label className="text-xs">Téma školení</Label>
                <Select value={temaId} onValueChange={setTemaId}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="vyber téma…" /></SelectTrigger>
                  <SelectContent>
                    {skoleni.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.nazev}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : <div />}
            <DialogHromadny
              klientId={klientId}
              rezim={rezim}
              tema={skoleni.find((s) => s.id === temaId)}
              vstupni={vstupni}
              radky={radky}
              poHotovo={nacti}
            />
          </div>
          {rezim === 'skoleni' && (
            <>
                {temaVybrane && moznePeriodicke && mozneVstupni && (
                  <div className="inline-flex rounded-md border p-0.5 text-xs mt-1.5">
                    {[{ v: false, t: 'Periodické' }, { v: true, t: 'Vstupní' }].map((o) => (
                      <button
                        key={o.t}
                        type="button"
                        onClick={() => setZapisVstupni(o.v)}
                        className={`rounded px-3 py-1 ${zapisVstupni === o.v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
                      >
                        {o.t}
                      </button>
                    ))}
                  </div>
                )}
                {temaVybrane && !moznePeriodicke && (
                  <p className="text-[11px] text-muted-foreground mt-1">Téma má jen vstupní školení — eviduje se, kdo a kdy ho absolvoval.</p>
                )}
            </>
          )}

          {nacitam ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Načítám…
            </div>
          ) : rezim === 'skoleni' && !temaId ? (
            <p className="py-8 text-sm text-muted-foreground">
              Vyber téma školení. Zobrazí se, kdo ho má, kdy byl naposledy školen a kdy mu termín končí.
            </p>
          ) : osoby.length === 0 ? (
            <p className="py-8 text-sm text-muted-foreground">Žádné osoby.</p>
          ) : (
            <div className="divide-y border-t text-sm">
              <div className="hidden sm:grid grid-cols-[1.6fr_1fr_1fr_auto] gap-3 py-2 text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                <span>Osoba</span><span>Poslední</span><span>Termín dalšího</span><span />
              </div>
              {radky.map(({ osoba, posledniZ, dalsi, perioda, povinne }) => {
                const st = stavTerminu(dalsi);
                return (
                  <div key={osoba.id} className="grid grid-cols-[1fr_auto] sm:grid-cols-[1.6fr_1fr_1fr_auto] gap-x-3 gap-y-1 py-2.5 items-center">
                    <div>
                      <p className="font-medium">{celeJmeno(osoba)}</p>
                      {rezim === 'skoleni' && !povinne && (
                        <p className="text-[10px] text-muted-foreground">z činností neplyne</p>
                      )}
                      {rezim === 'prohlidka' && (
                        <p className="text-[10px] text-muted-foreground">
                          {popisPeriodyProhlidky(perioda)}
                          {posledniZ?.zaver ? ` · ${POPIS_ZAVERU[posledniZ.zaver]}` : ''}
                        </p>
                      )}
                    </div>
                    <span className="order-3 sm:order-none text-[11px] sm:text-xs text-muted-foreground sm:text-foreground">
                      <span className="sm:hidden">poslední: </span>{formatDatum(posledniZ?.datum)}
                    </span>
                    <span className={`order-2 sm:order-none text-xs text-right sm:text-left ${BARVA[st]}`}>
                      {vstupni ? (posledniZ ? 'absolvoval' : 'bez záznamu')
                        : st === 'chybi' ? 'bez záznamu' : formatDatum(dalsi)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="order-4 sm:order-none h-7 w-7 justify-self-end"
                      title="Historie"
                      onClick={() => setHistorie({
                        osoba,
                        zaznamy: udalosti
                          .filter((u) => u.osobaId === osoba.id)
                          .sort((a, b) => (b.datum ?? '').localeCompare(a.datum ?? '')),
                      })}
                    >
                      <History className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <DialogHistorie
        data={historie}
        klientId={klientId}
        jeAdmin={userProfile?.role === 'admin'}
        poZmene={nacti}
        zavri={() => setHistorie(null)}
      />
    </div>
  );
}

/* ─────────────────────────  HROMADNÝ ZÁPIS  ───────────────────────── */

interface Radek {
  osoba: Osoba;
  posledniZ?: Udalost;
  dalsi?: string;
  perioda: number;
  povinne: boolean;
}

function DialogHromadny({
  klientId, rezim, tema, vstupni, radky, poHotovo,
}: {
  klientId: string;
  rezim: 'skoleni' | 'prohlidka';
  tema?: CiselnikSkoleni;
  vstupni: boolean;
  radky: Radek[];
  poHotovo: () => void;
}) {
  const { user } = useData();
  const { toast } = useToast();
  const [otevreno, setOtevreno] = useState(false);
  const [datum, setDatum] = useState(dnesLokalne());
  const [datumDo, setDatumDo] = useState('');
  const [datumPosudku, setDatumPosudku] = useState('');
  const [druh, setDruh] = useState<DruhProhlidky>('periodicka');
  const [zaver, setZaver] = useState<ZaverProhlidky>('zpusobily');
  const [provedl, setProvedl] = useState('');
  const [platnostDo, setPlatnostDo] = useState('');
  const [cisloDokladu, setCisloDokladu] = useState('');
  const [poznamka, setPoznamka] = useState('');
  const [doKdy, setDoKdy] = useState('');
  const [vybrani, setVybrani] = useState<Set<string>>(new Set());
  const [uklada, setUklada] = useState(false);

  /** Předvýběr: koho termín končí do zvoleného data (jádro hromadného zápisu). */
  function predvyber(hranice: string) {
    setDoKdy(hranice);
    if (!hranice) return;
    const h = new Date(hranice).toISOString();
    setVybrani(new Set(
      radky
        .filter((r) => (rezim === 'skoleni' ? r.povinne : true))
        .filter((r) => !r.dalsi || r.dalsi <= h)
        .map((r) => r.osoba.id),
    ));
  }

  /** Otevření dialogu: u školení se předvyberou povinní, kterým záznam chybí nebo termín končí. */
  function otevri() {
    setDatum(dnesLokalne());
    setDoKdy('');
    // Lektor se předvyplní z číselníku (kdo školení provádí); jde upravit.
    setProvedl(rezim === 'skoleni' ? (tema?.provadi ?? '') : '');
    setVybrani(
      rezim === 'skoleni'
        ? new Set(radky
          .filter((r) => r.povinne && (vstupni ? !r.posledniZ : stavTerminu(r.dalsi) !== 'ok'))
          .map((r) => r.osoba.id))
        : new Set(),
    );
    setOtevreno(true);
  }

  function prepni(id: string) {
    setVybrani((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  async function zapis() {
    if (vybrani.size === 0 || !datum) return;
    setUklada(true);
    const kdo = user?.email ?? 'neznámý';
    try {
      for (const r of radky.filter((x) => vybrani.has(x.osoba.id))) {
        const zaklad = {
          osobaId: r.osoba.id,
          typ: (rezim === 'skoleni' ? 'skoleni' : 'prohlidka') as TypUdalosti,
          temaId: rezim === 'skoleni' ? (tema?.id ?? null) : null,
          temaNazev: rezim === 'skoleni' ? (tema?.nazev ?? null) : null,
          vstupni: rezim === 'skoleni' ? vstupni : null,
          datum: new Date(datum).toISOString(),
          datumDo: datumDo ? new Date(datumDo).toISOString() : null,
          datumPosudku: rezim === 'prohlidka' && datumPosudku
            ? new Date(datumPosudku).toISOString()
            : null,
          druhProhlidky: rezim === 'prohlidka' ? druh : null,
          zaver: rezim === 'prohlidka' ? zaver : null,
          platnostDo: platnostDo ? new Date(platnostDo).toISOString() : null,
          cisloDokladu: cisloDokladu.trim() || null,
          provedl: provedl.trim() || null,
          poznamka: poznamka.trim() || null,
          stav: 'aktivni',
          log: [polozkaLogu(kdo, 'zalozeno', null, new Date(datum).toISOString())],
        };
        await addDoc(collection(db, 'klienti', klientId, 'udalosti'), zaklad);
      }
      toast({ title: `Zapsáno u ${vybrani.size} osob` });
      setOtevreno(false);
      setVybrani(new Set());
      setDoKdy('');
      poHotovo();
    } catch (e: any) {
      toast({ title: 'Zápis selhal', description: e?.message ?? '', variant: 'destructive' });
    } finally {
      setUklada(false);
    }
  }

  // Zapsat lze komukoli — školení, které osobě z činností neplyne, se také stává.
  const dostupni = radky;
  const povinni = radky.filter((r) => r.povinne);
  const ostatni = rezim === 'skoleni' ? radky.filter((r) => !r.povinne) : [];

  const radekUI = (r: Radek) => {
    const vybran = vybrani.has(r.osoba.id);
    const st = stavTerminu(r.dalsi);
    return (
      <button
        key={r.osoba.id}
        type="button"
        onClick={() => prepni(r.osoba.id)}
        className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-muted ${vybran ? 'bg-blue-50/60' : ''}`}
      >
        <span className={`h-3.5 w-3.5 shrink-0 rounded border flex items-center justify-center ${vybran ? 'border-blue-600 bg-blue-600' : 'border-slate-300'}`}>
          {vybran && <Check className="h-2.5 w-2.5 text-white" />}
        </span>
        <span className="flex-1 font-medium">{celeJmeno(r.osoba)}</span>
        <span className="text-muted-foreground">
          {r.posledniZ ? `naposledy ${formatDatum(r.posledniZ.datum)}` : ''}
        </span>
        <span className={`w-24 text-right ${BARVA[st]}`}>
          {vstupni ? (r.posledniZ ? 'absolvoval' : 'bez záznamu')
            : st === 'chybi' ? 'bez záznamu' : `do ${formatDatum(r.dalsi)}`}
        </span>
      </button>
    );
  };
  const blokovano = rezim === 'skoleni' && !tema;

  return (
    <Dialog open={otevreno} onOpenChange={setOtevreno}>
      <Button onClick={otevri} disabled={blokovano}>
        {rezim === 'skoleni'
          ? <><GraduationCap className="mr-2 h-4 w-4" /> Zapsat školení</>
          : <><Stethoscope className="mr-2 h-4 w-4" /> Zapsat prohlídku</>}
      </Button>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>
            {rezim === 'skoleni' ? `Zápis ${vstupni ? 'vstupního ' : ''}školení — ${tema?.nazev ?? ''}` : 'Zápis lékařské prohlídky'}
          </DialogTitle>
          <DialogDescription>
            {rezim === 'skoleni'
              ? 'Vyplňte datum školení a zaškrtněte lidi, kteří se ho zúčastnili. Všem zaškrtnutým se zapíše stejné datum.'
              : 'Vyplňte datum prohlídky a zaškrtněte lidi, kterých se týká. Všem zaškrtnutým se zapíše stejné datum.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs">
                {rezim === 'skoleni' ? 'Datum školení' : 'Datum prohlídky'}
              </Label>
              <Input type="date" value={datum} onChange={(e) => setDatum(e.target.value)} className="h-9" />
            </div>
            {rezim === 'skoleni' ? (
              <div className="space-y-1">
                <Label className="text-xs">Ukončení zácviku (volitelně)</Label>
                <Input type="date" value={datumDo} onChange={(e) => setDatumDo(e.target.value)} className="h-9" />
              </div>
            ) : (
              <div className="space-y-1">
                <Label className="text-xs">Datum vydání posudku</Label>
                <Input type="date" value={datumPosudku} onChange={(e) => setDatumPosudku(e.target.value)} className="h-9" />
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs">{rezim === 'skoleni' ? 'Lektor' : 'Poskytovatel PLS'}</Label>
              <Input value={provedl} onChange={(e) => setProvedl(e.target.value)} className="h-9" />
            </div>
          </div>

          {rezim === 'skoleni' && tema?.doklad && (
            <div className="grid gap-3 sm:grid-cols-2 rounded-lg border bg-amber-50/40 p-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Platnost dokladu do</Label>
                <Input type="date" value={platnostDo} onChange={(e) => setPlatnostDo(e.target.value)} className="h-9" />
                <p className="text-[11px] text-muted-foreground">
                  U průkazů a osvědčení se hlídá tohle datum, ne perioda.
                </p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Číslo dokladu</Label>
                <Input value={cisloDokladu} onChange={(e) => setCisloDokladu(e.target.value)} className="h-9" />
              </div>
            </div>
          )}

          {rezim === 'prohlidka' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Druh prohlídky</Label>
                <Select value={druh} onValueChange={(v) => setDruh(v as DruhProhlidky)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(POPIS_DRUHU) as DruhProhlidky[]).map((d) => (
                      <SelectItem key={d} value={d}>{POPIS_DRUHU[d]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
            </div>
          )}

          <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
            <p className="text-xs font-semibold">
              {rezim === 'skoleni' ? 'Kdo se školení zúčastnil' : 'Koho se prohlídka týká'}
            </p>

            <div className="flex flex-wrap items-end gap-2">
              {rezim === 'skoleni' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setVybrani(new Set(povinni.filter((r) => stavTerminu(r.dalsi) !== 'ok').map((r) => r.osoba.id)))}
                >
                  Povinní, kterým školení chybí nebo končí
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => setVybrani(new Set(dostupni.map((r) => r.osoba.id)))}>
                Vybrat všechny
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setVybrani(new Set())}>
                Zrušit výběr
              </Button>
              <div className="space-y-1 sm:ml-auto">
                <Label className="text-[11px] text-muted-foreground">nebo komu termín končí do</Label>
                <Input type="date" value={doKdy} onChange={(e) => predvyber(e.target.value)} className="h-8 w-[150px]" />
              </div>
            </div>

            {rezim === 'skoleni' && povinni.length === 0 && (
              <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Toto školení zatím nikomu neplyne z činností. Zaškrtněte lidi, kteří ho absolvovali,
                a zapište je ručně. Aby se školení přiřazovalo samo, připojte ho k činnosti v Číselníky → Činnosti.
              </p>
            )}

            <div className="max-h-72 overflow-y-auto rounded border bg-background divide-y">
              {rezim === 'skoleni' && povinni.length > 0 && ostatni.length > 0 && (
                <p className="bg-muted/40 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Školení plyne z činností
                </p>
              )}
              {povinni.map(radekUI)}
              {ostatni.length > 0 && (
                <p className="bg-muted/40 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Z činností neplyne (zapsat lze ručně)
                </p>
              )}
              {ostatni.map(radekUI)}
              {dostupni.length === 0 && (
                <p className="px-3 py-4 text-xs text-muted-foreground">Klient nemá v evidenci žádné osoby.</p>
              )}
            </div>

            <p className="text-xs font-medium flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" /> Vybráno {vybrani.size} z {dostupni.length}
            </p>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Poznámka</Label>
            <Textarea
              value={poznamka}
              onChange={(e) => setPoznamka(e.target.value)}
              className="min-h-[50px] text-sm"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOtevreno(false)}>Zrušit</Button>
          <Button onClick={zapis} disabled={uklada || vybrani.size === 0 || !datum}>
            {uklada && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Zapsat {vybrani.size > 0 ? `(${vybrani.size})` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────────────────  HISTORIE  ───────────────────────── */

function DialogHistorie({
  data, klientId, jeAdmin, poZmene, zavri,
}: {
  data: { osoba: Osoba; zaznamy: Udalost[] } | null;
  klientId: string;
  jeAdmin: boolean;
  poZmene: () => void;
  zavri: () => void;
}) {
  const { user } = useData();
  const { toast } = useToast();
  const [uprava, setUprava] = useState<string | null>(null);
  const [potvrdit, setPotvrdit] = useState<string | null>(null);
  const [f, setF] = useState({
    datum: '', datumDo: '', datumPosudku: '', platnostDo: '', cisloDokladu: '',
    provedl: '', poznamka: '', vstupni: false,
  });
  const [uklada, setUklada] = useState(false);

  const den = (v?: string | null) => (v ? v.slice(0, 10) : '');
  const iso = (v: string) => (v ? new Date(v).toISOString() : null);

  function otevriUpravu(u: Udalost) {
    setF({
      datum: den(u.datum), datumDo: den(u.datumDo), datumPosudku: den(u.datumPosudku),
      platnostDo: den(u.platnostDo), cisloDokladu: u.cisloDokladu ?? '',
      provedl: u.provedl ?? '', poznamka: u.poznamka ?? '', vstupni: u.vstupni === true,
    });
    setUprava(u.id);
    setPotvrdit(null);
  }

  async function uloz(u: Udalost) {
    if (!f.datum) return;
    setUklada(true);
    const kdo = user?.email ?? 'neznámý';
    const log = [...(u.log ?? [])];
    const zmenaDatumu = (pole: string, stare: string | null | undefined, nove: string | null) => {
      if (den(stare) !== den(nove)) log.push(polozkaLogu(kdo, pole, stare ?? null, nove));
    };
    const nove = {
      datum: iso(f.datum) as string,
      datumDo: iso(f.datumDo),
      datumPosudku: iso(f.datumPosudku),
      platnostDo: iso(f.platnostDo),
      cisloDokladu: f.cisloDokladu.trim() || null,
      provedl: f.provedl.trim() || null,
      poznamka: f.poznamka.trim() || null,
      ...(u.typ === 'skoleni' ? { vstupni: f.vstupni } : {}),
    };
    zmenaDatumu('datum', u.datum, nove.datum);
    zmenaDatumu('datumDo', u.datumDo, nove.datumDo);
    zmenaDatumu('datumPosudku', u.datumPosudku, nove.datumPosudku);
    zmenaDatumu('platnostDo', u.platnostDo, nove.platnostDo);
    if ((u.cisloDokladu ?? null) !== nove.cisloDokladu) log.push(polozkaLogu(kdo, 'cisloDokladu upraveno', null, null));
    if ((u.provedl ?? null) !== nove.provedl) log.push(polozkaLogu(kdo, 'lektor upraven', null, null));
    if ((u.poznamka ?? null) !== nove.poznamka) log.push(polozkaLogu(kdo, 'poznámka upravena', null, null));
    if (u.typ === 'skoleni' && (u.vstupni === true) !== f.vstupni) {
      log.push(polozkaLogu(kdo, f.vstupni ? 'změněno na vstupní' : 'změněno na periodické', null, null));
    }
    try {
      await updateDoc(doc(db, 'klienti', klientId, 'udalosti', u.id), { ...nove, log });
      toast({ title: 'Záznam upraven' });
      setUprava(null);
      poZmene();
      zavri();
    } catch (e: any) {
      toast({ title: 'Uložení selhalo', description: e?.message ?? '', variant: 'destructive' });
    } finally {
      setUklada(false);
    }
  }

  async function smaz(u: Udalost) {
    if (potvrdit !== u.id) { setPotvrdit(u.id); return; }
    try {
      await updateDoc(doc(db, 'klienti', klientId, 'udalosti', u.id), {
        stav: 'smazano',
        log: [...(u.log ?? []), polozkaLogu(user?.email ?? 'neznámý', 'smazano', u.datum, null)],
      });
      toast({ title: 'Záznam smazán' });
      setPotvrdit(null);
      poZmene();
      zavri();
    } catch (e: any) {
      toast({ title: 'Smazání selhalo', description: e?.message ?? '', variant: 'destructive' });
    }
  }

  const pole = (label: string, hodnota: string, zmen: (v: string) => void, typ = 'text') => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type={typ} value={hodnota} onChange={(e) => zmen(e.target.value)} className="h-9" />
    </div>
  );

  return (
    <Dialog open={!!data} onOpenChange={(o) => { if (!o) { setUprava(null); setPotvrdit(null); zavri(); } }}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>{data ? celeJmeno(data.osoba) : ''}</DialogTitle>
          <DialogDescription>
            Všechny záznamy školení, zácviků a prohlídek, od nejnovějšího. Chybný záznam lze upravit nebo smazat.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto space-y-2">
          {(data?.zaznamy ?? []).length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">Zatím žádné záznamy.</p>
          ) : data?.zaznamy.map((u) => (
            <div key={u.id} className="rounded border p-3 text-sm space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">
                  {u.typ === 'prohlidka'
                    ? `${POPIS_DRUHU[u.druhProhlidky ?? 'periodicka']} prohlídka`
                    : u.typ === 'povereni'
                      ? `Pověření: ${u.temaNazev ?? ''}`
                      : `${u.vstupni ? 'Vstupní: ' : ''}${u.temaNazev ?? 'Školení'}`}
                </span>
                <span className="text-xs text-muted-foreground">{formatDatum(u.datum)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {u.datumDo ? `zácvik do ${formatDatum(u.datumDo)} · ` : ''}
                {u.datumPosudku ? `posudek ${formatDatum(u.datumPosudku)} · ` : ''}
                {u.zaver ? `${POPIS_ZAVERU[u.zaver]} · ` : ''}
                {u.provedl ?? ''}
              </p>
              {(u.platnostDo || u.cisloDokladu) && (
                <p className="text-[11px] text-amber-800">
                  {u.cisloDokladu ? `doklad č. ${u.cisloDokladu}` : 'doklad'}
                  {u.platnostDo ? ` · platí do ${formatDatum(u.platnostDo)}` : ''}
                </p>
              )}
              {u.poznamka && <p className="text-xs italic">{u.poznamka}</p>}
              {(u.log ?? []).length > 1 && (
                <div className="pt-1 border-t space-y-0.5">
                  {(u.log ?? []).map((z, i) => (
                    <p key={i} className="text-[10px] text-muted-foreground">
                      {formatDatum(z.kdy)} · {z.kdo} · {z.pole}
                      {z.puvodni ? `: ${formatDatum(z.puvodni)} → ${formatDatum(z.nova)}` : ''}
                    </p>
                  ))}
                </div>
              )}

              {uprava === u.id ? (
                <div className="grid gap-3 border-t pt-3 sm:grid-cols-2">
                  {pole(u.typ === 'prohlidka' ? 'Datum prohlídky' : u.typ === 'povereni' ? 'Pověřen od' : 'Datum školení', f.datum, (v) => setF({ ...f, datum: v }), 'date')}
                  {u.typ === 'skoleni' && pole('Ukončení zácviku', f.datumDo, (v) => setF({ ...f, datumDo: v }), 'date')}
                  {u.typ === 'prohlidka' && pole('Datum vydání posudku', f.datumPosudku, (v) => setF({ ...f, datumPosudku: v }), 'date')}
                  {(u.typ === 'povereni' || u.platnostDo || u.cisloDokladu) && pole('Platí do', f.platnostDo, (v) => setF({ ...f, platnostDo: v }), 'date')}
                  {(u.typ === 'skoleni' && (u.platnostDo || u.cisloDokladu)) && pole('Číslo dokladu', f.cisloDokladu, (v) => setF({ ...f, cisloDokladu: v }))}
                  {pole(u.typ === 'prohlidka' ? 'Poskytovatel PLS' : u.typ === 'povereni' ? 'Pověřil' : 'Lektor', f.provedl, (v) => setF({ ...f, provedl: v }))}
                  {pole('Poznámka', f.poznamka, (v) => setF({ ...f, poznamka: v }))}
                  {u.typ === 'skoleni' && (
                    <label className="flex items-center gap-2 text-xs sm:col-span-2">
                      <input type="checkbox" checked={f.vstupni} onChange={(e) => setF({ ...f, vstupni: e.target.checked })} />
                      Jde o vstupní školení (jinak periodické)
                    </label>
                  )}
                  <div className="flex justify-end gap-2 sm:col-span-2">
                    <Button size="sm" variant="ghost" onClick={() => setUprava(null)}>Zrušit</Button>
                    <Button size="sm" disabled={uklada || !f.datum} onClick={() => uloz(u)}>
                      {uklada && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                      Uložit
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-end gap-2 pt-1">
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => otevriUpravu(u)}>
                    Upravit
                  </Button>
                  {jeAdmin && (
                    <Button
                      size="sm" variant={potvrdit === u.id ? 'destructive' : 'ghost'}
                      className="h-7 text-xs" onClick={() => smaz(u)}
                    >
                      {potvrdit === u.id ? 'Opravdu smazat?' : 'Smazat'}
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
