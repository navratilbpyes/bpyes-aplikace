import { NextResponse } from 'next/server';
import { z } from 'zod';

const PROJECT_ID = 'studio-2327834732-8ec09';
const FIREBASE_API_KEY = 'AIzaSyAJ2o8AlTOXKbIAtDYSNnDUvTLChAiGeoQ';
const IDENTITY = 'https://identitytoolkit.googleapis.com/v1';
const FIRESTORE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const schema = z.object({
  email: z.string().email(),
  klientId: z.string().min(1).max(200),
  klientNazev: z.string().max(200).optional(),
});

/** Ověří ID token přes veřejné Identity Toolkit API. Vrací uid, nebo null. */
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

/** Ověří, že uživatel má v kolekci 'uzivatele' roli 'admin'. */
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

/** Ověří, že klient s daným ID existuje. Chrání proti překlepu v klientId. */
async function klientExistuje(klientId: string, idToken: string): Promise<boolean> {
  try {
    const res = await fetch(`${FIRESTORE}/klienti/${klientId}`, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Heslo, které nikdo nezná. Klient si nastaví vlastní přes odkaz v e-mailu. */
function nahodneHeslo(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');

  // 1) Ověření, že požadavek poslal přihlášený admin
  const uid = await verifyToken(authHeader);
  if (!uid) {
    return NextResponse.json({ success: false, error: 'Neautorizováno.' }, { status: 401 });
  }
  const adminToken = authHeader!.substring(7);
  if (!(await isAdmin(uid, adminToken))) {
    return NextResponse.json({ success: false, error: 'Přístup jen pro administrátora.' }, { status: 403 });
  }

  // 2) Validace vstupu
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Neplatný vstup.' }, { status: 400 });
  }
  const { email, klientId, klientNazev } = parsed.data;

  // 3) Ověření, že klient existuje. Bez toho by vznikl účet s neplatným
  //    klientId a klient by po přihlášení neviděl vůbec nic.
  if (!(await klientExistuje(klientId, adminToken))) {
    return NextResponse.json(
      { success: false, error: 'Klient s tímto ID neexistuje.' },
      { status: 400 }
    );
  }

  // 4) Vytvoření účtu v Firebase Auth s náhodným heslem
  let novyUid: string;
  try {
    const res = await fetch(`${IDENTITY}/accounts:signUp?key=${FIREBASE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: nahodneHeslo(), returnSecureToken: false }),
    });
    const data = await res.json();

    if (!res.ok) {
      const kod = data?.error?.message;
      if (kod === 'EMAIL_EXISTS') {
        return NextResponse.json(
          { success: false, error: 'Účet s tímto e-mailem už existuje.' },
          { status: 409 }
        );
      }
      console.error('Vytvoření účtu selhalo:', kod);
      return NextResponse.json({ success: false, error: 'Účet se nepodařilo vytvořit.' }, { status: 500 });
    }
    novyUid = data.localId;
  } catch (e) {
    console.error('Chyba při vytváření účtu:', e);
    return NextResponse.json({ success: false, error: 'Účet se nepodařilo vytvořit.' }, { status: 500 });
  }

  // 5) Vytvoření profilu v kolekci 'uzivatele'.
  //    Zapisuje se adminovým tokenem – Rules povolí jen role 'client'
  //    a jen cizí profil. Použit je createDocument s documentId = uid.
  try {
    const res = await fetch(
      `${FIRESTORE}/uzivatele?documentId=${encodeURIComponent(novyUid)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          fields: {
            role: { stringValue: 'client' },
            klientId: { stringValue: klientId },
            klientNazev: { stringValue: klientNazev || '' },
            email: { stringValue: email },
          },
        }),
      }
    );

    if (!res.ok) {
      const chyba = await res.text();
      console.error('Vytvoření profilu selhalo:', chyba);
      // Účet už existuje, ale profil ne. Klient by se přihlásil a neviděl nic.
      // Vracíme uid, aby šlo profil doplnit ručně nebo účet smazat.
      return NextResponse.json(
        {
          success: false,
          error: 'Účet vznikl, ale profil se nepodařilo vytvořit. Doplňte jej ručně ve Firestore.',
          uid: novyUid,
        },
        { status: 500 }
      );
    }
  } catch (e) {
    console.error('Chyba při vytváření profilu:', e);
    return NextResponse.json(
      { success: false, error: 'Účet vznikl, ale profil se nepodařilo vytvořit.', uid: novyUid },
      { status: 500 }
    );
  }

  // 6) Odeslání odkazu pro nastavení hesla.
  //    Heslo z kroku 4 nikdo nezná – klient si své nastaví přes tento odkaz.
  let pozvankaOdeslana = true;
  try {
    const res = await fetch(`${IDENTITY}/accounts:sendOobCode?key=${FIREBASE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestType: 'PASSWORD_RESET', email }),
    });
    if (!res.ok) {
      pozvankaOdeslana = false;
      console.error('Odeslání pozvánky selhalo:', await res.text());
    }
  } catch (e) {
    pozvankaOdeslana = false;
    console.error('Chyba při odesílání pozvánky:', e);
  }

  return NextResponse.json({
    success: true,
    uid: novyUid,
    pozvankaOdeslana,
    zprava: pozvankaOdeslana
      ? 'Účet vytvořen. Klientovi byl odeslán e-mail pro nastavení hesla.'
      : 'Účet vytvořen, ale e-mail s odkazem se nepodařilo odeslat. Pošlete jej znovu z Firebase konzole.',
  });
}
