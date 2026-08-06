'use client';

/**
 * AuditFlow — admin editace „Další návštěva technika" u klienta.
 * Umístění: src/components/admin/navsteva-technika.tsx
 *
 * Jedno pole `dalsiNavstevaTechnika` (ISO datetime) na dokumentu klienta.
 * Admin zadá datum a čas; klient ho vidí v přehledu (klient-prehled) jako
 * navy pole. Historie se nedrží — admin hodnotu přepisuje.
 */

import { useEffect, useState, useCallback } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/components/data-provider';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CalendarClock, Loader2, Check, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Props {
  klientId: string;
}

/** ISO → hodnota pro <input type="datetime-local"> (YYYY-MM-DDTHH:mm, lokální čas). */
function isoNaLocal(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** datetime-local (lokální) → ISO string. */
function localNaIso(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

/** Náhled „pondělí 15. března 2027, 9:00". */
function formatNahled(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const datum = d.toLocaleDateString('cs-CZ', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  const cas = d.toLocaleTimeString('cs-CZ', { hour: 'numeric', minute: '2-digit' });
  return `${datum}, ${cas}`;
}

export default function NavstevaTechnika({ klientId }: Props) {
  const { toast } = useToast();
  const [hodnota, setHodnota] = useState('');
  const [nacitam, setNacitam] = useState(true);
  const [uklada, setUklada] = useState(false);

  const nacti = useCallback(async () => {
    try {
      const snap = await getDoc(doc(db, 'klienti', klientId));
      setHodnota(isoNaLocal(snap.data()?.dalsiNavstevaTechnika ?? null));
    } catch (e) {
      console.error('Načtení návštěvy selhalo:', e);
    } finally {
      setNacitam(false);
    }
  }, [klientId]);

  useEffect(() => { nacti(); }, [nacti]);

  async function uloz() {
    setUklada(true);
    try {
      await updateDoc(doc(db, 'klienti', klientId), {
        dalsiNavstevaTechnika: localNaIso(hodnota),
      });
      toast({ title: 'Uloženo', description: hodnota ? 'Termín návštěvy nastaven.' : 'Termín odebrán.' });
    } catch (e: any) {
      toast({ title: 'Nepodařilo se uložit', description: e?.message ?? '', variant: 'destructive' });
    } finally {
      setUklada(false);
    }
  }

  async function vymaz() {
    setHodnota('');
    setUklada(true);
    try {
      await updateDoc(doc(db, 'klienti', klientId), { dalsiNavstevaTechnika: null });
      toast({ title: 'Termín odebrán' });
    } catch (e: any) {
      toast({ title: 'Nepodařilo se uložit', description: e?.message ?? '', variant: 'destructive' });
    } finally {
      setUklada(false);
    }
  }

  const nahled = formatNahled(localNaIso(hodnota));
  const jeBudouci = hodnota ? new Date(hodnota).getTime() > Date.now() : false;

  return (
    <Card>
      <CardContent className="py-4 space-y-3">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-[#0F2038]" />
          <span className="text-sm font-semibold text-[#0F2038]">Další návštěva technika</span>
        </div>

        {nacitam ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Načítám…
          </div>
        ) : (
          <>
            <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-end">
              <div className="space-y-1">
                <Label className="text-xs">Datum a čas</Label>
                <Input
                  type="datetime-local"
                  value={hodnota}
                  onChange={(e) => setHodnota(e.target.value)}
                  className="h-9"
                />
              </div>
              <Button onClick={uloz} disabled={uklada} className="h-9">
                {uklada ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Check className="h-4 w-4 mr-1.5" />}
                Uložit
              </Button>
              {hodnota && (
                <Button variant="ghost" onClick={vymaz} disabled={uklada} className="h-9 text-muted-foreground">
                  <X className="h-4 w-4 mr-1.5" /> Zrušit termín
                </Button>
              )}
            </div>

            {nahled && (
              <p className="text-xs text-muted-foreground">
                Klient uvidí: <strong className="text-foreground">{nahled}</strong>
                {!jeBudouci && ' — termín je v minulosti, klientovi se zobrazí „Není plánována návštěva technika".'}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
