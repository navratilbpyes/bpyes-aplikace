'use client';

/**
 * AuditFlow — ořez a narovnání vyfocené listiny.
 * Umístění: src/components/orez-fotky.tsx
 *
 * Fotka protokolu z ruky je vždy nakřivo a s perspektivou. Uživatel označí
 * čtyři rohy listiny a komponenta je narovná do obdélníku — jako mobilní
 * skener, ale bez další knihovny.
 *
 * Matematika: inverzní projektivní transformace. Pro každý pixel výstupu
 * se spočítá, odkud ve zdroji pochází (bilineární vzorkování). Řešení
 * soustavy 8 rovnic Gaussovou eliminací.
 *
 * PDF sem nechodí — ta se nahrávají tak, jak jsou.
 */

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Loader2, Maximize2, RotateCw, Wand2 } from 'lucide-react';

interface Bod { x: number; y: number }

/** Řeší A·x = b Gaussovou eliminací s částečným pivotem. */
function vyresSoustavu(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((r, i) => [...r, b[i]]);
  for (let i = 0; i < n; i += 1) {
    let pivot = i;
    for (let r = i + 1; r < n; r += 1) {
      if (Math.abs(M[r][i]) > Math.abs(M[pivot][i])) pivot = r;
    }
    [M[i], M[pivot]] = [M[pivot], M[i]];
    const d = M[i][i] || 1e-12;
    for (let r = 0; r < n; r += 1) {
      if (r === i) continue;
      const f = M[r][i] / d;
      for (let c = i; c <= n; c += 1) M[r][c] -= f * M[i][c];
    }
  }
  return M.map((r, i) => r[n] / (r[i] || 1e-12));
}

/**
 * Homografie, která zobrazí čtyři rohy cíle (0,0)…(w,h) na čtyři body zdroje.
 * Vrací koeficienty [a,b,c,d,e,f,g,h] pro x' = (a·x+b·y+c)/(g·x+h·y+1).
 */
function homografie(cil: Bod[], zdroj: Bod[]): number[] {
  const A: number[][] = [];
  const B: number[] = [];
  for (let i = 0; i < 4; i += 1) {
    const { x, y } = cil[i];
    const { x: u, y: v } = zdroj[i];
    A.push([x, y, 1, 0, 0, 0, -x * u, -y * u]); B.push(u);
    A.push([0, 0, 0, x, y, 1, -x * v, -y * v]); B.push(v);
  }
  return vyresSoustavu(A, B);
}

/** Narovná čtyřúhelník ze zdrojového obrázku do obdélníku dané šířky. */
function narovnej(img: HTMLImageElement, rohy: Bod[], maxSirka = 1800): HTMLCanvasElement {
  const vzdal = (a: Bod, b: Bod) => Math.hypot(a.x - b.x, a.y - b.y);
  const sirka = Math.max(vzdal(rohy[0], rohy[1]), vzdal(rohy[3], rohy[2]));
  const vyska = Math.max(vzdal(rohy[0], rohy[3]), vzdal(rohy[1], rohy[2]));
  const mer = Math.min(1, maxSirka / sirka);
  const W = Math.max(1, Math.round(sirka * mer));
  const H = Math.max(1, Math.round(vyska * mer));

  const zdrojovy = document.createElement('canvas');
  zdrojovy.width = img.naturalWidth;
  zdrojovy.height = img.naturalHeight;
  zdrojovy.getContext('2d')!.drawImage(img, 0, 0);
  const src = zdrojovy.getContext('2d')!.getImageData(0, 0, zdrojovy.width, zdrojovy.height);

  const out = document.createElement('canvas');
  out.width = W; out.height = H;
  const cil = out.getContext('2d')!.createImageData(W, H);

  const [a, b, c, d, e, f, g, h] = homografie(
    [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H }],
    rohy,
  );

  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const den = g * x + h * y + 1;
      const u = (a * x + b * y + c) / den;
      const v = (d * x + e * y + f) / den;
      const i = (y * W + x) * 4;

      if (u < 0 || v < 0 || u >= src.width - 1 || v >= src.height - 1) {
        cil.data[i] = cil.data[i + 1] = cil.data[i + 2] = 255;
        cil.data[i + 3] = 255;
        continue;
      }
      // bilineární vzorkování, ať okraje písmen nejsou zubaté
      const x0 = Math.floor(u); const y0 = Math.floor(v);
      const fx = u - x0; const fy = v - y0;
      for (let k = 0; k < 3; k += 1) {
        const p = (yy: number, xx: number) => src.data[(yy * src.width + xx) * 4 + k];
        const horni = p(y0, x0) * (1 - fx) + p(y0, x0 + 1) * fx;
        const dolni = p(y0 + 1, x0) * (1 - fx) + p(y0 + 1, x0 + 1) * fx;
        cil.data[i + k] = horni * (1 - fy) + dolni * fy;
      }
      cil.data[i + 3] = 255;
    }
  }

  out.getContext('2d')!.putImageData(cil, 0, 0);
  return out;
}

/** Zesvětlí pozadí a zvýrazní text — čitelnost fotky listiny. */
function zvyrazni(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d')!;
  const d = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < d.data.length; i += 4) {
    const sed = 0.299 * d.data[i] + 0.587 * d.data[i + 1] + 0.114 * d.data[i + 2];
    // roztažení kontrastu: pod 110 ztmavit, nad 175 vybělit
    const v = sed < 110 ? sed * 0.55 : sed > 175 ? 255 : ((sed - 110) / 65) * 255;
    d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
  }
  ctx.putImageData(d, 0, 0);
}

export default function OrezFotky({
  soubor, zavri, hotovo,
}: {
  soubor: File | null;
  zavri: () => void;
  hotovo: (upraveny: File) => void;
}) {
  const platnoRef = useRef<HTMLCanvasElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [rohy, setRohy] = useState<Bod[]>([]);
  const [tazeny, setTazeny] = useState<number | null>(null);
  const [vylepsit, setVylepsit] = useState(true);
  const [pracuji, setPracuji] = useState(false);
  const [mer, setMer] = useState(1);

  useEffect(() => {
    if (!soubor) { setImg(null); return; }
    const url = URL.createObjectURL(soubor);
    const i = new Image();
    i.onload = () => {
      setImg(i);
      const o = 0.08;
      setRohy([
        { x: i.naturalWidth * o, y: i.naturalHeight * o },
        { x: i.naturalWidth * (1 - o), y: i.naturalHeight * o },
        { x: i.naturalWidth * (1 - o), y: i.naturalHeight * (1 - o) },
        { x: i.naturalWidth * o, y: i.naturalHeight * (1 - o) },
      ]);
    };
    i.src = url;
    return () => URL.revokeObjectURL(url);
  }, [soubor]);

  // vykreslení náhledu s vodicími body
  useEffect(() => {
    const c = platnoRef.current;
    if (!c || !img || rohy.length !== 4) return;
    const maxW = Math.min(560, window.innerWidth - 80);
    const m = Math.min(1, maxW / img.naturalWidth);
    setMer(m);
    c.width = img.naturalWidth * m;
    c.height = img.naturalHeight * m;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0, c.width, c.height);

    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 2;
    ctx.beginPath();
    rohy.forEach((r, i) => (i === 0
      ? ctx.moveTo(r.x * m, r.y * m)
      : ctx.lineTo(r.x * m, r.y * m)));
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = 'rgba(37,99,235,0.12)';
    ctx.fill();

    rohy.forEach((r) => {
      ctx.beginPath();
      ctx.arc(r.x * m, r.y * m, 9, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#2563eb';
      ctx.stroke();
    });
  }, [img, rohy]);

  function pozice(e: React.PointerEvent): Bod {
    const c = platnoRef.current!;
    const r = c.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) * (c.width / r.width)) / mer,
      y: ((e.clientY - r.top) * (c.height / r.height)) / mer,
    };
  }

  function start(e: React.PointerEvent) {
    const p = pozice(e);
    let nej = 0;
    let nejd = Infinity;
    rohy.forEach((r, i) => {
      const d = Math.hypot(r.x - p.x, r.y - p.y);
      if (d < nejd) { nejd = d; nej = i; }
    });
    setTazeny(nej);
    (e.target as Element).setPointerCapture(e.pointerId);
  }

  function tahni(e: React.PointerEvent) {
    if (tazeny === null || !img) return;
    const p = pozice(e);
    setRohy((r) => r.map((b, i) => (i === tazeny
      ? {
        x: Math.max(0, Math.min(img.naturalWidth, p.x)),
        y: Math.max(0, Math.min(img.naturalHeight, p.y)),
      }
      : b)));
  }

  function cely() {
    if (!img) return;
    setRohy([
      { x: 0, y: 0 },
      { x: img.naturalWidth, y: 0 },
      { x: img.naturalWidth, y: img.naturalHeight },
      { x: 0, y: img.naturalHeight },
    ]);
  }

  /** Otočí rohy o 90° — fotka nastojato natočená naležato. */
  function otoc() {
    setRohy((r) => [r[1], r[2], r[3], r[0]]);
  }

  async function uloz() {
    if (!img || !soubor) return;
    setPracuji(true);
    try {
      const c = narovnej(img, rohy);
      if (vylepsit) zvyrazni(c);
      const blob: Blob = await new Promise((res) =>
        c.toBlob((b) => res(b!), 'image/jpeg', 0.75));
      const nazev = soubor.name.replace(/\.[^.]+$/, '') + '-sken.jpg';
      hotovo(new File([blob], nazev, { type: 'image/jpeg' }));
    } finally {
      setPracuji(false);
    }
  }

  return (
    <Dialog open={!!soubor} onOpenChange={(o) => !o && zavri()}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Narovnání dokumentu</DialogTitle>
          <DialogDescription>
            Přetáhněte čtyři body na rohy listiny. Fotka se narovná do obdélníku.
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-center">
          {img ? (
            <canvas
              ref={platnoRef}
              onPointerDown={start}
              onPointerMove={tahni}
              onPointerUp={() => setTazeny(null)}
              className="max-w-full touch-none rounded border cursor-crosshair"
            />
          ) : (
            <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Načítám fotku…
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={cely}>
            <Maximize2 className="mr-1.5 h-3.5 w-3.5" /> Celá fotka
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={otoc}>
            <RotateCw className="mr-1.5 h-3.5 w-3.5" /> Otočit
          </Button>
          <Button
            type="button"
            variant={vylepsit ? 'default' : 'outline'}
            size="sm"
            onClick={() => setVylepsit((v) => !v)}
          >
            <Wand2 className="mr-1.5 h-3.5 w-3.5" /> Vyčistit pozadí
          </Button>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={zavri} disabled={pracuji}>Zrušit</Button>
          <Button onClick={uloz} disabled={pracuji || !img}>
            {pracuji && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Použít
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
