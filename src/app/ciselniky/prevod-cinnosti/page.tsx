'use client';

/**
 * AuditFlow — převod číselníku Činnosti do „Školení a činnosti".
 * Umístění: src/app/ciselniky/prevod-cinnosti/page.tsx
 *
 * Každou dosavadní činnost lze buď SLOUČIT do existující položky číselníku školení
 * (typicky když jde o totéž — „Práce ve výškách" ↔ „Školení k práci ve výškách"),
 * nebo ZALOŽIT jako novou položku. Původní činnosti se nemažou, jen se označí
 * `prevedeno` a `prevedenoDo` — Lidské zdroje na nich zatím běží a přepojí se později.
 * Převod lze spustit opakovaně (aktualizuje stejnou cílovou položku, nic neduplikuje).
 * Zápis chrání Firestore Rules (write = admin).
 *
 * Po dokončení celé migrace (včetně přepojení Lidských zdrojů) lze stránku smazat.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  collection, addDoc, updateDoc, doc, query, where, getDocs,
} from 'firebase/firestore';
import { db, useData } from '@/components/data-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2, CheckCircle2, ArrowLeft, ArrowRightLeft, AlertTriangle } from 'lucide-react';
import type { CiselnikSkoleni } from '@/lib/skoleni';
import type { CiselnikCinnost, ZarazeniFaktoru } from '@/lib/cinnosti';

type PrevedenaCinnost = CiselnikCinnost & { prevedeno?: boolean; prevedenoDo?: string | null };

const NOVA = '__nova__';
const KATEGORIE_PORADI = ['1', '2', '2R', '3', '4'];

function normalizuj(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Návrh cíle: shoda názvu (přesná nebo jedna obsahuje druhou), jinak nová položka. */
function navrhniCil(c: PrevedenaCinnost, skoleni: CiselnikSkoleni[]): string {
  if (c.prevedenoDo && skoleni.some((s) => s.id === c.prevedenoDo)) return c.prevedenoDo;
  const n = normalizuj(c.nazev);
  if (!n) return NOVA;
  const shoda = skoleni.find((s) => {
    const sn = normalizuj(s.nazev);
    return sn === n || (n.length >= 6 && (sn.includes(n) || n.includes(sn)));
  });
  return shoda ? shoda.id : NOVA;
}

function sloucFaktory(a: ZarazeniFaktoru[] = [], b: ZarazeniFaktoru[] = []): ZarazeniFaktoru[] {
  const mapa = new Map<string, ZarazeniFaktoru>();
  for (const f of [...a, ...b]) {
    const stary = mapa.get(f.kod);
    if (!stary || KATEGORIE_PORADI.indexOf(f.kategorie) > KATEGORIE_PORADI.indexOf(stary.kategorie)) {
      mapa.set(f.kod, { ...f, poznamka: f.poznamka ?? stary?.poznamka ?? null });
    }
  }
  return Array.from(mapa.values());
}

export default function PrevodCinnostiPage() {
  const { userProfile } = useData();
  const isAdmin = userProfile?.role === 'admin';

  const [cinnosti, setCinnosti] = useState<PrevedenaCinnost[]>([]);
  const [skoleni, setSkoleni] = useState<CiselnikSkoleni[]>([]);
  const [cile, setCile] = useState<Record<string, string>>({});
  const [nacitam, setNacitam] = useState(true);
  const [bezi, setBezi] = useState(false);
  const [hotovo, setHotovo] = useState<number | null>(null);
  const [chyby, setChyby] = useState<string[]>([]);

  async function nacti() {
    setNacitam(true);
    try {
      const [snapC, snapS] = await Promise.all([
        getDocs(query(collection(db, 'ciselnikCinnosti'), where('stav', '==', 'aktivni'))),
        getDocs(query(collection(db, 'ciselnikSkoleni'), where('stav', '==', 'aktivni'))),
      ]);
      const c = snapC.docs
        .map((d) => ({ id: d.id, ...d.data() }) as PrevedenaCinnost)
        .sort((a, b) => a.nazev.localeCompare(b.nazev, 'cs'));
      const s = snapS.docs
        .map((d) => ({ id: d.id, ...d.data() }) as CiselnikSkoleni)
        .sort((a, b) => a.nazev.localeCompare(b.nazev, 'cs'));
      setCinnosti(c);
      setSkoleni(s);
      setCile(Object.fromEntries(c.map((x) => [x.id, navrhniCil(x, s)])));
    } catch (e) {
      console.error('Načtení pro převod selhalo:', e);
    } finally {
      setNacitam(false);
    }
  }

  useEffect(() => { if (isAdmin) nacti(); }, [isAdmin]);

  const skoleniMapa = useMemo(() => new Map(skoleni.map((s) => [s.id, s])), [skoleni]);

  async function spust() {
    if (bezi) return;
    setBezi(true);
    setChyby([]);
    setHotovo(null);
    const noveChyby: string[] = [];
    let n = 0;

    // položky vzniklé během tohoto běhu (aby dvě činnosti sloučené do jedné nové nepřepsaly data)
    const aktualni = new Map<string, CiselnikSkoleni>(skoleni.map((s) => [s.id, s]));

    for (const c of cinnosti) {
      try {
        const cil = cile[c.id] ?? NOVA;
        const castecne: Partial<CiselnikSkoleni> = {};
        const cilDoc = cil !== NOVA ? aktualni.get(cil) : undefined;

        const vysetreni = [cilDoc?.odbornaVysetreni?.trim(), c.odbornaVysetreni?.trim()]
          .filter((t): t is string => !!t);
        const vysetreniUnikatni = vysetreni.filter((t, i) => vysetreni.indexOf(t) === i).join('; ');

        const souvisejici = Array.from(new Set([
          ...(cilDoc?.souvisejiciIds ?? []),
          ...(c.skoleniIds ?? []),
        ])).filter((id) => id !== cil);

        castecne.zacvik = !!(cilDoc?.zacvik || c.zacvik);
        castecne.profesniRiziko = !!(cilDoc?.profesniRiziko || c.profesniRiziko);
        if (c.profesniRiziko) {
          castecne.prohlidkaDo50 = cilDoc?.prohlidkaDo50
            ? Math.min(cilDoc.prohlidkaDo50, c.prohlidkaDo50 || cilDoc.prohlidkaDo50)
            : (c.prohlidkaDo50 ?? null);
          castecne.prohlidkaNad50 = cilDoc?.prohlidkaNad50
            ? Math.min(cilDoc.prohlidkaNad50, c.prohlidkaNad50 || cilDoc.prohlidkaNad50)
            : (c.prohlidkaNad50 ?? null);
        }
        castecne.odbornaVysetreni = vysetreniUnikatni || null;
        castecne.faktory = sloucFaktory(cilDoc?.faktory, c.faktory);
        castecne.souvisejiciIds = souvisejici;
        castecne.puvodniCinnostIds = Array.from(new Set([...(cilDoc?.puvodniCinnostIds ?? []), c.id]));

        let cilId = cil;
        if (cil === NOVA) {
          const ref = await addDoc(collection(db, 'ciselnikSkoleni'), {
            nazev: c.nazev,
            oblast: c.oblast || 'Ostatní',
            periodaMesice: 0,
            provadi: null,
            stav: 'aktivni',
            poznamka: c.poznamka ?? null,
            ...castecne,
          });
          cilId = ref.id;
          aktualni.set(cilId, {
            id: cilId, nazev: c.nazev, periodaMesice: 0, stav: 'aktivni', ...castecne,
          } as CiselnikSkoleni);
        } else {
          await updateDoc(doc(db, 'ciselnikSkoleni', cil), castecne as Record<string, unknown>);
          aktualni.set(cil, { ...(cilDoc as CiselnikSkoleni), ...castecne });
        }

        await updateDoc(doc(db, 'ciselnikCinnosti', c.id), { prevedeno: true, prevedenoDo: cilId });
        n += 1;
      } catch (e: any) {
        noveChyby.push(`${c.nazev}: ${e?.message ?? 'chyba'}`);
      }
    }

    setChyby(noveChyby);
    setHotovo(n);
    setBezi(false);
    await nacti();
  }

  if (!isAdmin) {
    return <div className="p-8 text-muted-foreground">Převod číselníku je dostupný jen pro administrátora.</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-6 md:p-8 space-y-6">
      <header className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="-ml-3">
          <Link href="/ciselniky"><ArrowLeft className="mr-2 h-4 w-4" /> Zpět do číselníků</Link>
        </Button>
        <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
          <ArrowRightLeft className="h-6 w-6 text-blue-600" /> Převod činností do „Školení a činností“
        </h1>
        <p className="text-muted-foreground text-sm">
          U každé činnosti vyberte, zda se sloučí do existující položky (když jde o totéž), nebo se založí nová.
          Návrh vychází z podobnosti názvů — zkontrolujte ho. Původní činnosti se nemažou; Lidské zdroje na nich
          zatím dál běží a přepojí se v dalším kroku, proto převod nic nerozbije. Lze spustit opakovaně.
        </p>
      </header>

      <Card>
        <CardContent className="py-5 space-y-4">
          {nacitam ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Načítám…
            </div>
          ) : cinnosti.length === 0 ? (
            <p className="text-sm text-muted-foreground">Žádné činnosti k převodu.</p>
          ) : (
            <>
              <div className="divide-y border-y">
                {cinnosti.map((c) => {
                  const cil = cile[c.id] ?? NOVA;
                  const znaky = [
                    c.zacvik && 'zácvik',
                    c.profesniRiziko && 'profesní riziko',
                    (c.faktory?.length ?? 0) > 0 && `${c.faktory!.length}× faktor`,
                    (c.skoleniIds?.length ?? 0) > 0 && `${c.skoleniIds!.length}× školení`,
                  ].filter(Boolean).join(' · ');
                  return (
                    <div key={c.id} className="grid gap-2 py-3 sm:grid-cols-[1fr_1fr] items-center">
                      <div>
                        <p className="text-sm font-semibold">
                          {c.nazev}
                          {c.prevedeno && (
                            <span className="ml-2 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                              už převedeno
                            </span>
                          )}
                        </p>
                        {znaky && <p className="text-[11px] text-muted-foreground">{znaky}</p>}
                      </div>
                      <Select
                        value={cil}
                        onValueChange={(v) => setCile((p) => ({ ...p, [c.id]: v }))}
                      >
                        <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NOVA}>➕ Založit jako novou položku</SelectItem>
                          {skoleni.map((s) => (
                            <SelectItem key={s.id} value={s.id} className="text-xs">
                              Sloučit do: {s.oblast ? `[${s.oblast}] ` : ''}{s.nazev}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {cil !== NOVA && !skoleniMapa.has(cil) && (
                        <p className="text-[11px] text-red-600 sm:col-span-2">Cílová položka už neexistuje.</p>
                      )}
                    </div>
                  );
                })}
              </div>

              <Button onClick={spust} disabled={bezi} size="lg">
                {bezi ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowRightLeft className="h-4 w-4 mr-2" />}
                {bezi ? 'Převádím…' : `Převést ${cinnosti.length} činností`}
              </Button>
            </>
          )}

          {hotovo !== null && chyby.length === 0 && (
            <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 rounded-lg p-3 text-sm font-medium">
              <CheckCircle2 className="h-5 w-5" /> Hotovo — převedeno {hotovo} činností.
            </div>
          )}
          {chyby.length > 0 && (
            <div className="space-y-2 rounded-lg border border-red-200 bg-red-50/50 p-3">
              <div className="flex items-center gap-2 text-red-700 font-bold text-sm">
                <AlertTriangle className="h-4 w-4" /> Chyby ({chyby.length})
              </div>
              <ul className="text-xs text-red-700 list-disc pl-5 space-y-1">
                {chyby.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
