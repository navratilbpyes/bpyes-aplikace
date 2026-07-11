// src/app/api/pozvanky/overit/route.ts
// GET ?token=... – veřejné. Vrátí info o pozvánce (email, klient), pokud je platná.
// Nikdy nevrací tokenHash ani nic citlivého.

import { NextRequest, NextResponse } from "next/server";
import { getDoc, queryEquals } from "@/lib/firestore-rest";
import { hashToken } from "@/lib/pozvanky";

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token");
    if (!token)
      return NextResponse.json({ error: "Chybí token" }, { status: 400 });

    const found = await queryEquals("pozvanky", "tokenHash", hashToken(token));
    const pozvanka = found[0];

    if (!pozvanka)
      return NextResponse.json(
        { valid: false, reason: "notfound" },
        { status: 404 }
      );

    if (pozvanka.status !== "pending")
      return NextResponse.json({ valid: false, reason: pozvanka.status });

    const expiresAt = pozvanka.expiresAt as Date;
    if (new Date(expiresAt).getTime() < Date.now())
      return NextResponse.json({ valid: false, reason: "expired" });

    // volitelně: dotáhni název klienta pro hezčí zobrazení
    let klientNazev: string | null = null;
    const klient = await getDoc("klienti", pozvanka.klientId as string);
    if (klient) klientNazev = (klient.nazev as string) ?? null;

    return NextResponse.json({
      valid: true,
      email: pozvanka.email,
      klientNazev,
      osobaJmeno: pozvanka.osobaJmeno ?? null,
      role: pozvanka.role,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Chyba serveru" }, { status: 500 });
  }
}
