'use client';

/**
 * AuditFlow — nahrání a správa protokolu u revize/školení.
 * Umístění: src/components/protokol-upload.tsx
 *
 * Sdílená komponenta pro dvě místa:
 *  - klient (/moje-revize): nahraje / vymění / odpojí protokol → protokolStav 'ceka'
 *  - admin (revize-klienta): navíc „Viděl jsem" (→ 'videl') a „Odmítnout" (→ 'odmitnuto' + důvod)
 *
 * Zápis protokolových polí NEDĚLÁ tato komponenta sama — deleguje ho přes
 * `onUlozit(zmeny)` na rodiče (moje-revize / revize-klienta), který má vlastní
 * `updateDoc` na správné kolekci (revize|skoleni). Tím se drží jeden zápisový
 * kanál a Rules se řeší na jednom místě.
 *
 * Fyzický upload souboru běží přes lib/protokol.ts (API nahrat-soubor).
 */

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Loader2, Upload, FileText, Eye, Check, X, Clock, ShieldCheck, Ban, RefreshCw,
} from 'lucide-react';
import { cn } from '@/app/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  nahrajProtokol, otevriProtokol, POVOLENE_TYPY,
} from '@/lib/protokol';
import type { ProtokolPole, ProtokolStav } from '@/lib/protokol';

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
  const [odmitam, setOdmitam] = useState(false);
  const [duvod, setDuvod] = useState('');

  const maProtokol = !!data.protokolDokumentId;
  const stav = (data.protokolStav ?? null) as ProtokolStav | null;

  // --- klient/admin: nahrání nebo výměna souboru ---
  async function zpracujSoubor(soubor: File) {
    setNahravam(true);
    try {
      const dokumentId = await nahrajProtokol(soubor, klientId);
      // Po nahrání protokol vždy jde do stavu 'ceka' (i výměna po odmítnutí).
      await onUlozit({
        protokolDokumentId: dokumentId,
        protokolNazev: soubor.name,
        protokolStav: 'ceka',
        protokolDuvod: null,
      });
      toast({ title: 'Protokol nahrán', description: 'Čeká na kontrolu OZO.' });
    } catch (e: any) {
      toast({ title: 'Nahrání selhalo', description: e?.message ?? 'Zkuste to znovu.', variant: 'destructive' });
    } finally {
      setNahravam(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  // --- odpojení protokolu (oprava omylu) ---
  async function odpoj() {
    setUkladam(true);
    try {
      await onUlozit({
        protokolDokumentId: null,
        protokolNazev: null,
        protokolStav: null,
        protokolDuvod: null,
      });
      toast({ title: 'Protokol odpojen' });
    } catch (e: any) {
      toast({ title: 'Nepodařilo se odpojit', description: e?.message ?? '', variant: 'destructive' });
    } finally {
      setUkladam(false);
    }
  }

  // --- admin: viděl jsem ---
  async function oznacVidel() {
    setUkladam(true);
    try {
      await onUlozit({ protokolStav: 'videl', protokolDuvod: null });
      toast({ title: 'Označeno', description: 'Protokol vzat na vědomí.' });
    } catch (e: any) {
      toast({ title: 'Nepodařilo se uložit', description: e?.message ?? '', variant: 'destructive' });
    } finally {
      setUkladam(false);
    }
  }

  // --- admin: odmítnout s důvodem ---
  async function odmitni() {
    setUkladam(true);
    try {
      await onUlozit({ protokolStav: 'odmitnuto', protokolDuvod: duvod.trim() || null });
      setOdmitam(false);
      setDuvod('');
      toast({ title: 'Protokol odmítnut' });
    } catch (e: any) {
      toast({ title: 'Nepodařilo se uložit', description: e?.message ?? '', variant: 'destructive' });
    } finally {
      setUkladam(false);
    }
  }

  const busy = nahravam || ukladam;

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept={POVOLENE_TYPY.join(',')}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) zpracujSoubor(f);
        }}
      />

      {!maProtokol ? (
        // ── žádný protokol → tlačítko nahrát ──
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || busy}
          onClick={() => inputRef.current?.click()}
        >
          {nahravam ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
          Nahrát protokol (PDF/JPG/PNG)
        </Button>
      ) : (
        // ── protokol existuje → náhled + stav + akce ──
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => otevriProtokol(data.protokolDokumentId!)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:underline min-w-0"
            >
              <FileText className="h-4 w-4 shrink-0" />
              <span className="truncate max-w-[220px]">{data.protokolNazev ?? 'protokol'}</span>
            </button>

            {stav && (
              <span className={cn(
                'inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded',
                STAV_STYL[stav].tridy,
              )}>
                {(() => { const I = STAV_STYL[stav].Ikona; return <I className="h-3 w-3" />; })()}
                {STAV_STYL[stav].label}
              </span>
            )}
          </div>

          {stav === 'odmitnuto' && data.protokolDuvod && (
            <p className="text-xs text-red-700 bg-red-50 rounded px-2 py-1">
              Důvod: {data.protokolDuvod}
            </p>
          )}

          {/* akce nad protokolem */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* výměna / odpojení — klient i admin (oprava omylu) */}
            <Button
              type="button" variant="ghost" size="sm"
              disabled={disabled || busy}
              onClick={() => inputRef.current?.click()}
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Vyměnit
            </Button>
            <Button
              type="button" variant="ghost" size="sm"
              disabled={disabled || busy}
              onClick={odpoj}
              className="text-muted-foreground"
            >
              <X className="h-3.5 w-3.5 mr-1.5" /> Odpojit
            </Button>

            {/* admin akce — jen když čeká */}
            {adminMode && stav === 'ceka' && !odmitam && (
              <>
                <Button
                  type="button" variant="outline" size="sm"
                  disabled={busy}
                  onClick={oznacVidel}
                  className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                >
                  <Eye className="h-3.5 w-3.5 mr-1.5" /> Viděl jsem
                </Button>
                <Button
                  type="button" variant="outline" size="sm"
                  disabled={busy}
                  onClick={() => setOdmitam(true)}
                  className="border-red-300 text-red-700 hover:bg-red-50"
                >
                  <Ban className="h-3.5 w-3.5 mr-1.5" /> Odmítnout
                </Button>
              </>
            )}
          </div>

          {/* admin: panel odmítnutí s důvodem */}
          {adminMode && odmitam && (
            <div className="space-y-2 rounded-lg border border-red-200 bg-red-50/50 p-3">
              <Textarea
                placeholder="Důvod odmítnutí (nepovinné) — např. špatný soubor, není to revizní protokol…"
                value={duvod}
                onChange={(e) => setDuvod(e.target.value)}
                rows={2}
              />
              <div className="flex items-center gap-2">
                <Button type="button" size="sm" variant="destructive" disabled={busy} onClick={odmitni}>
                  {ukladam ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Check className="h-3.5 w-3.5 mr-1.5" />}
                  Potvrdit odmítnutí
                </Button>
                <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => { setOdmitam(false); setDuvod(''); }}>
                  Zrušit
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
