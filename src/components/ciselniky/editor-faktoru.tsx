'use client';

/**
 * AuditFlow — editor kategorizace rizikových faktorů.
 * Umístění: src/components/ciselniky/editor-faktoru.tsx
 *
 * Používá se u pracovní pozice i u činnosti. Kategorizace se dělá na faktor,
 * ne na pozici jako celek — výsledná kategorie osoby je nejvyšší ze všech
 * faktorů její pozice a jejích činností.
 */

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RIZIKOVE_FAKTORY, nejvyssiKategorie } from '@/lib/cinnosti';
import type { ZarazeniFaktoru, KodKategorie } from '@/lib/cinnosti';

const STUPNE: (KodKategorie | null)[] = [null, '1', '2', '2R', '3', '4'];

const BARVA: Record<string, string> = {
  '1': 'bg-emerald-600 text-white border-emerald-700',
  '2': 'bg-amber-500 text-white border-amber-600',
  '2R': 'bg-orange-500 text-white border-orange-600',
  '3': 'bg-red-600 text-white border-red-700',
  '4': 'bg-red-800 text-white border-red-900',
};

export default function EditorFaktoru({
  faktory, onZmena, popis,
}: {
  faktory: ZarazeniFaktoru[] | undefined;
  onZmena: (nove: ZarazeniFaktoru[]) => void;
  popis?: string;
}) {
  const stav = faktory ?? [];
  const najdi = (kod: string) => stav.find((f) => f.kod === kod);
  const vysledna = nejvyssiKategorie(stav);

  function nastav(kod: string, kategorie: KodKategorie | null) {
    if (kategorie === null) {
      onZmena(stav.filter((f) => f.kod !== kod));
      return;
    }
    onZmena(
      najdi(kod)
        ? stav.map((f) => (f.kod === kod ? { ...f, kategorie } : f))
        : [...stav, { kod, kategorie, poznamka: null }],
    );
  }

  function nastavPoznamku(kod: string, poznamka: string) {
    onZmena(stav.map((f) => (f.kod === kod ? { ...f, poznamka: poznamka || null } : f)));
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <Label className="text-xs font-semibold">Kategorizace rizikových faktorů</Label>
          <p className="text-[11px] text-muted-foreground">
            {popis ?? 'Příloha č. 1 vyhlášky č. 432/2003 Sb. Nevyplněný faktor se nezapočítá.'}
          </p>
        </div>
        <span className="text-[11px] whitespace-nowrap">
          Výsledná kategorie:{' '}
          <span className={`rounded px-1.5 py-0.5 font-bold ${vysledna ? BARVA[vysledna] : 'bg-slate-100 text-slate-500'}`}>
            {vysledna ?? 'nezařazeno'}
          </span>
        </span>
      </div>

      <div className="rounded border bg-background divide-y">
        {RIZIKOVE_FAKTORY.map((rf) => {
          const z = najdi(rf.kod);
          return (
            <div key={rf.kod} className="grid gap-2 px-3 py-1.5 sm:grid-cols-[1.3fr_auto_1fr] items-center">
              <span className="text-xs">{rf.nazev}</span>
              <div className="flex gap-1">
                {STUPNE.map((s) => {
                  const aktivni = (z?.kategorie ?? null) === s;
                  return (
                    <button
                      key={s ?? 'zadna'}
                      type="button"
                      onClick={() => nastav(rf.kod, s)}
                      title={s ? `Kategorie ${s}` : 'Nezařazeno'}
                      className={`h-6 min-w-[28px] rounded border text-[11px] font-bold transition-colors ${
                        aktivni
                          ? (s ? BARVA[s] : 'bg-slate-200 border-slate-300 text-slate-600')
                          : 'border-slate-200 text-slate-400 hover:bg-slate-50'
                      }`}
                    >
                      {s ?? '—'}
                    </button>
                  );
                })}
              </div>
              {z ? (
                <Input
                  value={z.poznamka ?? ''}
                  onChange={(e) => nastavPoznamku(rf.kod, e.target.value)}
                  placeholder="č. j. rozhodnutí KHS / měření"
                  className="h-7 text-xs"
                />
              ) : <span />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
