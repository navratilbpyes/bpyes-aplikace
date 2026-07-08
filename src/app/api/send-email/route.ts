import { Resend } from 'resend';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const PROJECT_ID = 'studio-2327834732-8ec09';
const FIREBASE_API_KEY = 'AIzaSyAJ2o8AlTOXKbIAtDYSNnDUvTLChAiGeoQ';

// email může přijít jako jeden string, nebo jako pole adres (hromadné odeslání)
const schema = z.object({
  email: z.union([
    z.string().email(),
    z.array(z.string().email()).min(1),
  ]),
  jmenoKlienta: z.string().min(1).max(200),
  cisloZpravy: z.string().min(1).max(50),
  odkaz: z.string().url().startsWith('https://'),
});

/**
 * Ověří Firebase ID token přes veřejné Identity Toolkit REST API.
 * Nepotřebuje service account klíč. Vrací uid, nebo null.
 */
async function verifyToken(authHeader: string | null): Promise<string | null> {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const idToken = authHeader.substring(7);

  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const uid = data?.users?.[0]?.localId;
    return uid || null;
  } catch {
    return null;
  }
}

/**
 * Ověří, že uživatel má v kolekci 'uzivatele' roli 'admin'.
 * Čte dokument přes Firestore REST API s ID tokenem uživatele
 * (Firestore Rules to povolí, protože uživatel čte svůj vlastní profil).
 */
async function isAdmin(uid: string, idToken: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/uzivatele/${uid}`,
      { headers: { Authorization: `Bearer ${idToken}` } }
    );
    if (!res.ok) return false;
    const doc = await res.json();
    return doc?.fields?.role?.stringValue === 'admin';
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');

  // 1) Ověření přihlášení
  const uid = await verifyToken(authHeader);
  if (!uid) {
    return NextResponse.json({ success: false, error: 'Neautorizováno.' }, { status: 401 });
  }

  // 2) Ověření role admin
  const idToken = authHeader!.substring(7);
  if (!(await isAdmin(uid, idToken))) {
    return NextResponse.json({ success: false, error: 'Přístup jen pro administrátora.' }, { status: 403 });
  }

  // 3) Validace vstupu
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Neplatný vstup.' }, { status: 400 });
  }
  const { email, jmenoKlienta, cisloZpravy, odkaz } = parsed.data;

  // 4) Lazy inicializace Resend (až za běhu, ne při buildu)
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('Chybí RESEND_API_KEY v env proměnných.');
    return NextResponse.json({ success: false, error: 'E-mailová služba není nakonfigurována.' }, { status: 500 });
  }
  const resend = new Resend(apiKey);

  try {
    const data = await resend.emails.send({
      from: 'AuditFlow | BPyes <navratil@bpyes.cz>',
      to: email,
      subject: `Nový auditní report: ${cisloZpravy} | ${jmenoKlienta}`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; border: 1px solid #e5e7eb; border-radius: 8px;">
          <h2 style="color: #2563eb; margin-top: 0;">Nový auditní protokol</h2>
          <p>Dobrý den,</p>
          <p>pro společnost <strong>${jmenoKlienta}</strong> byl právě vygenerován nový auditní report (č. ${cisloZpravy}).</p>
          <p>Report si můžete prohlédnout, stáhnout v PDF nebo rovnou nahlásit odstranění zjištěných nedostatků kliknutím na odkaz níže:</p>

          <div style="margin: 30px 0;">
            <a href="${odkaz}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              Otevřít klientský dispečink reportu
            </a>
          </div>

          <p style="font-size: 13px; color: #6b7280; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 15px;">
            Toto je automaticky generovaná zpráva ze systému AuditFlow BPyes. Na tento e-mail prosím neodpovídejte.
          </p>
        </div>
      `,
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Chyba při odesílání e-mailu:', error);
    return NextResponse.json({ success: false, error: 'E-mail se nepodařilo odeslat.' }, { status: 500 });
  }
}
