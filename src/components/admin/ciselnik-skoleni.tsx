'use client';

/**
 * AuditFlow — správa číselníků školení a osob.
 * Umístění: src/components/admin/ciselnik-skoleni.tsx
 *
 * Firestore kolekce:
 *   ciselnikSkoleni/{id}  — katalog školení (název, perioda, kdo provádí)
 *   ciselnikOsoby/{id}    — osoby provádějící školení
 *
 * Použití: <CiselnikSkoleni />
 */

import { useState, useEffect, useCallback } from 'react';
import {
  collection, addDoc, updateDoc, doc, query, where, getDocs,
} from 'firebase/firestore';
import { db } from '@/components/data-provider';
import { PERIODY, popisPeriody } from '@/lib/skoleni';
import type { CiselnikSkoleni as TypSkoleni, Osoba } from '@/lib/skoleni';

export default function CiselnikSkoleni() {
  const [skoleni, setSkoleni] = useState<TypSkoleni[]>([]);
  const [osoby, setOsoby] = useState<Osoba[]>([]);
  const [nacitam, setNacitam] = useState(true);
  const [zprava, setZprava] = useState<string | null>(null);

  // formulář nového školení
  const [novyNazev, setNovyNazev] = useState('');
  const [novaPerioda, setNovaPerioda] = useState(12);
  const [novaOsoba, setNovaOsoba] = useState('');

  // formulář nové osoby
  const [noveJmeno, setNoveJmeno] = useState('');
  const [novaRole, setNovaRole] = useState('');

  const nacti = useCallback(async () => {
    try {
      const [sSnap, oSnap] = await Promise.all([
        getDocs(query(collection(db, 'ciselnikSkoleni'), where('stav', '==', 'aktivni'))),
        getDocs(query(collection(db, 'ciselnikOsoby'), where('stav', '==', 'aktivni'))),
      ]);
      setSkoleni(sSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as TypSkoleni)
        .sort((a, b) => a.nazev.localeCompare(b.nazev, 'cs')));
      setOsoby(oSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Osoba)
        .sort((a, b) => a.jmeno.localeCompare(b.jmeno, 'cs')));
    } catch {
      setZprava('Načtení číselníku selhalo.');
    } finally {
      setNacitam(false);
    }
  }, []);

  useEffect(() => { nacti(); }, [nacti]);

  async function pridejSkoleni() {
    if (novyNazev.trim() === '') {
      setZprava('Zadej název školení.');
      return;
    }
    try {
      await addDoc(collection(db, 'ciselnikSkoleni'), {
        nazev: novyNazev.trim(),
        periodaMesice: novaPerioda,
        provadiOsobaId: novaOsoba || null,
        stav: 'aktivni',
      });
      setNovyNazev('');
      setNovaOsoba('');
      setZprava(null);
      nacti();
    } catch {
      setZprava('Uložení selhalo.');
    }
  }

  async function pridejOsobu() {
    if (noveJmeno.trim() === '') {
      setZprava('Zadej jméno osoby.');
      return;
    }
    try {
      await addDoc(collection(db, 'ciselnikOsoby'), {
        jmeno: noveJmeno.trim(),
        role: novaRole.trim() || null,
        stav: 'aktivni',
      });
      setNoveJmeno('');
      setNovaRole('');
      setZprava(null);
      nacti();
    } catch {
      setZprava('Uložení selhalo.');
    }
  }

  async function smazSkoleni(id: string) {
    await updateDoc(doc(db, 'ciselnikSkoleni', id), { stav: 'smazano' });
    nacti();
  }

  async function smazOsobu(id: string) {
    await updateDoc(doc(db, 'ciselnikOsoby', id), { stav: 'smazano' });
    nacti();
  }

  const jmenoOsoby = (id?: string) =>
    osoby.find((o) => o.id === id)?.jmeno ?? '—';

  if (nacitam) return <div style={S.blok}><p style={S.mute}>Načítám…</p></div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Osoby ── */}
      <div style={S.blok}>
        <h3 style={S.nadpis}>Osoby provádějící školení</h3>

        <div style={S.formRadek}>
          <input
            type="text" value={noveJmeno} onChange={(e) => setNoveJmeno(e.target.value)}
            placeholder="Jméno (např. Martin Navrátil)" style={{ ...S.input, flex: 1 }}
          />
          <input
            type="text" value={novaRole} onChange={(e) => setNovaRole(e.target.value)}
            placeholder="Role (např. OZO)" style={{ ...S.input, flex: '0 0 200px' }}
          />
          <button type="button" onClick={pridejOsobu} style={S.tlacitko}>Přidat</button>
        </div>

        {osoby.length === 0 && <p style={S.mute}>Zatím žádné osoby.</p>}
        {osoby.map((o) => (
          <div key={o.id} style={S.polozka}>
            <div style={{ flex: 1 }}>
              <span style={S.polozkaNazev}>{o.jmeno}</span>
              {o.role && <span style={S.polozkaMeta}> · {o.role}</span>}
            </div>
            <button type="button" onClick={() => smazOsobu(o.id)} style={S.tlacitkoSmazat}>×</button>
          </div>
        ))}
      </div>

      {/* ── Školení ── */}
      <div style={S.blok}>
        <h3 style={S.nadpis}>Číselník školení</h3>
        <p style={S.napoveda}>
          Katalog školení s výchozí periodou. Při přiřazení klientovi se hodnoty zkopírují —
          pozdější úprava zde už přiřazená školení nezmění.
        </p>

        <div style={S.formRadek}>
          <input
            type="text" value={novyNazev} onChange={(e) => setNovyNazev(e.target.value)}
            placeholder="Název školení (např. Školení BOZP)" style={{ ...S.input, flex: 1 }}
          />
          <select
            value={novaPerioda} onChange={(e) => setNovaPerioda(Number(e.target.value))}
            style={{ ...S.input, flex: '0 0 160px' }}
          >
            {PERIODY.map((p) => <option key={p.hodnota} value={p.hodnota}>{p.popis}</option>)}
          </select>
          <select
            value={novaOsoba} onChange={(e) => setNovaOsoba(e.target.value)}
            style={{ ...S.input, flex: '0 0 180px' }}
          >
            <option value="">Kdo provádí…</option>
            {osoby.map((o) => <option key={o.id} value={o.id}>{o.jmeno}</option>)}
          </select>
          <button type="button" onClick={pridejSkoleni} style={S.tlacitko}>Přidat</button>
        </div>

        {skoleni.length === 0 && <p style={S.mute}>Zatím žádná školení.</p>}
        {skoleni.map((s) => (
          <div key={s.id} style={S.polozka}>
            <div style={{ flex: 1 }}>
              <span style={S.polozkaNazev}>{s.nazev}</span>
              <span style={S.polozkaMeta}>
                {' · '}{popisPeriody(s.periodaMesice)}
                {' · '}{jmenoOsoby(s.provadiOsobaId)}
              </span>
            </div>
            <button type="button" onClick={() => smazSkoleni(s.id)} style={S.tlacitkoSmazat}>×</button>
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
  input: { padding: '9px 12px', border: '1px solid #E4E4DD', borderRadius: 8, fontSize: 14, color: '#0F2038', boxSizing: 'border-box', background: '#fff' },
  tlacitko: { background: '#2F5FD0', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 14, fontWeight: 500, cursor: 'pointer' },
  tlacitkoSmazat: { background: 'transparent', color: '#C0392B', border: '1px solid #E4E4DD', borderRadius: 8, width: 30, height: 30, fontSize: 17, cursor: 'pointer', flexShrink: 0 },
  polozka: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: '1px solid #E4E4DD' },
  polozkaNazev: { fontSize: 14, color: '#0F2038', fontWeight: 500 },
  polozkaMeta: { fontSize: 13, color: '#6B7280' },
  mute: { fontSize: 13, color: '#6B7280', margin: '8px 0 0' },
  chyba: { fontSize: 13, color: '#C0392B' },
};
