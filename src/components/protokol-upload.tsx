'use client';

/**
 * AuditFlow — nahrání a správa protokolů u revize/školení.
 * Umístění: src/components/protokol-upload.tsx
 *
 * Sdílená komponenta pro dvě místa:
 *  - klient (/moje-revize): nahraje / odebere protokol → stav 'ceka'
 *  - admin (revize-klienta, skoleni-klienta): navíc „Viděl jsem" a „Odmítnout"
 *
 * Protokolů může být u jedné revize víc (dílčí protokoly, přílohy, měření).
 * Ukládají se do pole `protokoly`; první z nich se zrcadlí do starých polí
 * `protokolDokumentId` a spol., aby report a časový plán fungovaly beze změny.
 *
 * Zápis NEDĚLÁ tato komponenta — deleguje ho přes `onUlozit(zmeny)` na rodiče,
 * který má updateDoc na správné kolekci. Jeden zápisový kanál, Rules na jednom místě.
 *
 * Fotky se před nahráním narovnají (komponenta OrezFotky); PDF jde tak, jak je.
 */

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Loader2, Upload, FileText, Eye, Check, X, Clock, ShieldCheck, Ban, ImageIcon,
} from 'lucide-react';
import { cn } from '@/app/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  nahrajProtokol, otevriProtokol, POVOLENE_TYPY,
  seznamProtokolu, zapisProtokoly,
} from '@/lib/protokol';
import type { ProtokolPole, ProtokolStav, ProtokolPolozka } from '@/lib/protokol';
import OrezFotky from '@/components/orez-fotky';
import { compressImage, dataUrlNaSoubor, SKEN_DOKUMENTU } from '@/lib/obrazky';

interface Props {
  /** klientId cílové revize/školení — admin ho posílá do uploadu */
  klientId: string;
  /** aktuální protokolová pole záznamu */
  data: ProtokolPole;
  /** uloží změny protokolových polí (rodič má updateDoc na revize|skoleni) */
  onUlozit: (zmeny: ProtokolPole) => Promise<void>;
  /** admin režim = zpřístupní „Viděl jsem" / „Odmítnout" */
  adminMode?: boolean;
  /** zakázat editaci (např. deaktivovaný klient) */
  disabled?: boolean;
}

const STAV_STYL: Record<ProtokolStav, { label: string; tridy: string; Ikona: any }> = {
  ceka: { label: 'Čeká na OZO', tridy: 'text-amber-700 bg-amber-50', Ikona: Clock },
  videl: { label: 'OZO viděl', tridy: 'text-emerald-700 bg-emerald-50', Ikona: ShieldCheck },
  odmitnuto: { label: 'Odmítnuto', tridy: 'text-red-700 bg-red-50', Ikona: Ban },
};

export default function ProtokolUpload({ klientId, data, onUlozit, adminMode, disabled }: Props) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [nahravam, setNahravam] = useState(false);
  const [ukladam, setUkladam] = useState(false);
  const [odmitam, setOdmitam] = useState<string | null>(null);
  const [duvod, setDuvod] = useState('');
  const [kOrezu, setKOrezu] = useState<File | null>(null);
  const [nadOblasti, setNadOblasti] = useState(false);
  /** fronta čekajících souborů — víc protokolů naráz se nahrává po jednom */
  const [fronta, setFronta] = useState<File[]>([]);

  const seznam = seznamProtokolu(data);
  const busy = nahravam || ukladam;

  /** Uloží nový seznam protokolů (rodič zapisuje). */
  async function ulozSeznam(novy: ProtokolPolozka[]) {
    await onUlozit(zapisProtokoly(novy));
  }

  async function nahraj(vstup: File) {
    setNahravam(true);
    try {
      // Fotky se vždy zmenší — originál z mobilu má i 8 MB a PHP na úložišti
      // ho odmítne. Text na listině musí zůstat čitelný, proto 1800 px.
      let soubor = vstup;
      if (vstup.type.startsWith('image/')) {
        const dataUrl = await compressImage(vstup, SKEN_DOKUMENTU);
        const zmenseny = await dataUrlNaSoubor(dataUrl, vstup.name);
        if (zmenseny.size < vstup.size) soubor = zmenseny;
      }
      const dokumentId = await nahrajProtokol(soubor, klientId);
      await ulozSeznam([
        ...seznam,
        {
          id: `p${Date.now()}`,
          dokumentId,
          nazev: soubor.name,
          stav: 'ceka',
          duvod: null,
          nahranoIso: new Date().toISOString(),
        },
      ]);
      toast({ title: 'Protokol nahrán', description: 'Čeká na kontrolu OZO.' });
      dalsiZFronty();
    } catch (e: any) {
      toast({ title: 'Nahrání selhalo', description: e?.message ?? 'Zkuste to znovu.', variant: 'destructive' });
    } finally {
      setNahravam(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  /** Fotku pošle nejdřív na narovnání, PDF nahraje rovnou. */
  function zpracujSoubor(soubor: File) {
    if (soubor.type.startsWith('image/')) setKOrezu(soubor);
    else nahraj(soubor);
  }

  /**
   * Přijme jeden i víc souborů. Nepovolené typy zahodí s hláškou,
   * zbytek zpracuje po jednom — ořez je dialog a ten nejde otevřít vícekrát.
   */
  function prijmi(soubory: File[]) {
    const povolene = soubory.filter((f) => POVOLENE_TYPY.includes(f.type));
    const zahozene = soubory.length - povolene.length;
    if (zahozene > 0) {
      toast({
        title: `${zahozene} ${zahozene === 1 ? 'soubor byl' : 'souborů bylo'} přeskočeno`,
        description: 'Přijímáme jen PDF, JPG a PNG.',
        variant: 'destructive',
      });
    }
    if (povolene.length === 0) return;
    const [prvni, ...zbytek] = povolene;
    setFronta(zbytek);
    zpracujSoubor(prvni);
  }

  /** Pustí další soubor z fronty, jakmile je předchozí hotový. */
  function dalsiZFronty() {
    setFronta((f) => {
      if (f.length === 0) return f;
      const [dalsi, ...zbytek] = f;
      // odložit o tick, ať se stihne zavřít předchozí dialog
      setTimeout(() => zpracujSoubor(dalsi), 0);
      return zbytek;
    });
  }

  async function odeber(id: string) {
    setUkladam(true);
    try {
      await ulozSeznam(seznam.filter((p) => p.id !== id));
      toast({ title: 'Protokol odpojen' });
    } catch (e: any) {
      toast({ title: 'Nepodařilo se odpojit', description: e?.message ?? '', variant: 'destructive' });
    } finally {
      setUkladam(false);
    }
  }

  async function zmenStav(id: string, stav: ProtokolStav, d: string | null = null) {
    setUkladam(true);
    try {
      await ulozSeznam(seznam.map((p) => (p.id === id ? { ...p, stav, duvod: d } : p)));
      setOdmitam(null);
      setDuvod('');
      toast({ title: stav === 'videl' ? 'Protokol vzat na vědomí' : 'Protokol odmítnut' });
    } catch (e: any) {
      toast({ title: 'Nepodařilo se uložit', description: e?.message ?? '', variant: 'destructive' });
    } finally {
      setUkladam(false);
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept={POVOLENE_TYPY.join(',')}
        multiple
        className="hidden"
        onChange={(e) => {
          const f = Array.from(e.target.files ?? []);
          if (f.length > 0) prijmi(f);
          e.target.value = '';
        }}
      />

      {seznam.length > 0 && (
        <div className="rounded-lg border divide-y">
          {seznam.map((p) => {
            const styl = STAV_STYL[p.stav];
            return (
              <div key={p.id} className="p-2.5 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => otevriProtokol(p.dokumentId)}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:underline min-w-0"
                  >
                    <FileText className="h-4 w-4 shrink-0" />
                    <span className="truncate max-w-[200px] sm:max-w-[280px]">{p.nazev}</span>
                  </button>

                  <span className={cn(
                    'inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded',
                    styl.tridy,
                  )}>
                    {(() => { const I = styl.Ikona; return <I className="h-3 w-3" />; })()}
                    {styl.label}
                  </span>

                  <Button
                    type="button" variant="ghost" size="icon"
                    className="h-7 w-7 ml-auto text-muted-foreground hover:text-destructive"
                    disabled={disabled || busy}
                    onClick={() => odeber(p.id)}
                    title="Odpojit"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {p.stav === 'odmitnuto' && p.duvod && (
                  <p className="text-xs text-red-700 bg-red-50 rounded px-2 py-1">
                    Důvod: {p.duvod}
                  </p>
                )}

                {adminMode && p.stav === 'ceka' && odmitam !== p.id && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      type="button" variant="outline" size="sm"
                      disabled={busy}
                      onClick={() => zmenStav(p.id, 'videl')}
                      className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                    >
                      <Eye className="h-3.5 w-3.5 mr-1.5" /> Viděl jsem
                    </Button>
                    <Button
                      type="button" variant="outline" size="sm"
                      disabled={busy}
                      onClick={() => { setOdmitam(p.id); setDuvod(''); }}
                      className="border-red-300 text-red-700 hover:bg-red-50"
                    >
                      <Ban className="h-3.5 w-3.5 mr-1.5" /> Odmítnout
                    </Button>
                  </div>
                )}

                {adminMode && odmitam === p.id && (
                  <div className="space-y-2 rounded-lg border border-red-200 bg-red-50/50 p-3">
                    <Textarea
                      placeholder="Důvod odmítnutí (nepovinné) — např. špatný soubor, není to revizní protokol…"
                      value={duvod}
                      onChange={(e) => setDuvod(e.target.value)}
                      rows={2}
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        type="button" size="sm" variant="destructive" disabled={busy}
                        onClick={() => zmenStav(p.id, 'odmitnuto', duvod.trim() || null)}
                      >
                        {ukladam ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Check className="h-3.5 w-3.5 mr-1.5" />}
                        Potvrdit odmítnutí
                      </Button>
                      <Button
                        type="button" size="sm" variant="ghost" disabled={busy}
                        onClick={() => { setOdmitam(null); setDuvod(''); }}
                      >
                        Zrušit
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Zóna pro přetažení. Kliknutí funguje stejně jako dřív — na mobilu
          se přetahovat nedá, takže musí zůstat plnohodnotnou alternativou. */}
      <div
        role="button"
        tabIndex={disabled || busy ? -1 : 0}
        onClick={() => !disabled && !busy && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !disabled && !busy) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => { e.preventDefault(); if (!disabled && !busy) setNadOblasti(true); }}
        onDragLeave={() => setNadOblasti(false)}
        onDrop={(e) => {
          e.preventDefault();
          setNadOblasti(false);
          if (disabled || busy) return;
          const f = Array.from(e.dataTransfer.files ?? []);
          if (f.length > 0) prijmi(f);
        }}
        className={cn(
          'flex flex-col items-center gap-1 rounded-lg border border-dashed px-4 py-5 text-center transition-colors',
          disabled || busy
            ? 'cursor-not-allowed opacity-60'
            : 'cursor-pointer hover:border-blue-400 hover:bg-blue-50/40',
          nadOblasti && 'border-blue-500 bg-blue-50',
        )}
      >
        {nahravam ? (
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
        ) : (
          <Upload className="h-5 w-5 text-muted-foreground" />
        )}
        <p className="text-sm font-medium">
          {nahravam
            ? `Nahrávám…${fronta.length > 0 ? ` (zbývá ${fronta.length})` : ''}`
            : seznam.length === 0 ? 'Nahrát protokol' : 'Přidat další protokol'}
        </p>
        <p className="text-[11px] text-muted-foreground">
          Přetáhněte sem soubory, nebo klepněte pro výběr · PDF, JPG, PNG · lze i více naráz
        </p>
        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
          <ImageIcon className="h-3 w-3" /> Vyfocenou listinu lze před nahráním narovnat.
        </p>
      </div>

      <OrezFotky
        soubor={kOrezu}
        zavri={() => { setKOrezu(null); dalsiZFronty(); }}
        hotovo={(upraveny) => { setKOrezu(null); nahraj(upraveny); }}
      />
    </div>
  );
}
