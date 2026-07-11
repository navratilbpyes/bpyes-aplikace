// src/app/api/pozvanky/vytvorit/route.ts
// POST – JEN admin. Vytvori pozvanku pro konkretni OSOBU klienta, zneplatni stare
// pending na stejny email, posle email pres Resend.

import { NextRequest, NextResponse } from "next/server";
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

    // 7) email pres Resend
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.POZVANKY_FROM ?? "AuditFlow <info@bpyes.cz>",
          to: emailNorm,
          subject: "Pozvanka do AuditFlow",
          html: `
            <p>Dobry den${osobaJmeno ? ", " + osobaJmeno : ""},</p>
            <p>byl vam vytvoren pristup do aplikace <strong>AuditFlow</strong>.</p>
            <p>Ucet dokoncite na tomto odkazu (plati ${POZVANKA_PLATNOST_DNI} dni):</p>
            <p><a href="${link}">${link}</a></p>
            <p>S pozdravem,<br>BPyes</p>
          `,
        }),
      });
    }

    return NextResponse.json({ ok: true, link });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Chyba serveru" }, { status: 500 });
  }
}
