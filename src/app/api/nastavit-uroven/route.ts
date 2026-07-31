/**
 * AuditFlow — nastavení úrovně přístupu klienta (full / basic).
 * Umístění: src/app/api/nastavit-uroven/route.ts
 *
 * POST { klientId, uroven }  — nastaví `uroven` všem účtům daného klienta.
 * Jen admin. Píše adminovým tokenem (klient si roli/úroveň měnit nesmí).
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';

const PROJECT_ID = 'studio-2327834732-8ec09';
const API_KEY = 'AIzaSyAJ2o8AlTOXKbIAtDYSNnDUvTLChAiGeoQ';
const FIRESTORE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const schema = z.object({
  klientId: z.string().min(1).max(200),
  uroven: z.enum(['full', 'basic']),
});

async function verifyToken(authHeader: string | null): Promise<string | null> {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const idToken = authHeader.slice(7);
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    },
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data?.users?.[0]?.localId ?? null;
}

async function isAdmin(uid: string, idToken: string): Promise<boolean> {
  const res = await fetch(`${FIRESTORE}/uzivatele/${uid}`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) return false;
  const doc = await res.json();
  return doc?.fields?.role?.stringValue === 'admin';
}

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  const idToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const uid = await verifyToken(authHeader);
  if (!uid || !idToken || !(await isAdmin(uid, idToken))) {
    return NextResponse.json({ success: false, error: 'Neautorizováno.' }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Neplatný vstup.' }, { status: 400 });
  }
  const { klientId, uroven } = parsed.data;

  try {
    // Najdi všechny účty daného klienta.
    const q = await fetch(`${FIRESTORE}:runQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
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

    if (!q.ok) {
      return NextResponse.json({ success: false, error: 'Chyba dotazu.' }, { status: 500 });
    }

    const rows = (await q.json()) as Array<{ document?: { name?: string } }>;
    const jmena = rows
      .map((r) => r.document?.name)
      .filter((n): n is string => !!n);

    if (jmena.length === 0) {
      return NextResponse.json({ success: false, error: 'Klient nemá žádné účty.' }, { status: 404 });
    }

    // Nastav uroven každému účtu (PATCH s updateMask jen na pole uroven).
    for (const name of jmena) {
      await fetch(`${name}?updateMask.fieldPaths=uroven`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ fields: { uroven: { stringValue: uroven } } }),
      });
    }

    return NextResponse.json({ success: true, pocet: jmena.length, uroven });
  } catch (e) {
    console.error('Nastavení úrovně selhalo:', e);
    return NextResponse.json({ success: false, error: 'Chyba serveru.' }, { status: 500 });
  }
}

/** GET ?klientId=... — vrátí aktuální úroveň (z prvního účtu klienta). */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const idToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const uid = await verifyToken(authHeader);
  if (!uid || !idToken || !(await isAdmin(uid, idToken))) {
    return NextResponse.json({ success: false, error: 'Neautorizováno.' }, { status: 403 });
  }

  const klientId = new URL(request.url).searchParams.get('klientId');
  if (!klientId) {
    return NextResponse.json({ success: false, error: 'Chybí klientId.' }, { status: 400 });
  }

  try {
    const q = await fetch(`${FIRESTORE}:runQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
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
          limit: 1,
        },
      }),
    });
    const rows = (await q.json()) as Array<{
      document?: { fields?: { uroven?: { stringValue?: string } } };
    }>;
    const uroven = rows[0]?.document?.fields?.uroven?.stringValue ?? 'full';
    return NextResponse.json({ success: true, uroven });
  } catch {
    return NextResponse.json({ success: true, uroven: 'full' });
  }
}
