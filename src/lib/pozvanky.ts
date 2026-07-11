// src/lib/pozvanky.ts
import { createHash, randomBytes } from "crypto";

export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export const POZVANKA_PLATNOST_DNI = 14;

// z jakého pole klienta osoba pochází
export type OsobaTyp = "kontakt" | "odpovednaOsoba";

export interface Pozvanka {
  __id?: string;
  tokenHash: string;
  email: string;
  klientId: string;
  osobaId: string;       // id v poli kontakty[] nebo odpovedneOsoby
  osobaTyp: OsobaTyp;
  osobaJmeno: string;    // snapshot jmena pro zobrazeni
  role: string;          // 'firma' | 'manazer'
  status: "pending" | "accepted" | "revoked" | "expired";
  createdBy: string;
  createdAt: Date;
  expiresAt: Date;
  acceptedAt?: Date | null;
  acceptedUid?: string | null;
}
