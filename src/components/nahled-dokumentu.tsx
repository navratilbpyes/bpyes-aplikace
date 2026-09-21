'use client';

/**
 * AuditFlow — náhled nahraného dokumentu.
 * Umístění: src/components/nahled-dokumentu.tsx
 *
 * Kliknutí na protokol dřív rovnou stahovalo soubor. Při kontrole revizí
 * to znamenalo desítky souborů ve složce Stažené, jen aby se člověk podíval,
 * jestli je to ten správný papír. Náhled to řeší v aplikaci.
 *
 * Obrázky se vykreslí přímo, PDF v rámu. Stažení i otevření v nové kartě
 * zůstávají jako tlačítka.
 */

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Download, ExternalLink, AlertTriangle } from 'lucide-react';
import { odkazProtokolu, nahledProtokolu } from '@/lib/protokol';

export interface NahledCil {
  dokumentId: string;
  nazev: string;
}

export default function NahledDokumentu({
  cil, zavri,
}: {
  cil: NahledCil | null;
  zavri: () => void;
}) {
  const [odkaz, setOdkaz] = useState<string | null>(null);
  const [typ, setTyp] = useState<string>('');
  const [chyba, setChyba] = useState<string | null>(null);
  const [stahuji, setStahuji] = useState(false);

  useEffect(() => {
    if (!cil) { setOdkaz(null); setChyba(null); return; }
    let zrusen = false;
    let lokalni: string | null = null;
    setOdkaz(null); setChyba(null);
    (async () => {
      try {
        const { url, typ: t } = await nahledProtokolu(cil.dokumentId);
        lokalni = url;
        if (zrusen) { URL.revokeObjectURL(url); return; }
        setOdkaz(url);
        setTyp(t);
      } catch (e: any) {
        if (!zrusen) setChyba(e?.message ?? 'Dokument se nepodařilo načíst.');
      }
    })();
    // uvolnit paměť po zavření dialogu
    return () => { zrusen = true; if (lokalni) URL.revokeObjectURL(lokalni); };
  }, [cil]);

  const obrazek = typ.startsWith('image/');

  async function stahni() {
    if (!cil) return;
    setStahuji(true);
    try {
      const u = await odkazProtokolu(cil.dokumentId);
      window.open(u, '_blank', 'noopener,noreferrer');
    } finally {
      setStahuji(false);
    }
  }

  return (
    <Dialog open={!!cil} onOpenChange={(o) => !o && zavri()}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-hidden p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="truncate pr-8 text-base">{cil?.nazev}</DialogTitle>
        </DialogHeader>

        <div className="flex min-h-[50vh] items-center justify-center rounded-lg border bg-muted/20">
          {chyba ? (
            <div className="flex flex-col items-center gap-2 p-6 text-center">
              <AlertTriangle className="h-6 w-6 text-red-600" />
              <p className="text-sm font-medium">{chyba}</p>
            </div>
          ) : !odkaz ? (
            <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Načítám dokument…
            </div>
          ) : obrazek ? (
            <img
              src={odkaz}
              alt={cil?.nazev ?? 'náhled'}
              className="max-h-[70vh] w-auto max-w-full rounded object-contain"
            />
          ) : (
            <iframe
              src={odkaz}
              title={cil?.nazev ?? 'náhled'}
              className="h-[70vh] w-full rounded"
            />
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled={stahuji} onClick={stahni}>
            {stahuji ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Stáhnout
          </Button>
          <Button
            variant="ghost" size="sm"
            disabled={!odkaz}
            onClick={() => odkaz && window.open(odkaz, '_blank', 'noopener,noreferrer')}
          >
            <ExternalLink className="mr-2 h-4 w-4" /> Otevřít v nové kartě
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
