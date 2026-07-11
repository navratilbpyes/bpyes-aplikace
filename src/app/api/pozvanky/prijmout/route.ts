// src/app/api/pozvanky/prijmout/route.ts
// POST { token, idToken } – po createUserWithEmailAndPassword.
// Zapise profil s klientId + osobaId + osobaTyp, uzavre pozvanku.

import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken } from "@/lib/verify-id-token";
import { getDoc, setDoc, queryEquals } from "@/lib/firestore-rest";
import { hashToken } from "@/lib/pozvanky";

export async function POST(req: NextRequest) {
  try {
    const { token, idToken } = await req.json();
    if (!token || !idToken)
      return NextResponse.json(
        { error: "token a idToken jsou povinne" },
        { status: 400 }
      );

    const user = await verifyIdToken(idToken);

    const found = await queryEquals("pozvanky", "tokenHash", hashToken(token));
    const pozvanka = found[0];
    if (!pozvanka)
      return NextResponse.json({ error: "Pozvanka nenalezena" }, { status: 404 });
    if (pozvanka.status !== "pending")
      return NextResponse.json(
        { error: "Pozvanka jiz neni platna" },
        { status: 409 }
      );
    if (new Date(pozvanka.expiresAt as Date).getTime() < Date.now())
      return NextResponse.json({ error: "Pozvanka expirovala" }, { status: 410 });

    if (
      (user.email ?? "").toLowerCase() !==
      String(pozvanka.email).toLowerCase()
    )
      return NextResponse.json(
        { error: "Email uctu nesouhlasi s pozvankou" },
        { status: 403 }
      );

    const existujici = await getDoc("uzivatele", user.uid);
    if (existujici)
      return NextResponse.json(
        { error: "Uzivatel uz ma profil" },
        { status: 409 }
      );

    // zapis profil – role, klientId, osobaId, osobaTyp
    await setDoc("uzivatele", user.uid, {
      email: pozvanka.email,
      role: pozvanka.role,
      klientId: pozvanka.klientId,
      osobaId: pozvanka.osobaId,
      osobaTyp: pozvanka.osobaTyp,
      osobaJmeno: pozvanka.osobaJmeno ?? "",
      createdAt: new Date(),
    });

    await setDoc("pozvanky", pozvanka.__id as string, {
      status: "accepted",
      acceptedAt: new Date(),
      acceptedUid: user.uid,
    });

    return NextResponse.json({ ok: true, klientId: pozvanka.klientId });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Chyba serveru" }, { status: 500 });
  }
}
