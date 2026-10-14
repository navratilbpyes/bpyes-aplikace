'use client';

/**
 * AuditFlow — nedostatky zjištěné revizí.
 * Umístění: src/components/nedostatky-revize.tsx
 *
 * Revizní technik vypíše v protokolu závady; ty se sem přepíšou a hlídá se
 * jejich odstranění. Stejný tok jako u nedostatků z kontrol:
 *   otevřený → klient nahlásí odstranění → OZO potvrdí (nebo vrátí k dopracování).
 *
 * Dvě podoby podle role (prop `jeKlient`):
 *  - OZO: edituje vše, vidí hlášení klienta a odklikává ho (Potvrdit / Vrátit),
 *         může nedostatek uzavřít i přímo.
 *  - klient: edituje popis/odpovědného/termín, odstranění jen NAHLASUJE.
 *            Uzavřít ho smí až OZO.
 *
 * Stavy a typ viz src/lib/nedostatky.ts.
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
  Plus, X, Check, AlertTriangle, ChevronDown, ChevronRight, Loader2, Clock, Undo2, ShieldCheck,
} from 'lucide-react';
import {
  stavNedostatku, nedostatekPoTerminu, souhrnNedostatku, ZRUSENI_HLASENI,
} from '@/lib/nedostatky';
import type { Nedostatek } from '@/lib/nedostatky';

export type { Nedostatek } from '@/lib/nedostatky';

export interface NedostatkyPole {
  nedostatky?: Nedostatek[];
}

const isoNaDatum = (iso?: string | null) => (iso ? iso.slice(0, 10) : '');
const datumNaIso = (d: string) => (d ? new Date(`${d}T00:00:00`).toISOString() : null);
const format = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('cs-CZ') : '—');
const dnesDatum = () => new Date().toISOString().slice(0, 10);

export default function NedostatkyRevize({
  data, onUlozit, osoby = [], disabled, jeKlient = false,
}: {
  data: NedostatkyPole;
  onUlozit: (zmeny: NedostatkyPole) => Promise<void>;
  /** návrhy odpovědných osob (pozice z detailu klienta) */
  osoby?: string[];
  disabled?: boolean;
  /** true = klientský pohled (odstranění jen hlásí, nepotvrzuje) */
  jeKlient?: boolean;
}) {
  const seznam = data.nedostatky ?? [];
  const [uklada, setUklada] = useState(false);
  const [zobrazitHotove, setZobrazitHotove] = useState(false);
  const [rozbaleny, setRozbaleny] = useState<string | null>(null);

  // klient: formulář hlášení odstranění
  const [hlasim, setHlasim] = useState<string | null>(null);
  const [hlaseni, setHlaseni] = useState({ datum: dnesDatum(), jmeno: '', poznamka: '' });
  // OZO: důvod vrácení
  const [vracim, setVracim] = useState<string | null>(null);
  const [duvod, setDuvod] = useState('');

  const souhrn = souhrnNedostatku(seznam);
  const hotove = seznam.filter((n) => stavNedostatku(n) === 'odstranen');
  const videt = zobrazitHotove ? seznam : seznam.filter((n) => stavNedostatku(n) !== 'odstranen');

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
    return uloz(seznam.map((n) => (n.id === id ? { ...n, ...zmeny } : n)));
  }

  // --- klient: nahlášení odstranění ---
  function otevriHlaseni(id: string) {
    setHlasim(id);
    setHlaseni({ datum: dnesDatum(), jmeno: '', poznamka: '' });
  }

  async function odesliHlaseni(id: string) {
    if (!hlaseni.jmeno.trim()) return;
    await uprav(id, {
      vyresenoKlientem: true,
      datumVyreseniKlientem: datumNaIso(hlaseni.datum) ?? new Date().toISOString(),
      jmenoVyresitele: hlaseni.jmeno.trim(),
      poznamkaKlienta: hlaseni.poznamka.trim() || null,
      overenoOzo: null,
      poznamkaOzo: null,
    });
    setHlasim(null);
  }

  // --- OZO: potvrzení / vrácení / přímé uzavření ---
  function potvrd(n: Nedostatek) {
    const ted = new Date().toISOString();
    return uprav(n.id, {
      odstranenoIso: n.datumVyreseniKlientem ?? ted,
      overenoOzo: 'potvrzeno',
      datumOvereniOzo: ted,
      poznamkaOzo: null,
    });
  }

  async function vrat(id: string) {
    await uprav(id, {
      ...ZRUSENI_HLASENI,
      overenoOzo: 'vraceno',
      datumOvereniOzo: new Date().toISOString(),
      poznamkaOzo: duvod.trim() || null,
    });
    setVracim(null);
    setDuvod('');
  }

  function uzavriPrimo(id: string, iso: string) {
    return uprav(id, { odstranenoIso: iso, overenoOzo: 'potvrzeno', datumOvereniOzo: new Date().toISOString() });
  }

  function otevriZnovu(id: string) {
    return uprav(id, {
      ...ZRUSENI_HLASENI,
      odstranenoIso: null,
      overenoOzo: null,
      datumOvereniOzo: null,
      poznamkaOzo: null,
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Label className="text-xs font-medium">
          Zjištěné nedostatky
          {souhrn.otevrene > 0 && (
            <span className="ml-1.5 text-amber-700">({souhrn.otevrene} neodstraněno)</span>
          )}
          {souhrn.ceka > 0 && (
            <span className="ml-1.5 text-blue-700">
              ({souhrn.ceka} {jeKlient ? 'čeká na ověření technikem' : 'čeká na vaše ověření'})
            </span>
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
            const stav = stavNedostatku(n);
            const hotovo = stav === 'odstranen';
            const ceka = stav === 'ceka_na_overeni';
            const vraceno = stav === 'vraceno';
            const propadl = nedostatekPoTerminu(n);
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
                        : ceka
                          ? `nahlásil(a) ${n.jmenoVyresitele ?? '—'} · ${format(n.datumVyreseniKlientem)}`
                          : n.terminIso ? `termín ${format(n.terminIso)}` : 'bez termínu'}
                    </p>
                  </button>

                  {hotovo ? (
                    <span className="shrink-0 inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-bold text-emerald-700">
                      <Check className="h-3 w-3" /> hotovo
                    </span>
                  ) : ceka ? (
                    <span className="shrink-0 inline-flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 text-[11px] font-bold text-blue-700">
                      <Clock className="h-3 w-3" /> čeká na ověření
                    </span>
                  ) : propadl ? (
                    <span className="shrink-0 inline-flex items-center gap-1 rounded bg-red-50 px-1.5 py-0.5 text-[11px] font-bold text-red-700">
                      <AlertTriangle className="h-3 w-3" /> po termínu
                    </span>
                  ) : vraceno ? (
                    <span className="shrink-0 inline-flex items-center gap-1 rounded bg-red-50 px-1.5 py-0.5 text-[11px] font-bold text-red-700">
                      <Undo2 className="h-3 w-3" /> vráceno
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

                    {/* ---------- Odstranění ---------- */}

                    {/* OZO vrátil k dopracování — vidí klient i OZO */}
                    {vraceno && (
                      <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                        <div className="flex items-center gap-2 text-sm font-bold text-red-800">
                          <Undo2 className="h-4 w-4" /> Technik OZO vrátil hlášení k dopracování
                        </div>
                        {n.poznamkaOzo && <p className="mt-1 text-sm text-red-900">{n.poznamkaOzo}</p>}
                      </div>
                    )}

                    {/* Hlášení klienta čeká na OZO */}
                    {ceka && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-3">
                        <div className="flex items-center gap-2 text-sm font-bold text-amber-800">
                          <Clock className="h-4 w-4" />
                          {jeKlient
                            ? 'Nahlášeno — čeká na ověření technikem OZO'
                            : 'Klient nahlásil odstranění — čeká na vaše ověření'}
                        </div>
                        <div className="rounded-md border bg-white p-3 text-sm space-y-2">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Nahlásil(a)</span>
                              <span className="font-bold">{n.jmenoVyresitele ?? '—'}</span>
                            </div>
                            <div>
                              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Odstraněno dne</span>
                              <span className="font-bold">{format(n.datumVyreseniKlientem)}</span>
                            </div>
                          </div>
                          {n.poznamkaKlienta && (
                            <div>
                              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Jak bylo odstraněno</span>
                              <p className="italic text-slate-700">{n.poznamkaKlienta}</p>
                            </div>
                          )}
                        </div>

                        {jeKlient ? (
                          <Button
                            type="button" variant="ghost" size="sm"
                            className="h-auto p-0 text-xs font-bold text-red-600 hover:bg-transparent hover:text-red-700"
                            disabled={disabled || uklada}
                            onClick={() => uprav(n.id, { ...ZRUSENI_HLASENI })}
                          >
                            Vrátit nedostatek zpět do řešení
                          </Button>
                        ) : vracim === n.id ? (
                          <div className="space-y-2">
                            <Label className="text-xs">Důvod vrácení (uvidí klient)</Label>
                            <Textarea
                              value={duvod}
                              onChange={(e) => setDuvod(e.target.value)}
                              placeholder="např. kryt není osazen, nutno doložit foto"
                              className="min-h-[56px] text-sm"
                            />
                            <div className="flex gap-2">
                              <Button type="button" size="sm" variant="destructive" disabled={uklada} onClick={() => vrat(n.id)}>
                                Vrátit k dopracování
                              </Button>
                              <Button type="button" size="sm" variant="ghost" onClick={() => { setVracim(null); setDuvod(''); }}>
                                Zrušit
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button" size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700"
                              disabled={disabled || uklada}
                              onClick={() => potvrd(n)}
                            >
                              <Check className="mr-1.5 h-3.5 w-3.5" /> Potvrdit odstranění
                            </Button>
                            <Button
                              type="button" size="sm" variant="outline"
                              disabled={disabled || uklada}
                              onClick={() => { setVracim(n.id); setDuvod(''); }}
                            >
                              <Undo2 className="mr-1.5 h-3.5 w-3.5" /> Vrátit k dopracování
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Odstranění potvrzeno / uzavřeno */}
                    {hotovo && (
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 space-y-1">
                        <div className="flex items-center gap-2 text-sm font-bold text-emerald-800">
                          <ShieldCheck className="h-4 w-4" /> Odstranění potvrzeno technikem OZO
                        </div>
                        <p className="text-xs text-emerald-900">
                          Odstraněno {format(n.odstranenoIso)}
                          {n.jmenoVyresitele ? ` · nahlásil(a) ${n.jmenoVyresitele}` : ''}
                          {n.datumOvereniOzo ? ` · potvrzeno ${format(n.datumOvereniOzo)}` : ''}
                        </p>
                        {(n.poznamkaKlienta || n.poznamka) && (
                          <p className="text-xs italic text-emerald-900">{n.poznamkaKlienta || n.poznamka}</p>
                        )}
                        {!jeKlient && (
                          <Button
                            type="button" variant="ghost" size="sm"
                            className="h-auto p-0 text-xs font-bold text-slate-600 hover:bg-transparent"
                            disabled={disabled || uklada}
                            onClick={() => otevriZnovu(n.id)}
                          >
                            Znovu otevřít
                          </Button>
                        )}
                      </div>
                    )}

                    {/* Klient: formulář nahlášení */}
                    {jeKlient && (stav === 'otevreny' || vraceno) && (
                      hlasim === n.id ? (
                        <div className="rounded-lg border border-blue-200 bg-white p-3 space-y-3">
                          <div className="text-sm font-bold text-blue-900">Nahlášení odstranění</div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1">
                              <Label className="text-xs">Kdy bylo odstraněno?</Label>
                              <Input
                                type="date" className="h-9"
                                value={hlaseni.datum}
                                onChange={(e) => setHlaseni((h) => ({ ...h, datum: e.target.value }))}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Vaše jméno</Label>
                              <Input
                                className="h-9" placeholder="Jan Novák"
                                value={hlaseni.jmeno}
                                onChange={(e) => setHlaseni((h) => ({ ...h, jmeno: e.target.value }))}
                              />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Jak bylo odstraněno (volitelně)</Label>
                            <Textarea
                              className="min-h-[56px] text-sm"
                              value={hlaseni.poznamka}
                              onChange={(e) => setHlaseni((h) => ({ ...h, poznamka: e.target.value }))}
                              placeholder="např. kryt osazen, ověřeno revizním technikem"
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button
                              type="button" size="sm"
                              disabled={uklada || !hlaseni.jmeno.trim()}
                              onClick={() => odesliHlaseni(n.id)}
                            >
                              Odeslat technikovi
                            </Button>
                            <Button type="button" size="sm" variant="ghost" onClick={() => setHlasim(null)}>
                              Zrušit
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          type="button" variant="outline" size="sm"
                          className="font-bold text-blue-700"
                          disabled={disabled || uklada}
                          onClick={() => otevriHlaseni(n.id)}
                        >
                          Odstranil(a) jsem tento nedostatek
                        </Button>
                      )
                    )}

                    {/* OZO: přímé uzavření bez hlášení klienta */}
                    {!jeKlient && (stav === 'otevreny' || vraceno) && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Odstraněno dne (uzavřít přímo)</Label>
                          <div className="flex gap-2">
                            <Input
                              type="date"
                              value=""
                              onChange={(e) => {
                                const iso = datumNaIso(e.target.value);
                                if (iso) uzavriPrimo(n.id, iso);
                              }}
                              className="h-9"
                              disabled={disabled}
                            />
                            <Button
                              type="button" variant="outline" size="sm"
                              className="h-9 whitespace-nowrap"
                              disabled={disabled || uklada}
                              onClick={() => uzavriPrimo(n.id, new Date().toISOString())}
                            >
                              Dnes
                            </Button>
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
                    )}
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
