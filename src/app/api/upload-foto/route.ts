// src/app/api/upload-foto/route.ts
// Bezpecne nahrani fotky: appka posle fotku sem (na vlastni server), tento endpoint
// prida tajny klic a preposle ji na hosting (appbpyes.cz/fotky/upload.php).
// Tajny klic je jen v env promenne UPLOAD_SECRET, nikdy se nedostane do prohlizece.

import { NextRequest, NextResponse } from 'next/server';

// Prodloužení časového limitu (vyžaduje Vercel Pro; u plánu Hobby platí pevný limit 10 s).
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const HOSTING_URL = process.env.UPLOAD_HOSTING_URL || 'https://appbpyes.cz/fotky/upload.php';

// Limity pro Vercel Serverless Functions (Vercel má pevný limit těla požadavku 4.5 MB)
const MAX_FILE_SIZE_BYTES = 4.5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif'
];

export async function POST(req: NextRequest) {
  // Kontrola přítomnosti tajného klíče
  const secret = process.env.UPLOAD_SECRET;
  if (!secret) {
    console.error('Chybí UPLOAD_SECRET v env proměnných.');
    return NextResponse.json(
      { success: false, error: 'Server není správně nakonfigurován (chybí tajný klíč).' },
      { status: 500 }
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { success: false, error: 'Chybí platný soubor v požadavku.' },
        { status: 400 }
      );
    }

    // Validation 1: Kontrola velikosti kvůli Vercel 4.5MB Serverless Body limitu
    if (file.size > MAX_FILE_SIZE_BYTES) {
      const sizeMb = (file.size / 1024 / 1024).toFixed(2);
      return NextResponse.json(
        {
          success: false,
          error: `Soubor je příliš velký (${sizeMb} MB). Maximální povolená velikost přes API je 4.5 MB. Zkomprimujte fotku v prohlížeči před odesláním.`,
        },
        { status: 413 }
      );
    }

    // Validation 2: Kontrola typu MIME
    if (file.type && !ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error: `Nepodporovaný typ souboru (${file.type}). Povoleny jsou pouze obrázky (JPEG, PNG, WebP, GIF).`,
        },
        { status: 400 }
      );
    }

    const forward = new FormData();
    const fileName = (file as File).name || 'foto.jpg';
    forward.append('file', file, fileName);

    // Timeout řízení pomocí AbortControlleru (45s abort)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    let res: Response;
    try {
      res = await fetch(HOSTING_URL, {
        method: 'POST',
        headers: {
          'X-Upload-Secret': secret,
          // WEDOS blokuje požadavky bez běžného User-Agenta (ochrana proti botům)
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'cs-CZ,cs;q=0.9',
          'Referer': 'https://appbpyes.cz/',
        },
        body: forward,
        signal: controller.signal,
      });
    } catch (fetchError: any) {
      if (fetchError.name === 'AbortError') {
        return NextResponse.json(
          { success: false, error: 'Připojení k cílovému hostingu vypršelo (Timeout 45s).' },
          { status: 504 }
        );
      }
      throw fetchError;
    } finally {
      clearTimeout(timeoutId);
    }

    const raw = await res.text();
    let data: any;

    try {
      data = JSON.parse(raw);
    } catch {
      console.error(
        'Hosting nevrátil platný JSON. Status:',
        res.status,
        'Odpověď (prvních 500 zn.):',
        raw.slice(0, 500)
      );
      return NextResponse.json(
        {
          success: false,
          error: `Hosting vrátil neočekávanou odpověď (status ${res.status}). Skript na hostingu mohl selhat.`,
          debug: process.env.NODE_ENV === 'development' ? raw.slice(0, 300) : undefined,
        },
        { status: 502 }
      );
    }

    if (!res.ok || !data.success) {
      console.error('Hosting upload selhal:', data);
      return NextResponse.json(
        { success: false, error: data.error || 'Nahrání na hosting selhalo.' },
        { status: res.status >= 400 && res.status < 600 ? res.status : 502 }
      );
    }

    return NextResponse.json({
      success: true,
      url: data.url,
      size: file.size,
    });
  } catch (e: any) {
    console.error('Chyba při zpracování nahrávání fotky:', e);
    return NextResponse.json(
      { success: false, error: 'Vnitřní chyba serveru při zpracování fotky.' },
      { status: 500 }
    );
  }
}
