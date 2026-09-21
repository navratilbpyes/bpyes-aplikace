/**
 * AuditFlow — protokol revize/školení: upload a stažení.
 * Umístění: src/lib/protokol.ts
 *
 * Tenká vrstva nad existujícími API routami:
 *   - POST /api/nahrat-soubor   → vrátí { souborId }  (metadata jdou do `dokumenty`)
 *   - GET  /api/odkaz-souboru   → vrátí { odkaz }      (dočasný podepsaný download)
 *
 * DŮLEŽITÉ: `nahrat-soubor` NEVRACÍ URL, ale ID dokumentu v kolekci `dokumenty`.
 * Na revizi se proto ukládá `protokolDokumentId` (reference), ne URL — odkaz
 * ke stažení je krátkodobý a získává se on-demand přes `odkazProtokolu`.
 */

import { auth } from '@/components/data-provider';

/** Stav protokolu na revizi/školení. */
export type ProtokolStav = 'ceka' | 'videl' | 'odmitnuto';

/** Jeden nahraný protokol. Revize jich může mít víc (dílčí protokoly, přílohy). */
export interface ProtokolPolozka {
  id: string;
  dokumentId: string;
  nazev: string;
  stav: ProtokolStav;
  duvod?: string | null;
  nahranoIso: string;
}

/**
 * Protokolová pole na dokumentu revize/školení.
 *
 * Historicky zde byl jeden protokol (protokolDokumentId a spol.). Nově se
 * ukládá pole `protokoly`. Stará pole zůstávají kvůli existujícím záznamům
 * a report je čte dál — při prvním zásahu se záznam převede funkcí `sjednot`.
 */
export interface ProtokolPole {
  protokoly?: ProtokolPolozka[];
  protokolDokumentId?: string | null;
  protokolNazev?: string | null;
  protokolStav?: ProtokolStav | null;
  /** důvod odmítnutí (vyplní OZO při 'odmitnuto') */
  protokolDuvod?: string | null;
}

/** Vrátí seznam protokolů — starý jednoprotokolový tvar převede na pole. */
export function seznamProtokolu(d: ProtokolPole): ProtokolPolozka[] {
  if (d.protokoly && d.protokoly.length > 0) return d.protokoly;
  if (d.protokolDokumentId) {
    return [{
      id: 'puvodni',
      dokumentId: d.protokolDokumentId,
      nazev: d.protokolNazev ?? 'protokol',
      stav: (d.protokolStav ?? 'ceka') as ProtokolStav,
      duvod: d.protokolDuvod ?? null,
      nahranoIso: '',
    }];
  }
  return [];
}

/**
 * Sestaví zápis protokolových polí z nového seznamu.
 * První protokol se zrcadlí i do starých polí, aby report a časový plán,
 * které je čtou, fungovaly beze změny.
 */
export function zapisProtokoly(seznam: ProtokolPolozka[]): ProtokolPole {
  const prvni = seznam[0];
  return {
    protokoly: seznam,
    protokolDokumentId: prvni?.dokumentId ?? null,
    protokolNazev: prvni?.nazev ?? null,
    protokolStav: prvni?.stav ?? null,
    protokolDuvod: prvni?.duvod ?? null,
  };
}

/** Povolené typy souboru (shodné s API routou nahrat-soubor). */
export const POVOLENE_TYPY = ['application/pdf', 'image/jpeg', 'image/png'];
export const MAX_VELIKOST = 20 * 1024 * 1024;

/**
 * Vrátí Firebase idToken přihlášeného uživatele, nebo null.
 *
 * `vynutit` obnoví token i když ještě nevypršel. Bez toho vrací SDK token
 * z mezipaměti a po hodině otevřené aplikace každý upload spadne na 401 —
 * projevovalo se to při delší práci s revizemi (prvních pár souborů projde,
 * pak přestane). Zápisové operace proto token vždy obnovují.
 */
async function idToken(vynutit = false): Promise<string | null> {
  const u = auth.currentUser;
  if (!u) return null;
  try {
    return await u.getIdToken(vynutit);
  } catch {
    return null;
  }
}

/**
 * Nahraje soubor přes /api/nahrat-soubor.
 * Vrací ID dokumentu (kolekce `dokumenty`), který se uloží na revizi
 * jako `protokolDokumentId`.
 */
export async function nahrajProtokol(soubor: File, cilovyKlientId?: string): Promise<string> {
  if (soubor.size > MAX_VELIKOST) {
    throw new Error('Soubor je příliš velký (max 20 MB).');
  }
  if (!POVOLENE_TYPY.includes(soubor.type)) {
    throw new Error('Nepovolený typ souboru (jen PDF, JPG, PNG).');
  }

  const token = await idToken(true);
  if (!token) throw new Error('Nejste přihlášeni.');

  const form = new FormData();
  form.append('soubor', soubor);
  // Admin nahrává ke konkrétnímu klientovi → pošli cílový klientId.
  // Klient tohle needává; server ho stejně ignoruje a vezme z profilu.
  if (cilovyKlientId) form.append('klientId', cilovyKlientId);

  const res = await fetch('/api/nahrat-soubor', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.souborId) {
    if (res.status === 401) {
      throw new Error('Přihlášení vypršelo. Obnovte stránku a zkuste to znovu.');
    }
    throw new Error(data?.chyba ?? 'Nahrání selhalo.');
  }
  return data.souborId as string;
}

/**
 * Vyžádá dočasný podepsaný odkaz ke stažení protokolu.
 * `dokumentId` je hodnota `protokolDokumentId` z revize.
 */
export async function odkazProtokolu(dokumentId: string, nahled = false): Promise<string> {
  const token = await idToken(true);
  if (!token) throw new Error('Nejste přihlášeni.');

  const res = await fetch(
    `/api/odkaz-souboru?id=${encodeURIComponent(dokumentId)}${nahled ? '&nahled=1' : ''}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.odkaz) {
    throw new Error(data?.chyba ?? 'Odkaz se nepodařilo získat.');
  }
  return data.odkaz as string;
}

/** Otevře protokol v nové kartě (vyžádá odkaz a přesměruje). */
export async function otevriProtokol(dokumentId: string, nahled = false): Promise<void> {
  const odkaz = await odkazProtokolu(dokumentId, nahled);
  window.open(odkaz, '_blank', 'noopener,noreferrer');
}

/**
 * Načte soubor k zobrazení v aplikaci a vrátí lokální URL (blob:).
 * Obchází to download.php, který soubor vždy posílá ke stažení.
 * Volající musí URL po použití uvolnit přes URL.revokeObjectURL.
 */
export async function nahledProtokolu(dokumentId: string): Promise<{ url: string; typ: string }> {
  const token = await idToken(true);
  if (!token) throw new Error('Nejste přihlášeni.');
  const res = await fetch(`/api/nahled-souboru?id=${encodeURIComponent(dokumentId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.chyba ?? 'Náhled se nepodařilo načíst.');
  }
  const blob = await res.blob();
  return { url: URL.createObjectURL(blob), typ: blob.type };
}

/** Přípona z názvu souboru — rozhoduje, čím se náhled vykreslí. */
export function jeObrazek(nazev: string): boolean {
  return /\.(jpe?g|png|gif|webp)$/i.test(nazev);
}
