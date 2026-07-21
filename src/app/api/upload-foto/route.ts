// src/app/api/upload-foto/route.ts
// Bezpecne nahrani fotky: appka posle fotku sem (na vlastni server), tento endpoint
// prida tajny klic a preposle ji na hosting (appbpyes.cz/fotky/upload.php).
// Tajny klic je jen v env promenne UPLOAD_SECRET, nikdy se nedostane do prohlizece.

import { NextRequest, NextResponse } from 'next/server';

const HOSTING_URL = process.env.UPLOAD_HOSTING_URL || 'https://appbpyes.cz/fotky/upload.php';

export async function POST(req: NextRequest) {
  const secret = process.env.UPLOAD_SECRET;
  if (!secret) {
    console.error('Chybi UPLOAD_SECRET v env promennych.');
    return NextResponse.json({ success: false, error: 'Server neni nakonfigurovan.' }, { status: 500 });
  }

  try {
    // fotka prijde jako multipart/form-data pole 'file'
    const formData = await req.formData();
    const file = formData.get('file');
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ success: false, error: 'Chybi soubor.' }, { status: 400 });
    }

    // preposli na hosting s tajnym klicem v hlavicce
    const forward = new FormData();
    forward.append('file', file, (file as any).name || 'foto.jpg');

    const res = await fetch(HOSTING_URL, {
      method: 'POST',
      headers: { 'X-Upload-Secret': secret },
      body: forward,
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      console.error('Hosting upload selhal:', data);
      return NextResponse.json(
        { success: false, error: data.error || 'Nahrani na hosting selhalo.' },
        { status: 502 }
      );
    }

    // vrat appce URL fotky
    return NextResponse.json({ success: true, url: data.url });
  } catch (e) {
    console.error('Chyba pri nahravani fotky:', e);
    return NextResponse.json({ success: false, error: 'Chyba serveru.' }, { status: 500 });
  }
}
