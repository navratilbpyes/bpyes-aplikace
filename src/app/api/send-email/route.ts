import { Resend } from 'resend';
import { NextResponse } from 'next/server';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const { email, jmenoKlienta, cisloZpravy, odkaz } = await request.json();

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
      `
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, error });
  }
}
