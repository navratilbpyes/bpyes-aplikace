'use client';

/**
 * AuditFlow — poskytovatelé pracovnělékařských služeb u klienta.
 * Umístění: src/components/klienti/sekce-pls.tsx
 *
 * Zaměstnavatel má povinnost uzavřít smlouvu o PLS (§ 54 zák. č. 373/2011 Sb.).
 * Poskytovatelů může být víc — typicky jiný pro každé pracoviště, nebo zvlášť
 * pro dopravně psychologické vyšetření.
 *
 * Data žijí v podkolekci `klienti/{id}/pls` a slouží k předvyplnění žádostí
 * o prohlídku (F006, F007, F008).
 */

import { useState, useEffect, useCallback } from 'react';
import { collection, addDoc, updateDoc, doc, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/components/data-provider';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Plus, Loader2, Stethoscope, Pencil, Trash2, Phone, Mail, MapPin, FileText,
} from 'lucide-react';
import type { StavZaznamu } from '@/lib/skoleni';
import Napoveda from '@/components/ui/napoveda';

export interface Poskytovatel {
  id: string;
  nazev: string;
  lekar?: string | null;
  ico?: string | null;
  adresa?: string | null;
  telefon?: string | null;
  email?: string | null;
  /** datum uzavření smlouvy o poskytování PLS (§ 54 zák. č. 373/2011 Sb.) */
  smlouvaOd?: string | null;
  smlouvaDo?: string | null;
  /** čeho se týká — pracoviště, druh prohlídek, DPV apod. */
  rozsah?: string | null;
  /** výchozí pro nové žádosti o prohlídku */
  hlavni?: boolean;
  poznamka?: string | null;
  stav: StavZaznamu;
}

const PRAZDNY = {
  nazev: '', lekar: '', ico: '', adresa: '', telefon: '', email: '',
  smlouvaOd: '', smlouvaDo: '', rozsah: '', poznamka: '', hlavni: false,
};

export default function SekcePls({ klientId }: { klientId: string }) {
  const { toast } = useToast();
  const [polozky, setPolozky] = useState<Poskytovatel[]>([]);
  const [nacitam, setNacitam] = useState(true);
  const [otevreno, setOtevreno] = useState(false);
  const [upravovany, setUpravovany] = useState<Poskytovatel | null>(null);
  const [f, setF] = useState({ ...PRAZDNY });
  const [uklada, setUklada] = useState(false);

  const nacti = useCallback(async () => {
    setNacitam(true);
    try {
      const snap = await getDocs(
        query(collection(db, 'klienti', klientId, 'pls'), where('stav', '==', 'aktivni')),
      );
      setPolozky(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as Poskytovatel)
          .sort((a, b) => Number(!!b.hlavni) - Number(!!a.hlavni) || a.nazev.localeCompare(b.nazev, 'cs')),
      );
    } catch (e) {
      console.error('Načtení poskytovatelů selhalo:', e);
    } finally {
      setNacitam(false);
    }
  }, [klientId]);

  useEffect(() => { nacti(); }, [nacti]);

  const naDatum = (iso?: string | null) => (iso ? iso.split('T')[0] : '');

  function otevriNovy() {
    setUpravovany(null);
    setF({ ...PRAZDNY });
    setOtevreno(true);
  }

  function otevriUpravu(p: Poskytovatel) {
    setUpravovany(p);
    setF({
      nazev: p.nazev ?? '', lekar: p.lekar ?? '', ico: p.ico ?? '', adresa: p.adresa ?? '',
      telefon: p.telefon ?? '', email: p.email ?? '',
      smlouvaOd: naDatum(p.smlouvaOd), smlouvaDo: naDatum(p.smlouvaDo),
      rozsah: p.rozsah ?? '', poznamka: p.poznamka ?? '', hlavni: !!p.hlavni,
    });
    setOtevreno(true);
  }

  async function uloz() {
    if (!f.nazev.trim()) return;
    setUklada(true);
    const data = {
      nazev: f.nazev.trim(),
      lekar: f.lekar.trim() || null,
      ico: f.ico.trim() || null,
      adresa: f.adresa.trim() || null,
      telefon: f.telefon.trim() || null,
      email: f.email.trim() || null,
      smlouvaOd: f.smlouvaOd ? new Date(f.smlouvaOd).toISOString() : null,
      smlouvaDo: f.smlouvaDo ? new Date(f.smlouvaDo).toISOString() : null,
      rozsah: f.rozsah.trim() || null,
      poznamka: f.poznamka.trim() || null,
      hlavni: f.hlavni,
      stav: 'aktivni' as StavZaznamu,
    };
    try {
      // hlavní může být jen jeden — ostatní se odznačí
      if (f.hlavni) {
        await Promise.all(
          polozky
            .filter((p) => p.hlavni && p.id !== upravovany?.id)
            .map((p) => updateDoc(doc(db, 'klienti', klientId, 'pls', p.id), { hlavni: false })),
        );
      }
      if (upravovany) {
        await updateDoc(doc(db, 'klienti', klientId, 'pls', upravovany.id), data);
      } else {
        await addDoc(collection(db, 'klienti', klientId, 'pls'), data);
      }
      setOtevreno(false);
      nacti();
      toast({ title: upravovany ? 'Uloženo' : 'Poskytovatel přidán' });
    } catch (e: any) {
      toast({ title: 'Uložení selhalo', description: e?.message ?? '', variant: 'destructive' });
    } finally {
      setUklada(false);
    }
  }

  async function smaz(p: Poskytovatel) {
    if (!confirm(`Odebrat ${p.nazev}?`)) return;
    await updateDoc(doc(db, 'klienti', klientId, 'pls', p.id), { stav: 'smazano' });
    nacti();
  }

  return (
    <>
      <div className="flex justify-between items-center">
        <h3 className="font-bold flex items-center gap-1.5">Poskytovatelé pracovnělékařských služeb ({polozky.length}) <Napoveda klic="pls" /></h3>
        <Button size="sm" variant="outline" onClick={otevriNovy}>
          <Plus className="mr-2 h-4 w-4" /> Přidat poskytovatele
        </Button>
      </div>

      {nacitam ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Načítám…
        </div>
      ) : polozky.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground border border-dashed rounded-lg space-y-1">
          <p>Zatím není zadán žádný poskytovatel PLS.</p>
          <p className="text-xs">
            Zaměstnavatel má povinnost mít uzavřenou smlouvu o pracovnělékařských službách
            (§ 54 zákona č. 373/2011 Sb.). Údaje se použijí v žádostech o prohlídku.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {polozky.map((p) => (
            <Card key={p.id} className="border-none shadow-sm">
              <CardContent className="flex items-start justify-between gap-4 p-6">
                <div className="flex items-start gap-4 min-w-0">
                  <div className="h-10 w-10 rounded-full bg-primary/5 flex items-center justify-center shrink-0">
                    <Stethoscope className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold">{p.nazev}</p>
                      {p.hlavni && (
                        <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded bg-[hsl(var(--stav-vyhovuje))]/10 text-[hsl(var(--stav-vyhovuje))]">
                          Hlavní
                        </span>
                      )}
                    </div>
                    {p.lekar && <p className="text-sm text-muted-foreground">{p.lekar}</p>}
                    {p.rozsah && (
                      <p className="text-xs flex items-start gap-1.5">
                        <FileText className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                        {p.rozsah}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground pt-1">
                      {p.adresa && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{p.adresa}</span>}
                      {p.telefon && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{p.telefon}</span>}
                      {p.email && <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{p.email}</span>}
                    </div>
                    {(p.smlouvaOd || p.smlouvaDo) && (
                      <p className="text-[11px] text-muted-foreground pt-1">
                        Smlouva{p.smlouvaOd ? ` od ${new Date(p.smlouvaOd).toLocaleDateString('cs-CZ')}` : ''}
                        {p.smlouvaDo ? ` do ${new Date(p.smlouvaDo).toLocaleDateString('cs-CZ')}` : ' — na dobu neurčitou'}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => otevriUpravu(p)} title="Upravit">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost" size="icon"
                    onClick={() => smaz(p)}
                    className="text-muted-foreground hover:text-destructive"
                    title="Odebrat"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={otevreno} onOpenChange={setOtevreno}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{upravovany ? 'Úprava poskytovatele' : 'Nový poskytovatel PLS'}</DialogTitle>
            <DialogDescription>
              Údaje se předvyplní do žádostí o pracovnělékařskou prohlídku.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Název poskytovatele</Label>
              <Input value={f.nazev} onChange={(e) => setF({ ...f, nazev: e.target.value })} placeholder="např. MEDICA Jeseník s.r.o." />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Posuzující lékař</Label>
              <Input value={f.lekar} onChange={(e) => setF({ ...f, lekar: e.target.value })} placeholder="MUDr. …" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">IČO</Label>
              <Input value={f.ico} onChange={(e) => setF({ ...f, ico: e.target.value })} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Adresa</Label>
              <Input value={f.adresa} onChange={(e) => setF({ ...f, adresa: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Telefon</Label>
              <Input value={f.telefon} onChange={(e) => setF({ ...f, telefon: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">E-mail</Label>
              <Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Smlouva od</Label>
              <Input type="date" value={f.smlouvaOd} onChange={(e) => setF({ ...f, smlouvaOd: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Smlouva do (volitelně)</Label>
              <Input type="date" value={f.smlouvaDo} onChange={(e) => setF({ ...f, smlouvaDo: e.target.value })} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Rozsah</Label>
              <Input
                value={f.rozsah}
                onChange={(e) => setF({ ...f, rozsah: e.target.value })}
                placeholder="např. provozovna Jeseník — všechny druhy prohlídek"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Poznámka</Label>
              <Textarea
                value={f.poznamka}
                onChange={(e) => setF({ ...f, poznamka: e.target.value })}
                className="min-h-[50px] text-sm"
              />
            </div>
            <div className="flex items-center gap-3 sm:col-span-2 rounded border px-3 py-2">
              <Switch checked={f.hlavni} onCheckedChange={(v) => setF({ ...f, hlavni: v })} />
              <div>
                <Label className="text-xs font-semibold">Hlavní poskytovatel</Label>
                <p className="text-[11px] text-muted-foreground">
                  Předvyplní se do žádostí. Hlavní může být jen jeden.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOtevreno(false)}>Zrušit</Button>
            <Button onClick={uloz} disabled={uklada || !f.nazev.trim()}>
              {uklada && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Uložit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
