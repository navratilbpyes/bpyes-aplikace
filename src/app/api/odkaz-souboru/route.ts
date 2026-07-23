/**
 * AuditFlow — API route pro vydání odkazu ke stažení.
 * Umístění: src/app/api/odkaz-souboru/route.ts
 *
 * Vrací dočasný podepsaný odkaz na download.php.
 * Platnost odkazu je krátká (CAS_TOLERANCE v config.php, výchozí 5 minut).
 *
 * ENV proměnné:
 *   APP_UPLOAD_SECRET   — shodné s UPLOAD_SECRET v config.php
 *   DOWNLOAD_ENDPOINT   — https://appbpyes.cz/download.php
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!;
const SECRET = process.env.APP_UPLOAD_SECRET!;
const ENDPOINT = process.env.DOWNLOAD_ENDPOINT!;

async function overToken(idToken: string): Promise<{ uid: string } | null> {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    },
  );
  if (!res.ok) return null;
  const data = await res.json();
  const uid = data?.users?.[0]?.localId;
  return uid ? { uid } : null;
}

async function nactiProfil(uid: string, idToken: string) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/uzivatele/${uid}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });
  if (!res.ok) return null;
  const f = (await res.json()).fields ?? {};
  return {
    klientId: f.klientId?.stringValue as string | undefined,
    role: f.role?.stringValue as string | undefined,
  };
}

/** Načte dokument a ověří, že patří danému klientovi. */
async function nactiDokument(dokumentId: string, idToken: string) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/dokumenty/${dokumentId}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });
  if (!res.ok) return null;
  const f = (await res.json()).fields ?? {};
  return {
    klientId: f.klientId?.stringValue as string | undefined,
    souborId: f.souborId?.stringValue as string | undefined,
    pripona: f.pripona?.stringValue as string | undefined,
    nazev: f.nazev?.stringValue as string | undefined,
    stav: f.stav?.stringValue as string | undefined,
  };
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? '';
  const idToken = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!idToken) {
    return NextResponse.json({ chyba: 'Chybí token' }, { status: 401 });
  }

  const dokumentId = req.nextUrl.searchParams.get('id');
  if (!dokumentId) {
    return NextResponse.json({ chyba: 'Chybí id dokumentu' }, { status: 400 });
  }

  const user = await overToken(idToken);
  if (!user) {
    return NextResponse.json({ chyba: 'Neplatný token' }, { status: 401 });
  }

  const profil = await nactiProfil(user.uid, idToken);
  const dokument = await nactiDokument(dokumentId, idToken);

  if (!profil || !dokument || dokument.stav !== 'aktivni') {
    return NextResponse.json({ chyba: 'Dokument nenalezen' }, { status: 404 });
  }

  // Klíčová kontrola: dokument musí patřit klientovi volajícího (admin může vše)
  if (profil.role !== 'admin' && dokument.klientId !== profil.klientId) {
    return NextResponse.json({ chyba: 'Nepovolený přístup' }, { status: 403 });
  }

  // ── Podpis odkazu ──
  const timestamp = String(Math.floor(Date.now() / 1000));
  const zprava = `${dokument.klientId}|${timestamp}|${dokument.souborId}`;
  const podpis = createHmac('sha256', SECRET).update(zprava).digest('hex');

  const params = new URLSearchParams({
    klientId: dokument.klientId!,
    souborId: dokument.souborId!,
    pripona: dokument.pripona!,
    nazev: dokument.nazev ?? 'dokument',
    timestamp,
    podpis,
  });

  return NextResponse.json({ odkaz: `${ENDPOINT}?${params.toString()}` });
}
