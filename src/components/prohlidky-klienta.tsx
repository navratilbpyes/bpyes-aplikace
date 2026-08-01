'use client';

/**
 * AuditFlow — přehled prověrek BOZP a preventivních požárních prohlídek.
 * Umístění: src/components/prohlidky-klienta.tsx
 *
 * Zobrazuje prohlídky po pracovištích. Záznamy vznikají automaticky
 * při uzavření reportu; zde je lze doladit (perioda, termín).
 *
 * Použití v kartě klienta:
 *   <ProhlidkyKlienta klientId={klient.id} pracoviste={klient.pracoviste} />
 */

import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/components/data-provider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { MapPin, ShieldCheck, Flame, Loader2, FileText, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/app/lib/utils';
import {
  NAZEV_TYPU, popisTerminu, naliehavost, dopocitejDalsi, mesicuDoTerminu,
} from '@/lib/prohlidky';
import type { Prohlidka, TypProhlidky } from '@/lib/prohlidky';
import type { Pracoviste } from '@/app/lib/types';

interface Props {
  klientId: string;
  pracoviste: Pracoviste[];
}

const PERIODY = [3, 6, 12, 24];

const popisPeriody = (m: number) =>
  m === 12 ? '1× ročně' : m === 24 ? '1× za 2 roky' : `1× za ${m} měsíců`;

export default function ProhlidkyKlienta({ klientId, pracoviste }: Props) {
  const [prohlidky, setProhlidky] = useState<Prohlidka[]>([]);
  const [nacitam, setNacitam] = useState(true);

  const nacti = useCallback(async () => {
    try {
      const snap = await getDocs(
        query(
          collection(db, 'prohlidky'),
          where('klientId', '==', klientId),
          where('stav', '==', 'aktivni'),
        ),
      );
      setProhlidky(snap.docs.map((d) => d.data() as Prohlidka));
    } catch (e) {
      console.error('Načtení prohlídek selhalo:', e);
    } finally {
      setNacitam(false);
    }
  }, [klientId]);

  useEffect(() => { nacti(); }, [nacti]);

  async function zmenPeriodu(p: Prohlidka, perioda: number) {
    const dalsi = p.posledniIso ? dopocitejDalsi(p.posledniIso, perioda) : undefined;
    const zmeny = {
      periodaMesice: perioda,
      ...(dalsi ? { dalsiMesic: dalsi.mesic, dalsiRok: dalsi.rok } : {}),
      updatedAt: new Date().toISOString(),
    };
    setProhlidky((s) => s.map((x) => (x.id === p.id ? { ...x, ...zmeny } : x)));
    try {
      await updateDoc(doc(db, 'prohlidky', p.id), zmeny);
    } catch (e) {
      console.error('Změna periody selhala:', e);
    }
  }

  async function zmenTermin(p: Prohlidka, mesic: number, rok: number) {
    const zmeny = { dalsiMesic: mesic, dalsiRok: rok, updatedAt: new Date().toISOString() };
    setProhlidky((s) => s.map((x) => (x.id === p.id ? { ...x, ...zmeny } : x)));
    try {
      await updateDoc(doc(db, 'prohlidky', p.id), zmeny);
    } catch (e) {
      console.error('Změna termínu selhala:', e);
    }
  }

  if (nacitam) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-8 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Načítám prohlídky…</span>
        </CardContent>
      </Card>
    );
  }

  if (pracoviste.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-muted-foreground">
          Klient nemá zadaná žádná pracoviště. Prohlídky se evidují po pracovištích.
        </CardContent>
      </Card>
    );
  }

  const rok = new Date().getFullYear();
  const roky = [rok, rok + 1, rok + 2, rok + 3];

  return (
    <div className="space-y-4">
      {pracoviste.map((pr) => {
        const proPracoviste = prohlidky.filter((p) => p.pracovisteId === pr.id);

        return (
          <Card key={pr.id}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                {pr.nazev}
              </CardTitle>
              {pr.adresa && <CardDescription>{pr.adresa}</CardDescription>}
            </CardHeader>

            <CardContent className="space-y-3">
              {(['PBOZP', 'PPP'] as TypProhlidky[]).map((typ) => {
                const p = proPracoviste.find((x) => x.typ === typ);
                const Ikona = typ === 'PBOZP' ? ShieldCheck : Flame;

                if (!p) {
                  return (
                    <div
                      key={typ}
                      className="flex items-center gap-3 rounded-lg border border-dashed p-3 text-sm text-muted-foreground"
                    >
                      <Ikona className="h-4 w-4 shrink-0" />
                      <span className="flex-1">{NAZEV_TYPU[typ]}</span>
                      <span className="text-xs">zatím neproběhla</span>
                    </div>
                  );
                }

                const nal = naliehavost(p.dalsiMesic, p.dalsiRok);
                const zbyva =
                  p.dalsiMesic && p.dalsiRok
                    ? mesicuDoTerminu(p.dalsiMesic, p.dalsiRok)
                    : null;

                return (
                  <div key={typ} className="rounded-lg border p-3 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Ikona
                        className={cn(
                          'h-4 w-4 shrink-0',
                          nal === 'po_terminu'
                            ? 'text-destructive'
                            : nal === 'blizi_se'
                              ? 'text-amber-600'
                              : 'text-muted-foreground',
                        )}
                      />
                      <span className="font-medium text-sm">{NAZEV_TYPU[typ]}</span>

                      <Badge
                        variant={nal === 'po_terminu' ? 'destructive' : 'secondary'}
                        className={cn(
                          'ml-auto',
                          nal === 'blizi_se' && 'bg-amber-100 text-amber-800 hover:bg-amber-100',
                        )}
                      >
                        {nal === 'po_terminu' && <AlertTriangle className="mr-1 h-3 w-3" />}
                        {popisTerminu(p.dalsiMesic, p.dalsiRok)}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {p.posledniIso && (
                        <span>
                          poslední: {new Date(p.posledniIso).toLocaleDateString('cs-CZ')}
                        </span>
                      )}
                      {zbyva !== null && (
                        <span>
                          {zbyva < 0
                            ? `${Math.abs(zbyva)} měs. po termínu`
                            : `zbývá ${zbyva} měs.`}
                        </span>
                      )}
                      {p.zdrojZaznamId && (
                        <Link
                          href={`/zaznamy/${p.zdrojZaznamId}`}
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          <FileText className="h-3 w-3" />
                          {p.zdrojCislo || 'protokol'}
                        </Link>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Perioda</Label>
                        <Select
                          value={String(p.periodaMesice)}
                          onValueChange={(v) => zmenPeriodu(p, Number(v))}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PERIODY.map((m) => (
                              <SelectItem key={m} value={String(m)}>
                                {popisPeriody(m)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Měsíc</Label>
                        <Select
                          value={p.dalsiMesic ? String(p.dalsiMesic) : ''}
                          onValueChange={(v) =>
                            zmenTermin(p, Number(v), p.dalsiRok ?? rok)
                          }
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="—" />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                              <SelectItem key={m} value={String(m)}>
                                {popisTerminu(m, rok).split(' ')[0]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Rok</Label>
                        <Select
                          value={p.dalsiRok ? String(p.dalsiRok) : ''}
                          onValueChange={(v) =>
                            zmenTermin(p, p.dalsiMesic ?? 1, Number(v))
                          }
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="—" />
                          </SelectTrigger>
                          <SelectContent>
                            {roky.map((r) => (
                              <SelectItem key={r} value={String(r)}>
                                {r}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
