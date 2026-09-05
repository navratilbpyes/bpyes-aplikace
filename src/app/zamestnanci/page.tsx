'use client';

/**
 * AuditFlow — Lidské zdroje: evidence osob napříč klienty.
 * Umístění: src/app/zamestnanci/page.tsx
 *
 * Admin vidí všechny klienty s filtrem, klient jen sebe.
 * Tři pohledy: Přehled (tabulka s filtry), Matice (osoby × činnosti), Pozice.
 *
 * Perioda prohlídky se nikdy neukládá — počítá se z kategorie pozice
 * a z činností osoby (nejkratší vyhrává), aby změna v číselníku
 * okamžitě platila pro všechny.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  collection, addDoc, updateDoc, doc, getDocs, query, where, writeBatch,
} from 'firebase/firestore';
import { db, useData } from '@/components/data-provider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Users, Plus, Loader2, Upload, X, Briefcase, Grid3x3, Stethoscope, Search,
  ChevronDown, ChevronRight,
} from 'lucide-react';
import type { Osoba, Pozice } from '@/lib/osoby';
import {
  celeJmeno, aktivniCinnosti, nactiOsoby, nactiPozice,
  parsujCsv, IMPORT_POLE, normalizujDatum,
} from '@/lib/osoby';
import type { CiselnikCinnost, CiselnikKategorie, KodKategorie, ZarazeniFaktoru } from '@/lib/cinnosti';
import EditorFaktoru from '@/components/ciselniky/editor-faktoru';
import type { CiselnikSkoleni } from '@/lib/skoleni';
import SekceUdalosti from '@/components/zamestnanci/sekce-udalosti';
import {
  periodaProhlidky, popisPeriodyProhlidky, jeNad50, maProfesniRiziko, nejvyssiKategorie,
} from '@/lib/cinnosti';

const KATEGORIE: KodKategorie[] = ['1', '2', '2R', '3', '4'];

/** Osoba obohacená o klienta — pro pohled napříč portfoliem. */
interface OsobaRadek extends Osoba {
  klientId: string;
  klientNazev: string;
}

export default function ZamestnanciPage() {
  const { klienti, userProfile } = useData();
  const { toast } = useToast();
  const isAdmin = userProfile?.role === 'admin';

  const [osoby, setOsoby] = useState<OsobaRadek[]>([]);
  const [pozice, setPozice] = useState<Record<string, Pozice[]>>({});
  const [cinnosti, setCinnosti] = useState<CiselnikCinnost[]>([]);
  const [kategorie, setKategorie] = useState<CiselnikKategorie[]>([]);
  const [skoleni, setSkoleni] = useState<CiselnikSkoleni[]>([]);
  const [nacitam, setNacitam] = useState(true);

  // filtry
  const [fKlient, setFKlient] = useState<string>(isAdmin ? 'vse' : (userProfile?.klientId ?? ''));
  const [fPozice, setFPozice] = useState('vse');
  const [fCinnost, setFCinnost] = useState('vse');
  const [hledani, setHledani] = useState('');

  const dostupniKlienti = useMemo(
    () => (isAdmin ? klienti : klienti.filter((k) => k.id === userProfile?.klientId)),
    [klienti, isAdmin, userProfile?.klientId],
  );

  const nacti = useCallback(async () => {
    if (dostupniKlienti.length === 0) { setNacitam(false); return; }
    setNacitam(true);
    try {
      const [snapC, snapK, snapS] = await Promise.all([
        getDocs(query(collection(db, 'ciselnikCinnosti'), where('stav', '==', 'aktivni'))),
        getDocs(collection(db, 'ciselnikKategorii')),
        getDocs(query(collection(db, 'ciselnikSkoleni'), where('stav', '==', 'aktivni'))),
      ]);
      setSkoleni(
        snapS.docs.map((d) => ({ id: d.id, ...d.data() }) as CiselnikSkoleni)
          .sort((a, b) => a.nazev.localeCompare(b.nazev, 'cs')),
      );
      setCinnosti(
        snapC.docs.map((d) => ({ id: d.id, ...d.data() }) as CiselnikCinnost)
          .sort((a, b) => a.nazev.localeCompare(b.nazev, 'cs')),
      );
      setKategorie(snapK.docs.map((d) => ({ id: d.id, ...d.data() }) as CiselnikKategorie));

      const davky = await Promise.all(
        dostupniKlienti.map(async (k) => ({
          klient: k,
          osoby: await nactiOsoby(k.id),
          pozice: await nactiPozice(k.id),
        })),
      );
      setOsoby(
        davky.flatMap((d) =>
          d.osoby.map((o) => ({ ...o, klientId: d.klient.id, klientNazev: d.klient.nazev })),
        ).sort((a, b) => celeJmeno(a).localeCompare(celeJmeno(b), 'cs')),
      );
      setPozice(Object.fromEntries(davky.map((d) => [d.klient.id, d.pozice])));
    } catch (e) {
      console.error('Načtení osob selhalo:', e);
      toast({ title: 'Načtení selhalo', variant: 'destructive' });
    } finally {
      setNacitam(false);
    }
  }, [dostupniKlienti, toast]);

  useEffect(() => { nacti(); }, [nacti]);

  const cinnostiMap = useMemo(
    () => Object.fromEntries(cinnosti.map((c) => [c.id, c])),
    [cinnosti],
  );

  /** Kategorie a perioda prohlídky se počítají, neukládají. */
  function vypocet(o: OsobaRadek) {
    const poz = (pozice[o.klientId] ?? []).find((p) => p.id === o.poziceId);
    const jejiCinnosti = aktivniCinnosti(o)
      .map((p) => {
        const c = cinnostiMap[p.cinnostId];
        if (!c) return null;
        // override profesního rizika u konkrétní osoby (např. práce pod napětím)
        return p.profesniRizikoOverride === null || p.profesniRizikoOverride === undefined
          ? c
          : { ...c, profesniRiziko: p.profesniRizikoOverride };
      })
      .filter((c): c is CiselnikCinnost => !!c);
    const nad50 = o.datumNarozeni ? jeNad50(o.datumNarozeni, new Date().toISOString()) : false;
    // Kategorie = nejvyšší ze všech faktorů pozice i činností; starší souhrnná
    // hodnota na pozici slouží jako fallback, dokud nejsou faktory vyplněné.
    const zFaktoru = nejvyssiKategorie(poz?.faktory, ...jejiCinnosti.map((c) => c.faktory));
    const vysledna = zFaktoru ?? poz?.kategorie ?? null;
    const kat = kategorie.find((k) => k.kod === vysledna);
    return {
      pozice: poz,
      kategorie: vysledna,
      cinnosti: jejiCinnosti,
      perioda: periodaProhlidky(kat, jejiCinnosti, nad50),
      profesniRiziko: maProfesniRiziko(jejiCinnosti),
      nad50,
    };
  }

  const filtrovane = useMemo(() => {
    const q = hledani.trim().toLowerCase();
    return osoby.filter((o) => {
      if (fKlient !== 'vse' && o.klientId !== fKlient) return false;
      if (fPozice !== 'vse' && o.poziceId !== fPozice) return false;
      if (fCinnost !== 'vse') {
        if (fCinnost === '__zadna__') {
          if (aktivniCinnosti(o).length > 0) return false;
        } else if (!aktivniCinnosti(o).some((p) => p.cinnostId === fCinnost)) return false;
      }
      if (q && !celeJmeno(o).toLowerCase().includes(q) && !(o.osobniCislo ?? '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [osoby, fKlient, fPozice, fCinnost, hledani]);

  const vybranyKlient = fKlient !== 'vse' ? fKlient : null;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-7 w-7 text-blue-600" /> Lidské zdroje
          </h1>
          <p className="text-sm text-muted-foreground">
            Evidence osob, pozic a činností. Z činností vyplývají povinná školení,
            zácviky a periody lékařských prohlídek.
          </p>
        </div>
        <div className="flex gap-2">
          <DialogImport
            klientId={vybranyKlient}
            pozice={vybranyKlient ? pozice[vybranyKlient] ?? [] : []}
            poHotovo={nacti}
          />
          <DialogNovaOsoba
            klientId={vybranyKlient}
            pozice={vybranyKlient ? pozice[vybranyKlient] ?? [] : []}
            poHotovo={nacti}
          />
        </div>
      </div>

      <Tabs defaultValue="prehled" className="space-y-6">
        <TabsList className="w-full justify-start h-auto p-1 bg-secondary">
          <TabsTrigger value="prehled" className="px-6 py-2">
            <Users className="mr-2 h-4 w-4" /> Přehled
          </TabsTrigger>
          <TabsTrigger value="matice" className="px-6 py-2">
            <Grid3x3 className="mr-2 h-4 w-4" /> Matice činností
          </TabsTrigger>
          <TabsTrigger value="pozice" className="px-6 py-2">
            <Briefcase className="mr-2 h-4 w-4" /> Pozice
          </TabsTrigger>
          <TabsTrigger value="udalosti" className="px-6 py-2">
            <Stethoscope className="mr-2 h-4 w-4" /> Školení a prohlídky
          </TabsTrigger>
        </TabsList>

        {/* ─── filtry ─── */}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {isAdmin && (
            <div className="space-y-1">
              <Label className="text-xs">Klient</Label>
              <Select value={fKlient} onValueChange={(v) => { setFKlient(v); setFPozice('vse'); }}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="vse">Všichni klienti</SelectItem>
                  {dostupniKlienti.map((k) => (
                    <SelectItem key={k.id} value={k.id}>{k.nazev}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1">
            <Label className="text-xs">Pozice</Label>
            <Select value={fPozice} onValueChange={setFPozice} disabled={!vybranyKlient}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder={vybranyKlient ? 'Všechny' : 'nejdřív vyber klienta'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vse">Všechny pozice</SelectItem>
                {(vybranyKlient ? pozice[vybranyKlient] ?? [] : []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.nazev}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Činnost</Label>
            <Select value={fCinnost} onValueChange={setFCinnost}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="vse">Všechny činnosti</SelectItem>
                <SelectItem value="__zadna__">— bez přiřazené činnosti —</SelectItem>
                {cinnosti.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nazev}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Hledat</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={hledani}
                onChange={(e) => setHledani(e.target.value)}
                placeholder="jméno nebo osobní číslo"
                className="h-9 pl-8"
              />
            </div>
          </div>
        </div>

        <TabsContent value="prehled">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {filtrovane.length} {filtrovane.length === 1 ? 'osoba' : filtrovane.length < 5 ? 'osoby' : 'osob'}
              </CardTitle>
              <CardDescription>
                Kategorie a perioda prohlídky se počítají z pozice a činností — nejkratší lhůta vyhrává.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {nacitam ? (
                <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Načítám…
                </div>
              ) : filtrovane.length === 0 ? (
                <div className="py-10 text-center space-y-2">
                  <p className="text-sm font-medium">Zatím tu nikdo není.</p>
                  <p className="text-xs text-muted-foreground max-w-md mx-auto">
                    Vyber klienta a nahraj seznam zaměstnanců z CSV, nebo přidej první osobu ručně.
                    Bez osob se nedají evidovat školení ani prohlídky.
                  </p>
                </div>
              ) : (
                <div className="divide-y border-t text-sm">
                  {filtrovane.map((o) => {
                    const v = vypocet(o);
                    return (
                      <div key={`${o.klientId}-${o.id}`} className="grid gap-2 py-3 md:grid-cols-[1.4fr_1fr_2fr_auto] items-start">
                        <div>
                          <p className="font-bold">{celeJmeno(o)}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {isAdmin && fKlient === 'vse' ? `${o.klientNazev} · ` : ''}
                            {o.osobniCislo ? `os. č. ${o.osobniCislo}` : ''}
                            {v.nad50 ? ' · nad 50 let' : ''}
                          </p>
                        </div>
                        <div className="text-xs">
                          <p className="font-medium">{v.pozice?.nazev ?? '—'}</p>
                          {v.pozice?.jeVedouci && (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">vedoucí</span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {v.cinnosti.length === 0 ? (
                            <span className="text-xs text-muted-foreground italic">bez činností</span>
                          ) : v.cinnosti.map((c) => (
                            <span
                              key={c.id}
                              className={`rounded px-1.5 py-0.5 text-[11px] ${c.profesniRiziko ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-700'}`}
                            >
                              {c.nazev}
                            </span>
                          ))}
                        </div>
                        <div className="text-right text-xs whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5 font-medium">
                            <Stethoscope className="h-3.5 w-3.5 text-slate-400" />
                            {popisPeriodyProhlidky(v.perioda)}
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            kat. {v.kategorie ?? '—'}{v.profesniRiziko ? ' · profesní riziko' : ''}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="matice">
          <Matice
            klientId={vybranyKlient}
            osoby={filtrovane}
            cinnosti={cinnosti}
            poZmene={nacti}
          />
        </TabsContent>

        <TabsContent value="udalosti">
          <SekceUdalosti
            klientId={vybranyKlient}
            osoby={filtrovane}
            skoleni={skoleni}
            cinnosti={cinnosti}
            kategorie={kategorie}
            poziceKategorie={Object.fromEntries(
              filtrovane.map((o) => [o.id, vypocet(o).kategorie]),
            )}
          />
        </TabsContent>

        <TabsContent value="pozice">
          <SekcePozice
            klientId={vybranyKlient}
            pozice={vybranyKlient ? pozice[vybranyKlient] ?? [] : []}
            cinnosti={cinnosti}
            osoby={osoby.filter((o) => o.klientId === vybranyKlient)}
            poZmene={nacti}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ─────────────────────────  MATICE  ───────────────────────── */

function Matice({
  klientId, osoby, cinnosti, poZmene,
}: {
  klientId: string | null;
  osoby: OsobaRadek[];
  cinnosti: CiselnikCinnost[];
  poZmene: () => void;
}) {
  const [uklada, setUklada] = useState<string | null>(null);
  const [lokalni, setLokalni] = useState<Record<string, string[]>>({});

  useEffect(() => {
    setLokalni(Object.fromEntries(
      osoby.map((o) => [o.id, aktivniCinnosti(o).map((p) => p.cinnostId)]),
    ));
  }, [osoby]);

  if (!klientId) {
    return (
      <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
        Matice se zobrazí po výběru konkrétního klienta.
      </CardContent></Card>
    );
  }

  async function prepni(o: OsobaRadek, cinnostId: string) {
    const klic = `${o.id}-${cinnostId}`;
    setUklada(klic);
    const stavajici = o.cinnosti ?? [];
    const aktivni = aktivniCinnosti(o).some((p) => p.cinnostId === cinnostId);
    const dnes = new Date().toISOString();

    // Odebrání = ukončení k dnešku, ne smazání — historie povinností musí zůstat.
    const nove = aktivni
      ? stavajici.map((p) => (p.cinnostId === cinnostId && !p.do ? { ...p, do: dnes } : p))
      : [...stavajici, { cinnostId, od: dnes, do: null, profesniRizikoOverride: null }];

    setLokalni((prev) => ({
      ...prev,
      [o.id]: aktivni
        ? (prev[o.id] ?? []).filter((x) => x !== cinnostId)
        : [...(prev[o.id] ?? []), cinnostId],
    }));

    try {
      await updateDoc(doc(db, 'klienti', o.klientId, 'osoby', o.id), { cinnosti: nove });
      o.cinnosti = nove;
    } catch (e) {
      console.error('Uložení činnosti selhalo:', e);
      poZmene();
    } finally {
      setUklada(null);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Matice činností</CardTitle>
        <CardDescription>
          Klikni do mřížky. Odebrání činnost ukončí k dnešku, nesmaže ji — historie zůstává.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {osoby.length === 0 || cinnosti.length === 0 ? (
          <p className="py-8 text-sm text-muted-foreground">
            {cinnosti.length === 0 ? 'Číselník činností je prázdný.' : 'Žádné osoby k zobrazení.'}
          </p>
        ) : (
          <table className="text-xs border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 bg-background text-left p-2 border-b min-w-[180px]">Osoba</th>
                {cinnosti.map((c) => (
                  <th key={c.id} className="border-b p-1 align-bottom">
                    <div className="h-32 w-8 flex items-end justify-center">
                      <span
                        className="whitespace-nowrap text-[11px] font-medium"
                        style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                      >
                        {c.nazev}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {osoby.map((o) => (
                <tr key={o.id} className="hover:bg-muted/40">
                  <td className="sticky left-0 bg-background p-2 border-b font-medium whitespace-nowrap">
                    {celeJmeno(o)}
                  </td>
                  {cinnosti.map((c) => {
                    const ma = (lokalni[o.id] ?? []).includes(c.id);
                    const klic = `${o.id}-${c.id}`;
                    return (
                      <td key={c.id} className="border-b p-0 text-center">
                        <button
                          type="button"
                          onClick={() => prepni(o, c.id)}
                          disabled={uklada === klic}
                          className="h-9 w-8 flex items-center justify-center hover:bg-blue-50"
                          title={`${celeJmeno(o)} — ${c.nazev}`}
                        >
                          <span className={`h-4 w-4 rounded border ${ma ? 'border-blue-600 bg-blue-600' : 'border-slate-300'}`} />
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

/* ─────────────────────────  POZICE  ───────────────────────── */

function SekcePozice({
  klientId, pozice, cinnosti, osoby, poZmene,
}: {
  klientId: string | null;
  pozice: Pozice[];
  cinnosti: CiselnikCinnost[];
  osoby: OsobaRadek[];
  poZmene: () => void;
}) {
  const { toast } = useToast();
  const [nazev, setNazev] = useState('');
  const [otevrena, setOtevrena] = useState<string | null>(null);
  const [aplikuje, setAplikuje] = useState<string | null>(null);

  if (!klientId) {
    return (
      <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
        Pozice se spravují po výběru konkrétního klienta.
      </CardContent></Card>
    );
  }

  async function pridej() {
    if (!nazev.trim() || !klientId) return;
    await addDoc(collection(db, 'klienti', klientId, 'pozice'), {
      nazev: nazev.trim(), jeVedouci: false, kategorie: null, stav: 'aktivni',
    });
    setNazev('');
    poZmene();
  }

  async function uprav(id: string, zmeny: Partial<Pozice>) {
    if (!klientId) return;
    await updateDoc(doc(db, 'klienti', klientId, 'pozice', id), zmeny as any);
    poZmene();
  }

  function prepniVychozi(p: Pozice, cinnostId: string) {
    const stav = p.vychoziCinnosti ?? [];
    uprav(p.id, {
      vychoziCinnosti: stav.includes(cinnostId)
        ? stav.filter((x) => x !== cinnostId)
        : [...stav, cinnostId],
    });
  }

  /**
   * Doplní výchozí činnosti stávajícím osobám na pozici.
   * Nikdy nic neodebírá — jen přidává, co osobě chybí.
   */
  async function aplikujNaStavajici(p: Pozice) {
    if (!klientId) return;
    const sada = p.vychoziCinnosti ?? [];
    if (sada.length === 0) return;
    setAplikuje(p.id);
    try {
      const dnes = new Date().toISOString();
      const dotcene = osoby.filter((o) => o.poziceId === p.id);
      let zmeneno = 0;
      for (const o of dotcene) {
        const maAktivni = aktivniCinnosti(o).map((x) => x.cinnostId);
        const chybi = sada.filter((id) => !maAktivni.includes(id));
        if (chybi.length === 0) continue;
        await updateDoc(doc(db, 'klienti', klientId, 'osoby', o.id), {
          cinnosti: [
            ...(o.cinnosti ?? []),
            ...chybi.map((id) => ({ cinnostId: id, od: dnes, do: null, profesniRizikoOverride: null })),
          ],
        });
        zmeneno += 1;
      }
      toast({
        title: zmeneno > 0 ? `Doplněno u ${zmeneno} osob` : 'Nebylo co doplnit',
        description: `Pozice ${p.nazev} — ${dotcene.length} osob na pozici.`,
      });
      poZmene();
    } catch (e: any) {
      toast({ title: 'Doplnění selhalo', description: e?.message ?? '', variant: 'destructive' });
    } finally {
      setAplikuje(null);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Pracovní pozice</CardTitle>
        <CardDescription>
          Kategorie práce určuje periodu prohlídky. „Vedoucí" je atribut pozice —
          z něj plynou školení vedoucích zaměstnanců dle § 103 ZP.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-[1fr_auto] items-end">
          <div className="space-y-1">
            <Label className="text-xs">Název pozice</Label>
            <Input
              value={nazev}
              onChange={(e) => setNazev(e.target.value)}
              placeholder="např. Údržbář"
              onKeyDown={(e) => e.key === 'Enter' && pridej()}
            />
          </div>
          <Button onClick={pridej} disabled={!nazev.trim()}>
            <Plus className="mr-2 h-4 w-4" /> Přidat
          </Button>
        </div>

        {pozice.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">
            Zatím žádné pozice. Bez nich nelze určit kategorii práce.
          </p>
        ) : (
          <div className="divide-y border-t">
            {pozice.map((p) => (
              <div key={p.id} className="py-3 space-y-3">
              <div className="grid gap-3 sm:grid-cols-[auto_1fr_140px_180px_auto] items-center">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => setOtevrena(otevrena === p.id ? null : p.id)}
                  title="Výchozí činnosti"
                >
                  {otevrena === p.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
                <Input
                  value={p.nazev}
                  onChange={(e) => uprav(p.id, { nazev: e.target.value })}
                  className="h-9"
                />
                <Select
                  value={p.kategorie ?? '__zadna__'}
                  onValueChange={(v) => uprav(p.id, { kategorie: v === '__zadna__' ? null : (v as KodKategorie) })}
                >
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Kategorie…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__zadna__">— nezařazeno —</SelectItem>
                    {KATEGORIE.map((k) => (
                      <SelectItem key={k} value={k}>Kategorie {k}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={!!p.jeVedouci}
                    onCheckedChange={(v) => uprav(p.id, { jeVedouci: v })}
                  />
                  <span className="text-xs text-muted-foreground">vedoucí zaměstnanec</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => uprav(p.id, { stav: 'smazano' })}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {otevrena === p.id && (
                <div className="ml-10 rounded-lg border bg-muted/20 p-4 space-y-4">
                  <div className="rounded border bg-background px-3 py-3">
                    <EditorFaktoru
                      faktory={p.faktory}
                      onZmena={(nove) => uprav(p.id, { faktory: nove })}
                      popis="Faktory prostředí na této pozici. K nim se přičtou faktory z činností osoby."
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">Výchozí činnosti pozice</Label>
                    <p className="text-[11px] text-muted-foreground">
                      Nové osobě na této pozici se přiřadí samy. Např. svářeč = svařování + jeřábník + vazač.
                    </p>
                  </div>
                  {cinnosti.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Číselník činností je prázdný.</p>
                  ) : (
                    <div className="max-h-56 overflow-y-auto rounded border bg-background divide-y">
                      {cinnosti.map((c) => {
                        const vybrano = (p.vychoziCinnosti ?? []).includes(c.id);
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => prepniVychozi(p, c.id)}
                            className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-muted ${vybrano ? 'bg-blue-50/60 font-medium' : ''}`}
                          >
                            <span className={`h-3.5 w-3.5 shrink-0 rounded border ${vybrano ? 'border-blue-600 bg-blue-600' : 'border-slate-300'}`} />
                            <span className="flex-1">{c.nazev}</span>
                            {c.profesniRiziko && (
                              <span className="text-[10px] text-amber-700">profesní riziko</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <div className="flex items-center gap-3 flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={aplikuje === p.id || (p.vychoziCinnosti ?? []).length === 0}
                      onClick={() => aplikujNaStavajici(p)}
                    >
                      {aplikuje === p.id && <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />}
                      Doplnit stávajícím osobám
                    </Button>
                    <span className="text-[11px] text-muted-foreground">
                      {osoby.filter((o) => o.poziceId === p.id).length} osob na pozici · pouze přidává, nic neodebírá
                    </span>
                  </div>
                </div>
              )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ─────────────────────────  NOVÁ OSOBA  ───────────────────────── */

function DialogNovaOsoba({
  klientId, pozice, poHotovo,
}: {
  klientId: string | null;
  pozice: Pozice[];
  poHotovo: () => void;
}) {
  const { toast } = useToast();
  const [otevreno, setOtevreno] = useState(false);
  const [f, setF] = useState({ jmeno: '', prijmeni: '', datumNarozeni: '', osobniCislo: '', poziceId: '', datumNastupu: '' });
  const [uklada, setUklada] = useState(false);

  async function uloz() {
    if (!klientId || !f.prijmeni.trim()) return;
    setUklada(true);
    try {
      await addDoc(collection(db, 'klienti', klientId, 'osoby'), {
        jmeno: f.jmeno.trim(),
        prijmeni: f.prijmeni.trim(),
        datumNarozeni: f.datumNarozeni ? new Date(f.datumNarozeni).toISOString() : null,
        osobniCislo: f.osobniCislo.trim() || null,
        poziceId: f.poziceId || null,
        datumNastupu: f.datumNastupu ? new Date(f.datumNastupu).toISOString() : null,
        cinnosti: pozice.find((p) => p.id === f.poziceId)?.vychoziCinnosti?.map((id) => ({
          cinnostId: id, od: new Date().toISOString(), do: null, profesniRizikoOverride: null,
        })) ?? [],
        stav: 'aktivni',
      });
      setF({ jmeno: '', prijmeni: '', datumNarozeni: '', osobniCislo: '', poziceId: '', datumNastupu: '' });
      setOtevreno(false);
      poHotovo();
      toast({ title: 'Osoba přidána' });
    } catch (e: any) {
      toast({ title: 'Uložení selhalo', description: e?.message ?? '', variant: 'destructive' });
    } finally {
      setUklada(false);
    }
  }

  return (
    <Dialog open={otevreno} onOpenChange={setOtevreno}>
      <Button onClick={() => setOtevreno(true)} disabled={!klientId}>
        <Plus className="mr-2 h-4 w-4" /> Přidat osobu
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nová osoba</DialogTitle>
          <DialogDescription>
            Datum narození je nutné pro periodu prohlídky (hranice 50 let) a pro formulář F006.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Příjmení</Label>
              <Input value={f.prijmeni} onChange={(e) => setF({ ...f, prijmeni: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Jméno</Label>
              <Input value={f.jmeno} onChange={(e) => setF({ ...f, jmeno: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Datum narození</Label>
              <Input type="date" value={f.datumNarozeni} onChange={(e) => setF({ ...f, datumNarozeni: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Osobní číslo</Label>
              <Input value={f.osobniCislo} onChange={(e) => setF({ ...f, osobniCislo: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Pozice</Label>
              <Select value={f.poziceId} onValueChange={(v) => setF({ ...f, poziceId: v })}>
                <SelectTrigger><SelectValue placeholder="vyber…" /></SelectTrigger>
                <SelectContent>
                  {pozice.map((p) => <SelectItem key={p.id} value={p.id}>{p.nazev}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Datum nástupu</Label>
              <Input type="date" value={f.datumNastupu} onChange={(e) => setF({ ...f, datumNastupu: e.target.value })} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOtevreno(false)}>Zrušit</Button>
          <Button onClick={uloz} disabled={uklada || !f.prijmeni.trim()}>
            {uklada && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Uložit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────────────────  IMPORT CSV  ───────────────────────── */

function DialogImport({
  klientId, pozice, poHotovo,
}: {
  klientId: string | null;
  pozice: Pozice[];
  poHotovo: () => void;
}) {
  const { toast } = useToast();
  const [otevreno, setOtevreno] = useState(false);
  const [hlavicka, setHlavicka] = useState<string[]>([]);
  const [radky, setRadky] = useState<string[][]>([]);
  const [mapovani, setMapovani] = useState<Record<string, number>>({});
  const [uklada, setUklada] = useState(false);

  function nacti(soubor: File) {
    const r = new FileReader();
    r.onload = () => {
      const { hlavicka: h, radky: rd } = parsujCsv(String(r.result));
      setHlavicka(h);
      setRadky(rd);
      // předvyplní mapování podle názvu sloupce
      const auto: Record<string, number> = {};
      IMPORT_POLE.forEach((p) => {
        const i = h.findIndex((s) => s.toLowerCase().includes(p.popis.toLowerCase().split(' ')[0]));
        if (i >= 0) auto[p.klic] = i;
      });
      setMapovani(auto);
    };
    r.readAsText(soubor, 'utf-8');
  }

  async function importuj() {
    if (!klientId) return;
    setUklada(true);
    try {
      const davka = writeBatch(db);
      let n = 0;
      for (const r of radky) {
        const hod = (klic: string) => {
          const i = mapovani[klic];
          return i === undefined ? '' : (r[i] ?? '').trim();
        };
        const prijmeni = hod('prijmeni');
        if (!prijmeni) continue;
        const nazevPozice = hod('poziceNazev');
        const poz = pozice.find((p) => p.nazev.toLowerCase() === nazevPozice.toLowerCase());
        davka.set(doc(collection(db, 'klienti', klientId, 'osoby')), {
          prijmeni,
          jmeno: hod('jmeno'),
          datumNarozeni: normalizujDatum(hod('datumNarozeni')),
          osobniCislo: hod('osobniCislo') || null,
          poziceId: poz?.id ?? null,
          datumNastupu: normalizujDatum(hod('datumNastupu')),
          cinnosti: [],
          stav: 'aktivni',
        });
        n += 1;
      }
      await davka.commit();
      toast({ title: `Naimportováno ${n} osob` });
      setOtevreno(false);
      setHlavicka([]); setRadky([]); setMapovani({});
      poHotovo();
    } catch (e: any) {
      toast({ title: 'Import selhal', description: e?.message ?? '', variant: 'destructive' });
    } finally {
      setUklada(false);
    }
  }

  const chybiPozice = radky.length > 0 && mapovani.poziceNazev !== undefined
    && radky.some((r) => {
      const n = (r[mapovani.poziceNazev] ?? '').trim();
      return n && !pozice.some((p) => p.nazev.toLowerCase() === n.toLowerCase());
    });

  return (
    <Dialog open={otevreno} onOpenChange={setOtevreno}>
      <Button variant="outline" onClick={() => setOtevreno(true)} disabled={!klientId}>
        <Upload className="mr-2 h-4 w-4" /> Import CSV
      </Button>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import osob z CSV</DialogTitle>
          <DialogDescription>
            Soubor s hlavičkou, oddělovač středník nebo čárka. Sloupce si přiřadíš níže.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) nacti(f); }}
          />

          {hlavicka.length > 0 && (
            <>
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Přiřazení sloupců</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {IMPORT_POLE.map((p) => (
                    <div key={p.klic} className="grid grid-cols-[110px_1fr] items-center gap-2">
                      <span className="text-xs">
                        {p.popis}{p.povinne && <span className="text-red-600"> *</span>}
                      </span>
                      <Select
                        value={mapovani[p.klic] !== undefined ? String(mapovani[p.klic]) : '__zadny__'}
                        onValueChange={(v) => setMapovani((m) => {
                          const kopie = { ...m };
                          if (v === '__zadny__') delete kopie[p.klic];
                          else kopie[p.klic] = Number(v);
                          return kopie;
                        })}
                      >
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__zadny__">— nepoužít —</SelectItem>
                          {hlavicka.map((h, i) => (
                            <SelectItem key={i} value={String(i)}>{h || `sloupec ${i + 1}`}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded border bg-muted/30 p-3 text-xs space-y-1">
                <p className="font-medium">Náhled: {radky.length} řádků</p>
                {radky.slice(0, 3).map((r, i) => (
                  <p key={i} className="text-muted-foreground truncate">
                    {(r[mapovani.prijmeni] ?? '?')} {(r[mapovani.jmeno] ?? '')}
                    {mapovani.poziceNazev !== undefined ? ` · ${r[mapovani.poziceNazev] ?? ''}` : ''}
                  </p>
                ))}
              </div>

              {chybiPozice && (
                <p className="text-xs text-amber-700 bg-amber-50 rounded p-2">
                  Některé pozice v souboru u klienta neexistují — osoby se založí bez pozice.
                  Založ pozice napřed, nebo je doplň potom.
                </p>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOtevreno(false)}>Zrušit</Button>
          <Button
            onClick={importuj}
            disabled={uklada || radky.length === 0 || mapovani.prijmeni === undefined}
          >
            {uklada && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Importovat {radky.length > 0 ? `(${radky.length})` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
