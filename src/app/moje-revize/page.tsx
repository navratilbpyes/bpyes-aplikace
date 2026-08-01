'use client';

/**
 * AuditFlow — klientská správa revizí a školení.
 * Umístění: src/app/moje-revize/page.tsx
 *
 * Klient si sám zakládá a upravuje VLASTNÍ revize a školení
 * (Firestore: klienti/{klientId}/revize a /skoleni).
 *
 * Pravidla (viz firestore.rules):
 *  - klient smí přidat záznam se zadal='klient', potvrzenoOzo=false, stav='aktivni'
 *  - klient smí upravit jen záznam, který sám zadal (zadal=='klient')
 *  - klient nesmí mazat ani nastavit potvrzenoOzo=true
 *  - záznamy zadané OZO (zadal=='ozo' nebo chybí) vidí jen ke čtení
 *
 * Štítek „Čeká na potvrzení OZO" má evidenční váhu — technik ho odklikne
 * v adminní kartě klienta.
 */

import { useEffect, useMemo, useState, useCallback } from 'react';
import { db, useData } from '@/components/data-provider';
import {
  collection, addDoc, updateDoc, doc, getDocs, query, where,
} from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Loader2, Plus, ShieldCheck, Clock, ChevronDown, ChevronUp, Wrench, GraduationCap,
} from 'lucide-react';
import { cn } from '@/app/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  PERIODY, popisPeriody, dopocitejDalsi, platnyTermin,
} from '@/lib/revize';
import type { RevizeKlienta } from '@/lib/revize';
import type { SkoleniKlienta } from '@/lib/skoleni';
import VlaknoKomentaru from '@/components/komentare/vlakno';

type Druh = 'revize' | 'skoleni';

// Sjednocený tvar pro UI (revize i školení mají stejná časová pole).
type Polozka = (RevizeKlienta | SkoleniKlienta) & {
  zadal?: 'ozo' | 'klient';
  potvrzenoOzo?: boolean;
};

interface CiselnikPolozka {
  id: string;
  nazev: string;
  periodaMesice: number;
}

export default function MojeRevizePage() {
  const { userProfile, authLoading } = useData();
  const klientId = userProfile?.klientId;
  const { toast } = useToast();

  const [druh, setDruh] = useState<Druh>('revize');
  const [seznam, setSeznam] = useState<Polozka[]>([]);
  const [ciselnik, setCiselnik] = useState<CiselnikPolozka[]>([]);
  const [nacitam, setNacitam] = useState(true);
  const [vybrane, setVybrane] = useState('');
  const [uklada, setUklada] = useState(false);
  const [rozbaleno, setRozbaleno] = useState<string | null>(null);

  const cesta = useCallback(
    () => collection(db, 'klienti', klientId!, druh),
    [klientId, druh],
  );

  const ciselnikKolekce = druh === 'revize' ? 'ciselnikRevizi' : 'ciselnikSkoleni';

  const nacti = useCallback(async () => {
    if (!klientId) { setNacitam(false); return; }
    setNacitam(true);
    try {
      const [zSnap, cSnap] = await Promise.all([
        getDocs(cesta()),
        getDocs(query(collection(db, ciselnikKolekce), where('stav', '==', 'aktivni'))),
      ]);
      const zaznamy = zSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as Polozka)
        .filter((z) => z.stav !== 'smazano');
      // řazení: nejdřív nepotvrzené klientovy, pak podle názvu
      zaznamy.sort((a, b) => a.nazev.localeCompare(b.nazev, 'cs'));
      setSeznam(zaznamy);
      setCiselnik(
        cSnap.docs.map((d) => {
          const f = d.data();
          return { id: d.id, nazev: f.nazev, periodaMesice: f.periodaMesice };
        }),
      );
    } catch (e) {
      console.error('Načtení selhalo:', e);
      toast({ title: 'Načtení selhalo', description: 'Zkuste to prosím znovu.', variant: 'destructive' });
    } finally {
      setNacitam(false);
    }
  }, [klientId, cesta, ciselnikKolekce, toast]);

  useEffect(() => { nacti(); }, [nacti]);

  // --- přidání z číselníku ---
  async function pridejZCiselniku() {
    if (!vybrane || uklada) return;
    const zdroj = ciselnik.find((c) => c.id === vybrane);
    if (!zdroj) return;
    setUklada(true);
    try {
      await addDoc(cesta(), {
        ciselnikId: zdroj.id,
        nazev: zdroj.nazev,
        periodaMesice: zdroj.periodaMesice,
        ...(druh === 'revize'
          ? { firmaNazev: null, firmaTelefon: null, firmaEmail: null, cisloProtokolu: null }
          : { provadi: null }),
        poznamka: null,
        posledniIso: null,
        dalsiIso: null,
        dalsiRucne: false,
        stav: 'aktivni',
        zadal: 'klient',
        potvrzenoOzo: false,
      });
      setVybrane('');
      await nacti();
      toast({ title: 'Přidáno', description: `${zdroj.nazev} — čeká na potvrzení OZO.` });
    } catch (e) {
      console.error(e);
      toast({ title: 'Nepodařilo se přidat', description: 'Zkuste to znovu.', variant: 'destructive' });
    } finally {
      setUklada(false);
    }
  }

  // --- přidání vlastního ---
  async function pridejVlastni() {
    if (uklada) return;
    setUklada(true);
    try {
      const ref = await addDoc(cesta(), {
        ciselnikId: null,
        nazev: druh === 'revize' ? 'Nová revize' : 'Nové školení',
        periodaMesice: 12,
        ...(druh === 'revize'
          ? { firmaNazev: null, firmaTelefon: null, firmaEmail: null, cisloProtokolu: null }
          : { provadi: null }),
        poznamka: null,
        posledniIso: null,
        dalsiIso: null,
        dalsiRucne: false,
        stav: 'aktivni',
        zadal: 'klient',
        potvrzenoOzo: false,
      });
      await nacti();
      setRozbaleno(ref.id);
    } catch (e) {
      console.error(e);
      toast({ title: 'Nepodařilo se přidat', description: 'Zkuste to znovu.', variant: 'destructive' });
    } finally {
      setUklada(false);
    }
  }

  // --- úprava vlastního záznamu ---
  async function uprav(id: string, zmeny: Partial<Polozka>) {
    setSeznam((p) => p.map((r) => (r.id === id ? { ...r, ...zmeny } : r)));
    try {
      const cistec = Object.fromEntries(
        Object.entries(zmeny).map(([k, v]) => [k, v === undefined || v === '' ? null : v]),
      );
      await updateDoc(doc(db, 'klienti', klientId!, druh, id), cistec);
    } catch (e) {
      console.error('Uložení změny selhalo:', e);
      toast({
        title: 'Změnu nelze uložit',
        description: 'Upravovat lze jen záznamy, které jste zadali vy.',
        variant: 'destructive',
      });
      nacti(); // vrátí UI do stavu z DB
    }
  }

  if (authLoading || nacitam) {
    return (
      <div className="p-8 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Načítám…
      </div>
    );
  }

  if (!klientId) {
    return (
      <div className="p-8 text-muted-foreground">
        Účet nemá přiřazenou firmu. Kontaktujte svého technika BOZP/PO.
      </div>
    );
  }

  const Ikona = druh === 'revize' ? Wrench : GraduationCap;

  return (
    <div className="max-w-4xl mx-auto p-6 md:p-8 space-y-6">
      <header>
        <h1 className="text-3xl font-black tracking-tight">Moje revize a školení</h1>
        <p className="text-muted-foreground mt-1">
          Zadané záznamy uvidí i váš technik BOZP/PO. Nové záznamy dostanou štítek
          „Čeká na potvrzení OZO", než je technik ověří.
        </p>
      </header>

      {/* Přepínač revize / školení */}
      <div className="inline-flex rounded-lg border bg-muted p-1">
        {(['revize', 'skoleni'] as Druh[]).map((d) => (
          <button
            key={d}
            onClick={() => { setDruh(d); setRozbaleno(null); setVybrane(''); }}
            className={cn(
              'px-4 py-1.5 text-sm font-bold rounded-md transition-all',
              druh === d ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700',
            )}
          >
            {d === 'revize' ? 'Revize' : 'Školení'}
          </button>
        ))}
      </div>

      {/* Přidání */}
      <Card>
        <CardContent className="py-5 space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] items-end">
            <div className="space-y-1.5">
              <Label className="text-xs">Přidat z katalogu</Label>
              <Select value={vybrane} onValueChange={setVybrane}>
                <SelectTrigger>
                  <SelectValue placeholder={`Vyberte ${druh === 'revize' ? 'revizi' : 'školení'}…`} />
                </SelectTrigger>
                <SelectContent>
                  {ciselnik.length === 0 ? (
                    <div className="px-2 py-3 text-sm text-muted-foreground">Katalog je prázdný.</div>
                  ) : (
                    ciselnik.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nazev} ({popisPeriody(c.periodaMesice)})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={pridejZCiselniku} disabled={!vybrane || uklada}>
              {uklada ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Přidat
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-grow border-t" />
            <span className="text-xs text-muted-foreground uppercase">nebo</span>
            <div className="flex-grow border-t" />
          </div>
          <Button variant="outline" onClick={pridejVlastni} disabled={uklada} className="w-full">
            <Plus className="h-4 w-4 mr-2" /> Přidat vlastní {druh === 'revize' ? 'revizi' : 'školení'}
          </Button>
        </CardContent>
      </Card>

      {/* Seznam */}
      {seznam.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm border border-dashed rounded-lg">
          Zatím žádné {druh === 'revize' ? 'revize' : 'školení'}. Přidejte první výše.
        </div>
      ) : (
        <div className="space-y-3">
          {seznam.map((z) => {
            const muzuUpravit = z.zadal === 'klient'; // adminovy záznamy jsou read-only
            const potvrzeno = z.potvrzenoOzo !== false; // chybí nebo true = potvrzeno
            const termin = platnyTermin(z as RevizeKlienta);
            const jeRozbaleno = rozbaleno === z.id;

            return (
              <Card key={z.id} className={cn(!muzuUpravit && 'bg-muted/30')}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-full bg-primary/5 flex items-center justify-center shrink-0 mt-0.5">
                        <Ikona className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold">{z.nazev}</span>
                          {potvrzeno ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                              <ShieldCheck className="h-3 w-3" /> Potvrzeno OZO
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                              <Clock className="h-3 w-3" /> Čeká na potvrzení OZO
                            </span>
                          )}
                          {!muzuUpravit && (
                            <span className="text-[11px] text-muted-foreground">zadal technik</span>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground mt-0.5">
                          {popisPeriody(z.periodaMesice)}
                          {termin && <> · další termín {new Date(termin).toLocaleDateString('cs-CZ')}</>}
                        </div>
                      </div>
                    </div>
                    {muzuUpravit && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setRozbaleno(jeRozbaleno ? null : z.id)}
                      >
                        {jeRozbaleno ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        <span className="ml-1">Upravit</span>
                      </Button>
                    )}
                  </div>

                  {/* Editační panel (jen vlastní záznamy) */}
                  {muzuUpravit && jeRozbaleno && (
                    <div className="mt-4 pt-4 border-t grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label className="text-xs">Název</Label>
                        <Input
                          value={z.nazev}
                          onChange={(e) => uprav(z.id, { nazev: e.target.value })}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs">Perioda</Label>
                        <Select
                          value={String(z.periodaMesice)}
                          onValueChange={(v) => {
                            const perioda = Number(v);
                            const dalsi = z.dalsiRucne
                              ? z.dalsiIso
                              : dopocitejDalsi(z.posledniIso, perioda);
                            uprav(z.id, { periodaMesice: perioda, dalsiIso: dalsi });
                          }}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {PERIODY.map((p) => (
                              <SelectItem key={p.hodnota} value={String(p.hodnota)}>{p.popis}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs">
                          {druh === 'revize' ? 'Datum poslední revize' : 'Datum posledního proškolení'}
                        </Label>
                        <Input
                          type="date"
                          value={z.posledniIso ? z.posledniIso.split('T')[0] : ''}
                          onChange={(e) => {
                            const iso = e.target.value ? new Date(e.target.value).toISOString() : undefined;
                            const dalsi = z.dalsiRucne ? z.dalsiIso : dopocitejDalsi(iso, z.periodaMesice);
                            uprav(z.id, { posledniIso: iso, dalsiIso: dalsi });
                          }}
                        />
                      </div>

                      {druh === 'revize' ? (
                        <>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Revizní firma / technik</Label>
                            <Input
                              value={(z as RevizeKlienta).firmaNazev ?? ''}
                              onChange={(e) => uprav(z.id, { firmaNazev: e.target.value } as Partial<Polozka>)}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Číslo protokolu</Label>
                            <Input
                              value={(z as RevizeKlienta).cisloProtokolu ?? ''}
                              onChange={(e) => uprav(z.id, { cisloProtokolu: e.target.value } as Partial<Polozka>)}
                            />
                          </div>
                        </>
                      ) : (
                        <div className="space-y-1.5">
                          <Label className="text-xs">Provádí</Label>
                          <Input
                            value={(z as SkoleniKlienta).provadi ?? ''}
                            onChange={(e) => uprav(z.id, { provadi: e.target.value } as Partial<Polozka>)}
                          />
                        </div>
                      )}

                      <div className="space-y-1.5 sm:col-span-2">
                        <Label className="text-xs">Poznámka</Label>
                        <Input
                          value={z.poznamka ?? ''}
                          onChange={(e) => uprav(z.id, { poznamka: e.target.value })}
                        />
                      </div>
                    </div>
                  )}
                  {/* Vlákno komentářů k této revizi/školení */}
                  <div className="mt-4 pt-4 border-t">
                    <VlaknoKomentaru
                      klientId={klientId}
                      cil={druh}
                      cilId={z.id}
                      cilPopis={z.nazev}
                      kompaktni
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
