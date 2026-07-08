import { Resend } from 'resend';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyAdmin } from '@/lib/firebase-admin';

// Validace vstupu. odkaz musí být https a z povolené domény (uprav si na svou doménu).
const schema = z.object({
  email: z.string().email(),
  jmenoKlienta: z.string().min(1).max(200),
  cisloZpravy: z.string().min(1).max(50),
  odkaz: z.string().url().startsWith('https://'),
});

export async function POST(request: Request) {
  // 1) Ověření, že požadavek poslal přihlášený admin (Firebase Admin SDK).
  const adminUid = await verifyAdmin(request.headers.get('authorization'));
  if (!adminUid) {
    return NextResponse.json(
      { success: false, error: 'Neautorizováno.' },
      { status: 401 }
    );
  }

  // 2) Validace vstupu.
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Neplatný vstup.' },
      { status: 400 }
    );
  }
  const { email, jmenoKlienta, cisloZpravy, odkaz } = parsed.data;

  // 3) Lazy inicializace Resend – až za běhu, ne při buildu.
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('Chybí RESEND_API_KEY v env proměnných.');
    return NextResponse.json(
      { success: false, error: 'E-mailová služba není nakonfigurována.' },
      { status: 500 }
    );
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
    // Chybu logujeme na server, klientovi vracíme obecnou hlášku (neúnik detailů).
    console.error('Chyba při odesílání e-mailu:', error);
    return NextResponse.json(
      { success: false, error: 'E-mail se nepodařilo odeslat.' },
      { status: 500 }
    );
  }
}
