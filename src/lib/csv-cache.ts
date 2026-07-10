/**
 * Načítání CSV z Google Sheets s offline zálohou.
 *
 * Strategie: nejdřív síť, cache jako záchranná síť.
 * Při výpadku sítě (práce v hale, slabý signál) se použije poslední
 * úspěšně stažená verze – i když je stará. Lepší staré šablony než žádné.
 */

const PREFIX = 'csv_cache:';

interface CacheZaznam {
  csv: string;
  ulozeno: number;
}

function nacistZCache(url: string): CacheZaznam | null {
  try {
    const raw = localStorage.getItem(PREFIX + url);
    return raw ? (JSON.parse(raw) as CacheZaznam) : null;
  } catch {
    return null;
  }
}

function ulozitDoCache(url: string, csv: string): void {
  try {
    const zaznam: CacheZaznam = { csv, ulozeno: Date.now() };
    localStorage.setItem(PREFIX + url, JSON.stringify(zaznam));
  } catch {
    // localStorage může být plný nebo zakázaný – cache je volitelná, nevadí
  }
}

export interface VysledekCsv {
  csv: string;
  /** true, když data pocházejí z offline zálohy, ne ze sítě. */
  zeZalohy: boolean;
  /** Kdy byla záloha pořízena (jen když zeZalohy === true). */
  stariMs?: number;
}

/**
 * Stáhne CSV. Při úspěchu ho uloží do zálohy.
 * Při selhání sítě vrátí poslední zálohu, pokud existuje.
 * Když není ani síť, ani záloha, vyhodí chybu.
 */
export async function nactiCsv(url: string, signal?: AbortSignal): Promise<VysledekCsv> {
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const csv = await res.text();
    ulozitDoCache(url, csv);
    return { csv, zeZalohy: false };
  } catch (chyba) {
    // Zrušení požadavku (odchod ze stránky) není chyba – propustíme dál
    if (signal?.aborted) throw chyba;

    const zaloha = nacistZCache(url);
    if (zaloha) {
      return {
        csv: zaloha.csv,
        zeZalohy: true,
        stariMs: Date.now() - zaloha.ulozeno,
      };
    }
    throw chyba;
  }
}

/** Lidsky čitelné stáří zálohy, např. „3 dny". */
export function stariZalohy(ms: number): string {
  const minuty = Math.floor(ms / 60_000);
  if (minuty < 60) return `${minuty} min`;
  const hodiny = Math.floor(minuty / 60);
  if (hodiny < 24) return `${hodiny} h`;
  const dny = Math.floor(hodiny / 24);
  return dny === 1 ? '1 den' : `${dny} dní`;
}
