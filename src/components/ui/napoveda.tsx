'use client';

/**
 * AuditFlow — tlačítko nápovědy u karet.
 * Umístění: src/components/ui/napoveda.tsx
 *
 * Rozbalí se na místě, nikam neodnaviguje. Texty žijí v lib/napoveda.ts.
 */

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { HelpCircle } from 'lucide-react';
import { NAPOVEDA } from '@/lib/napoveda';

export default function Napoveda({ klic }: { klic: keyof typeof NAPOVEDA | string }) {
  const t = NAPOVEDA[klic];
  if (!t) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Nápověda: ${t.nadpis}`}
          className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground no-print"
        >
          <HelpCircle className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(26rem,90vw)] space-y-2">
        <p className="font-bold text-sm">{t.nadpis}</p>
        {t.text.map((odstavec, i) => (
          <p key={i} className="text-xs leading-relaxed text-muted-foreground">{odstavec}</p>
        ))}
        {t.predpis && (
          <p className="border-t pt-2 text-[11px] text-muted-foreground">{t.predpis}</p>
        )}
      </PopoverContent>
    </Popover>
  );
}
