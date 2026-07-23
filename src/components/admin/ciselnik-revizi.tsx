'use client';

/**
 * AuditFlow — správa číselníků revizí a firem.
 * Umístění: src/components/admin/ciselnik-revizi.tsx
 *
 * Firestore kolekce:
 *   ciselnikRevizi/{id}  — katalog revizí (název, perioda, kdo provádí)
 *   ciselnikFirem/{id}   — firmy včetně kontaktu
 *
 * Použití: <CiselnikRevizi />
 */

import { useState, useEffect, useCallback } from 'react';
import {
  collection, addDoc, updateDoc, doc, query, where, getDocs,
} from 'firebase/firestore';
import { db } from '@/components/data-provider';
import { PERIODY, popisPeriody } from '@/lib/revize';
import type { CiselnikRevize, Firma } from '@/lib/revize';

export default function CiselnikRevizi() {
  const [revize, setRevize] = useState<CiselnikRevize[]>([]);
  const [firmy, setFirmy] = useState<Firma[]>([]);
  const [nacitam, setNacitam] = useState(true);
  const [zprava, setZprava] = useState<string | null>(null);

  // formulář nové revize
  const [novyNazev, setNovyNazev] = useState('');
  const [novaPerioda, setNovaPerioda] = useState(12);
  const [novaFirma, setNovaFirma] = useState('');

  // formulář nové firmy
  const [fNazev, setFNazev] = useState('');
  const [fObor, setFObor] = useState('');
  const [fTelefon, setFTelefon] = useState('');
  const [fEmail, setFEmail] = useState('');

  const nacti = useCallback(async () => {
    try {
      const [rSnap, fSnap] = await Promise.all([
        getDocs(query(collection(db, 'ciselnikRevizi'), where('stav', '==', 'aktivni'))),
        getDocs(query(collection(db, 'ciselnikFirem'), where('stav', '==', 'aktivni'))),
      ]);
      setRevize(rSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as CiselnikRevize)
        .sort((a, b) => a.nazev.localeCompare(b.nazev, 'cs')));
      setFirmy(fSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Firma)
        .sort((a, b) => a.nazev.localeCompare(b.nazev, 'cs')));
    } catch {
      setZprava('Načtení číselníku selhalo.');
    } finally {
      setNacitam(false);
    }
  }, []);

  useEffect(() => { nacti(); }, [nacti]);

  async function pridejRevizi() {
    if (novyNazev.trim() === '') {
      setZprava('Zadej název revize.');
      return;
    }
    try {
      await addDoc(collection(db, 'ciselnikRevizi'), {
        nazev: novyNazev.trim(),
        periodaMesice: novaPerioda,
        provadiFirmaId: novaFirma || null,
        stav: 'aktivni',
      });
      setNovyNazev('');
      setNovaFirma('');
      setZprava(null);
      nacti();
    } catch {
      setZprava('Uložení selhalo.');
    }
  }

  async function pridejFirmu() {
    if (fNazev.trim() === '') {
      setZprava('Zadej název firmy.');
      return;
    }
    try {
      await addDoc(collection(db, 'ciselnikFirem'), {
        nazev: fNazev.trim(),
        obor: fObor.trim() || null,
        telefon: fTelefon.trim() || null,
        email: fEmail.trim() || null,
        stav: 'aktivni',
      });
      setFNazev(''); setFObor(''); setFTelefon(''); setFEmail('');
      setZprava(null);
      nacti();
    } catch {
      setZprava('Uložení selhalo.');
    }
  }

  async function upravFirmu(id: string, zmeny: Partial<Firma>) {
    setFirmy((p) => p.map((f) => (f.id === id ? { ...f, ...zmeny } : f)));
    const cistec = Object.fromEntries(
      Object.entries(zmeny).map(([k, v]) => [k, v === undefined || v === '' ? null : v]),
    );
    await updateDoc(doc(db, 'ciselnikFirem', id), cistec);
  }

  async function smazRevizi(id: string) {
    await updateDoc(doc(db, 'ciselnikRevizi', id), { stav: 'smazano' });
    nacti();
  }

  async function smazFirmu(id: string) {
    await updateDoc(doc(db, 'ciselnikFirem', id), { stav: 'smazano' });
    nacti();
  }

  const nazevFirmy = (id?: string) => firmy.find((f) => f.id === id)?.nazev ?? '—';

  if (nacitam) return <div style={S.blok}><p style={S.mute}>Načítám…</p></div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Firmy ── */}
      <div style={S.blok}>
        <h3 style={S.nadpis}>Revizní firmy a technici</h3>
        <p style={S.napoveda}>Kontakt se zobrazí u revize v kartě klienta.</p>

        <div style={S.formMrizka}>
          <input type="text" value={fNazev} onChange={(e) => setFNazev(e.target.value)}
            placeholder="Název firmy / jméno technika" style={S.input} />
          <input type="text" value={fObor} onChange={(e) => setFObor(e.target.value)}
            placeholder="Obor (např. elektro, plyn)" style={S.input} />
          <input type="tel" value={fTelefon} onChange={(e) => setFTelefon(e.target.value)}
            placeholder="Telefon" style={S.input} />
          <input type="email" value={fEmail} onChange={(e) => setFEmail(e.target.value)}
            placeholder="E-mail" style={S.input} />
          <button type="button" onClick={pridejFirmu} style={S.tlacitko}>Přidat firmu</button>
        </div>

        {firmy.length === 0 && <p style={S.mute}>Zatím žádné firmy.</p>}
        {firmy.map((f) => (
          <div key={f.id} style={S.firmaKarta}>
            <div style={S.firmaMrizka}>
              <input type="text" value={f.nazev}
                onChange={(e) => upravFirmu(f.id, { nazev: e.target.value })}
                style={S.input} />
              <input type="text" value={f.obor ?? ''}
                onChange={(e) => upravFirmu(f.id, { obor: e.target.value })}
                placeholder="Obor" style={S.input} />
              <input type="tel" value={f.telefon ?? ''}
                onChange={(e) => upravFirmu(f.id, { telefon: e.target.value })}
                placeholder="Telefon" style={S.input} />
              <input type="email" value={f.email ?? ''}
                onChange={(e) => upravFirmu(f.id, { email: e.target.value })}
                placeholder="E-mail" style={S.input} />
              <button type="button" onClick={() => smazFirmu(f.id)} style={S.tlacitkoSmazat}>×</button>
            </div>
          </div>
        ))}
      </div>

      {/* ── Revize ── */}
      <div style={S.blok}>
        <h3 style={S.nadpis}>Číselník revizí</h3>
        <p style={S.napoveda}>
          Katalog revizí s výchozí periodou. Při přiřazení klientovi se hodnoty zkopírují —
          pozdější úprava zde už přiřazené revize nezmění.
        </p>

        <div style={S.formRadek}>
          <input type="text" value={novyNazev} onChange={(e) => setNovyNazev(e.target.value)}
            placeholder="Název revize (např. Revize hromosvodu)"
            style={{ ...S.input, flex: 1, minWidth: 220 }} />
          <select value={novaPerioda} onChange={(e) => setNovaPerioda(Number(e.target.value))}
            style={{ ...S.input, flex: '0 0 160px' }}>
            {PERIODY.map((p) => <option key={p.hodnota} value={p.hodnota}>{p.popis}</option>)}
          </select>
          <select value={novaFirma} onChange={(e) => setNovaFirma(e.target.value)}
            style={{ ...S.input, flex: '0 0 200px' }}>
            <option value="">Kdo provádí…</option>
            {firmy.map((f) => <option key={f.id} value={f.id}>{f.nazev}</option>)}
          </select>
          <button type="button" onClick={pridejRevizi} style={S.tlacitko}>Přidat</button>
        </div>

        {revize.length === 0 && <p style={S.mute}>Zatím žádné revize.</p>}
        {revize.map((r) => (
          <div key={r.id} style={S.polozka}>
            <div style={{ flex: 1 }}>
              <span style={S.polozkaNazev}>{r.nazev}</span>
              <span style={S.polozkaMeta}>
                {' · '}{popisPeriody(r.periodaMesice)}
                {' · '}{nazevFirmy(r.provadiFirmaId)}
              </span>
            </div>
            <button type="button" onClick={() => smazRevizi(r.id)} style={S.tlacitkoSmazat}>×</button>
          </div>
        ))}
      </div>

      {zprava && <p style={S.chyba}>{zprava}</p>}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  blok: { background: '#fff', border: '1px solid #E4E4DD', borderRadius: 12, padding: 20 },
  nadpis: { fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 16, fontWeight: 600, color: '#0F2038', margin: '0 0 6px' },
  napoveda: { fontSize: 12, color: '#6B7280', margin: '0 0 16px', lineHeight: 1.5 },
  formRadek: { display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  formMrizka: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr)) auto', gap: 8, marginBottom: 16, alignItems: 'center' },
  input: { padding: '9px 12px', border: '1px solid #E4E4DD', borderRadius: 8, fontSize: 14, color: '#0F2038', boxSizing: 'border-box', background: '#fff', width: '100%' },
  tlacitko: { background: '#2F5FD0', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 14, fontWeight: 500, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' },
  tlacitkoSmazat: { background: 'transparent', color: '#C0392B', border: '1px solid #E4E4DD', borderRadius: 8, width: 30, height: 30, fontSize: 17, cursor: 'pointer', flexShrink: 0 },
  firmaKarta: { padding: '10px 0', borderTop: '1px solid #E4E4DD' },
  firmaMrizka: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr)) auto', gap: 8, alignItems: 'center' },
  polozka: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: '1px solid #E4E4DD' },
  polozkaNazev: { fontSize: 14, color: '#0F2038', fontWeight: 500 },
  polozkaMeta: { fontSize: 13, color: '#6B7280' },
  mute: { fontSize: 13, color: '#6B7280', margin: '8px 0 0' },
  chyba: { fontSize: 13, color: '#C0392B' },
};
