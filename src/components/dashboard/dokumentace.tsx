'use client';

/**
 * AuditFlow — sekce Dokumentace v klientském dashboardu.
 * Umístění: src/components/dashboard/dokumentace.tsx
 *
 * Čte z Firestore `klienti/{klientId}`:
 *   driveSlozkaUrl : string
 *   rychleOdkazy   : { nazev, url }[]
 *
 * Když odkaz není vyplněný, sekce se nezobrazí vůbec.
 *
 * Použití:
 *   <Dokumentace klientId={profil.klientId} />
 */

import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/components/data-provider';

interface RychlyOdkaz {
  nazev: string;
  url: string;
}

interface Props {
  klientId: string;
}

export default function Dokumentace({ klientId }: Props) {
  const [slozkaUrl, setSlozkaUrl] = useState('');
  const [rychle, setRychle] = useState<RychlyOdkaz[]>([]);
  const [nacitam, setNacitam] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'klienti', klientId));
        const d = snap.data() ?? {};
        setSlozkaUrl(d.driveSlozkaUrl ?? '');
        setRychle(Array.isArray(d.rychleOdkazy) ? d.rychleOdkazy : []);
      } catch {
        // ticho — sekce se prostě nezobrazí
      } finally {
        setNacitam(false);
      }
    })();
  }, [klientId]);

  if (nacitam || !slozkaUrl) return null;

  return (
    <section style={S.karta}>
      <div style={S.hlavicka}>
        <span style={S.nadpis}>Dokumentace</span>
        <span style={S.stitek}>Google Disk</span>
      </div>

      <a href={slozkaUrl} target="_blank" rel="noopener noreferrer" style={S.hlavniOdkaz}>
        <span style={S.hlavniText}>Otevřít složku s dokumentací</span>
        <span style={S.sipka}>↗</span>
      </a>

      {rychle.length > 0 && (
        <div style={S.rychleBlok}>
          <div style={S.rychleNadpis}>Rychlé odkazy</div>
          <div style={S.rychleMrizka}>
            {rychle.map((r, i) => (
              <a key={i} href={r.url} target="_blank" rel="noopener noreferrer" style={S.rychlyOdkaz}>
                {r.nazev}
                <span style={S.sipkaMala}>↗</span>
              </a>
            ))}
          </div>
        </div>
      )}

      <p style={S.poznamka}>Dokumenty se otevřou na Google Disku v novém okně.</p>
    </section>
  );
}

const S: Record<string, React.CSSProperties> = {
  karta: { background: '#fff', border: '1px solid #E4E4DD', borderRadius: 12, padding: 18 },
  hlavicka: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  nadpis: { fontFamily: "'Space Grotesk', system-ui, sans-serif", fontWeight: 600, fontSize: 16, color: '#0F2038' },
  stitek: { background: '#E6F1FB', color: '#185FA5', fontSize: 12, padding: '3px 10px', borderRadius: 12 },
  hlavniOdkaz: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 16px', border: '1px solid #E4E4DD', borderRadius: 10,
    textDecoration: 'none', background: '#FBFBF9',
  },
  hlavniText: { fontFamily: "'Space Grotesk', system-ui, sans-serif", fontWeight: 600, fontSize: 14, color: '#0F2038' },
  sipka: { color: '#2F5FD0', fontSize: 16 },
  rychleBlok: { marginTop: 16 },
  rychleNadpis: { fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B7280', marginBottom: 8 },
  rychleMrizka: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  rychlyOdkaz: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '7px 12px', border: '1px solid #E4E4DD', borderRadius: 8,
    fontSize: 13, color: '#0F2038', textDecoration: 'none', background: '#fff',
  },
  sipkaMala: { color: '#2F5FD0', fontSize: 12 },
  poznamka: { fontSize: 12, color: '#6B7280', marginTop: 14, marginBottom: 0 },
};
