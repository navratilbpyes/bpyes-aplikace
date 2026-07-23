'use client';

/**
 * AuditFlow — školení konkrétního klienta.
 * Umístění: src/components/admin/skoleni-klienta.tsx
 *
 * Firestore: klienti/{klientId}/skoleni/{id}
 *
 * Chování:
 *   - přidání z číselníku = kopie hodnot (snapshot), pozdější změna číselníku neovlivní
 *   - totéž školení lze přidat vícekrát (různé skupiny, odlišené poznámkou)
 *   - perioda i osoba jdou u klienta přepsat
 *   - vlastní školení mimo číselník
 *   - termín se dopočte z periody, nebo se zadá ručně
 *
 * Použití: <SkoleniKlienta klientId={klientId} />
 */

import { useState, useEffect, useCallback } from 'react';
import {
  collection, addDoc, updateDoc, doc, query, where, getDocs,
} from 'firebase/firestore';
import { db } from '@/components/data-provider';
import {
  PERIODY, popisPeriody, dopocitejDalsi, platnyTermin,
} from '@/lib/skoleni';
import type {
  CiselnikSkoleni, Osoba, SkoleniKlienta as TypSkoleni,
} from '@/lib/skoleni';

interface Props {
  klientId: string;
}

const prazdneNaUndefined = (v: string) => (v.trim() === '' ? undefined : v.trim());
const isoNaDatum = (iso?: string) => (iso ? iso.slice(0, 10) : '');
const datumNaIso = (d: string) => (d ? new Date(d + 'T00:00:00').toISOString() : undefined);

export default function SkoleniKlienta({ klientId }: Props) {
  const [seznam, setSeznam] = useState<TypSkoleni[]>([]);
  const [ciselnik, setCiselnik] = useState<CiselnikSkoleni[]>([]);
  const [osoby, setOsoby] = useState<Osoba[]>([]);
  const [nacitam, setNacitam] = useState(true);
  const [zprava, setZprava] = useState<string | null>(null);
  const [vybrane, setVybrane] = useState('');
  const [rozbaleno, setRozbaleno] = useState<string | null>(null);

  const cesta = useCallback(() => collection(db, 'klienti', klientId, 'skoleni'), [klientId]);

  const nacti = useCallback(async () => {
    try {
      const [kSnap, cSnap, oSnap] = await Promise.all([
        getDocs(query(cesta(), where('stav', '==', 'aktivni'))),
        getDocs(query(collection(db, 'ciselnikSkoleni'), where('stav', '==', 'aktivni'))),
        getDocs(query(collection(db, 'ciselnikOsoby'), where('stav', '==', 'aktivni'))),
      ]);
      setSeznam(kSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as TypSkoleni));
      setCiselnik(cSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as CiselnikSkoleni)
        .sort((a, b) => a.nazev.localeCompare(b.nazev, 'cs')));
      setOsoby(oSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Osoba)
        .sort((a, b) => a.jmeno.localeCompare(b.jmeno, 'cs')));
    } catch {
      setZprava('Načtení školení selhalo.');
    } finally {
      setNacitam(false);
    }
  }, [cesta]);

  useEffect(() => { nacti(); }, [nacti]);

  /** Přidá školení z číselníku — zkopíruje hodnoty jako snapshot. */
  async function pridejZCiselniku() {
    const zdroj = ciselnik.find((c) => c.id === vybrane);
    if (!zdroj) {
      setZprava('Vyber školení z číselníku.');
      return;
    }
    try {
      await addDoc(cesta(), {
        ciselnikId: zdroj.id,
        nazev: zdroj.nazev,
        periodaMesice: zdroj.periodaMesice,
        provadiOsobaId: zdroj.provadiOsobaId ?? null,
        poznamka: null,
        posledniIso: null,
        dalsiIso: null,
        dalsiRucne: false,
        stav: 'aktivni',
      });
      setVybrane('');
      setZprava(null);
      nacti();
    } catch {
      setZprava('Přidání selhalo.');
    }
  }

  /** Přidá vlastní školení mimo číselník. */
  async function pridejVlastni() {
    try {
      const ref = await addDoc(cesta(), {
        ciselnikId: null,
        nazev: 'Nové školení',
        periodaMesice: 12,
        provadiOsobaId: null,
        poznamka: null,
        posledniIso: null,
        dalsiIso: null,
        dalsiRucne: false,
        stav: 'aktivni',
      });
      setZprava(null);
      await nacti();
      setRozbaleno(ref.id);
    } catch {
      setZprava('Přidání selhalo.');
    }
  }

  async function uprav(id: string, zmeny: Partial<TypSkoleni>) {
    // optimistická aktualizace UI
    setSeznam((p) => p.map((s) => (s.id === id ? { ...s, ...zmeny } : s)));
    try {
      const cistec = Object.fromEntries(
        Object.entries(zmeny).map(([k, v]) => [k, v === undefined ? null : v]),
      );
      await updateDoc(doc(db, 'klienti', klientId, 'skoleni', id), cistec);
    } catch {
      setZprava('Uložení změny selhalo.');
    }
  }

  async function smaz(id: string) {
    setSeznam((p) => p.filter((s) => s.id !== id));
    await updateDoc(doc(db, 'klienti', klientId, 'skoleni', id), { stav: 'smazano' });
  }

  const jmenoOsoby = (id?: string | null) =>
    osoby.find((o) => o.id === id)?.jmeno ?? 'neurčeno';

  const formatDatum = (iso?: string) =>
    iso ? new Date(iso).toLocaleDateString('cs-CZ') : '—';

  if (nacitam) return <div style={S.blok}><p style={S.mute}>Načítám…</p></div>;

  return (
    <div style={S.blok}>
      <h3 style={S.nadpis}>Školení klienta</h3>

      {/* přidání */}
      <div style={S.formRadek}>
        <select
          value={vybrane}
          onChange={(e) => setVybrane(e.target.value)}
          style={{ ...S.input, flex: 1 }}
        >
          <option value="">Vyber školení z číselníku…</option>
          {ciselnik.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nazev} ({popisPeriody(c.periodaMesice)})
            </option>
          ))}
        </select>
        <button type="button" onClick={pridejZCiselniku} style={S.tlacitko}>Přidat</button>
        <button type="button" onClick={pridejVlastni} style={S.tlacitkoSekundarni}>
          + Vlastní
        </button>
      </div>
      <p style={S.napoveda}>
        Stejné školení lze přidat vícekrát pro různé skupiny — rozliš je poznámkou.
      </p>

      {/* seznam */}
      {seznam.length === 0 && <p style={S.mute}>Klient zatím nemá přiřazená žádná školení.</p>}

      {seznam.map((s) => {
        const termin = platnyTermin(s);
        const otevreno = rozbaleno === s.id;
        return (
          <div key={s.id} style={S.karta}>
            <div style={S.kartaHlavicka}>
              <button
                type="button"
                onClick={() => setRozbaleno(otevreno ? null : s.id)}
                style={S.rozbalit}
              >
                {otevreno ? '▾' : '▸'}
              </button>
              <div style={{ flex: 1 }}>
                <div style={S.kartaNazev}>
                  {s.nazev}
                  {s.poznamka && <span style={S.skupina}> — {s.poznamka}</span>}
                  {!s.ciselnikId && <span style={S.vlastniStitek}>vlastní</span>}
                </div>
                <div style={S.kartaMeta}>
                  {popisPeriody(s.periodaMesice)} · {jmenoOsoby(s.provadiOsobaId)} ·
                  {' další: '}<strong>{formatDatum(termin)}</strong>
                  {s.dalsiRucne && <span style={S.rucneStitek}>ručně</span>}
                </div>
              </div>
              <button type="button" onClick={() => smaz(s.id)} style={S.tlacitkoSmazat}>×</button>
            </div>

            {otevreno && (
              <div style={S.detail}>
                <label style={S.label}>
                  Název
                  <input
                    type="text" value={s.nazev}
                    onChange={(e) => uprav(s.id, { nazev: e.target.value })}
                    style={S.input}
                  />
                </label>

                <label style={S.label}>
                  Poznámka / skupina
                  <input
                    type="text" value={s.poznamka ?? ''}
                    onChange={(e) => uprav(s.id, { poznamka: prazdneNaUndefined(e.target.value) })}
                    placeholder="např. skupina B — sklad"
                    style={S.input}
                  />
                </label>

                <div style={S.dvojice}>
                  <label style={{ ...S.label, flex: 1 }}>
                    Perioda
                    <select
                      value={s.periodaMesice}
                      onChange={(e) => {
                        const perioda = Number(e.target.value);
                        const novyDalsi = s.dalsiRucne
                          ? s.dalsiIso
                          : dopocitejDalsi(s.posledniIso, perioda);
                        uprav(s.id, { periodaMesice: perioda, dalsiIso: novyDalsi });
                      }}
                      style={S.input}
                    >
                      {PERIODY.map((p) => (
                        <option key={p.hodnota} value={p.hodnota}>{p.popis}</option>
                      ))}
                    </select>
                  </label>

                  <label style={{ ...S.label, flex: 1 }}>
                    Provádí
                    <select
                      value={s.provadiOsobaId ?? ''}
                      onChange={(e) => uprav(s.id, { provadiOsobaId: prazdneNaUndefined(e.target.value) })}
                      style={S.input}
                    >
                      <option value="">neurčeno</option>
                      {osoby.map((o) => <option key={o.id} value={o.id}>{o.jmeno}</option>)}
                    </select>
                  </label>
                </div>

                <div style={S.dvojice}>
                  <label style={{ ...S.label, flex: 1 }}>
                    Poslední proškolení
                    <input
                      type="date" value={isoNaDatum(s.posledniIso)}
                      onChange={(e) => {
                        const posledni = datumNaIso(e.target.value);
                        const novyDalsi = s.dalsiRucne
                          ? s.dalsiIso
                          : dopocitejDalsi(posledni, s.periodaMesice);
                        uprav(s.id, { posledniIso: posledni, dalsiIso: novyDalsi });
                      }}
                      style={S.input}
                    />
                  </label>

                  <label style={{ ...S.label, flex: 1 }}>
                    Další termín
                    <input
                      type="date"
                      value={isoNaDatum(termin)}
                      onChange={(e) => uprav(s.id, {
                        dalsiIso: datumNaIso(e.target.value),
                        dalsiRucne: true,
                      })}
                      style={S.input}
                    />
                  </label>
                </div>

                {s.dalsiRucne && (
                  <button
                    type="button"
                    onClick={() => uprav(s.id, {
                      dalsiRucne: false,
                      dalsiIso: dopocitejDalsi(s.posledniIso, s.periodaMesice),
                    })}
                    style={S.tlacitkoZpet}
                  >
                    Vrátit k automatickému výpočtu
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {zprava && <p style={S.chyba}>{zprava}</p>}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  blok: { background: '#fff', border: '1px solid #E4E4DD', borderRadius: 12, padding: 20 },
  nadpis: { fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: 16, fontWeight: 600, color: '#0F2038', margin: '0 0 16px' },
  napoveda: { fontSize: 12, color: '#6B7280', margin: '0 0 16px', lineHeight: 1.5 },
  formRadek: { display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
  input: { display: 'block', width: '100%', padding: '9px 12px', border: '1px solid #E4E4DD', borderRadius: 8, fontSize: 14, color: '#0F2038', boxSizing: 'border-box', background: '#fff', marginTop: 4 },
  tlacitko: { background: '#2F5FD0', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 14, fontWeight: 500, cursor: 'pointer', flexShrink: 0 },
  tlacitkoSekundarni: { background: '#F1EFE8', color: '#0F2038', border: 'none', borderRadius: 8, padding: '9px 14px', fontSize: 14, cursor: 'pointer', flexShrink: 0 },
  tlacitkoSmazat: { background: 'transparent', color: '#C0392B', border: '1px solid #E4E4DD', borderRadius: 8, width: 30, height: 30, fontSize: 17, cursor: 'pointer', flexShrink: 0 },
  tlacitkoZpet: { background: 'transparent', color: '#2F5FD0', border: '1px solid #E4E4DD', borderRadius: 8, padding: '7px 12px', fontSize: 13, cursor: 'pointer', marginTop: 10 },
  karta: { border: '1px solid #E4E4DD', borderRadius: 10, marginTop: 10, overflow: 'hidden' },
  kartaHlavicka: { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: '#FBFBF9' },
  kartaNazev: { fontSize: 14, fontWeight: 600, color: '#0F2038' },
  kartaMeta: { fontSize: 12, color: '#6B7280', marginTop: 3 },
  skupina: { fontWeight: 400, color: '#6B7280' },
  vlastniStitek: { marginLeft: 8, fontSize: 11, background: '#E6F1FB', color: '#185FA5', padding: '2px 7px', borderRadius: 10, fontWeight: 500 },
  rucneStitek: { marginLeft: 6, fontSize: 11, background: '#F1EFE8', color: '#6B7280', padding: '1px 6px', borderRadius: 8 },
  rozbalit: { background: 'transparent', border: 'none', color: '#6B7280', fontSize: 14, cursor: 'pointer', padding: 0, width: 16, flexShrink: 0 },
  detail: { padding: '14px', borderTop: '1px solid #E4E4DD', display: 'flex', flexDirection: 'column', gap: 12 },
  label: { display: 'block', fontSize: 13, color: '#0F2038', fontWeight: 500 },
  dvojice: { display: 'flex', gap: 12, flexWrap: 'wrap' },
  mute: { fontSize: 13, color: '#6B7280', margin: '8px 0 0' },
  chyba: { fontSize: 13, color: '#C0392B', marginTop: 12 },
};
