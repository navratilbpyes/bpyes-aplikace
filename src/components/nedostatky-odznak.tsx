'use client';

/**
 * AuditFlow — odznak „nedostatky" u revize (řádek revize, hlavička sekce).
 * Umístění: src/components/nedostatky-odznak.tsx
 *
 * Ukáže jen to, co vyžaduje pozornost: otevřené (červeně, je-li něco po termínu,
 * jinak oranžově) a nahlášené klientem čekající na OZO (modře).
 * Žádný nedostatek k řešení = nic se nevykreslí.
 */

import { AlertTriangle, Clock } from 'lucide-react';
import { cn } from '@/app/lib/utils';
import { souhrnNedostatku } from '@/lib/nedostatky';
import type { Nedostatek, SouhrnNedostatku } from '@/lib/nedostatky';

function sklon(n: number): string {
  if (n === 1) return 'nedostatek';
  if (n >= 2 && n <= 4) return 'nedostatky';
  return 'nedostatků';
}

export function OdznakSouhrnu({ souhrn, jeKlient }: { souhrn: SouhrnNedostatku; jeKlient?: boolean }) {
  if (souhrn.otevrene === 0 && souhrn.ceka === 0) return null;
  return (
    <>
      {souhrn.otevrene > 0 && (
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold',
            souhrn.poTerminu > 0 ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800',
          )}
          title={souhrn.poTerminu > 0 ? `${souhrn.poTerminu} po termínu` : undefined}
        >
          <AlertTriangle className="h-3 w-3" />
          {souhrn.otevrene} {sklon(souhrn.otevrene)}
          {souhrn.poTerminu > 0 && ` · po termínu ${souhrn.poTerminu}`}
        </span>
      )}
      {souhrn.ceka > 0 && (
        <span className="inline-flex items-center gap-1 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-800">
          <Clock className="h-3 w-3" />
          {jeKlient ? `${souhrn.ceka} čeká na ověření` : `${souhrn.ceka} k ověření`}
        </span>
      )}
    </>
  );
}

/** Odznak u jedné revize. */
export default function OdznakNedostatkyRevize({
  nedostatky, jeKlient,
}: {
  nedostatky?: Nedostatek[] | null;
  jeKlient?: boolean;
}) {
  return <OdznakSouhrnu souhrn={souhrnNedostatku(nedostatky)} jeKlient={jeKlient} />;
}

/** Součet přes více revizí (hlavička sekce / oblasti). */
export function souctySouhrnu(seznam: { nedostatky?: Nedostatek[] | null }[]): SouhrnNedostatku {
  const s: SouhrnNedostatku = { otevrene: 0, ceka: 0, poTerminu: 0 };
  for (const r of seznam) {
    const d = souhrnNedostatku(r.nedostatky);
    s.otevrene += d.otevrene;
    s.ceka += d.ceka;
    s.poTerminu += d.poTerminu;
  }
  return s;
}
