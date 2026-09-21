'use client';

/**
 * AuditFlow — ořez a narovnání vyfocené listiny.
 * Umístění: src/components/orez-fotky.tsx
 *
 * Fotka protokolu z ruky je vždy nakřivo a s perspektivou. Uživatel označí
 * čtyři rohy listiny a komponenta je narovná do obdélníku — jako mobilní
 * skener, ale bez další knihovny.
 *
 * Rohy se hledají automaticky (Sobel + Houghova transformace), ale ruční
 * tažení je rovnocenná cesta, ne nouzovka: bílý papír na světlém stole
 * detekci spolehlivě rozbije a v provozu se to stává často.
 *
 * Matematika: inverzní projektivní transformace. Pro každý pixel výstupu
 * se spočítá, odkud ve zdroji pochází (bilineární vzorkování). Řešení
 * soustavy 8 rovnic Gaussovou eliminací.
 *
 * Víc listů se skládá do jednoho PDF (viz lib/pdf-ze-skenu).
 * Nahrané PDF sem nechodí — to se ukládá tak, jak je.
 */

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Loader2, Maximize2, RotateCw, Wand2, Scan, FilePlus2, FileText } from 'lucide-react';
import { pdfZeSkenu, type SkenStranka } from '@/lib/pdf-ze-skenu';

interface Bod { x: number; y: number }

/** Přímka v normálovém tvaru: x·cos(theta) + y·sin(theta) = rho. */
interface Primka { rho: number; theta: number; hlasy: number }

/* ------------------------------------------------------------------ *
 * Automatické hledání okrajů listiny
 * ------------------------------------------------------------------ */

const DETEKCE_SIRKA = 480; // na čem se počítá; víc pixelů přesnost nezlepší

/** Zmenší fotku a vrátí jasovou složku jako pole 0–255. */
function sedaMapa(img: HTMLImageElement): { data: Float32Array; w: number; h: number; mer: number } {
  const mer = Math.min(1, DETEKCE_SIRKA / img.naturalWidth);
  const w = Math.max(1, Math.round(img.naturalWidth * mer));
  const h = Math.max(1, Math.round(img.naturalHeight * mer));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0, w, h);
  const px = ctx.getImageData(0, 0, w, h).data;
  const data = new Float32Array(w * h);
  for (let i = 0; i < w * h; i += 1) {
    data[i] = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
  }
  return { data, w, h, mer };
}

/**
 * Box blur — rozmaže jemnou strukturu. Bez něj přebije text uvnitř listiny
 * její vlastní okraj a Hough pak hlasuje pro řádky písma, ne pro hranu papíru.
 */
function rozmaz(seda: Float32Array, w: number, h: number, polomer = 2): Float32Array {
  const mezi = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      let sum = 0; let n = 0;
      for (let d = -polomer; d <= polomer; d += 1) {
        const xx = x + d;
        if (xx < 0 || xx >= w) continue;
        sum += seda[y * w + xx]; n += 1;
      }
      mezi[y * w + x] = sum / n;
    }
  }
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      let sum = 0; let n = 0;
      for (let d = -polomer; d <= polomer; d += 1) {
        const yy = y + d;
        if (yy < 0 || yy >= h) continue;
        sum += mezi[yy * w + x]; n += 1;
      }
      out[y * w + x] = sum / n;
    }
  }
  return out;
}

/** Sobel: vrátí velikost gradientu pro každý pixel. */
function gradient(seda: Float32Array, w: number, h: number): Float32Array {
  const g = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const i = y * w + x;
      const gx = -seda[i - w - 1] - 2 * seda[i - 1] - seda[i + w - 1]
        + seda[i - w + 1] + 2 * seda[i + 1] + seda[i + w + 1];
      const gy = -seda[i - w - 1] - 2 * seda[i - w] - seda[i - w + 1]
        + seda[i + w - 1] + 2 * seda[i + w] + seda[i + w + 1];
      g[i] = Math.hypot(gx, gy);
    }
  }
  return g;
}

/**
 * Houghova transformace nad nejsilnějšími hranami.
 * Vrací přímky setříděné podle počtu hlasů.
 */
function najdiPrimky(grad: Float32Array, w: number, h: number): Primka[] {
  // práh: hrana je horních ~15 % pixelů podle velikosti gradientu
  const setrizeny = Float32Array.from(grad).sort();
  const prah = setrizeny[Math.floor(setrizeny.length * 0.85)] || 1;

  const KROK = 180; // po jednom stupni
  const diag = Math.ceil(Math.hypot(w, h));
  const akumulator = new Int32Array(KROK * (2 * diag + 1));
  const cos = new Float32Array(KROK);
  const sin = new Float32Array(KROK);
  for (let t = 0; t < KROK; t += 1) {
    cos[t] = Math.cos((t * Math.PI) / KROK);
    sin[t] = Math.sin((t * Math.PI) / KROK);
  }

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (grad[y * w + x] < prah) continue;
      for (let t = 0; t < KROK; t += 1) {
        const rho = Math.round(x * cos[t] + y * sin[t]) + diag;
        akumulator[t * (2 * diag + 1) + rho] += 1;
      }
    }
  }

  // lokální maxima s potlačením okolí, ať jedna hrana nedá deset přímek
  const nalezene: Primka[] = [];
  // pozor: Math.max(...akumulator) tu přeteče zásobník, pole má stovky tisíc buněk
  let maxHlasu = 0;
  for (let i = 0; i < akumulator.length; i += 1) {
    if (akumulator[i] > maxHlasu) maxHlasu = akumulator[i];
  }
  const prahHlasu = Math.max(20, maxHlasu * 0.3);
  const OKOLI_RHO = 20;
  const OKOLI_THETA = 8;

  for (let t = 0; t < KROK; t += 1) {
    for (let r = 0; r < 2 * diag + 1; r += 1) {
      const hlasy = akumulator[t * (2 * diag + 1) + r];
      if (hlasy < prahHlasu) continue;
      let jeMaximum = true;
      for (let dt = -OKOLI_THETA; dt <= OKOLI_THETA && jeMaximum; dt += 1) {
        for (let dr = -OKOLI_RHO; dr <= OKOLI_RHO; dr += 1) {
          const tt = (t + dt + KROK) % KROK;
          const rr = r + dr;
          if (rr < 0 || rr > 2 * diag) continue;
          if (akumulator[tt * (2 * diag + 1) + rr] > hlasy) { jeMaximum = false; break; }
        }
      }
      if (jeMaximum) nalezene.push({ rho: r - diag, theta: (t * Math.PI) / KROK, hlasy });
    }
  }

  return nalezene.sort((a, b) => b.hlasy - a.hlasy).slice(0, 40);
}

/** Průsečík dvou přímek, nebo null když jsou skoro rovnoběžné. */
function prusecik(a: Primka, b: Primka): Bod | null {
  const det = Math.cos(a.theta) * Math.sin(b.theta) - Math.sin(a.theta) * Math.cos(b.theta);
  if (Math.abs(det) < 0.2) return null;
  return {
    x: (a.rho * Math.sin(b.theta) - b.rho * Math.sin(a.theta)) / det,
    y: (b.rho * Math.cos(a.theta) - a.rho * Math.cos(b.theta)) / det,
  };
}

/** Ověří, že čtyřúhelník vypadá jako listina, ne jako náhodný trojúhelník. */
function rozumnyTvar(rohy: Bod[], w: number, h: number): boolean {
  if (rohy.some((r) => !Number.isFinite(r.x) || !Number.isFinite(r.y))) return false;
  // rohy smí lehce přetéct mimo záběr (papír useknutý okrajem fotky), ne o moc
  const rezerva = 0.15;
  if (rohy.some((r) => r.x < -w * rezerva || r.x > w * (1 + rezerva)
    || r.y < -h * rezerva || r.y > h * (1 + rezerva))) return false;

  // plocha Gaussovým vzorcem
  let plocha = 0;
  for (let i = 0; i < 4; i += 1) {
    const a = rohy[i];
    const b = rohy[(i + 1) % 4];
    plocha += a.x * b.y - b.x * a.y;
  }
  plocha = Math.abs(plocha) / 2;
  if (plocha < w * h * 0.15) return false;

  // vnitřní úhly mezi 50 a 130 stupni — jinak je to splácnutý kosočtverec
  for (let i = 0; i < 4; i += 1) {
    const p = rohy[(i + 3) % 4];
    const c = rohy[i];
    const n = rohy[(i + 1) % 4];
    const u = { x: p.x - c.x, y: p.y - c.y };
    const v = { x: n.x - c.x, y: n.y - c.y };
    const uhel = Math.acos(
      (u.x * v.x + u.y * v.y) / ((Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y)) || 1e-9),
    ) * (180 / Math.PI);
    if (uhel < 50 || uhel > 130) return false;
  }
  return true;
}

/**
 * Najde rohy listiny ve fotce. Vrací je v souřadnicích originálu
 * v pořadí levý horní → pravý horní → pravý dolní → levý dolní,
 * nebo null, když detekce nenašla nic důvěryhodného.
 */
function najdiRohy(img: HTMLImageElement): Bod[] | null {
  try {
    const { data, w, h, mer } = sedaMapa(img);
    const primky = najdiPrimky(gradient(rozmaz(data, w, h), w, h), w, h);
    if (primky.length < 4) return null;

    const stred = { x: w / 2, y: h / 2 };
    // vodorovné = normála míří nahoru/dolů (theta kolem 90°)
    const vodorovne = primky.filter((p) => {
      const st = (p.theta * 180) / Math.PI;
      return st > 55 && st < 125;
    });
    const svisle = primky.filter((p) => {
      const st = (p.theta * 180) / Math.PI;
      return st < 35 || st > 145;
    });
    if (vodorovne.length < 2 || svisle.length < 2) return null;

    // u vodorovné přímky spočítej y ve středu snímku, u svislé x
    const yVeStredu = (p: Primka) => (p.rho - stred.x * Math.cos(p.theta)) / (Math.sin(p.theta) || 1e-9);
    const xVeStredu = (p: Primka) => (p.rho - stred.y * Math.sin(p.theta)) / (Math.cos(p.theta) || 1e-9);

    const horni = vodorovne.reduce((a, b) => (yVeStredu(b) < yVeStredu(a) ? b : a));
    const dolni = vodorovne.reduce((a, b) => (yVeStredu(b) > yVeStredu(a) ? b : a));
    const levy = svisle.reduce((a, b) => (xVeStredu(b) < xVeStredu(a) ? b : a));
    const pravy = svisle.reduce((a, b) => (xVeStredu(b) > xVeStredu(a) ? b : a));

    // Protilehlé okraje listiny svírají malý úhel. Když se rozcházejí, chytil
    // Hough něco jiného než papír — typicky spáru stolu nebo stín.
    const rozdilUhlu = (a: Primka, b: Primka) => {
      const d = Math.abs(a.theta - b.theta) * (180 / Math.PI);
      return Math.min(d, 180 - d);
    };
    // 30° je horní mez toho, co udělá perspektiva při focení z ruky nad stolem
    if (rozdilUhlu(horni, dolni) > 30 || rozdilUhlu(levy, pravy) > 30) return null;

    // Všechny čtyři okraje musí být výrazné. Slabý okraj = dohad, ne detekce.
    const nejvicHlasu = primky[0].hlasy;
    if ([horni, dolni, levy, pravy].some((p) => p.hlasy < nejvicHlasu * 0.35)) return null;

    const rohy = [
      prusecik(horni, levy), prusecik(horni, pravy),
      prusecik(dolni, pravy), prusecik(dolni, levy),
    ];
    if (rohy.some((r) => r === null)) return null;

    const ctverec = rohy as Bod[];
    if (!rozumnyTvar(ctverec, w, h)) return null;
    return ctverec.map((r) => ({ x: r.x / mer, y: r.y / mer }));
  } catch {
    return null; // detekce je pohodlí, ne podmínka — při chybě zůstane ruční ořez
  }
}

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
  const [hledam, setHledam] = useState(false);
  /** Už narovnané listy čekající na složení do PDF. */
  const [hotoveListy, setHotoveListy] = useState<SkenStranka[]>([]);
  const [jakoPdf, setJakoPdf] = useState(false);
  /** Fotka na plátně je už odložená mezi hotové listy — nesmí se započítat dvakrát. */
  const [spotrebovany, setSpotrebovany] = useState(false);
  const dalsiListRef = useRef<HTMLInputElement>(null);

  /** Výchozí rámeček 8 % od kraje — když detekce nenajde nic. */
  function vychoziRohy(i: HTMLImageElement): Bod[] {
    const o = 0.08;
    return [
      { x: i.naturalWidth * o, y: i.naturalHeight * o },
      { x: i.naturalWidth * (1 - o), y: i.naturalHeight * o },
      { x: i.naturalWidth * (1 - o), y: i.naturalHeight * (1 - o) },
      { x: i.naturalWidth * o, y: i.naturalHeight * (1 - o) },
    ];
  }

  /**
   * Spustí detekci mimo hlavní vykreslení, ať se dialog neotevře se zámrzem.
   * Při neúspěchu nechá rohy, jak jsou — žádná hláška, uživatel je dotáhne.
   */
  function detekuj(i: HTMLImageElement) {
    setHledam(true);
    const spust = () => {
      const nalezene = najdiRohy(i);
      if (nalezene) setRohy(nalezene);
      setHledam(false);
    };
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(spust, { timeout: 1200 });
    } else {
      window.setTimeout(spust, 60);
    }
  }

  /** Nová fotka z rodiče = nová dávka, hotové listy se zahodí. */
  useEffect(() => {
    if (!soubor) {
      setImg(null); setHotoveListy([]); setJakoPdf(false); setSpotrebovany(false);
    }
  }, [soubor]);

  /** Načte fotku do plátna a spustí nad ní detekci okrajů. */
  function nactiFotku(f: File) {
    const url = URL.createObjectURL(f);
    const i = new Image();
    i.onload = () => {
      URL.revokeObjectURL(url);
      setImg(i);
      setRohy(vychoziRohy(i));
      setSpotrebovany(false);
      detekuj(i);
    };
    i.onerror = () => URL.revokeObjectURL(url);
    i.src = url;
  }

  useEffect(() => {
    if (!soubor) return;
    nactiFotku(soubor);
    // nactiFotku je stabilní vůči props; závislost na souboru stačí
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  /** Narovná aktuální plátno a vrátí ho jako JPEG stránku. */
  async function aktualniList(): Promise<SkenStranka> {
    const c = narovnej(img!, rohy);
    if (vylepsit) zvyrazni(c);
    const blob: Blob = await new Promise((res) =>
      c.toBlob((b) => res(b!), 'image/jpeg', 0.75));
    return {
      jpeg: new Uint8Array(await blob.arrayBuffer()),
      sirka: c.width,
      vyska: c.height,
    };
  }

  /** Odloží narovnaný list a otevře výběr dalšího — z víc listů bude jedno PDF. */
  async function dalsiList() {
    if (!img) return;
    setPracuji(true);
    try {
      const list = await aktualniList();
      setHotoveListy((l) => [...l, list]);
      setJakoPdf(true);
      setSpotrebovany(true);
      dalsiListRef.current?.click();
    } finally {
      setPracuji(false);
    }
  }

  async function uloz() {
    if (!img || !soubor) return;
    setPracuji(true);
    try {
      // odložený list už v seznamu je; přidávat ho znovu by PDF zdvojilo
      const listy = spotrebovany ? hotoveListy : [...hotoveListy, await aktualniList()];
      if (listy.length === 0) return;
      const zaklad = soubor.name.replace(/\.[^.]+$/, '');

      if (listy.length === 1 && !jakoPdf) {
        hotovo(new File([listy[0].jpeg as BlobPart], `${zaklad}-sken.jpg`, { type: 'image/jpeg' }));
        return;
      }
      const pdf = pdfZeSkenu(listy);
      hotovo(new File([pdf], `${zaklad}-sken.pdf`, { type: 'application/pdf' }));
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
            Rohy listiny se hledají samy. Když sednou vedle, přetáhněte body rukou.
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

        {(hledam || hotoveListy.length > 0) && (
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {hledam && (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Hledám okraje listiny…
              </span>
            )}
            {hotoveListy.length > 0 && (
              <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                <FileText className="h-3.5 w-3.5" />
                Hotové listy: {hotoveListy.length} — uloží se jako jedno PDF
              </span>
            )}
            {spotrebovany && (
              <span className="text-amber-700">
                List je odložený. Vyberte další fotku, nebo rovnou uložte PDF.
              </span>
            )}
          </div>
        )}

        <input
          ref={dalsiListRef}
          type="file"
          accept="image/jpeg,image/png"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) nactiFotku(f);
            e.target.value = '';
          }}
        />

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button" variant="outline" size="sm"
            disabled={!img || hledam}
            onClick={() => img && detekuj(img)}
          >
            <Scan className="mr-1.5 h-3.5 w-3.5" /> Najít okraje
          </Button>
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
          <Button
            type="button"
            variant={jakoPdf ? 'default' : 'outline'}
            size="sm"
            disabled={hotoveListy.length > 0}
            onClick={() => setJakoPdf((v) => !v)}
            title={hotoveListy.length > 0 ? 'Víc listů se ukládá vždy jako PDF.' : undefined}
          >
            <FileText className="mr-1.5 h-3.5 w-3.5" /> Uložit jako PDF
          </Button>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={zavri} disabled={pracuji}>Zrušit</Button>
          <Button
            variant="outline"
            onClick={dalsiList}
            disabled={pracuji || !img || spotrebovany}
            title="Narovnaný list se odloží a můžete vyfotit další stranu."
          >
            <FilePlus2 className="mr-1.5 h-4 w-4" /> Přidat další list
          </Button>
          <Button onClick={uloz} disabled={pracuji || !img}>
            {pracuji && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {hotoveListy.length > 0 || jakoPdf ? 'Uložit PDF' : 'Použít'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
