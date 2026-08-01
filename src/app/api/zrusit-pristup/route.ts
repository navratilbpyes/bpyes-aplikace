// src/app/api/zrusit-pristup/route.ts
// Trvalé zrušení přístupu jedné kontaktní osoby. ŽÁDNÝ service account.
//
// Tvrdé smazání účtu ve Firebase Auth umí jen Admin SDK (service account) nebo
// sám uživatel svým idTokenem — admin ani jedno nemá. Nejblíže „zrušení" bez SA:
//   1) profil označíme deaktivovan=true (guard v layout.tsx uživatele vyhodí),
//   2) smažeme dokument profilu z kolekce `uzivatele`.
// Bez profilu data-provider vrátí userProfile=null → uživatel se po přihlášení
// dostane jen na login screen a nevidí žádná data. Osiřelý Auth účet zůstává
// (nedá se bez SA smazat), ale je bez profilu neškodný — do aplikace nepustí.
//
// Důsledek pro UI: e-mail zmizí ze seznamu přístupů (nemá profil), takže se
// zobrazí jako „bez přístupu" a jde ho případně znovu pozvat (vznikne nový
// profil ke stávajícímu Auth účtu přes vytvorit-klienta → EMAIL_EXISTS! proto
// pozor: opětovné pozvání stejného e-mailu selže na EMAIL_EXISTS. Pro obnovu
// raději použij reaktivaci, dokud profil ještě existuje.)
//
// POST { email, klientId }. Jen admin.

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
  const { klientId } = parsed.data;

  const name = await najdiProfil(email, klientId, adminToken);
  if (!name) {
    return NextResponse.json(
      { success: false, error: 'Tento e-mail nemá u daného klienta účet.' },
      { status: 404 }
    );
  }

  // 1) pojistka: nejdřív deaktivuj (kdyby smazání selhalo, ať se mezitím
  //    uživatel stejně nedostane dovnitř)
  try {
    await fetch(
      `https://firestore.googleapis.com/v1/${name}?updateMask.fieldPaths=deaktivovan`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ fields: { deaktivovan: { booleanValue: true } } }),
      }
    );
  } catch (e) {
    console.error('Deaktivace před zrušením selhala (pokračuji ke smazání):', e);
  }

  // 2) smaž profil
  try {
    const res = await fetch(`https://firestore.googleapis.com/v1/${name}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (!res.ok) {
      console.error('DELETE profilu selhal:', await res.text());
      return NextResponse.json({ success: false, error: 'Zrušení selhalo.' }, { status: 500 });
    }
  } catch (e) {
    console.error('Chyba při mazání profilu:', e);
    return NextResponse.json({ success: false, error: 'Chyba serveru.' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    zprava: 'Přístup byl zrušen. Účet je bez profilu, do aplikace se nedostane.',
  });
}
