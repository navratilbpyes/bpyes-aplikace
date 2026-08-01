/**
 * AuditFlow — dotazy klienta k nálezům.
 * Umístění: src/lib/dotazy.ts
 *
 * Kolekce `dotazy` (kořenová). Dotaz je vázaný na konkrétní závadu
 * v konkrétním záznamu. Píše klient, odpovídá OZO (admin).
 */

export type StavDotazu = 'nevyrizeno' | 'vyrizeno';

export interface Dotaz {
  id: string;
  klientId: string;
  /** záznam (report), ke kterému nález patří */
  zaznamId: string;
  /** id konkrétní závady v tom záznamu */
  zavadaId: string;
  /** krátký popis závady — snapshot pro orientaci v seznamu */
  zavadaPopis?: string;
  /** text dotazu od klienta */
  text: string;
  /** odpověď od OZO, dokud není, je prázdná */
  odpoved?: string;
  stav: StavDotazu;
  /** kdo dotaz napsal (jméno pro zobrazení) */
  autorJmeno?: string;
  /** uid autora */
  autorUid: string;
  vytvorenoIso: string;
  odpovezenoIso?: string;
}

/** Data pro založení dotazu (bez server-generovaných polí). */
export interface NovyDotaz {
  klientId: string;
  zaznamId: string;
  zavadaId: string;
  zavadaPopis?: string;
  text: string;
  autorJmeno?: string;
  autorUid: string;
}
