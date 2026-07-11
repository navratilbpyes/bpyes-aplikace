import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Resend } from 'resend';
import { getAccessToken } from '@/lib/google-token';

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

  // 6) Vygenerovani odkazu pro nastaveni hesla BEZ odeslani Firebase emailu
  //    (returnOobLink: true funguje jen u autentizovaneho pozadavku pres service account),
  //    a odeslani vlastniho brandovaneho emailu pres Resend z overene domeny bpyes.cz.
  let pozvankaOdeslana = true;
  try {
    // 6a) autentizovane volani sendOobCode se service account tokenem
    const saToken = await getAccessToken(
      'https://www.googleapis.com/auth/identitytoolkit'
    );
    const oobRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts:sendOobCode`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${saToken}`,
        },
        body: JSON.stringify({
          requestType: 'PASSWORD_RESET',
          email,
          returnOobLink: true, // <- odkaz jen vratit, email NEposilat
        }),
      }
    );

    if (!oobRes.ok) {
      pozvankaOdeslana = false;
      console.error('Generovani odkazu selhalo:', await oobRes.text());
    } else {
      const oobData = await oobRes.json();
      const odkaz: string | undefined = oobData.oobLink;

      if (!odkaz) {
        pozvankaOdeslana = false;
        console.error('Firebase nevratil oobLink:', JSON.stringify(oobData));
      } else {
        // 6b) odeslani vlastniho emailu pres Resend (stejny vzor jako /api/send-email)
        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) {
          pozvankaOdeslana = false;
          console.error('Chybi RESEND_API_KEY v env promennych.');
        } else {
          const resend = new Resend(apiKey);
          try {
            await resend.emails.send({
              from:
                process.env.POZVANKY_FROM ??
                'BPyes AuditFlow <navratil@bpyes.cz>',
              to: email,
              subject: 'Váš přístup do BPyes AuditFlow',
              html: `
        <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; border: 1px solid #e5e7eb; border-radius: 8px;">
          <h2 style="color: #2563eb; margin-top: 0;">Vítejte v BPyes AuditFlow</h2>
          <p>Dobrý den,</p>
          <p>byl vám vytvořen přístup do klientského portálu <strong>${
            klientNazev || 'BPyes AuditFlow'
          }</strong>, kde uvidíte auditní protokoly a zjištění týkající se vaší firmy.</p>
          <p>Pro dokončení registrace si prosím nastavte vlastní heslo kliknutím na tlačítko níže:</p>
          <div style="margin: 30px 0;">
            <a href="${odkaz}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              Nastavit heslo a vstoupit
            </a>
          </div>
          <p style="font-size: 13px; color: #6b7280;">Pokud tlačítko nefunguje, zkopírujte do prohlížeče tento odkaz:<br>${odkaz}</p>
          <p style="font-size: 13px; color: #6b7280; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 15px;">
            Na tuto adresu se budete přihlašovat. Uvidíte pouze záznamy své firmy.<br>
            Toto je automaticky generovaná zpráva ze systému BPyes AuditFlow.
          </p>
        </div>
              `,
            });
          } catch (mailErr) {
            pozvankaOdeslana = false;
            console.error('Resend chyba:', mailErr);
          }
        }
      }
    }
  } catch (e) {
    pozvankaOdeslana = false;
    console.error('Chyba při generování/odesílání pozvánky:', e);
  }

  return NextResponse.json({
    success: true,
    uid: novyUid,
    pozvankaOdeslana,
    zprava: pozvankaOdeslana
      ? 'Účet vytvořen. Klientovi byl odeslán e-mail s odkazem pro nastavení hesla.'
      : 'Účet vytvořen, ale e-mail se nepodařilo odeslat. Zkontrolujte logy (RESEND_API_KEY / ověřená doména).',
  });
}
