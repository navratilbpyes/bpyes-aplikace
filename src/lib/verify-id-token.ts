// src/lib/verify-id-token.ts
// Ověří Firebase ID token bez Admin SDK: stáhne Google public keys a ověří RS256 podpis + claims.

import { createVerify, X509Certificate } from "crypto";

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!;
const CERTS_URL =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

let certCache: { keys: Record<string, string>; exp: number } | null = null;

async function getCerts(): Promise<Record<string, string>> {
  const now = Date.now();
  if (certCache && certCache.exp > now) return certCache.keys;
  const res = await fetch(CERTS_URL, { cache: "no-store" });
  if (!res.ok) throw new Error("Nelze stáhnout Google certifikáty");
  const keys = (await res.json()) as Record<string, string>;
  // cache podle Cache-Control max-age (default 1h)
  const cc = res.headers.get("cache-control") ?? "";
  const m = cc.match(/max-age=(\d+)/);
  const maxAge = m ? parseInt(m[1], 10) : 3600;
  certCache = { keys, exp: now + maxAge * 1000 };
  return keys;
}

interface DecodedToken {
  uid: string;
  email?: string;
  email_verified?: boolean;
}

export async function verifyIdToken(idToken: string): Promise<DecodedToken> {
  const [headerB64, payloadB64, sigB64] = idToken.split(".");
  if (!headerB64 || !payloadB64 || !sigB64)
    throw new Error("Neplatný tvar tokenu");

  const header = JSON.parse(Buffer.from(headerB64, "base64url").toString());
  const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());

  // --- ověření claims ---
  const now = Math.floor(Date.now() / 1000);
  if (payload.aud !== PROJECT_ID) throw new Error("Špatné aud");
  if (payload.iss !== `https://securetoken.google.com/${PROJECT_ID}`)
    throw new Error("Špatné iss");
  if (payload.exp < now) throw new Error("Token expiroval");
  if (payload.iat > now + 300) throw new Error("Token z budoucnosti");
  if (!payload.sub) throw new Error("Chybí sub");

  // --- ověření podpisu ---
  const certs = await getCerts();
  const cert = certs[header.kid];
  if (!cert) throw new Error("Neznámý kid");
  const publicKey = new X509Certificate(cert).publicKey;

  const verifier = createVerify("RSA-SHA256");
  verifier.update(`${headerB64}.${payloadB64}`);
  const ok = verifier.verify(
    publicKey,
    Buffer.from(sigB64, "base64url")
  );
  if (!ok) throw new Error("Neplatný podpis tokenu");

  return {
    uid: payload.sub,
    email: payload.email,
    email_verified: payload.email_verified,
  };
}
