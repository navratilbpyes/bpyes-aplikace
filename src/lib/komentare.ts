/**
 * AuditFlow — komentáře (vlákna) u nálezů, revizí a školení.
 * Umístění: src/lib/komentare.ts
 *
 * Kolekce `komentare` (kořenová). Komentář je vázaný na konkrétní cíl
 * (nález v reportu, revize, nebo školení klienta) přes cil + cilId.
 * Vlákno = víc komentářů se stejným cil + cilId, řazené v čase.
 *
 * Append-only: komentáře se jen přidávají, needitují ani nemažou (audit stopa).
 * Píše klient i OZO (admin). Vlákno je „nevyřízené", když poslední komentář
 * napsal klient a OZO ještě neodpověděl.
 */

export type CilKomentare = 'nalez' | 'revize' | 'skoleni';

export interface Komentar {
  id: string;
  klientId: string;
  /** typ cíle, ke kterému komentář patří */
  cil: CilKomentare;
  /** id cíle: u nálezu `${zaznamId}:${zavadaId}`, u revize/školení id dokumentu */
  cilId: string;
  /** krátký popis cíle — snapshot pro orientaci v přehledu */
  cilPopis?: string;
  /** text komentáře */
  text: string;
  /** kdo napsal: 'klient' nebo 'ozo' */
  zadal: 'klient' | 'ozo';
  autorUid: string;
  autorEmail?: string;
  kdyIso: string;
}

/** Data pro založení komentáře (bez server-generovaných polí). */
export interface NovyKomentar {
  klientId: string;
  cil: CilKomentare;
  cilId: string;
  cilPopis?: string;
  text: string;
  zadal: 'klient' | 'ozo';
  autorUid: string;
  autorEmail?: string;
}

/** Sestaví cilId nálezu z id reportu a id závady. */
export function cilIdNalezu(zaznamId: string, zavadaId: string): string {
  return `${zaznamId}:${zavadaId}`;
}

/**
 * Vlákno je nevyřízené, když poslední komentář napsal klient
 * (OZO na něj ještě nereagoval). Prázdné vlákno není nevyřízené.
 */
export function jeNevyrizeno(vlakno: Komentar[]): boolean {
  if (vlakno.length === 0) return false;
  const posledni = [...vlakno].sort((a, b) => a.kdyIso.localeCompare(b.kdyIso)).at(-1)!;
  return posledni.zadal === 'klient';
}
