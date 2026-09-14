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
  AlertTriangle, RotateCw,
} from 'lucide-react';
import type { Osoba } from '@/lib/osoby';
import { celeJmeno } from '@/lib/osoby';
import type { CiselnikCinnost } from '@/lib/cinnosti';
import type { Udalost } from '@/lib/udalosti';
import { formatDatum, POPIS_DRUHU, POPIS_ZAVERU, nactiPrah } from '@/lib/udalosti';
import type { CiselnikUzel, VyhodnocenyUzel, FazeUzlu } from '@/lib/uzly';
import { vyhodnotMapu, POPIS_FAZE, souhrnMapy } from '@/lib/uzly';
import type { CiselnikSkoleni } from '@/lib/skoleni';

const FAZE: FazeUzlu[] = ['nastup', 'provoz', 'udalost', 'ukonceni'];

export default function KartaOsoby({
  osoba, klientId, uzly, cinnosti, udalosti, jeVedouci, skoleni, periodaProhlidky, zavri, poZmene,
}: {
  osoba: Osoba | null;
  klientId: string | null;
  uzly: CiselnikUzel[];
  cinnosti: CiselnikCinnost[];
  udalosti: Udalost[];
  jeVedouci: boolean;
  skoleni: CiselnikSkoleni[];
  periodaProhlidky?: number;
  zavri: () => void;
  poZmene: () => void;
}) {
  const { toast } = useToast();
  const [rozbaleny, setRozbaleny] = useState<string | null>(null);
  const [uklada, setUklada] = useState<string | null>(null);

  const prah = nactiPrah();

  const mapa: VyhodnocenyUzel[] = useMemo(
    () => (osoba
      ? vyhodnotMapu(uzly, osoba, cinnosti, udalosti, jeVedouci, skoleni, periodaProhlidky, prah)
      : []),
    [osoba, uzly, cinnosti, udalosti, jeVedouci, skoleni, periodaProhlidky, prah],
  );

  const souhrn = useMemo(() => souhrnMapy(mapa), [mapa]);

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

  return (
    <Dialog open={!!osoba} onOpenChange={(o) => !o && zavri()}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>{osoba ? celeJmeno(osoba) : ''}</DialogTitle>
          <DialogDescription>
            {souhrn.splneno} z {souhrn.celkem} kroků v pořádku
            {souhrn.problemy > 0 ? ` · ${souhrn.problemy} vyžaduje pozornost` : ''}.
            Zobrazují se jen kroky, které se této osoby týkají.
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
                  {faze === 'provoz' && (
                    <span className="ml-2 normal-case font-normal tracking-normal">
                      termín dalšího
                    </span>
                  )}
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
                          className="flex w-full items-center gap-2 sm:gap-3 px-2.5 sm:px-3 py-2.5 text-left hover:bg-muted/40"
                        >
                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                              m.stav === 'splneno' || m.stav === 'ok'
                                ? 'border-emerald-600 bg-emerald-600 text-white'
                                : m.stav === 'blizi'
                                  ? 'border-amber-500 bg-amber-500 text-white'
                                  : m.stav === 'po'
                                    ? 'border-red-600 bg-red-600 text-white'
                                    : 'border-slate-300 text-slate-300'
                            }`}
                          >
                            {m.stav === 'splneno' || m.stav === 'ok'
                              ? <Check className="h-3 w-3" />
                              : m.stav === 'po'
                                ? <AlertTriangle className="h-3 w-3" />
                                : m.stav === 'blizi'
                                  ? <RotateCw className="h-3 w-3" />
                                  : <Circle className="h-2 w-2 fill-current" />}
                          </span>
                          <span className="flex-1 text-[13px] sm:text-sm font-medium leading-tight">{m.uzel.nazev}</span>
                          {m.uzel.formular && (
                            <span className="hidden sm:flex items-center gap-1 text-[11px] text-muted-foreground">
                              <FileText className="h-3 w-3" />{m.uzel.formular}
                            </span>
                          )}
                          <span className="text-xs whitespace-nowrap text-right">
                            {m.uzel.uzavreni === 'doklady' ? (
                              <span className={
                                m.stav === 'po' ? 'text-red-700 font-bold'
                                : m.stav === 'blizi' ? 'text-amber-700 font-medium'
                                : m.stav === 'chybi' ? 'text-slate-400 italic'
                                : 'text-emerald-700 font-medium'
                              }>
                                {m.stav === 'chybi' ? 'žádný doklad' : `nejbližší ${formatDatum(m.dalsi)}`}
                              </span>
                            ) : m.uzel.faze === 'provoz' ? (
                              <>
                                <span className={
                                  m.stav === 'po' ? 'text-red-700 font-bold'
                                  : m.stav === 'blizi' ? 'text-amber-700 font-medium'
                                  : m.stav === 'chybi' ? 'text-slate-400 italic'
                                  : 'text-emerald-700 font-medium'
                                }>
                                  {m.stav === 'chybi' ? 'bez záznamu' : formatDatum(m.dalsi)}
                                </span>
                                {m.stav !== 'chybi' && (
                                  <span className="block text-[10px] text-muted-foreground">
                                    poslední {formatDatum(m.datum)}
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className={m.stav === 'splneno' ? 'text-emerald-700 font-medium' : 'text-muted-foreground'}>
                                {m.stav === 'splneno' ? formatDatum(m.datum) : 'čeká'}
                              </span>
                            )}
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

                            {m.uzel.uzavreni === 'doklady' ? (
                              (m.doklady ?? []).length === 0 ? (
                                <p className="text-[11px] text-muted-foreground">
                                  Osoba nemá zapsaný žádný průkaz ani osvědčení. Zapisují se
                                  na záložce Školení u témat označených jako doklad.
                                </p>
                              ) : (
                                <div className="rounded border bg-background divide-y">
                                  {(m.doklady ?? []).map((d, i) => (
                                    <div key={i} className="flex items-center justify-between gap-3 px-3 py-1.5 text-xs">
                                      <span className="min-w-0">
                                        <span className="font-medium">{d.nazev}</span>
                                        {d.cislo && <span className="text-muted-foreground"> · č. {d.cislo}</span>}
                                      </span>
                                      <span className={
                                        d.stav === 'po' ? 'text-red-700 font-bold whitespace-nowrap'
                                        : d.stav === 'blizi' ? 'text-amber-700 font-medium whitespace-nowrap'
                                        : d.stav === 'chybi' ? 'text-slate-400 italic whitespace-nowrap'
                                        : 'text-emerald-700 font-medium whitespace-nowrap'
                                      }>
                                        {d.stav === 'chybi' ? 'bez platnosti' : `platí do ${formatDatum(d.platnostDo)}`}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )
                            ) : rucni ? (
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
                                {m.uzel.faze === 'provoz'
                                  ? `Opakuje se; termín se počítá od data poslední události této osoby${m.perioda ? ` (perioda ${m.perioda} měsíců)` : ''}. Nový záznam přidáte na záložce ${m.uzel.uzavreni === 'prohlidkou' ? 'Prohlídky' : 'Školení'}.`
                                  : `Uzavře se automaticky zápisem na záložce ${m.uzel.uzavreni === 'prohlidkou' ? 'Prohlídky' : 'Školení'}.`}
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
