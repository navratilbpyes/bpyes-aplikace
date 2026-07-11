// middleware.ts  (KOREN projektu, vedle package.json — NE do src/)
// Rate limit na overovaci endpoint pozvanek, aby se token nedal brute-forcovat.
//
// Pozn.: Vercel serverless bezi bezstavove, in-memory pocitadlo neni globalne
// spolehlive napric instancemi. Pro tvuj objem (par pozvanek) to bohate staci
// a chrani pred hrubym brute-force z jedne IP. Pokud bys chtel tvrdou garanci,
// dal by se pripojit Upstash Redis — ale to je overkill.

import { NextRequest, NextResponse } from "next/server";

// pametove pocitadlo v ramci jedne instance
const okno = 60_000;      // 1 minuta
const maxPokusu = 10;     // max 10 overeni / min / IP
const hits = new Map<string, { count: number; reset: number }>();

function klic(req: NextRequest): string {
  // Vercel predava realnou IP v x-forwarded-for
  const fwd = req.headers.get("x-forwarded-for");
  const ip = fwd ? fwd.split(",")[0].trim() : "neznama";
  return ip;
}

export function middleware(req: NextRequest) {
  const ip = klic(req);
  const now = Date.now();
  const zaznam = hits.get(ip);

  if (!zaznam || zaznam.reset < now) {
    hits.set(ip, { count: 1, reset: now + okno });
  } else {
    zaznam.count += 1;
    if (zaznam.count > maxPokusu) {
      return NextResponse.json(
        { error: "Prilis mnoho pokusu. Zkuste to za chvili." },
        { status: 429 }
      );
    }
  }

  // obcasny uklid stare mapy, at neroste
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
  }

  return NextResponse.next();
}

// middleware bezi JEN na overovacim endpointu
export const config = {
  matcher: ["/api/pozvanky/overit"],
};
