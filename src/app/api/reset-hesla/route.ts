// src/app/api/reset-hesla/route.ts
// Reset hesla klienta iniciovaný adminem. ŽÁDNÝ service account klíč.
//
// Problém: pro cizí (klientův) účet admin nemá jeho heslo ani refresh token,
// takže nemůže znovu použít token flow z `vytvorit-klienta` (ten funguje jen
// pro čerstvě vytvořený účet, kde signUp refresh token vrátí).
//
// Řešení bez SA: veřejné Identity Toolkit API `accounts:sendOobCode` s
// requestType=PASSWORD_RESET. To pošle klientovi standardní Firebase e-mail
// s odkazem na reset hesla. Nevyžaduje SA ani idToken cílového účtu — stačí
// Web API key. Admin request je chráněn běžným ověřením (přihlášený admin).
//
// Kompromis: e-mail odesílá Firebase (ne brandovaný Resend). Text/odesílatele
// lze upravit v konzoli Firebase → Authentication → Templates. Pokud bude
// později k dispozici service account, jde přejít na returnOobLink=true a
// poslat vlastní brandovaný e-mail přes Resend (viz TODO níže).

import { NextResponse } from 'next/server';
import { z } from 'zod';

const PROJECT_ID = 'studio-2327834732-8ec09';
const FIREBASE_API_KEY = 'AIzaSyAJ2o8AlTOXKbIAtDYSNnDUvTLChAiGeoQ';
const IDENTITY = 'https://identitytoolkit.googleapis.com/v1';
const FIRESTORE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const schema = z.object({
  email: z.string().email(),
  klientId: z.string().min(1).max(200),
});

async function verifyToken(authHeader: string | null): Promise<string | null> {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const idToken = authHeader.substring(7);
  try {
    const res = await fetch(`${IDENTITY}/accounts:lookup?key=${FIREBASE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.users?.[0]?.localId || null;
  } catch {
    return null;
  }
}

async function isAdmin(uid: string, idToken: string): Promise<boolean> {
  try {
    const res = await fetch(`${FIRESTORE}/uzivatele/${uid}`, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!res.ok) return false;
    const doc = await res.json();
    return doc?.fields?.role?.stringValue === 'admin';
  } catch {
    return false;
  }
}

/** Ověří, že daný e-mail opravdu patří účtu tohoto klienta (kolekce uzivatele). */
async function patriKlientovi(email: string, klientId: string, idToken: string): Promise<boolean> {
  try {
    const res = await fetch(`${FIRESTORE}:runQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'uzivatele' }],
          where: {
            compositeFilter: {
              op: 'AND',
              filters: [
                { fieldFilter: { field: { fieldPath: 'klientId' }, op: 'EQUAL', value: { stringValue: klientId } } },
                { fieldFilter: { field: { fieldPath: 'email' }, op: 'EQUAL', value: { stringValue: email } } },
              ],
            },
          },
          limit: 1,
        },
      }),
    });
    if (!res.ok) return false;
    const rows = (await res.json()) as Array<{ document?: unknown }>;
    return rows.some((r) => r.document);
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');

  // 1) jen přihlášený admin
  const uid = await verifyToken(authHeader);
  if (!uid) {
    return NextResponse.json({ success: false, error: 'Neautorizováno.' }, { status: 401 });
  }
  const adminToken = authHeader!.substring(7);
  if (!(await isAdmin(uid, adminToken))) {
    return NextResponse.json({ success: false, error: 'Přístup jen pro administrátora.' }, { status: 403 });
  }

  // 2) validace vstupu
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Neplatný vstup.' }, { status: 400 });
  }
  const email = parsed.data.email.toLowerCase();
  const { klientId } = parsed.data;

  // 3) pojistka: e-mail musí patřit účtu tohoto klienta
  if (!(await patriKlientovi(email, klientId, adminToken))) {
    return NextResponse.json(
      { success: false, error: 'Tento e-mail nemá u daného klienta účet.' },
      { status: 400 }
    );
  }

  // 4) pošli reset e-mail přes veřejné Identity Toolkit API (bez SA)
  try {
    const res = await fetch(`${IDENTITY}/accounts:sendOobCode?key=${FIREBASE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestType: 'PASSWORD_RESET', email }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const kod = data?.error?.message;
      if (kod === 'EMAIL_NOT_FOUND') {
        return NextResponse.json(
          { success: false, error: 'Účet s tímto e-mailem ve Firebase neexistuje.' },
          { status: 404 }
        );
      }
      console.error('sendOobCode PASSWORD_RESET selhal:', kod);
      return NextResponse.json({ success: false, error: 'Reset se nepodařilo odeslat.' }, { status: 500 });
    }
  } catch (e) {
    console.error('Chyba při odesílání resetu:', e);
    return NextResponse.json({ success: false, error: 'Reset se nepodařilo odeslat.' }, { status: 500 });
  }

  // TODO (až bude service account): sendOobCode s returnOobLink=true → vlastní
  // brandovaný e-mail přes Resend, stejně jako pozvánka.
  return NextResponse.json({
    success: true,
    zprava: 'Klientovi byl odeslán e-mail s odkazem pro nastavení nového hesla.',
  });
}
