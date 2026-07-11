// src/lib/google-token.ts
// Vyrobí Google OAuth2 access token ze service accountu BEZ Firebase Admin SDK.
// Podepíšeme JWT ručně a vyměníme ho na token endpointu za access token.
// Workspace policy blokuje Admin SDK inicializaci, tohle je čisté REST + crypto.

import { createSign } from "crypto";

interface ServiceAccount {
  client_email: string;
  private_key: string;
}

// Service account JSON dej do env jako jeden řádek (JSON.stringify).
// V .env.local:  GCP_SERVICE_ACCOUNT_JSON='{"client_email":"...","private_key":"-----BEGIN..."}'
function getServiceAccount(): ServiceAccount {
  const raw = process.env.GCP_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("Chybí GCP_SERVICE_ACCOUNT_JSON");
  const sa = JSON.parse(raw);
  return {
    client_email: sa.client_email,
    // v env bývají \n jako literál – nahradíme za skutečné odřádkování
    private_key: (sa.private_key as string).replace(/\\n/g, "\n"),
  };
}

let cached: { token: string; exp: number } | null = null;

export async function getAccessToken(
  scope = "https://www.googleapis.com/auth/datastore"
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.exp - 60 > now) return cached.token;

  const sa = getServiceAccount();
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: sa.client_email,
    scope,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const b64 = (o: object) =>
    Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${b64(header)}.${b64(claim)}`;

  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  const signature = signer.sign(sa.private_key, "base64url");
  const jwt = `${unsigned}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    throw new Error(`Token exchange selhal: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  cached = { token: data.access_token, exp: now + data.expires_in };
  return data.access_token;
}
