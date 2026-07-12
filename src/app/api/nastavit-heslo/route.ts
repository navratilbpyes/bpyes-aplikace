// src/app/api/nastavit-heslo/route.ts
// Nastaveni hesla klientem pres vlastni token flow. ZADNY service account klic.
// Token z emailu: "uid.tajemstvi.encRefresh"
//  1) rozsifrujeme refreshToken (AES-GCM, APP_SECRET) a smenime za idToken (jen Web API key)
//  2) idTokenem precteme vlastni profil, overime hash tajemstvi + expiraci + jednorazovost
//  3) idTokenem nastavime nove heslo (accounts:update)
//  4) oznacime profil hesloNastaveno=true (aby odkaz slo pouzit jen jednou)

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createHash, createDecipheriv } from 'crypto';

const PROJECT_ID = 'studio-2327834732-8ec09';
const FIREBASE_API_KEY = 'AIzaSyAJ2o8AlTOXKbIAtDYSNnDUvTLChAiGeoQ';
const IDENTITY = 'https://identitytoolkit.googleapis.com/v1';
const SECURETOKEN = 'https://securetoken.googleapis.com/v1/token';
const FIRESTORE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const schema = z.object({
  token: z.string().min(10),
  heslo: z.string().min(8).max(200),
});

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}
function decKey(): Buffer {
  const secret = process.env.APP_SECRET;
  if (!secret) throw new Error('Chybi APP_SECRET');
  return createHash('sha256').update(secret).digest();
}
function decrypt(payload: string): string {
  const [ivB, dataB, tagB] = payload.split('.');
  const iv = Buffer.from(ivB, 'base64url');
  const data = Buffer.from(dataB, 'base64url');
  const tag = Buffer.from(tagB, 'base64url');
  const decipher = createDecipheriv('aes-256-gcm', decKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

export async function POST(req: Request) {
  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ success: false, error: 'Neplatný požadavek.' }, { status: 400 });
  }

  // token = uid . tajemstvi . encRefresh(iv.data.tag)  -> 5 casti pri splitu podle '.'
  const casti = body.token.split('.');
  if (casti.length !== 5) {
    return NextResponse.json({ success: false, error: 'Neplatný odkaz.' }, { status: 400 });
  }
  const uid = casti[0];
  const tajemstvi = casti[1];
  const encRefresh = `${casti[2]}.${casti[3]}.${casti[4]}`;

  // 1) rozsifruj refreshToken a smen za idToken
  let idToken: string;
  try {
    const refreshToken = decrypt(encRefresh);
    const res = await fetch(`${SECURETOKEN}?key=${FIREBASE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });
    if (!res.ok) {
      console.error('Smena refresh tokenu selhala:', await res.text());
      return NextResponse.json({ success: false, error: 'Odkaz vypršel nebo je neplatný.' }, { status: 400 });
    }
    const data = await res.json();
    idToken = data.id_token;
  } catch (e) {
    console.error('Chyba pri zpracovani tokenu:', e);
    return NextResponse.json({ success: false, error: 'Neplatný odkaz.' }, { status: 400 });
  }

  // 2) precti vlastni profil a over hash + expiraci + jednorazovost
  try {
    const res = await fetch(`${FIRESTORE}/uzivatele/${uid}`, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!res.ok) {
      return NextResponse.json({ success: false, error: 'Profil nenalezen.' }, { status: 404 });
    }
    const doc = await res.json();
    const f = doc.fields ?? {};
    const ulozenyHash = f.tokenHesla?.stringValue;
    const exp = parseInt(f.tokenExp?.integerValue ?? '0', 10);
    const hesloNastaveno = f.hesloNastaveno?.booleanValue === true;

    if (!ulozenyHash || ulozenyHash !== sha256(tajemstvi)) {
      return NextResponse.json({ success: false, error: 'Neplatný odkaz.' }, { status: 400 });
    }
    if (Date.now() > exp) {
      return NextResponse.json({ success: false, error: 'Platnost odkazu vypršela.' }, { status: 410 });
    }
    if (hesloNastaveno) {
      return NextResponse.json({ success: false, error: 'Heslo už bylo nastaveno. Přihlaste se.' }, { status: 409 });
    }
  } catch (e) {
    console.error('Chyba pri cteni profilu:', e);
    return NextResponse.json({ success: false, error: 'Chyba serveru.' }, { status: 500 });
  }

  // 3) nastav nove heslo pres accounts:update s idTokenem
  try {
    const res = await fetch(`${IDENTITY}/accounts:update?key=${FIREBASE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken, password: body.heslo, returnSecureToken: false }),
    });
    if (!res.ok) {
      console.error('Nastaveni hesla selhalo:', await res.text());
      return NextResponse.json({ success: false, error: 'Heslo se nepodařilo nastavit.' }, { status: 500 });
    }
  } catch (e) {
    console.error('Chyba pri nastaveni hesla:', e);
    return NextResponse.json({ success: false, error: 'Chyba serveru.' }, { status: 500 });
  }

  // 4) oznac profil jako hotovy (jednorazovost). Zapis vlastnim idTokenem.
  try {
    await fetch(
      `${FIRESTORE}/uzivatele/${uid}?updateMask.fieldPaths=hesloNastaveno&updateMask.fieldPaths=tokenHesla`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          fields: {
            hesloNastaveno: { booleanValue: true },
            tokenHesla: { stringValue: '' }, // zneplatni token
          },
        }),
      }
    );
  } catch (e) {
    // heslo uz je nastaveno; kdyz se flag nezapsal, neni to fatalni
    console.error('Nepodarilo se zneplatnit token (heslo ale nastaveno):', e);
  }

  return NextResponse.json({ success: true });
}
