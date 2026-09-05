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
import type { CiselnikCinnost, CiselnikKategorie } from '@/lib/cinnosti';
import { periodaProhlidky, jeNad50, popisPeriodyProhlidky } from '@/lib/cinnosti';
import type { Udalost, TypUdalosti, DruhProhlidky, ZaverProhlidky } from '@/lib/udalosti';
import {
  nactiUdalosti, posledni, dalsiTermin, formatDatum, stavTerminu,
  polozkaLogu, POPIS_ZAVERU, POPIS_DRUHU,
} from '@/lib/udalosti';

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
  const [udalosti, setUdalosti] = useState<Udalost[]>([]);
  const [nacitam, setNacitam] = useState(true);
  const [temaId, setTemaId] = useState<string>('');
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

  /** Řádky přehledu: osoba + poslední záznam + termín dalšího. */
  const radky = useMemo(() => {
    const tema = skoleni.find((s) => s.id === temaId);
    return osoby.map((o) => {
      const p = rezim === 'skoleni'
        ? posledni(udalosti, o.id, 'skoleni', temaId || null)
        : posledni(udalosti, o.id, 'prohlidka', null);
      const perioda = rezim === 'skoleni' ? (tema?.periodaMesice ?? 0) : (periodaOsoby(o) ?? 0);
      const dalsi = dalsiTermin(p, perioda);
      return { osoba: o, posledniZ: p, dalsi, perioda, povinne: rezim === 'skoleni' ? povinnaSkoleni(o).includes(temaId) : true };
    });
  }, [osoby, udalosti, rezim, temaId, skoleni, periodaOsoby, povinnaSkoleni]);

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
          <div className="grid gap-2 sm:grid-cols-[1fr_auto] items-end">
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
              radky={radky}
              poHotovo={nacti}
            />
          </div>

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
              <div className="grid grid-cols-[1.6fr_1fr_1fr_auto] gap-3 py-2 text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                <span>Osoba</span><span>Poslední</span><span>Termín dalšího</span><span />
              </div>
              {radky.map(({ osoba, posledniZ, dalsi, perioda, povinne }) => {
                const st = stavTerminu(dalsi);
                return (
                  <div key={osoba.id} className="grid grid-cols-[1.6fr_1fr_1fr_auto] gap-3 py-2.5 items-center">
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
                    <span className="text-xs">{formatDatum(posledniZ?.datum)}</span>
                    <span className={`text-xs ${BARVA[st]}`}>
                      {st === 'chybi' ? 'bez záznamu' : formatDatum(dalsi)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
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

      <DialogHistorie data={historie} zavri={() => setHistorie(null)} />
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
  klientId, rezim, tema, radky, poHotovo,
}: {
  klientId: string;
  rezim: 'skoleni' | 'prohlidka';
  tema?: CiselnikSkoleni;
  radky: Radek[];
  poHotovo: () => void;
}) {
  const { user } = useData();
  const { toast } = useToast();
  const [otevreno, setOtevreno] = useState(false);
  const [datum, setDatum] = useState(new Date().toISOString().split('T')[0]);
  const [datumDo, setDatumDo] = useState('');
  const [datumPosudku, setDatumPosudku] = useState('');
  const [druh, setDruh] = useState<DruhProhlidky>('periodicka');
  const [zaver, setZaver] = useState<ZaverProhlidky>('zpusobily');
  const [provedl, setProvedl] = useState('');
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
          datum: new Date(datum).toISOString(),
          datumDo: datumDo ? new Date(datumDo).toISOString() : null,
          datumPosudku: rezim === 'prohlidka' && datumPosudku
            ? new Date(datumPosudku).toISOString()
            : null,
          druhProhlidky: rezim === 'prohlidka' ? druh : null,
          zaver: rezim === 'prohlidka' ? zaver : null,
          platnostDo: null,
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

  const dostupni = radky.filter((r) => (rezim === 'skoleni' ? r.povinne : true));
  const blokovano = rezim === 'skoleni' && !tema;

  return (
    <Dialog open={otevreno} onOpenChange={setOtevreno}>
      <Button onClick={() => setOtevreno(true)} disabled={blokovano}>
        {rezim === 'skoleni'
          ? <><GraduationCap className="mr-2 h-4 w-4" /> Zapsat školení</>
          : <><Stethoscope className="mr-2 h-4 w-4" /> Zapsat prohlídku</>}
      </Button>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {rezim === 'skoleni' ? `Zápis školení — ${tema?.nazev ?? ''}` : 'Zápis lékařské prohlídky'}
          </DialogTitle>
          <DialogDescription>
            Vyber, komu termín končí do zvoleného data, uprav výběr a zapiš jedním datem všem najednou.
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
            <div className="grid gap-3 sm:grid-cols-[1fr_auto] items-end">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Vybrat všechny, komu termín končí do</Label>
                <Input type="date" value={doKdy} onChange={(e) => predvyber(e.target.value)} className="h-9" />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setVybrani(new Set(dostupni.map((r) => r.osoba.id)))}>
                  Vybrat vše
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setVybrani(new Set())}>
                  Zrušit výběr
                </Button>
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto rounded border bg-background divide-y">
              {dostupni.map((r) => {
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
                    <span className={BARVA[st]}>
                      {st === 'chybi' ? 'bez záznamu' : formatDatum(r.dalsi)}
                    </span>
                  </button>
                );
              })}
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
          <Button onClick={zapis} disabled={uklada || vybrani.size === 0}>
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
  data, zavri,
}: {
  data: { osoba: Osoba; zaznamy: Udalost[] } | null;
  zavri: () => void;
}) {
  return (
    <Dialog open={!!data} onOpenChange={(o) => !o && zavri()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{data ? celeJmeno(data.osoba) : ''}</DialogTitle>
          <DialogDescription>
            Všechny záznamy školení, zácviků a prohlídek, od nejnovějšího.
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
                    : (u.temaNazev ?? 'Školení')}
                </span>
                <span className="text-xs text-muted-foreground">{formatDatum(u.datum)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {u.datumDo ? `zácvik do ${formatDatum(u.datumDo)} · ` : ''}
                {u.datumPosudku ? `posudek ${formatDatum(u.datumPosudku)} · ` : ''}
                {u.zaver ? `${POPIS_ZAVERU[u.zaver]} · ` : ''}
                {u.provedl ?? ''}
              </p>
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
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
