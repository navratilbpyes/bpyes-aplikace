// src/app/api/pozvanky/vytvorit/route.ts
// POST – JEN admin. Vytvori pozvanku pro konkretni OSOBU klienta, zneplatni stare
// pending na stejny email, posle email pres Resend.

import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { verifyIdToken } from "@/lib/verify-id-token";
import { getDoc, setDoc, queryEquals } from "@/lib/firestore-rest";
import {
  generateToken,
  hashToken,
  POZVANKA_PLATNOST_DNI,
  OsobaTyp,
} from "@/lib/pozvanky";

export async function POST(req: NextRequest) {
  try {
    // 1) overeni admina
    const auth = req.headers.get("authorization") ?? "";
    const idToken = auth.replace(/^Bearer /, "");
    if (!idToken)
      return NextResponse.json({ error: "Chybi token" }, { status: 401 });

    const caller = await verifyIdToken(idToken);
    const callerProfil = await getDoc("uzivatele", caller.uid);
    if (!callerProfil || callerProfil.role !== "admin")
      return NextResponse.json({ error: "Jen admin" }, { status: 403 });

    // 2) vstup
    const {
      email,
      klientId,
      osobaId,
      osobaTyp,
      role = "client",
    }: {
      email?: string;
      klientId?: string;
      osobaId?: string;
      osobaTyp?: OsobaTyp;
      role?: string;
    } = await req.json();

    if (!email || !klientId || !osobaId || !osobaTyp)
      return NextResponse.json(
        { error: "email, klientId, osobaId a osobaTyp jsou povinne" },
        { status: 400 }
      );

    const emailNorm = String(email).trim().toLowerCase();

    // 3) over, ze klient existuje a osoba v nem opravdu je (nespolehat na klienta)
    const klient = await getDoc("klienti", klientId);
    if (!klient)
      return NextResponse.json({ error: "Klient nenalezen" }, { status: 404 });

    const pole =
      osobaTyp === "kontakt"
        ? (klient.kontakty as { id: string; jmeno?: string }[] | undefined)
        : (klient.odpovedneOsoby as { id: string; jmeno?: string }[] | undefined);
    const osoba = (pole ?? []).find((o) => o.id === osobaId);
    if (!osoba)
      return NextResponse.json(
        { error: "Osoba u tohoto klienta nenalezena" },
        { status: 404 }
      );
    const osobaJmeno = osoba.jmeno ?? "";

    // 4) zamez duplicite: jedna osoba = jeden ucet
    //    pokud uz ma nekdo profil s timto osobaId, nepozveme znovu
    const existujiciUzivatele = await queryEquals("uzivatele", "osobaId", osobaId);
    if (existujiciUzivatele.length > 0)
      return NextResponse.json(
        { error: "Tato osoba uz ma ucet." },
        { status: 409 }
      );

    // 5) zneplatni stare pending pozvanky na stejny email
    const stare = await queryEquals("pozvanky", "email", emailNorm);
    for (const p of stare) {
      if (p.status === "pending" && p.__id)
        await setDoc("pozvanky", p.__id as string, { status: "revoked" });
    }

    // 6) vytvor novou
    const token = generateToken();
    const id = crypto.randomUUID();
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + POZVANKA_PLATNOST_DNI * 24 * 3600 * 1000
    );

    await setDoc("pozvanky", id, {
      tokenHash: hashToken(token),
      email: emailNorm,
      klientId,
      osobaId,
      osobaTyp,
      osobaJmeno,
      role,
      status: "pending",
      createdBy: caller.uid,
      createdAt: now,
      expiresAt,
      acceptedAt: null,
      acceptedUid: null,
    });

    const link = `${process.env.NEXT_PUBLIC_APP_URL}/pozvanka?token=${token}`;

    // 7) email pres Resend (stejny vzor jako /api/send-email)
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      // pozvanka je vytvorena, ale email neodesleme – vratime link a upozorneni
      console.error("Chybi RESEND_API_KEY v env promennych.");
      return NextResponse.json({
        ok: true,
        link,
        emailOdeslan: false,
        upozorneni:
          "Pozvanka vytvorena, ale e-mail se neodeslal (chybi RESEND_API_KEY). Odkaz zkopiruj rucne.",
      });
    }

    const resend = new Resend(apiKey);
    try {
      await resend.emails.send({
        from:
          process.env.POZVANKY_FROM ?? "AuditFlow | BPyes <navratil@bpyes.cz>",
        to: emailNorm,
        subject: "Pozvanka do AuditFlow",
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; border: 1px solid #e5e7eb; border-radius: 8px;">
            <h2 style="color: #2563eb; margin-top: 0;">Pozvanka do AuditFlow</h2>
            <p>Dobry den${osobaJmeno ? ", " + osobaJmeno : ""},</p>
            <p>byl vam vytvoren pristup do klientskeho portalu <strong>BPyes AuditFlow</strong>.</p>
            <p>Ucet dokoncite kliknutim na odkaz nize (plati ${POZVANKA_PLATNOST_DNI} dni):</p>
            <div style="margin: 30px 0;">
              <a href="${link}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                Dokoncit registraci
              </a>
            </div>
            <p style="font-size: 13px; color: #6b7280;">Nebo zkopirujte tento odkaz do prohlizece:<br>${link}</p>
            <p style="font-size: 13px; color: #6b7280; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 15px;">
              Toto je automaticky generovana zprava ze systemu BPyes AuditFlow.
            </p>
          </div>
        `,
      });
    } catch (mailErr) {
      // email selhal (napr. neoverena domena) – ale pozvanka uz existuje.
      // Vratime to jako upozorneni, ne 500, at mas link a vis duvod.
      console.error("Resend chyba:", mailErr);
      return NextResponse.json({
        ok: true,
        link,
        emailOdeslan: false,
        upozorneni:
          "Pozvanka vytvorena, ale e-mail se nepodarilo odeslat. Zkontroluj overenou domenu v Resendu. Odkaz zkopiruj rucne.",
      });
    }

    return NextResponse.json({ ok: true, link, emailOdeslan: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Chyba serveru" }, { status: 500 });
  }
}
