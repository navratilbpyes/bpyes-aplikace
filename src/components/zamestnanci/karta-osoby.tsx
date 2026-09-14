'use client';

/**
 * AuditFlow — karta osoby s procesní mapou.
 * Umístění: src/components/zamestnanci/karta-osoby.tsx
 *
 * Nahoře fáze procesu, kde člověk stojí; dole sloučená historie školení,
 * zácviků a prohlídek. U osoby v provozu je celá osa splněná a nezabírá
 * pozornost; u nováčka je to jeho seznam úkolů.
 */

import { useState, useMemo } from 'react';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '@/components/data-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Check, Circle, ChevronDown, ChevronRight, FileText, Loader2, Stethoscope, GraduationCap,
} from 'lucide-react';
import type { Osoba } from '@/lib/osoby';
import { celeJmeno } from '@/lib/osoby';
import type { CiselnikCinnost } from '@/lib/cinnosti';
import type { Udalost } from '@/lib/udalosti';
import { formatDatum, POPIS_DRUHU, POPIS_ZAVERU } from '@/lib/udalosti';
import type { CiselnikUzel, VyhodnocenyUzel, FazeUzlu } from '@/lib/uzly';
import { vyhodnotMapu, POPIS_FAZE } from '@/lib/uzly';

const FAZE: FazeUzlu[] = ['nastup', 'provoz', 'udalost', 'ukonceni'];

export default function KartaOsoby({
  osoba, klientId, uzly, cinnosti, udalosti, jeVedouci, zavri, poZmene,
}: {
  osoba: Osoba | null;
  klientId: string | null;
  uzly: CiselnikUzel[];
  cinnosti: CiselnikCinnost[];
  udalosti: Udalost[];
  jeVedouci: boolean;
  zavri: () => void;
  poZmene: () => void;
}) {
  const { toast } = useToast();
  const [rozbaleny, setRozbaleny] = useState<string | null>(null);
  const [uklada, setUklada] = useState<string | null>(null);

  const mapa: VyhodnocenyUzel[] = useMemo(
    () => (osoba ? vyhodnotMapu(uzly, osoba, cinnosti, udalosti, jeVedouci) : []),
    [osoba, uzly, cinnosti, udalosti, jeVedouci],
  );

  const mojeUdalosti = useMemo(
    () => (osoba
      ? udalosti
        .filter((u) => u.osobaId === osoba.id)
        .sort((a, b) => (b.datum ?? '').localeCompare(a.datum ?? ''))
      : []),
    [osoba, udalosti],
  );

  /** Ruční uzavření uzlu — datum se ukládá do mapy `uzavreneUzly` na osobě. */
  async function uzavriRucne(uzelId: string, datum: string) {
    if (!osoba || !klientId) return;
    setUklada(uzelId);
    try {
      const stavajici = ((osoba as any).uzavreneUzly ?? {}) as Record<string, string>;
      const nove = { ...stavajici };
      if (datum) nove[uzelId] = new Date(datum).toISOString();
      else delete nove[uzelId];
      await updateDoc(doc(db, 'klienti', klientId, 'osoby', osoba.id), { uzavreneUzly: nove });
      (osoba as any).uzavreneUzly = nove;
      poZmene();
    } catch (e: any) {
      toast({ title: 'Uložení selhalo', description: e?.message ?? '', variant: 'destructive' });
    } finally {
      setUklada(null);
    }
  }

  const splneno = mapa.filter((m) => m.stav === 'splneno').length;

  return (
    <Dialog open={!!osoba} onOpenChange={(o) => !o && zavri()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{osoba ? celeJmeno(osoba) : ''}</DialogTitle>
          <DialogDescription>
            {splneno} z {mapa.length} kroků splněno. Zobrazují se jen kroky,
            které se této osoby týkají.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {FAZE.map((faze) => {
            const vFazi = mapa.filter((m) => m.uzel.faze === faze);
            if (vFazi.length === 0) return null;
            return (
              <div key={faze} className="space-y-1">
                <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                  {POPIS_FAZE[faze]}
                </p>
                <div className="rounded-lg border divide-y">
                  {vFazi.map((m) => {
                    const rozbaleno = rozbaleny === m.uzel.id;
                    const rucni = m.uzel.uzavreni === 'rucne';
                    return (
                      <div key={m.uzel.id}>
                        <button
                          type="button"
                          onClick={() => setRozbaleny(rozbaleno ? null : m.uzel.id)}
                          className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/40"
                        >
                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                              m.stav === 'splneno'
                                ? 'border-emerald-600 bg-emerald-600 text-white'
                                : 'border-slate-300 text-slate-300'
                            }`}
                          >
                            {m.stav === 'splneno'
                              ? <Check className="h-3 w-3" />
                              : <Circle className="h-2 w-2 fill-current" />}
                          </span>
                          <span className="flex-1 text-sm font-medium">{m.uzel.nazev}</span>
                          {m.uzel.formular && (
                            <span className="hidden sm:flex items-center gap-1 text-[11px] text-muted-foreground">
                              <FileText className="h-3 w-3" />{m.uzel.formular}
                            </span>
                          )}
                          <span className={`text-xs whitespace-nowrap ${m.stav === 'splneno' ? 'text-emerald-700 font-medium' : 'text-muted-foreground'}`}>
                            {m.stav === 'splneno' ? formatDatum(m.datum) : 'čeká'}
                          </span>
                          {rozbaleno ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                        </button>

                        {rozbaleno && (
                          <div className="space-y-3 border-t bg-muted/20 px-3 py-3">
                            {m.uzel.napoveda && (
                              <p className="text-xs leading-relaxed text-muted-foreground">
                                {m.uzel.napoveda}
                              </p>
                            )}
                            {m.uzel.predpis && (
                              <p className="text-[11px] text-muted-foreground">{m.uzel.predpis}</p>
                            )}

                            {rucni ? (
                              <div className="flex items-end gap-2">
                                <div className="space-y-1">
                                  <Label className="text-xs">Splněno dne</Label>
                                  <Input
                                    type="date"
                                    value={m.datum ? m.datum.split('T')[0] : ''}
                                    onChange={(e) => uzavriRucne(m.uzel.id, e.target.value)}
                                    className="h-9 w-[170px]"
                                  />
                                </div>
                                {uklada === m.uzel.id && <Loader2 className="h-4 w-4 animate-spin mb-2" />}
                                {m.datum && (
                                  <Button
                                    variant="ghost" size="sm"
                                    onClick={() => uzavriRucne(m.uzel.id, '')}
                                    className="mb-0.5 text-xs text-muted-foreground"
                                  >
                                    Zrušit
                                  </Button>
                                )}
                              </div>
                            ) : (
                              <p className="text-[11px] text-muted-foreground">
                                Uzavře se automaticky zápisem na záložce
                                {m.uzel.uzavreni === 'prohlidkou' ? ' Prohlídky' : ' Školení'}.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
              Historie
            </p>
            {mojeUdalosti.length === 0 ? (
              <p className="py-3 text-xs text-muted-foreground">Zatím žádné záznamy.</p>
            ) : (
              <div className="rounded-lg border divide-y">
                {mojeUdalosti.map((u) => (
                  <div key={u.id} className="flex items-start gap-3 px-3 py-2">
                    {u.typ === 'prohlidka'
                      ? <Stethoscope className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                      : <GraduationCap className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {u.typ === 'prohlidka'
                          ? `${POPIS_DRUHU[u.druhProhlidky ?? 'periodicka']} prohlídka`
                          : (u.temaNazev ?? 'Školení')}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {u.datumDo ? `zácvik do ${formatDatum(u.datumDo)} · ` : ''}
                        {u.zaver ? `${POPIS_ZAVERU[u.zaver]} · ` : ''}
                        {u.provedl ?? ''}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDatum(u.datum)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
