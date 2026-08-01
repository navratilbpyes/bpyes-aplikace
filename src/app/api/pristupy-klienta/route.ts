// src/app/api/pristupy-klienta/route.ts
// GET ?klientId=... -> vrati seznam uctu (emailu) s pristupem pro daneho klienta
// a stav nastaveni hesla. JEN admin. Cte kolekci 'uzivatele' adminovym tokenem.

import { NextResponse } from 'next/server';

const PROJECT_ID = 'studio-2327834732-8ec09';
const FIREBASE_API_KEY = 'AIzaSyAJ2o8AlTOXKbIAtDYSNnDUvTLChAiGeoQ';
const IDENTITY = 'https://identitytoolkit.googleapis.com/v1';
const FIRESTORE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

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

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  const idToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : '';
  const uid = await verifyToken(authHeader);
  if (!uid || !(await isAdmin(uid, idToken))) {
    return NextResponse.json({ success: false, error: 'Jen admin.' }, { status: 403 });
  }

  const url = new URL(req.url);
  const klientId = url.searchParams.get('klientId');
  if (!klientId) {
    return NextResponse.json({ success: false, error: 'Chybí klientId.' }, { status: 400 });
  }

  try {
    // runQuery: uzivatele kde klientId == klientId
    const res = await fetch(`${FIRESTORE}:runQuery`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'uzivatele' }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'klientId' },
              op: 'EQUAL',
              value: { stringValue: klientId },
            },
          },
          limit: 100,
        },
      }),
    });

    if (!res.ok) {
      console.error('runQuery pristupy selhal:', await res.text());
      return NextResponse.json({ success: false, error: 'Chyba dotazu.' }, { status: 500 });
    }

    const rows = (await res.json()) as Array<{
      document?: { fields?: Record<string, { stringValue?: string; booleanValue?: boolean }> };
    }>;

    const pristupy = rows
      .filter((r) => r.document?.fields)
      .map((r) => {
        const f = r.document!.fields!;
        return {
          email: (f.email?.stringValue || '').toLowerCase(),
          hesloNastaveno: f.hesloNastaveno?.booleanValue === true,
          deaktivovan: f.deaktivovan?.booleanValue === true,
        };
      })
      .filter((p) => p.email);

    return NextResponse.json({ success: true, pristupy });
  } catch (e) {
    console.error('Chyba pri cteni pristupu:', e);
    return NextResponse.json({ success: false, error: 'Chyba serveru.' }, { status: 500 });
  }
}
