// src/app/api/nastavit-heslo-oob/route.ts
//
// Nastavení hesla přes Firebase oobCode (out-of-band code z reset e-mailu).
// ŽÁDNÝ service account — používá veřejné Identity Toolkit API
// `accounts:resetPassword` s Web API key (ověřeno: funguje bez SA/IAM).
//
// Flow (3-lite):
//   1) Pozvánka / reset zavolá sendOobCode (PASSWORD_RESET) → Firebase pošle
//      e-mail s odkazem.
//   2) V konzoli Firebase je Action URL nastavená na naši stránku
//      /nastavit-heslo, takže odkaz vede sem s ?oobCode=... &mode=resetPassword.
//   3) Naše stránka vezme oobCode + heslo od uživatele a zavolá tuto route.
//
// Proč resetPassword a ne accounts:update: accounts:update s idTokenem z
// refresh tokenu vrací CREDENTIAL_TOO_OLD_LOGIN_AGAIN (Firebase u změny hesla
// vyžaduje čerstvé přihlášení). resetPassword s oobCode tuto pojistku nemá.

import { NextResponse } from 'next/server';
import { z } from 'zod';

const FIREBASE_API_KEY = 'AIzaSyAJ2o8AlTOXKbIAtDYSNnDUvTLChAiGeoQ';
const IDENTITY = 'https://identitytoolkit.googleapis.com/v1';

const schema = z.object({
  oobCode: z.string().min(1).max(2000),
  heslo: z.string().min(8).max(200),
});

/** Přeloží Firebase chybové kódy na čitelné české hlášky. */
function prelozChybu(kod: string): string {
  switch (kod) {
    case 'EXPIRED_OOB_CODE':
      return 'Platnost odkazu vypršela. Požádejte o nový odkaz na nastavení hesla.';
    case 'INVALID_OOB_CODE':
      return 'Odkaz je neplatný nebo už byl použit. Požádejte o nový.';
    case 'USER_DISABLED':
      return 'Účet je deaktivovaný. Kontaktujte technika BOZP/PO.';
    case 'USER_NOT_FOUND':
      return 'Účet nebyl nalezen. Kontaktujte technika BOZP/PO.';
    case 'WEAK_PASSWORD : Password should be at least 6 characters':
    case 'WEAK_PASSWORD':
      return 'Heslo je příliš slabé.';
    default:
      return 'Heslo se nepodařilo nastavit. Zkuste to prosím znovu.';
  }
}

export async function POST(req: Request) {
  let telo: unknown;
  try {
    telo = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Neplatný požadavek.' }, { status: 400 });
  }

  const parsed = schema.safeParse(telo);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Neplatné heslo nebo odkaz.' }, { status: 400 });
  }
  const { oobCode, heslo } = parsed.data;

  try {
    const res = await fetch(`${IDENTITY}/accounts:resetPassword?key=${FIREBASE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oobCode, newPassword: heslo }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const kod = data?.error?.message ?? '';
      console.error('resetPassword (oob) selhal:', kod);
      return NextResponse.json(
        { success: false, error: prelozChybu(kod) },
        { status: res.status === 400 ? 400 : 500 },
      );
    }

    // Úspěch — heslo nastaveno. data.email obsahuje e-mail účtu.
    return NextResponse.json({ success: true, email: data?.email ?? null });
  } catch (e) {
    console.error('Chyba při nastavení hesla (oob):', e);
    return NextResponse.json({ success: false, error: 'Chyba spojení. Zkuste to prosím znovu.' }, { status: 500 });
  }
}
