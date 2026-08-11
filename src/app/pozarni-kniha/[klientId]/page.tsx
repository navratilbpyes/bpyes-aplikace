'use client';

/**
 * AuditFlow — Požární kniha (PO-05), stránka pro jednoho klienta.
 * Umístění: src/app/pozarni-kniha/[klientId]/page.tsx
 *
 * Dostupná adminovi (z detailu klienta) i klientovi (své knihy).
 * Skládá se z:
 *  - hlavičky (PO-05 + identifikace klienta z dat),
 *  - roční tabulky činností (16 fixních řádků, datum z revizí/školení/prohlídek
 *    dle pozarniRadek),
 *  - volných záznamů (přidává klient i OZO, štítek kdo),
 *  - tisku přes @page (jako reporty).
 */

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  collection, addDoc, getDocs, getDoc, doc, query, where,
} from 'firebase/firestore';
import { db, useData } from '@/components/data-provider';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2, Printer, Plus, Flame, ShieldCheck, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  sestavTabulku, formatDatum, type ZdrojovaPolozka, type PozarniZaznam,
} from '@/lib/pozarni-kniha';
import type { Klient } from '@/app/lib/types';

export default function PozarniKnihaPage() {
  const params = useParams();
  const klientId = String(params.klientId);
  const { userProfile } = useData();
  const { toast } = useToast();
  const isAdmin = userProfile?.role === 'admin';

  const [klient, setKlient] = useState<Klient | null>(null);
  const [zdroje, setZdroje] = useState<ZdrojovaPolozka[]>([]);
  const [zaznamy, setZaznamy] = useState<PozarniZaznam[]>([]);
  const [nacitam, setNacitam] = useState(true);
  const [rok, setRok] = useState(new Date().getFullYear());

  // formulář volného záznamu
  const [novyDatum, setNovyDatum] = useState('');
  const [novyObsah, setNovyObsah] = useState('');
  const [uklada, setUklada] = useState(false);

  const nacti = useCallback(async () => {
    setNacitam(true);
    try {
      const [klDoc, revSnap, skolSnap, prohSnap, zaznSnap] = await Promise.all([
        getDoc(doc(db, 'klienti', klientId)),
        getDocs(query(collection(db, 'klienti', klientId, 'revize'), where('stav', '==', 'aktivni'))),
        getDocs(query(collection(db, 'klienti', klientId, 'skoleni'), where('stav', '==', 'aktivni'))),
        getDocs(query(collection(db, 'prohlidky'), where('klientId', '==', klientId))),
        getDocs(collection(db, 'klienti', klientId, 'pozarniZaznamy')),
      ]);

      if (klDoc.exists()) setKlient({ id: klDoc.id, ...klDoc.data() } as Klient);

      const zdrojove: ZdrojovaPolozka[] = [
        ...revSnap.docs.map((d) => {
          const f = d.data() as any;
          return { pozarniRadek: f.pozarniRadek ?? null, posledniIso: f.posledniIso ?? null, typ: 'revize' as const };
        }),
        ...skolSnap.docs.map((d) => {
          const f = d.data() as any;
          return { pozarniRadek: f.pozarniRadek ?? null, posledniIso: f.posledniIso ?? null, typ: 'skoleni' as const };
        }),
        ...prohSnap.docs.map((d) => {
          const f = d.data() as any;
          return { pozarniRadek: f.pozarniRadek ?? null, posledniIso: f.posledniIso ?? null, typ: 'prohlidka' as const };
        }),
      ];
      setZdroje(zdrojove);

      setZaznamy(
        zaznSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as PozarniZaznam)
          .filter((z) => z.stav !== 'smazano')
          .sort((a, b) => new Date(b.datum).getTime() - new Date(a.datum).getTime()),
      );
    } catch (e) {
      console.error('Načtení požární knihy selhalo:', e);
    } finally {
      setNacitam(false);
    }
  }, [klientId]);

  useEffect(() => { nacti(); }, [nacti]);

  const tabulka = useMemo(() => sestavTabulku(zdroje, rok), [zdroje, rok]);
  const zaznamyRoku = useMemo(
    () => zaznamy.filter((z) => new Date(z.datum).getFullYear() === rok),
    [zaznamy, rok],
  );

  // roky k výběru: aktuální ± několik + roky s daty
  const roky = useMemo(() => {
    const set = new Set<number>();
    const teď = new Date().getFullYear();
    for (let r = teď - 3; r <= teď + 1; r++) set.add(r);
    zaznamy.forEach((z) => set.add(new Date(z.datum).getFullYear()));
    zdroje.forEach((z) => { if (z.posledniIso) set.add(new Date(z.posledniIso).getFullYear()); });
    return [...set].sort((a, b) => b - a);
  }, [zaznamy, zdroje]);

  async function pridejZaznam() {
    if (!novyDatum || novyObsah.trim() === '') return;
    setUklada(true);
    try {
      const iso = new Date(novyDatum + 'T00:00:00').toISOString();
      await addDoc(collection(db, 'klienti', klientId, 'pozarniZaznamy'), {
        datum: iso,
        rok: new Date(iso).getFullYear(),
        obsah: novyObsah.trim(),
        zadal: isAdmin ? 'ozo' : 'klient',
        zadalJmeno: isAdmin ? 'OZO technik' : (klient?.nazev ?? 'Klient'),
        stav: 'aktivni',
      });
      setNovyDatum('');
      setNovyObsah('');
      toast({ title: 'Záznam přidán' });
      nacti();
    } catch (e: any) {
      toast({ title: 'Nepodařilo se uložit', description: e?.message ?? '', variant: 'destructive' });
    } finally {
      setUklada(false);
    }
  }

  if (nacitam) {
    return (
      <div className="flex items-center gap-2 p-8 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Načítám požární knihu…
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-5">
      {/* Číslování stran + patička jen pro tisk knihy (inline, ať nekoliduje s reporty) */}
      <style>{`
        @media print {
          @page {
            @bottom-left {
              content: "Požární kniha — PO-05";
              font-family: sans-serif; font-size: 8px; color: #94a3b8;
            }
            @bottom-center {
              content: "Strana " counter(page) " z " counter(pages);
              font-family: sans-serif; font-size: 8px; color: #94a3b8;
            }
          }
        }
      `}</style>

      {/* Ovládání (netiskne se) */}
      <div className="flex items-center justify-between gap-3 no-print">
        <div className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-[#0F2038]" />
          <h1 className="text-xl font-bold text-[#0F2038]">Požární kniha</h1>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(rok)} onValueChange={(v) => setRok(Number(v))}>
            <SelectTrigger className="h-9 w-[110px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {roky.map((r) => <SelectItem key={r} value={String(r)}>Rok {r}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={() => window.print()} variant="outline" className="h-9">
            <Printer className="h-4 w-4 mr-2" /> Tisk knihy
          </Button>
        </div>
      </div>

      {/* Tiskový obsah */}
      <div className="pozarni-kniha space-y-5">
        {/* Hlavička dokumentu */}
        <Card className="border-[#0F2038]">
          <CardContent className="py-4">
            <div className="flex items-start justify-between gap-4 border-b pb-3 mb-3">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Vnitřní předpis zaměstnavatele</div>
                <div className="text-lg font-black text-[#0F2038]">POŽÁRNÍ KNIHA</div>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <div>Číslo dokumentu: <strong>PO-05</strong></div>
                <div>Rok: <strong>{rok}</strong></div>
              </div>
            </div>
            {/* Identifikace klienta */}
            <div className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              <div><span className="text-muted-foreground">Název:</span> <strong>{klient?.nazev ?? '—'}</strong></div>
              <div><span className="text-muted-foreground">IČ:</span> {klient?.ico ?? '—'}</div>
              <div><span className="text-muted-foreground">Sídlo:</span> {[klient?.sidlo, klient?.psc, klient?.mesto].filter(Boolean).join(', ') || '—'}</div>
              <div><span className="text-muted-foreground">Provozovny:</span> {klient?.pracoviste?.map((p) => p.nazev).join(', ') || '—'}</div>
            </div>
          </CardContent>
        </Card>

        {/* Roční tabulka činností */}
        <Card>
          <CardContent className="py-4">
            <div className="text-sm font-bold text-[#0F2038] mb-3">Přehled činností — rok {rok}</div>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-[11px] uppercase text-muted-foreground border-b-2 border-[#0F2038]">
                  <th className="text-left font-bold py-2 pr-2">Činnost</th>
                  <th className="text-right font-bold py-2 pl-2 w-[130px]">Datum provedení</th>
                </tr>
              </thead>
              <tbody>
                {tabulka.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="py-2 pr-2 align-top">{r.nazev}</td>
                    <td className={`py-2 pl-2 text-right align-top tabular-nums ${r.datumProvedeni ? 'font-semibold' : 'text-muted-foreground'}`}>
                      {formatDatum(r.datumProvedeni)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[10px] text-muted-foreground mt-3 leading-snug">
              K uvedeným činnostem jsou vyhotoveny samostatné záznamy uložené v dokumentaci požární ochrany.
              Datum se načítá z evidovaných revizí, školení a prohlídek.
            </p>
          </CardContent>
        </Card>

        {/* Volné záznamy */}
        <Card>
          <CardContent className="py-4">
            <div className="text-sm font-bold text-[#0F2038] mb-3">Volné záznamy — rok {rok}</div>

            {zaznamyRoku.length === 0 ? (
              <p className="text-sm text-muted-foreground">Žádné volné záznamy pro tento rok.</p>
            ) : (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-[11px] uppercase text-muted-foreground border-b-2 border-[#0F2038]">
                    <th className="text-left font-bold py-2 pr-2 w-[100px]">Datum</th>
                    <th className="text-left font-bold py-2 px-2">Obsah zjištění / nedostatky; odstranění</th>
                    <th className="text-left font-bold py-2 pl-2 w-[130px]">Záznam provedl</th>
                  </tr>
                </thead>
                <tbody>
                  {zaznamyRoku.map((z) => (
                    <tr key={z.id} className="border-b last:border-0 align-top">
                      <td className="py-2 pr-2 tabular-nums">{formatDatum(z.datum)}</td>
                      <td className="py-2 px-2 whitespace-pre-wrap">{z.obsah}</td>
                      <td className="py-2 pl-2">
                        <span className="inline-flex items-center gap-1 text-xs">
                          {z.zadal === 'ozo'
                            ? <ShieldCheck className="h-3 w-3 text-emerald-600" />
                            : <User className="h-3 w-3 text-blue-600" />}
                          {z.zadalJmeno ?? (z.zadal === 'ozo' ? 'OZO' : 'Klient')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Přidání záznamu — netiskne se */}
            <div className="no-print mt-4 pt-4 border-t space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Přidat volný záznam</div>
              <div className="grid gap-2 sm:grid-cols-[150px_1fr]">
                <div className="space-y-1">
                  <Label className="text-xs">Datum</Label>
                  <Input type="date" value={novyDatum} onChange={(e) => setNovyDatum(e.target.value)} className="h-9" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Obsah</Label>
                  <Textarea
                    value={novyObsah}
                    onChange={(e) => setNovyObsah(e.target.value)}
                    placeholder="Zjištění, nedostatek, způsob odstranění…"
                    rows={2}
                  />
                </div>
              </div>
              <Button onClick={pridejZaznam} disabled={uklada || !novyDatum || novyObsah.trim() === ''}>
                {uklada ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                Přidat záznam
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
