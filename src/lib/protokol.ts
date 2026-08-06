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

/** Protokolová pole, která žijí na dokumentu revize/školení. */
export interface ProtokolPole {
  protokolDokumentId?: string | null;
  protokolNazev?: string | null;
  protokolStav?: ProtokolStav | null;
  /** důvod odmítnutí (vyplní OZO při 'odmitnuto') */
  protokolDuvod?: string | null;
}

/** Povolené typy souboru (shodné s API routou nahrat-soubor). */
export const POVOLENE_TYPY = ['application/pdf', 'image/jpeg', 'image/png'];
export const MAX_VELIKOST = 20 * 1024 * 1024;

/** Vrátí čerstvý Firebase idToken přihlášeného uživatele, nebo null. */
async function idToken(): Promise<string | null> {
  const u = auth.currentUser;
  if (!u) return null;
  try {
    return await u.getIdToken();
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

  const token = await idToken();
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
    throw new Error(data?.chyba ?? 'Nahrání selhalo.');
  }
  return data.souborId as string;
}

/**
 * Vyžádá dočasný podepsaný odkaz ke stažení protokolu.
 * `dokumentId` je hodnota `protokolDokumentId` z revize.
 */
export async function odkazProtokolu(dokumentId: string): Promise<string> {
  const token = await idToken();
  if (!token) throw new Error('Nejste přihlášeni.');

  const res = await fetch(`/api/odkaz-souboru?id=${encodeURIComponent(dokumentId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.odkaz) {
    throw new Error(data?.chyba ?? 'Odkaz se nepodařilo získat.');
  }
  return data.odkaz as string;
}

/** Otevře protokol v nové kartě (vyžádá odkaz a přesměruje). */
export async function otevriProtokol(dokumentId: string): Promise<void> {
  const odkaz = await odkazProtokolu(dokumentId);
  window.open(odkaz, '_blank', 'noopener,noreferrer');
}
