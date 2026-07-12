// src/lib/google-token.ts
// Vyrobí Google OAuth2 access token ze service accountu BEZ Firebase Admin SDK.
// Podepíšeme JWT ručně a vyměníme ho na token endpointu za access token.
// Workspace policy blokuje Admin SDK inicializaci, tohle je čisté REST + crypto.

import { createSign } from "crypto";

interface ServiceAccount {
  client_email: string;
  private_key: string;
}

// Service account lze do env vlozit dvema zpusoby:
//  1) GCP_SERVICE_ACCOUNT_JSON  = cely JSON na jeden radek (JSON.stringify)
//  2) GCP_SERVICE_ACCOUNT_BASE64 = ten samy JSON zakodovany do base64 (odolnejsi,
//     neobsahuje uvozovky ani zalomeni, ktere se ve Vercelu snadno rozbijeji)
// Doporucene je base64. Kod zvladne oba a je tolerantni k drobnym vadam.
function getServiceAccount(): ServiceAccount {
  const b64 = process.env.GCP_SERVICE_ACCOUNT_BASE64;
  const rawJson = process.env.GCP_SERVICE_ACCOUNT_JSON;

  let raw: string | undefined;
  if (b64) {
    raw = Buffer.from(b64, "base64").toString("utf8");
  } else {
    raw = rawJson;
  }
  if (!raw)
    throw new Error(
      "Chybi GCP_SERVICE_ACCOUNT_BASE64 nebo GCP_SERVICE_ACCOUNT_JSON"
    );

  let sa: { client_email?: string; private_key?: string };
  try {
    sa = JSON.parse(raw);
  } catch {
    // Zachrana: nekdy se do env dostanou skutecna zalomeni uvnitr private_key,
    // ktera rozbiji JSON. Escapujeme zalomeni jen uvnitr hodnot retezcu.
    const opraveny = raw.replace(/[\r\n]+/g, "\\n");
    sa = JSON.parse(opraveny);
  }

  if (!sa.client_email || !sa.private_key)
    throw new Error("Service account JSON nema client_email/private_key");

  return {
    client_email: sa.client_email,
    // v env byvaji \n jako literal – prevedeme na skutecne odradkovani
    private_key: sa.private_key.replace(/\\n/g, "\n"),
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
