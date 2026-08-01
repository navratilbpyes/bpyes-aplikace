'use client';

/**
 * AuditFlow — správa odkazů na Google Drive v admin kartě klienta.
 * Umístění: src/components/admin/drive-odkazy.tsx
 *
 * Ukládá do Firestore dokumentu klienta:
 *   driveSlozkaUrl : string          — hlavní složka
 *   rychleOdkazy   : { nazev, url }[] — rychlá tlačítka (volitelné)
 *
 * Použití v kartě klienta:
 *   <DriveOdkazy klientId={klientId} />
 */

import { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/components/data-provider';

export interface RychlyOdkaz {
  nazev: string;
  url: string;
}

interface Props {
  klientId: string;
}

export default function DriveOdkazy({ klientId }: Props) {
  const [slozkaUrl, setSlozkaUrl] = useState('');
  const [freeloUrl, setFreeloUrl] = useState('');
  const [rychle, setRychle] = useState<RychlyOdkaz[]>([]);
  const [nacitam, setNacitam] = useState(true);
  const [uklada, setUklada] = useState(false);
  const [zprava, setZprava] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'klienti', klientId));
        const d = snap.data() ?? {};
        setSlozkaUrl(d.driveSlozkaUrl ?? '');
        setFreeloUrl(d.freeloUrl ?? '');
        setRychle(Array.isArray(d.rychleOdkazy) ? d.rychleOdkazy : []);
      } catch {
        setZprava('Načtení odkazů selhalo.');
      } finally {
        setNacitam(false);
      }
    })();
  }, [klientId]);

  const platnaUrl = (u: string) => u === '' || /^https:\/\/(drive|docs)\.google\.com\//.test(u);

  async function uloz() {
    if (!platnaUrl(slozkaUrl)) {
      setZprava('Odkaz musí začínat https://drive.google.com/ nebo https://docs.google.com/');
      return;
    }
    const spatny = rychle.find((r) => !platnaUrl(r.url));
    if (spatny) {
      setZprava(`Neplatný odkaz u "${spatny.nazev || 'bez názvu'}".`);
      return;
    }

    if (freeloUrl !== '' && !/^https:\/\/(app\.)?freelo\.(cz|io)\//.test(freeloUrl)) {
      setZprava('Odkaz na Freelo musí začínat https://freelo.cz/ nebo https://app.freelo.cz/');
      return;
    }

    setUklada(true);
    setZprava(null);
    try {
      await updateDoc(doc(db, 'klienti', klientId), {
        driveSlozkaUrl: slozkaUrl.trim(),
        freeloUrl: freeloUrl.trim(),
        rychleOdkazy: rychle
          .filter((r) => r.nazev.trim() !== '' && r.url.trim() !== '')
          .map((r) => ({ nazev: r.nazev.trim(), url: r.url.trim() })),
      });
      setZprava('Uloženo.');
    } catch {
      setZprava('Uložení selhalo.');
    } finally {
      setUklada(false);
    }
  }

  function zmenRychly(i: number, klic: keyof RychlyOdkaz, hodnota: string) {
    setRychle((p) => p.map((r, idx) => (idx === i ? { ...r, [klic]: hodnota } : r)));
  }

  if (nacitam) {
    return <div style={S.blok}><p style={S.mute}>Načítám…</p></div>;
  }

  return (
    <div style={S.blok}>
      <h3 style={S.nadpis}>Dokumentace na Google Disku</h3>

      <label style={S.label}>
        Hlavní složka klienta
        <input
          type="url"
          value={slozkaUrl}
          onChange={(e) => setSlozkaUrl(e.target.value)}
          placeholder="https://drive.google.com/drive/folders/…"
          style={S.input}
        />
      </label>
      <p style={S.napoveda}>
        Na Disku otevři složku klienta → Sdílet → Kdokoli s odkazem (Čtenář) → Kopírovat odkaz.
        Bez nastaveného sdílení klient složku neotevře.
      </p>

      <label style={{ ...S.label, marginTop: 20, display: 'block' }}>
        Odkaz na Freelo projekt
        <input
          type="url"
          value={freeloUrl}
          onChange={(e) => setFreeloUrl(e.target.value)}
          placeholder="https://app.freelo.cz/project/…"
          style={S.input}
        />
      </label>
      <p style={S.napoveda}>
        Zobrazí se klientovi na dashboardu jako dlaždice „Úkoly ve Freelu".
      </p>

      <div style={{ marginTop: 20 }}>
        <div style={S.radek}>
          <span style={S.podnadpis}>Rychlé odkazy (volitelné)</span>
          <button
            type="button"
            onClick={() => setRychle((p) => [...p, { nazev: '', url: '' }])}
            style={S.tlacitkoMale}
          >
            + Přidat
          </button>
        </div>

        {rychle.length === 0 && (
          <p style={S.mute}>Zatím žádné. Slouží jako zkratky na často používané dokumenty.</p>
        )}

        {rychle.map((r, i) => (
          <div key={i} style={S.rychlyRadek}>
            <input
              type="text"
              value={r.nazev}
              onChange={(e) => zmenRychly(i, 'nazev', e.target.value)}
              placeholder="Název (např. Kniha úrazů)"
              style={{ ...S.input, flex: '0 0 200px', marginTop: 0 }}
            />
            <input
              type="url"
              value={r.url}
              onChange={(e) => zmenRychly(i, 'url', e.target.value)}
              placeholder="https://drive.google.com/…"
              style={{ ...S.input, flex: 1, marginTop: 0 }}
            />
            <button
              type="button"
              onClick={() => setRychle((p) => p.filter((_, idx) => idx !== i))}
              style={S.tlacitkoSmazat}
              aria-label="Odebrat"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div style={{ ...S.radek, marginTop: 20 }}>
        <button type="button" onClick={uloz} disabled={uklada} style={S.tlacitko}>
          {uklada ? 'Ukládám…' : 'Uložit odkazy'}
        </button>
        {zprava && (
          <span style={{ ...S.zprava, color: zprava === 'Uloženo.' ? '#4A7A5C' : '#C0392B' }}>
            {zprava}
          </span>
        )}
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  blok: { background: '#fff', border: '1px solid #E4E4DD', borderRadius: 12, padding: 20 },
  nadpis: { fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 16, fontWeight: 600, color: '#0F2038', margin: '0 0 16px' },
  podnadpis: { fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 14, fontWeight: 600, color: '#0F2038' },
  label: { display: 'block', fontSize: 13, color: '#0F2038', fontWeight: 500 },
  input: { display: 'block', width: '100%', marginTop: 6, padding: '9px 12px', border: '1px solid #E4E4DD', borderRadius: 8, fontSize: 14, color: '#0F2038', boxSizing: 'border-box' },
  napoveda: { fontSize: 12, color: '#6B7280', marginTop: 6, lineHeight: 1.5 },
  mute: { fontSize: 13, color: '#6B7280', margin: '8px 0 0' },
  radek: { display: 'flex', alignItems: 'center', gap: 12 },
  rychlyRadek: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 },
  tlacitko: { background: '#2F5FD0', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 14, fontWeight: 500, cursor: 'pointer' },
  tlacitkoMale: { background: '#F1EFE8', color: '#0F2038', border: 'none', borderRadius: 8, padding: '5px 12px', fontSize: 12, cursor: 'pointer', marginLeft: 'auto' },
  tlacitkoSmazat: { background: 'transparent', color: '#C0392B', border: '1px solid #E4E4DD', borderRadius: 8, width: 32, height: 32, fontSize: 18, cursor: 'pointer', flexShrink: 0 },
  zprava: { fontSize: 13 },
};
