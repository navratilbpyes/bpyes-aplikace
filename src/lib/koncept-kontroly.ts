/**
 * AuditFlow — automatická záloha rozpracované kontroly do localStorage.
 * Umístění: src/lib/koncept-kontroly.ts
 *
 * Chrání před ztrátou práce při refreshi / pádu uploadu fotek. Zálohuje VŠE
 * kromě fotek (base64 fotky jsou velké a do localStorage se nevejdou; navíc
 * blob/base64 po refreshi stejně zaniknou). Po obnově zůstane text, hodnocení
 * a závady; fotky je nutné přifotit.
 *
 * Jeden slot = poslední rozpracovaná kontrola. Po úspěšném uložení do cloudu
 * se záloha maže (viz smazKoncept).
 */

const KLIC = 'auditflow_koncept_kontroly_v1';

export interface KonceptKontroly {
  ulozenoIso: string;
  step: number;
  formData: any;
  checklist: Record<string, any>;
  pointDefects: Record<string, any[]>;
  customPoints: any[];
  disabledSections: string[];
  filterPosition: string;
}

/** Odstraní base64 fotky z objektu (rekurzivně u známých polí). */
function bezFotek<T>(obj: T): T {
  if (obj == null) return obj;
  // hluboká kopie + vynulování fot-polí
  const kopie = JSON.parse(JSON.stringify(obj));
  const projdi = (uzel: any) => {
    if (uzel == null || typeof uzel !== 'object') return;
    for (const klic of Object.keys(uzel)) {
      if (klic === 'foto' || klic === 'doporuceniFoto') {
        // ponecháme prázdné pole, ať struktura sedí, ale fotky pryč
        uzel[klic] = [];
      } else {
        projdi(uzel[klic]);
      }
    }
  };
  projdi(kopie);
  return kopie;
}

/** Uloží zálohu (bez fotek). Tichá — chyby nevadí (localStorage plné/zakázané). */
export function ulozKoncept(data: Omit<KonceptKontroly, 'ulozenoIso'>): void {
  try {
    const zaloha: KonceptKontroly = {
      ulozenoIso: new Date().toISOString(),
      step: data.step,
      formData: data.formData,
      checklist: bezFotek(data.checklist),
      pointDefects: bezFotek(data.pointDefects),
      customPoints: data.customPoints,
      disabledSections: data.disabledSections,
      filterPosition: data.filterPosition,
    };
    localStorage.setItem(KLIC, JSON.stringify(zaloha));
  } catch {
    /* localStorage nedostupné nebo plné — zálohu tiše přeskočíme */
  }
}

/** Načte zálohu, nebo null když žádná není / je poškozená. */
export function nactiKoncept(): KonceptKontroly | null {
  try {
    const raw = localStorage.getItem(KLIC);
    if (!raw) return null;
    const data = JSON.parse(raw) as KonceptKontroly;
    // základní validace — musí mít aspoň klienta nebo nějaký obsah
    if (!data || typeof data.step !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

/** Smaže zálohu (po úspěšném uložení do cloudu nebo po zahození). */
export function smazKoncept(): void {
  try {
    localStorage.removeItem(KLIC);
  } catch {
    /* nevadí */
  }
}

/** Je záloha neprázdná (stojí za nabídnutí obnovení)? */
export function maSmysluObnovit(k: KonceptKontroly | null): boolean {
  if (!k) return false;
  const maKlienta = !!k.formData?.klientId;
  const maObsah = Object.keys(k.checklist || {}).length > 0
    || Object.keys(k.pointDefects || {}).length > 0
    || (k.customPoints?.length ?? 0) > 0;
  return maKlienta || maObsah;
}

/** Lidsky čitelné stáří zálohy: „před 5 min", „před 2 h", „14. 8. 9:30". */
export function stariKonceptu(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const min = Math.floor((Date.now() - d.getTime()) / 60000);
  if (min < 1) return 'právě teď';
  if (min < 60) return `před ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `před ${h} h`;
  return d.toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', hour: 'numeric', minute: '2-digit' });
}
