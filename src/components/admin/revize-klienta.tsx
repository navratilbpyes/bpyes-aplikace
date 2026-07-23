'use client';

/**
 * AuditFlow — revize konkrétního klienta.
 * Umístění: src/components/admin/revize-klienta.tsx
 *
 * Firestore: klienti/{klientId}/revize/{id}
 *
 * Číselník nese jen téma a periodu. Revizní firma se zadává zde,
 * u konkrétní revize — u každého klienta bývá jiná.
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
  Plus, X, Loader2, ChevronDown, ChevronRight, RotateCcw, Phone, Mail, FileText,
} from 'lucide-react';
import { PERIODY, popisPeriody, dopocitejDalsi, platnyTermin } from '@/lib/revize';
import type { CiselnikRevize, RevizeKlienta as TypRevize } from '@/lib/revize';

interface Props {
  klientId: string;
}

const isoNaDatum = (iso?: string) => (iso ? iso.slice(0, 10) : '');
const datumNaIso = (d: string) => (d ? new Date(d + 'T00:00:00').toISOString() : undefined);
const formatDatum = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('cs-CZ') : '—');

export default function RevizeKlienta({ klientId }: Props) {
  const [seznam, setSeznam] = useState<TypRevize[]>([]);
  const [ciselnik, setCiselnik] = useState<CiselnikRevize[]>([]);
  const [nacitam, setNacitam] = useState(true);
  const [vybrane, setVybrane] = useState('');
  const [rozbaleno, setRozbaleno] = useState<string | null>(null);

  const cesta = useCallback(
    () => collection(db, 'klienti', klientId, 'revize'),
    [klientId],
  );

  const nacti = useCallback(async () => {
    try {
      const [kSnap, cSnap] = await Promise.all([
        getDocs(query(cesta(), where('stav', '==', 'aktivni'))),
        getDocs(query(collection(db, 'ciselnikRevizi'), where('stav', '==', 'aktivni'))),
      ]);
      setSeznam(kSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as TypRevize));
      setCiselnik(
        cSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as CiselnikRevize)
          .sort((a, b) => a.nazev.localeCompare(b.nazev, 'cs')),
      );
    } catch (e) {
      console.error('Načtení revizí selhalo:', e);
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
      firmaNazev: null,
      firmaTelefon: null,
      firmaEmail: null,
      poznamka: null,
      cisloProtokolu: null,
      posledniIso: null,
      dalsiIso: null,
      dalsiRucne: false,
      stav: 'aktivni',
    });
    setVybrane('');
    nacti();
  }

  async function pridejVlastni() {
    const ref = await addDoc(cesta(), {
      ciselnikId: null,
      nazev: 'Nová revize',
      periodaMesice: 12,
      firmaNazev: null,
      firmaTelefon: null,
      firmaEmail: null,
      poznamka: null,
      cisloProtokolu: null,
      posledniIso: null,
      dalsiIso: null,
      dalsiRucne: false,
      stav: 'aktivni',
    });
    await nacti();
    setRozbaleno(ref.id);
  }

  async function uprav(id: string, zmeny: Partial<TypRevize>) {
    setSeznam((p) => p.map((r) => (r.id === id ? { ...r, ...zmeny } : r)));
    try {
      const cistec = Object.fromEntries(
        Object.entries(zmeny).map(([k, v]) => [k, v === undefined || v === '' ? null : v]),
      );
      await updateDoc(doc(db, 'klienti', klientId, 'revize', id), cistec);
    } catch (e) {
      console.error('Uložení změny selhalo:', e);
    }
  }

  async function smaz(id: string) {
    setSeznam((p) => p.filter((r) => r.id !== id));
    await updateDoc(doc(db, 'klienti', klientId, 'revize', id), { stav: 'smazano' });
  }

  if (nacitam) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-8 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Načítám revize…</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Revize klienta</CardTitle>
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
          Stejné téma lze přidat vícekrát pro různá zařízení či objekty — rozliš je poznámkou.
        </p>

        {seznam.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">
            Klient zatím nemá přiřazené žádné revize.
          </p>
        ) : (
          <div className="space-y-2">
            {seznam.map((r) => {
              const termin = platnyTermin(r);
              const otevreno = rozbaleno === r.id;
              return (
                <div key={r.id} className="rounded-lg border overflow-hidden">
                  <div className="flex items-start gap-2 bg-muted/40 p-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={() => setRozbaleno(otevreno ? null : r.id)}
                    >
                      {otevreno
                        ? <ChevronDown className="h-4 w-4" />
                        : <ChevronRight className="h-4 w-4" />}
                    </Button>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-sm">{r.nazev}</span>
                        {r.poznamka && (
                          <span className="text-sm text-muted-foreground">— {r.poznamka}</span>
                        )}
                        {!r.ciselnikId && (
                          <Badge variant="secondary" className="text-[10px]">vlastní</Badge>
                        )}
                      </div>

                      <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                        <span>{popisPeriody(r.periodaMesice)}</span>
                        {r.firmaNazev && <span>{r.firmaNazev}</span>}
                        <span>
                          další: <strong className="text-foreground">{formatDatum(termin)}</strong>
                        </span>
                        {r.dalsiRucne && (
                          <Badge variant="outline" className="text-[10px] h-4">ručně</Badge>
                        )}
                      </div>

                      {(r.cisloProtokolu || r.firmaTelefon || r.firmaEmail) && (
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                          {r.cisloProtokolu && (
                            <span className="inline-flex items-center gap-1 text-muted-foreground">
                              <FileText className="h-3 w-3" />
                              {r.cisloProtokolu}
                            </span>
                          )}
                          {r.firmaTelefon && (
                            <a
                              href={`tel:${r.firmaTelefon}`}
                              className="inline-flex items-center gap-1 text-primary hover:underline"
                            >
                              <Phone className="h-3 w-3" />
                              {r.firmaTelefon}
                            </a>
                          )}
                          {r.firmaEmail && (
                            <a
                              href={`mailto:${r.firmaEmail}`}
                              className="inline-flex items-center gap-1 text-primary hover:underline"
                            >
                              <Mail className="h-3 w-3" />
                              {r.firmaEmail}
                            </a>
                          )}
                        </div>
                      )}
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => smaz(r.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  {otevreno && (
                    <div className="border-t p-3 space-y-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Téma revize</Label>
                          <Input
                            value={r.nazev}
                            onChange={(e) => uprav(r.id, { nazev: e.target.value })}
                            className="h-9"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Poznámka / zařízení</Label>
                          <Input
                            value={r.poznamka ?? ''}
                            onChange={(e) => uprav(r.id, { poznamka: e.target.value })}
                            placeholder="např. hala B — rozvaděč RH2"
                            className="h-9"
                          />
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Perioda</Label>
                          <Select
                            value={String(r.periodaMesice)}
                            onValueChange={(v) => {
                              const perioda = Number(v);
                              const dalsi = r.dalsiRucne
                                ? r.dalsiIso
                                : dopocitejDalsi(r.posledniIso, perioda);
                              uprav(r.id, { periodaMesice: perioda, dalsiIso: dalsi });
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
                          <Label className="text-xs">Číslo protokolu</Label>
                          <Input
                            value={r.cisloProtokolu ?? ''}
                            onChange={(e) => uprav(r.id, { cisloProtokolu: e.target.value })}
                            placeholder="např. HR-2025/14"
                            className="h-9"
                          />
                        </div>
                      </div>

                      {/* Revizní firma pro tuto konkrétní revizi */}
                      <div className="rounded-md border bg-muted/30 p-3 space-y-3">
                        <Label className="text-xs font-medium">Revizní firma / technik</Label>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <Input
                            value={r.firmaNazev ?? ''}
                            onChange={(e) => uprav(r.id, { firmaNazev: e.target.value })}
                            placeholder="Název firmy"
                            className="h-9"
                          />
                          <Input
                            type="tel"
                            value={r.firmaTelefon ?? ''}
                            onChange={(e) => uprav(r.id, { firmaTelefon: e.target.value })}
                            placeholder="Telefon"
                            className="h-9"
                          />
                          <Input
                            type="email"
                            value={r.firmaEmail ?? ''}
                            onChange={(e) => uprav(r.id, { firmaEmail: e.target.value })}
                            placeholder="E-mail"
                            className="h-9"
                          />
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Poslední revize</Label>
                          <Input
                            type="date"
                            value={isoNaDatum(r.posledniIso)}
                            onChange={(e) => {
                              const posledni = datumNaIso(e.target.value);
                              const dalsi = r.dalsiRucne
                                ? r.dalsiIso
                                : dopocitejDalsi(posledni, r.periodaMesice);
                              uprav(r.id, { posledniIso: posledni, dalsiIso: dalsi });
                            }}
                            className="h-9"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Další termín</Label>
                          <Input
                            type="date"
                            value={isoNaDatum(termin)}
                            onChange={(e) => uprav(r.id, {
                              dalsiIso: datumNaIso(e.target.value),
                              dalsiRucne: true,
                            })}
                            className="h-9"
                          />
                        </div>
                      </div>

                      {r.dalsiRucne && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => uprav(r.id, {
                            dalsiRucne: false,
                            dalsiIso: dopocitejDalsi(r.posledniIso, r.periodaMesice),
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
