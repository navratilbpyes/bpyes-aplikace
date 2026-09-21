/**
 * AuditFlow — API route pro náhled souboru v prohlížeči.
 * Umístění: src/app/api/nahled-souboru/route.ts
 *
 * download.php posílá soubor jako přílohu, takže ho prohlížeč vždy stáhne.
 * Tahle route ho stáhne na serveru a pošle dál jako `inline` se správným
 * Content-Type — prohlížeč ho pak zobrazí. Úprava PHP na Wedosu není potřeba.
 *
 * Kontroly přístupu jsou totožné s /api/odkaz-souboru.
 *
 * ENV proměnné:
 *   APP_UPLOAD_SECRET   — shodné s UPLOAD_SECRET v config.php
 *   DOWNLOAD_ENDPOINT   — https://appbpyes.cz/download.php
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';

const PROJECT_ID =
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'studio-2327834732-8ec09';
const SECRET = process.env.APP_UPLOAD_SECRET!;
const ENDPOINT = process.env.DOWNLOAD_ENDPOINT!;

// Firebase Web API key je veřejný (jezdí v prohlížeči), ochranu řeší Firestore
// Rules. Env je primární zdroj, konstanta je fallback — bez ní `overToken`
// volá Identity Toolkit s key=undefined a vydání odkazu spadne na 401.
const FIREBASE_API_KEY =
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyAJ2o8AlTOXKbIAtDYSNnDUvTLChAiGeoQ';

async function overToken(idToken: string): Promise<{ uid: string } | null> {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
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

const TYPY: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
};

export async function GET(req: NextRequest) {
  const idToken = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!idToken) {
    return NextResponse.json({ chyba: 'Chybí token' }, { status: 401 });
  }

  const dokumentId = req.nextUrl.searchParams.get('id');
  if (!dokumentId) {
    return NextResponse.json({ chyba: 'Chybí id dokumentu' }, { status: 400 });
  }

  const user = await overToken(idToken);
  if (!user) {
    return NextResponse.json(
      { chyba: 'Přihlášení vypršelo. Obnovte stránku a zkuste to znovu.' },
      { status: 401 },
    );
  }

  const profil = await nactiProfil(user.uid, idToken);
  const dokument = await nactiDokument(dokumentId, idToken);

  if (!profil || !dokument || dokument.stav !== 'aktivni') {
    return NextResponse.json({ chyba: 'Dokument nenalezen' }, { status: 404 });
  }
  if (profil.role !== 'admin' && dokument.klientId !== profil.klientId) {
    return NextResponse.json({ chyba: 'Nepovolený přístup' }, { status: 403 });
  }

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

  let wedos: Response;
  try {
    wedos = await fetch(`${ENDPOINT}?${params.toString()}`);
  } catch {
    return NextResponse.json({ chyba: 'Úložiště neodpovídá.' }, { status: 502 });
  }
  if (!wedos.ok || !wedos.body) {
    // Tělo do logu — HTML stránka tu obvykle znamená ochranu hostingu, ne chybu PHP.
    const telo = await wedos.text().catch(() => '');
    console.error('nahled-souboru: Wedos odmítl', wedos.status, telo.slice(0, 1500));
    return NextResponse.json({ chyba: `Soubor se nepodařilo načíst (HTTP ${wedos.status}).` }, { status: 502 });
  }

  const pripona = (dokument.pripona ?? '').toLowerCase().replace(/^\./, '');
  const nazev = encodeURIComponent(dokument.nazev ?? 'dokument');

  return new NextResponse(wedos.body, {
    status: 200,
    headers: {
      'Content-Type': TYPY[pripona] ?? wedos.headers.get('content-type') ?? 'application/octet-stream',
      // inline = zobrazit, ne stáhnout
      'Content-Disposition': `inline; filename*=UTF-8''${nazev}`,
      'Cache-Control': 'private, no-store',
    },
  });
}
