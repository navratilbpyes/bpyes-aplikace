// src/app/api/deaktivovat-pristup/route.ts
// Dočasná deaktivace / reaktivace přístupu jedné kontaktní osoby. ŽÁDNÝ SA.
//
// Firebase Auth `disabled` flag lze nastavit jen přes Admin SDK (service
// account), který na Vercelu není. Proto místo toho používáme aplikační
// příznak `deaktivovan: true` v profilu (kolekce `uzivatele`). Guard v
// layout.tsx takového uživatele po přihlášení odhlásí. Účet ve Firebase Auth
// zůstává (klient se technicky přihlásí), ale aplikace ho nepustí dovnitř.
//
// POST { email, klientId, deaktivovan: boolean }
//   deaktivovan=true  → zablokuje přístup
//   deaktivovan=false → obnoví přístup
// Jen admin. Píše adminovým tokenem (klient si příznak měnit nesmí).

import { NextResponse } from 'next/server';
import { z } from 'zod';

const PROJECT_ID = 'studio-2327834732-8ec09';
const FIREBASE_API_KEY = 'AIzaSyAJ2o8AlTOXKbIAtDYSNnDUvTLChAiGeoQ';
const IDENTITY = 'https://identitytoolkit.googleapis.com/v1';
const FIRESTORE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const schema = z.object({
  email: z.string().email(),
  klientId: z.string().min(1).max(200),
  deaktivovan: z.boolean(),
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

/** Najde resource name (cestu) profilu podle e-mailu + klientId. */
async function najdiProfil(email: string, klientId: string, idToken: string): Promise<string | null> {
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
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{ document?: { name?: string } }>;
    return rows[0]?.document?.name ?? null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');

  const uid = await verifyToken(authHeader);
  if (!uid) {
    return NextResponse.json({ success: false, error: 'Neautorizováno.' }, { status: 401 });
  }
  const adminToken = authHeader!.substring(7);
  if (!(await isAdmin(uid, adminToken))) {
    return NextResponse.json({ success: false, error: 'Přístup jen pro administrátora.' }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Neplatný vstup.' }, { status: 400 });
  }
  const email = parsed.data.email.toLowerCase();
  const { klientId, deaktivovan } = parsed.data;

  const name = await najdiProfil(email, klientId, adminToken);
  if (!name) {
    return NextResponse.json(
      { success: false, error: 'Tento e-mail nemá u daného klienta účet.' },
      { status: 404 }
    );
  }

  // PATCH jen pole `deaktivovan`. `name` z runQuery je resource cesta,
  // fetch potřebuje plnou URL: https://firestore.googleapis.com/v1/{name}
  try {
    const res = await fetch(
      `https://firestore.googleapis.com/v1/${name}?updateMask.fieldPaths=deaktivovan`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ fields: { deaktivovan: { booleanValue: deaktivovan } } }),
      }
    );
    if (!res.ok) {
      console.error('PATCH deaktivovan selhal:', await res.text());
      return NextResponse.json({ success: false, error: 'Zápis selhal.' }, { status: 500 });
    }
  } catch (e) {
    console.error('Chyba při zápisu deaktivace:', e);
    return NextResponse.json({ success: false, error: 'Chyba serveru.' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    deaktivovan,
    zprava: deaktivovan
      ? 'Přístup byl dočasně pozastaven.'
      : 'Přístup byl obnoven.',
  });
}
