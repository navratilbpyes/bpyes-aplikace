'use client';

/**
 * AuditFlow — vkládací zóna pro fotky s podporou:
 *  - kliknutí (otevře výběr souborů),
 *  - drag & drop (přetažení souborů na zónu),
 *  - vložení ze schránky (Ctrl+V, když je zóna aktivní / myš nad ní).
 *
 * Umístění: src/components/nova-kontrola/foto-zona.tsx
 *
 * Komponenta jen SBÍRÁ soubory, zkomprimuje je (compressImage) a předá hotové
 * base64 řetězce přes onFotky. Náhledy a mazání řeší rodič (beze změny).
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, Loader2 } from 'lucide-react';
import { compressImage, FOTO_NEDOSTATKU } from '@/lib/obrazky';

interface Props {
  /** zavolá se s polem base64 fotek (už zkomprimovaných) */
  onFotky: (base64: string[]) => void;
  /** text tlačítka */
  label?: string;
  /** malá varianta (menší tlačítko, pro doporučení) */
  maly?: boolean;
}

export default function FotoZona({ onFotky, label = 'Přidat fotodokumentaci', maly = false }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const zonaRef = useRef<HTMLDivElement>(null);
  const [pretahuje, setPretahuje] = useState(false);
  const [zpracovava, setZpracovava] = useState(false);
  const [nadZonou, setNadZonou] = useState(false);

  const zpracujSoubory = useCallback(async (soubory: File[]) => {
    const obrazky = soubory.filter((f) => f.type.startsWith('image/'));
    if (obrazky.length === 0) return;
    setZpracovava(true);
    try {
      const nove: string[] = [];
      for (const f of obrazky) {
        nove.push(await compressImage(f, FOTO_NEDOSTATKU));
      }
      if (nove.length) onFotky(nove);
    } finally {
      setZpracovava(false);
    }
  }, [onFotky]);

  // Vložení ze schránky (Ctrl+V) — jen když je myš nad zónou (aby se fotka
  // nevložila do špatné zóny, když jich je na stránce víc).
  useEffect(() => {
    if (!nadZonou) return;
    const onPaste = (e: ClipboardEvent) => {
      const soubory = Array.from(e.clipboardData?.items || [])
        .filter((i) => i.kind === 'file' && i.type.startsWith('image/'))
        .map((i) => i.getAsFile())
        .filter((f): f is File => !!f);
      if (soubory.length) {
        e.preventDefault();
        zpracujSoubory(soubory);
      }
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [nadZonou, zpracujSoubory]);

  return (
    <div
      ref={zonaRef}
      onMouseEnter={() => setNadZonou(true)}
      onMouseLeave={() => setNadZonou(false)}
      onDragOver={(e) => { e.preventDefault(); setPretahuje(true); }}
      onDragLeave={(e) => { e.preventDefault(); setPretahuje(false); }}
      onDrop={(e) => {
        e.preventDefault();
        setPretahuje(false);
        zpracujSoubory(Array.from(e.dataTransfer.files || []));
      }}
      className={[
        'rounded-lg border-2 border-dashed transition-colors',
        maly ? 'p-2' : 'p-3',
        pretahuje ? 'border-[#2F5FD0] bg-[#2F5FD0]/5' : 'border-muted-foreground/25',
      ].join(' ')}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          zpracujSoubory(Array.from(e.target.files || []) as File[]);
          e.target.value = '';
        }}
      />
      <div className="flex items-center gap-3 flex-wrap">
        <Button
          type="button"
          variant="outline"
          size={maly ? 'sm' : 'default'}
          className={maly ? 'h-8' : ''}
          disabled={zpracovava}
          onClick={() => inputRef.current?.click()}
        >
          {zpracovava
            ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            : <Camera className={maly ? 'h-3.5 w-3.5 mr-2' : 'h-4 w-4 mr-2'} />}
          {zpracovava ? 'Zpracovávám…' : label}
        </Button>
        <span className="text-xs text-muted-foreground">
          {pretahuje ? 'Pusťte fotky sem' : 'nebo přetáhněte / vložte (Ctrl+V)'}
        </span>
      </div>
    </div>
  );
}
