'use client';

/**
 * AuditFlow — školení konkrétního klienta.
 * Umístění: src/components/admin/skoleni-klienta.tsx
 *
 * Firestore: klienti/{klientId}/skoleni/{id}
 *
 * Přidání z číselníku zkopíruje hodnoty (snapshot). Totéž téma lze přidat
 * vícekrát pro různé skupiny — rozliší je poznámka. Perioda i „kdo provádí"
 * jdou u klienta přepsat. Termín se dopočte z periody, nebo se zadá ručně.
 */

import { useState, useEffect, useCallback } from 'react';
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
  Plus, X, Loader2, ChevronDown, ChevronRight, RotateCcw,
} from 'lucide-react';
import { cn } from '@/app/lib/utils';
import { PERIODY, popisPeriody, dopocitejDalsi, platnyTermin } from '@/lib/skoleni';
import type { CiselnikSkoleni, SkoleniKlienta as TypSkoleni } from '@/lib/skoleni';

interface Props {
  klientId: string;
}

const naNull = (v: string) => (v.trim() === '' ? null : v.trim());
const isoNaDatum = (iso?: string) => (iso ? iso.slice(0, 10) : '');
const datumNaIso = (d: string) => (d ? new Date(d + 'T00:00:00').toISOString() : undefined);
const formatDatum = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('cs-CZ') : '—');

export default function SkoleniKlienta({ klientId }: Props) {
  const [seznam, setSeznam] = useState<TypSkoleni[]>([]);
  const [ciselnik, setCiselnik] = useState<CiselnikSkoleni[]>([]);
  const [nacitam, setNacitam] = useState(true);
  const [vybrane, setVybrane] = useState('');
  const [rozbaleno, setRozbaleno] = useState<string | null>(null);

  const cesta = useCallback(
    () => collection(db, 'klienti', klientId, 'skoleni'),
    [klientId],
  );

  const nacti = useCallback(async () => {
    try {
      const [kSnap, cSnap] = await Promise.all([
        getDocs(query(cesta(), where('stav', '==', 'aktivni'))),
        getDocs(query(collection(db, 'ciselnikSkoleni'), where('stav', '==', 'aktivni'))),
      ]);
      setSeznam(kSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as TypSkoleni));
      setCiselnik(
        cSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as CiselnikSkoleni)
          .sort((a, b) => a.nazev.localeCompare(b.nazev, 'cs')),
      );
    } catch (e) {
      console.error('Načtení školení selhalo:', e);
    } finally {
      setNacitam(false);
    }
  }, [cesta]);

  useEffect(() => { nacti(); }, [nacti]);

  async function pridejZCiselniku() {
    const zdroj = ciselnik.find((c) => c.id === vybrane);
    if (!zdroj) return;
    await addDoc(cesta(), {
      ciselnikId: zdroj.id,
      nazev: zdroj.nazev,
      periodaMesice: zdroj.periodaMesice,
      provadi: zdroj.provadi ?? null,
      poznamka: null,
      posledniIso: null,
      dalsiIso: null,
      dalsiRucne: false,
      stav: 'aktivni',
      zadal: 'ozo',
      potvrzenoOzo: true,
    });
    setVybrane('');
    nacti();
  }

  async function pridejVlastni() {
    const ref = await addDoc(cesta(), {
      ciselnikId: null,
      nazev: 'Nové školení',
      periodaMesice: 12,
      provadi: null,
      poznamka: null,
      posledniIso: null,
      dalsiIso: null,
      dalsiRucne: false,
      stav: 'aktivni',
      zadal: 'ozo',
      potvrzenoOzo: true,
    });
    await nacti();
    setRozbaleno(ref.id);
  }

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

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Školení klienta</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Select value={vybrane} onValueChange={setVybrane}>
            <SelectTrigger className="flex-1 min-w-[220px]">
              <SelectValue placeholder="Vyber téma z číselníku…" />
            </SelectTrigger>
            <SelectContent>
              {ciselnik.length === 0 && (
                <div className="px-2 py-3 text-sm text-muted-foreground">
                  Číselník je prázdný — naplň jej v sekci Číselníky.
                </div>
              )}
              {ciselnik.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nazev} ({popisPeriody(c.periodaMesice)})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={pridejZCiselniku} disabled={!vybrane}>
            <Plus className="mr-2 h-4 w-4" /> Přidat
          </Button>
          <Button variant="secondary" onClick={pridejVlastni}>
            Vlastní
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Stejné téma lze přidat vícekrát pro různé skupiny — rozliš je poznámkou.
        </p>

        {seznam.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">
            Klient zatím nemá přiřazená žádná školení.
          </p>
        ) : (
          <div className="space-y-2">
            {seznam.map((s) => {
              const termin = platnyTermin(s);
              const otevreno = rozbaleno === s.id;
              return (
                <div key={s.id} className="rounded-lg border overflow-hidden">
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
                        {!s.ciselnikId && (
                          <Badge variant="secondary" className="text-[10px]">vlastní</Badge>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                        <span>{popisPeriody(s.periodaMesice)}</span>
                        {s.provadi && <span>{s.provadi}</span>}
                        <span>
                          další: <strong className="text-foreground">{formatDatum(termin)}</strong>
                        </span>
                        {s.dalsiRucne && (
                          <Badge variant="outline" className="text-[10px] h-4">ručně</Badge>
                        )}
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => smaz(s.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  {otevreno && (
                    <div className="border-t p-3 space-y-3">
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

                      {s.dalsiRucne && (
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
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
