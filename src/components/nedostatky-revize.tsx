'use client';

/**
 * AuditFlow — nedostatky zjištěné revizí.
 * Umístění: src/components/nedostatky-revize.tsx
 *
 * Revizní technik vypíše v protokolu závady; ty se sem přepíšou a hlídá se
 * jejich odstranění. Stejná logika jako u nálezů z prověrky, jen vázaná
 * na konkrétní revizi.
 *
 * Pole odpovídají tomu, co se v praxi zapisuje: popis, kdo odstraní, do kdy,
 * kdy bylo odstraněno. Odstraněné se schovají, ať nepřekáží v přehledu.
 *
 * Zápis deleguje na rodiče přes `onUlozit` — jeden zápisový kanál na
 * revize|skoleni, stejně jako u protokolů.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Plus, X, Check, AlertTriangle, ChevronDown, ChevronRight, Loader2,
} from 'lucide-react';

/** Jeden nedostatek zjištěný revizí. */
export interface Nedostatek {
  id: string;
  popis: string;
  /** kdo má odstranit — jméno nebo pozice, volný text */
  odpovedny?: string | null;
  /** termín odstranění (ISO) */
  terminIso?: string | null;
  /** kdy bylo odstraněno (ISO); prázdné = trvá */
  odstranenoIso?: string | null;
  /** jak bylo odstraněno / poznámka */
  poznamka?: string | null;
  zadanoIso: string;
}

export interface NedostatkyPole {
  nedostatky?: Nedostatek[];
}

const isoNaDatum = (iso?: string | null) => (iso ? iso.slice(0, 10) : '');
const datumNaIso = (d: string) => (d ? new Date(`${d}T00:00:00`).toISOString() : null);
const format = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('cs-CZ') : '—');

/** Po termínu a dosud neodstraněné. */
function poTerminu(n: Nedostatek): boolean {
  return !n.odstranenoIso && !!n.terminIso && n.terminIso < new Date().toISOString();
}

export default function NedostatkyRevize({
  data, onUlozit, osoby = [], disabled,
}: {
  data: NedostatkyPole;
  onUlozit: (zmeny: NedostatkyPole) => Promise<void>;
  /** návrhy odpovědných osob (pozice z detailu klienta) */
  osoby?: string[];
  disabled?: boolean;
}) {
  const seznam = data.nedostatky ?? [];
  const [uklada, setUklada] = useState(false);
  const [zobrazitHotove, setZobrazitHotove] = useState(false);
  const [rozbaleny, setRozbaleny] = useState<string | null>(null);

  const otevrene = seznam.filter((n) => !n.odstranenoIso);
  const hotove = seznam.filter((n) => n.odstranenoIso);
  const videt = zobrazitHotove ? seznam : otevrene;

  async function uloz(novy: Nedostatek[]) {
    setUklada(true);
    try {
      await onUlozit({ nedostatky: novy });
    } finally {
      setUklada(false);
    }
  }

  function pridej() {
    const n: Nedostatek = {
      id: `n${Date.now()}`,
      popis: '',
      odpovedny: null,
      terminIso: null,
      odstranenoIso: null,
      poznamka: null,
      zadanoIso: new Date().toISOString(),
    };
    setRozbaleny(n.id);
    uloz([...seznam, n]);
  }

  function uprav(id: string, zmeny: Partial<Nedostatek>) {
    uloz(seznam.map((n) => (n.id === id ? { ...n, ...zmeny } : n)));
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Label className="text-xs font-medium">
          Zjištěné nedostatky
          {otevrene.length > 0 && (
            <span className="ml-1.5 text-amber-700">({otevrene.length} neodstraněno)</span>
          )}
        </Label>
        {hotove.length > 0 && (
          <Button
            type="button" variant="ghost" size="sm"
            className="h-7 text-[11px] text-muted-foreground"
            onClick={() => setZobrazitHotove((v) => !v)}
          >
            {zobrazitHotove ? 'Skrýt odstraněné' : `Zobrazit odstraněné (${hotove.length})`}
          </Button>
        )}
      </div>

      {videt.length > 0 && (
        <div className="rounded-lg border divide-y">
          {videt.map((n) => {
            const rozbaleno = rozbaleny === n.id;
            const hotovo = !!n.odstranenoIso;
            const propadl = poTerminu(n);
            return (
              <div key={n.id}>
                <div className="flex items-start gap-2 p-2.5">
                  <button
                    type="button"
                    onClick={() => setRozbaleny(rozbaleno ? null : n.id)}
                    className="mt-0.5 shrink-0 text-muted-foreground"
                  >
                    {rozbaleno ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setRozbaleny(rozbaleno ? null : n.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className={`text-sm ${hotovo ? 'text-muted-foreground line-through' : 'font-medium'}`}>
                      {n.popis || <span className="italic text-muted-foreground">bez popisu — doplňte</span>}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {n.odpovedny ? `${n.odpovedny} · ` : ''}
                      {hotovo
                        ? `odstraněno ${format(n.odstranenoIso)}`
                        : n.terminIso ? `termín ${format(n.terminIso)}` : 'bez termínu'}
                    </p>
                  </button>

                  {hotovo ? (
                    <span className="shrink-0 inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-bold text-emerald-700">
                      <Check className="h-3 w-3" /> hotovo
                    </span>
                  ) : propadl ? (
                    <span className="shrink-0 inline-flex items-center gap-1 rounded bg-red-50 px-1.5 py-0.5 text-[11px] font-bold text-red-700">
                      <AlertTriangle className="h-3 w-3" /> po termínu
                    </span>
                  ) : null}

                  <Button
                    type="button" variant="ghost" size="icon"
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                    disabled={disabled || uklada}
                    onClick={() => uloz(seznam.filter((x) => x.id !== n.id))}
                    title="Smazat"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {rozbaleno && (
                  <div className="space-y-3 border-t bg-muted/20 p-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Popis nedostatku</Label>
                      <Textarea
                        value={n.popis}
                        onChange={(e) => uprav(n.id, { popis: e.target.value })}
                        placeholder="např. chybí kryt svorkovnice u rozvaděče RH2"
                        className="min-h-[60px] text-sm"
                        disabled={disabled}
                      />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Kdo odstraní</Label>
                        {osoby.length > 0 ? (
                          <Select
                            value={n.odpovedny ?? '__zadny__'}
                            onValueChange={(v) => uprav(n.id, { odpovedny: v === '__zadny__' ? null : v })}
                          >
                            <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__zadny__">— neurčeno —</SelectItem>
                              {osoby.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            value={n.odpovedny ?? ''}
                            onChange={(e) => uprav(n.id, { odpovedny: e.target.value })}
                            placeholder="jméno nebo pozice"
                            className="h-9"
                            disabled={disabled}
                          />
                        )}
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Termín odstranění</Label>
                        <Input
                          type="date"
                          value={isoNaDatum(n.terminIso)}
                          onChange={(e) => uprav(n.id, { terminIso: datumNaIso(e.target.value) })}
                          className="h-9"
                          disabled={disabled}
                        />
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Odstraněno dne</Label>
                        <div className="flex gap-2">
                          <Input
                            type="date"
                            value={isoNaDatum(n.odstranenoIso)}
                            onChange={(e) => uprav(n.id, { odstranenoIso: datumNaIso(e.target.value) })}
                            className="h-9"
                            disabled={disabled}
                          />
                          {!n.odstranenoIso && (
                            <Button
                              type="button" variant="outline" size="sm"
                              className="h-9 whitespace-nowrap"
                              disabled={disabled || uklada}
                              onClick={() => uprav(n.id, { odstranenoIso: new Date().toISOString() })}
                            >
                              Dnes
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Jak bylo odstraněno</Label>
                        <Input
                          value={n.poznamka ?? ''}
                          onChange={(e) => uprav(n.id, { poznamka: e.target.value })}
                          className="h-9"
                          disabled={disabled}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Button
        type="button" variant="outline" size="sm"
        disabled={disabled || uklada}
        onClick={pridej}
      >
        {uklada ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
        Přidat nedostatek
      </Button>
    </div>
  );
}
