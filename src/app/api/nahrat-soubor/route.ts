/**
 * AuditFlow — API route pro nahrání souboru.
 * Umístění: src/app/api/nahrat-soubor/route.ts
 *
 * Tok:
 *   1. Ověří Firebase idToken volajícího
 *   2. Zjistí jeho klientId z Firestore
 *   3. Podepíše požadavek HMAC a přepošle soubor na Wedos
 *   4. Zapíše metadata do Firestore
 *
 * ENV proměnné (Vercel):
 *   APP_UPLOAD_SECRET      — shodné s UPLOAD_SECRET v config.php
 *   UPLOAD_ENDPOINT        — https://appbpyes.cz/upload.php
 *   NEXT_PUBLIC_FIREBASE_PROJECT_ID
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';

// Project ID je veřejné (je v klientském firebaseConfig). Env je primární,
// konstanta je fallback — bez ní `nactiProfil` volá Firestore REST na
// projects/undefined/... → profil se nenačte a každý upload spadne na 403.
const PROJECT_ID =
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'studio-2327834732-8ec09';
const SECRET = process.env.APP_UPLOAD_SECRET!;
const ENDPOINT = process.env.UPLOAD_ENDPOINT!;

// Firebase Web API key je veřejný (jezdí v prohlížeči), ochranu řeší Firestore
// Rules. Env je primární zdroj, konstanta je fallback — bez ní `overToken`
// volá Identity Toolkit s key=undefined a každý upload spadne na 401.
const FIREBASE_API_KEY =
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyAJ2o8AlTOXKbIAtDYSNnDUvTLChAiGeoQ';

const MAX_VELIKOST = 20 * 1024 * 1024;
const POVOLENE_MIME = ['application/pdf', 'image/jpeg', 'image/png'];

/** Ověří Firebase idToken přes REST API (bez service account). */
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

/** Načte profil uživatele z Firestore pomocí jeho vlastního tokenu. */
async function nactiProfil(uid: string, idToken: string) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/uzivatele/${uid}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });
  if (!res.ok) return null;
  const doc = await res.json();
  const f = doc.fields ?? {};
  return {
    klientId: f.klientId?.stringValue as string | undefined,
    role: f.role?.stringValue as string | undefined,
  };
}

/** Zapíše metadata souboru do Firestore kolekce `dokumenty`. */
async function zapisMetadata(
  idToken: string,
  data: {
    klientId: string;
    souborId: string;
    pripona: string;
    nazev: string;
    velikost: number;
    nahralUid: string;
  },
) {
  // Dokument zakládáme s EXPLICITNÍM ID = souborId (Wedos ID), aby se dal
  // později najít v odkaz-souboru podle protokolDokumentId (které = souborId).
  // Bez ?documentId by Firestore vygeneroval vlastní auto-ID a odkaz-souboru
  // by dokument nenašel → 404 „Dokument nenalezen".
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/dokumenty?documentId=${encodeURIComponent(data.souborId)}`;
  const body = {
    fields: {
      klientId: { stringValue: data.klientId },
      souborId: { stringValue: data.souborId },
      pripona: { stringValue: data.pripona },
      nazev: { stringValue: data.nazev },
      velikost: { integerValue: String(data.velikost) },
      nahralUid: { stringValue: data.nahralUid },
      nahranoIso: { timestampValue: new Date().toISOString() },
      stav: { stringValue: 'aktivni' },
    },
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.ok;
}

export async function POST(req: NextRequest) {
  // ── 1. Autentizace ──
  const auth = req.headers.get('authorization') ?? '';
  const idToken = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!idToken) {
    return NextResponse.json({ chyba: 'Chybí token' }, { status: 401 });
  }

  const user = await overToken(idToken);
  if (!user) {
    return NextResponse.json({ chyba: 'Neplatný token' }, { status: 401 });
  }

  const profil = await nactiProfil(user.uid, idToken);
  if (!profil) {
    return NextResponse.json({ chyba: 'Profil nenalezen' }, { status: 403 });
  }

  // ── 2. Soubor + cílový klient z požadavku ──
  const form = await req.formData();
  const soubor = form.get('soubor') as File | null;
  const zadanyKlientId = (form.get('klientId') as string | null)?.trim() || '';

  // Efektivní klientId:
  //  - admin: musí přijít v požadavku (nahrává ke konkrétnímu klientovi);
  //           admin sám klientId v profilu nemá.
  //  - klient: vždy jeho vlastní z profilu; případný zadaný klientId se ignoruje
  //           (nesmí podvrhnout cizího klienta).
  const jeAdmin = profil.role === 'admin';
  const klientId = jeAdmin ? zadanyKlientId : (profil.klientId ?? '');

  if (!klientId) {
    return NextResponse.json(
      { chyba: jeAdmin ? 'Chybí cílový klient' : 'Uživatel nemá přiřazeného klienta' },
      { status: 403 },
    );
  }

  if (!soubor) {
    return NextResponse.json({ chyba: 'Chybí soubor' }, { status: 400 });
  }
  if (soubor.size > MAX_VELIKOST) {
    return NextResponse.json({ chyba: 'Soubor je příliš velký (max 20 MB)' }, { status: 413 });
  }
  if (!POVOLENE_MIME.includes(soubor.type)) {
    return NextResponse.json({ chyba: 'Nepovolený typ (jen PDF, JPG, PNG)' }, { status: 415 });
  }

  // ── 3. Podpis a přeposlání na Wedos ──
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nazev = soubor.name;
  const zprava = `${klientId}|${timestamp}|${nazev}`;
  const podpis = createHmac('sha256', SECRET).update(zprava).digest('hex');

  const odeslat = new FormData();
  odeslat.append('klientId', klientId);
  odeslat.append('timestamp', timestamp);
  odeslat.append('nazev', nazev);
  odeslat.append('podpis', podpis);
  odeslat.append('soubor', soubor);

  const wedos = await fetch(ENDPOINT, { method: 'POST', body: odeslat });
  const vysledek = await wedos.json();

  if (!wedos.ok || !vysledek.ok) {
    return NextResponse.json(
      { chyba: vysledek.chyba ?? 'Nahrání selhalo' },
      { status: wedos.status || 500 },
    );
  }

  // ── 4. Metadata do Firestore ──
  const zapisOk = await zapisMetadata(idToken, {
    klientId,
    souborId: vysledek.souborId,
    pripona: vysledek.pripona,
    nazev,
    velikost: vysledek.velikost,
    nahralUid: user.uid,
  });

  if (!zapisOk) {
    return NextResponse.json({ chyba: 'Metadata se nepodařilo uložit' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, souborId: vysledek.souborId });
}
