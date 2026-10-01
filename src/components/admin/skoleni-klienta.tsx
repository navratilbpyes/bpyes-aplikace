'use client';

/**
 * AuditFlow — školení konkrétního klienta.
 * Umístění: src/components/admin/skoleni-klienta.tsx
 *
 * Firestore: klienti/{klientId}/skoleni/{id}
 *
 * Souhrn se plní automaticky z Lidských zdrojů (relevantní položky klienta a záznamy
 * osob) — viz lib/souhrn-skoleni.ts. Řádky `auto` jsou jen ke čtení. Ručně zadané
 * (starší) řádky zůstávají upravitelné a lze je smazat. Nové ručně se nepřidávají —
 * vlastní položky se zakládají v Lidských zdrojích → Nastavení klienta.
 */

import { useState, useEffect, useCallback, Fragment } from 'react';
import {
  collection, addDoc, updateDoc, doc, query, where, getDocs,
} from 'firebase/firestore';
import { db } from '@/components/data-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Plus, X, Loader2, ChevronDown, ChevronRight, RotateCcw, Check,
} from 'lucide-react';
import { cn } from '@/app/lib/utils';
import { PERIODY, popisPeriody, dopocitejDalsi, platnyTermin } from '@/lib/skoleni';
import type { SkoleniKlienta as TypSkoleni } from '@/lib/skoleni';
import { synchronizujSouhrn } from '@/lib/souhrn-skoleni';
import ProtokolUpload from '@/components/protokol-upload';
import type { ProtokolPole } from '@/lib/protokol';

interface Props {
  klientId: string;
}

const naNull = (v: string) => (v.trim() === '' ? null : v.trim());
const isoNaDatum = (iso?: string) => (iso ? iso.slice(0, 10) : '');
const datumNaIso = (d: string) => (d ? new Date(d + 'T00:00:00').toISOString() : undefined);
const formatDatum = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('cs-CZ') : '—');

export default function SkoleniKlienta({ klientId }: Props) {
  const [seznam, setSeznam] = useState<TypSkoleni[]>([]);
  const [nacitam, setNacitam] = useState(true);
  const [rozbaleno, setRozbaleno] = useState<string | null>(null);

  const cesta = useCallback(
    () => collection(db, 'klienti', klientId, 'skoleni'),
    [klientId],
  );

  const nacti = useCallback(async () => {
    try {
      // nejdřív přepočet souhrnu z Lidských zdrojů (jen admin; selhání nesmí zablokovat zobrazení)
      try { await synchronizujSouhrn(klientId); } catch (e) { console.warn('Souhrn školení se nepodařilo přepočítat:', e); }
      const kSnap = await getDocs(query(cesta(), where('stav', '==', 'aktivni')));
      setSeznam(kSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as TypSkoleni));
    } catch (e) {
      console.error('Načtení školení selhalo:', e);
    } finally {
      setNacitam(false);
    }
  }, [cesta, klientId]);

  useEffect(() => { nacti(); }, [nacti]);

  async function uprav(id: string, zmeny: Partial<TypSkoleni>) {
    setSeznam((p) => p.map((s) => (s.id === id ? { ...s, ...zmeny } : s)));
    try {
      const cistec = Object.fromEntries(
        Object.entries(zmeny).map(([k, v]) => [k, v === undefined || v === '' ? null : v]),
      );
      await updateDoc(doc(db, 'klienti', klientId, 'skoleni', id), cistec);
    } catch (e) {
      console.error('Uložení změny selhalo:', e);
    }
  }

  async function smaz(id: string) {
    setSeznam((p) => p.filter((s) => s.id !== id));
    await updateDoc(doc(db, 'klienti', klientId, 'skoleni', id), { stav: 'smazano' });
  }

  if (nacitam) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-8 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Načítám školení…</span>
        </CardContent>
      </Card>
    );
  }

  const automaticke = seznam
    .filter((s) => s.auto)
    .sort((a, b) => a.nazev.localeCompare(b.nazev, 'cs'));
  const rucni = seznam.filter((s) => !s.auto);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Školení a činnosti klienta</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Souhrn se plní automaticky z Lidských zdrojů podle relevantních školení a činností klienta.
          „Poslední“ je nejnovější školení kterékoli osoby, „další“ nejbližší končící termín;
          osoba bez záznamu se počítá jako po termínu. Vlastní položky klienta se zakládají v
          Lidských zdrojích → Nastavení klienta.
        </p>

        {seznam.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">
            Zatím nic. Nastavte klientovi relevantní školení a činnosti v Lidských zdrojích → Nastavení klienta.
          </p>
        ) : (
          <div className="space-y-2">
            {[...automaticke, ...rucni].map((s, i) => {
              const termin = platnyTermin(s);
              const otevreno = rozbaleno === s.id;
              const auto = !!s.auto;
              return (
                <Fragment key={s.id}>
                {i === 0 && auto && (
                  <h3 className="pt-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Automatický souhrn z Lidských zdrojů ({automaticke.length})
                  </h3>
                )}
                {i === automaticke.length && rucni.length > 0 && (
                  <h3 className="pt-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Ručně zadané / starší záznamy ({rucni.length})
                  </h3>
                )}
                <div className="rounded-lg border overflow-hidden">
                  <div className="flex items-start gap-2 bg-muted/40 p-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={() => setRozbaleno(otevreno ? null : s.id)}
                    >
                      {otevreno
                        ? <ChevronDown className="h-4 w-4" />
                        : <ChevronRight className="h-4 w-4" />}
                    </Button>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-sm">{s.nazev}</span>
                        {s.poznamka && (
                          <span className="text-sm text-muted-foreground">— {s.poznamka}</span>
                        )}
                        {auto && (
                          <Badge variant="outline" className="text-[10px]">automaticky</Badge>
                        )}
                        {!auto && !s.ciselnikId && (
                          <Badge variant="secondary" className="text-[10px]">vlastní</Badge>
                        )}
                        {s.zadal === 'klient' && s.potvrzenoOzo === false && (
                          <Badge className="text-[10px] bg-amber-100 text-amber-800 hover:bg-amber-100">
                            čeká na potvrzení
                          </Badge>
                        )}
                        {s.zadal === 'klient' && s.potvrzenoOzo === true && (
                          <Badge className="text-[10px] bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                            potvrzeno
                          </Badge>
                        )}
                      </div>

                      {s.zadal === 'klient' && s.potvrzenoOzo === false && (
                        <Button
                          size="sm"
                          className="mt-2 h-7 bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => uprav(s.id, { potvrzenoOzo: true } as any)}
                        >
                          <Check className="h-3.5 w-3.5 mr-1" /> Potvrdit školení
                        </Button>
                      )}
                      <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                        <span>{popisPeriody(s.periodaMesice)}</span>
                        {s.provadi && <span>{s.provadi}</span>}
                        {auto && (s.pocetOsob ?? 0) > 0 && (
                          <span>
                            {s.pocetOsob} {s.pocetOsob === 1 ? 'osoba' : (s.pocetOsob ?? 0) < 5 ? 'osoby' : 'osob'}
                            {(s.pocetBezZaznamu ?? 0) > 0 && (
                              <strong className="text-red-700"> · {s.pocetBezZaznamu}× bez záznamu</strong>
                            )}
                          </span>
                        )}
                        {auto && (s.pocetOsob ?? 0) === 0 && <span>zatím žádná dotčená osoba</span>}
                        {s.posledniIso && (
                          <span>
                            poslední: <strong className="text-foreground">{formatDatum(s.posledniIso)}</strong>
                          </span>
                        )}
                        <span>
                          další: <strong className="text-foreground">{formatDatum(termin)}</strong>
                        </span>
                        {!auto && s.dalsiRucne && (
                          <Badge variant="outline" className="text-[10px] h-4">ručně</Badge>
                        )}
                      </div>
                    </div>

                    {!auto && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => smaz(s.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  {otevreno && (
                    <div className="border-t p-3 space-y-3">
                      {auto && (
                        <p className="text-xs text-muted-foreground">
                          Tento řádek se počítá automaticky ze záznamů osob v Lidských zdrojích a nelze ho
                          upravit ručně. Termíny změníte zápisem školení u konkrétních osob.
                        </p>
                      )}
                      {!auto && (<>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Téma školení</Label>
                          <Input
                            value={s.nazev}
                            onChange={(e) => uprav(s.id, { nazev: e.target.value })}
                            className="h-9"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Poznámka / skupina</Label>
                          <Input
                            value={s.poznamka ?? ''}
                            onChange={(e) => uprav(s.id, { poznamka: e.target.value })}
                            placeholder="např. skupina B — sklad"
                            className="h-9"
                          />
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Perioda</Label>
                          <Select
                            value={String(s.periodaMesice)}
                            onValueChange={(v) => {
                              const perioda = Number(v);
                              const dalsi = s.dalsiRucne
                                ? s.dalsiIso
                                : dopocitejDalsi(s.posledniIso, perioda);
                              uprav(s.id, { periodaMesice: perioda, dalsiIso: dalsi });
                            }}
                          >
                            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {PERIODY.map((p) => (
                                <SelectItem key={p.hodnota} value={String(p.hodnota)}>
                                  {p.popis}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Kdo provádí</Label>
                          <Input
                            value={s.provadi ?? ''}
                            onChange={(e) => uprav(s.id, { provadi: e.target.value })}
                            placeholder="např. OZO"
                            className="h-9"
                          />
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Poslední proškolení</Label>
                          <Input
                            type="date"
                            value={isoNaDatum(s.posledniIso)}
                            onChange={(e) => {
                              const posledni = datumNaIso(e.target.value);
                              const dalsi = s.dalsiRucne
                                ? s.dalsiIso
                                : dopocitejDalsi(posledni, s.periodaMesice);
                              uprav(s.id, { posledniIso: posledni, dalsiIso: dalsi });
                            }}
                            className="h-9"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Další termín</Label>
                          <Input
                            type="date"
                            value={isoNaDatum(termin)}
                            onChange={(e) => uprav(s.id, {
                              dalsiIso: datumNaIso(e.target.value),
                              dalsiRucne: true,
                            })}
                            className="h-9"
                          />
                        </div>
                      </div>

                      </>)}

                      {/* Doklad o školení — nahrání / kontrola OZO */}
                      <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                        <Label className="text-xs font-medium">Doklad o školení</Label>
                        <ProtokolUpload
                          klientId={klientId}
                          adminMode
                          data={s as ProtokolPole}
                          onUlozit={(zmeny) => uprav(s.id, zmeny as Partial<TypSkoleni>)}
                        />
                      </div>

                      {!auto && s.dalsiRucne && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => uprav(s.id, {
                            dalsiRucne: false,
                            dalsiIso: dopocitejDalsi(s.posledniIso, s.periodaMesice),
                          })}
                        >
                          <RotateCcw className="mr-2 h-3 w-3" />
                          Vrátit k automatickému výpočtu
                        </Button>
                      )}
                    </div>
                  )}
                </div>
                </Fragment>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
