'use client';

/**
 * AuditFlow — revize konkrétního klienta.
 * Umístění: src/components/admin/revize-klienta.tsx
 *
 * Firestore: klienti/{klientId}/revize/{id}
 *
 * Chování:
 *   - přidání z číselníku = kopie hodnot (snapshot), pozdější změna číselníku neovlivní
 *   - totéž zařízení lze přidat vícekrát (různé objekty), odlišené poznámkou
 *   - perioda i firma jdou u klienta přepsat
 *   - vlastní revize mimo číselník
 *   - termín se dopočte z periody, nebo se zadá ručně
 *   - číslo protokolu poslední revize
 *
 * Použití: <RevizeKlienta klientId={klientId} />
 */

import { useState, useEffect, useCallback } from 'react';
import {
  collection, addDoc, updateDoc, doc, query, where, getDocs,
} from 'firebase/firestore';
import { db } from '@/components/data-provider';
import { PERIODY, popisPeriody, dopocitejDalsi, platnyTermin } from '@/lib/revize';
import type { CiselnikRevize, Firma, RevizeKlienta as TypRevize } from '@/lib/revize';

interface Props {
  klientId: string;
}

const prazdneNaUndefined = (v: string) => (v.trim() === '' ? undefined : v.trim());
const isoNaDatum = (iso?: string) => (iso ? iso.slice(0, 10) : '');
const datumNaIso = (d: string) => (d ? new Date(d + 'T00:00:00').toISOString() : undefined);

export default function RevizeKlienta({ klientId }: Props) {
  const [seznam, setSeznam] = useState<TypRevize[]>([]);
  const [ciselnik, setCiselnik] = useState<CiselnikRevize[]>([]);
  const [firmy, setFirmy] = useState<Firma[]>([]);
  const [nacitam, setNacitam] = useState(true);
  const [zprava, setZprava] = useState<string | null>(null);
  const [vybrane, setVybrane] = useState('');
  const [rozbaleno, setRozbaleno] = useState<string | null>(null);

  const cesta = useCallback(() => collection(db, 'klienti', klientId, 'revize'), [klientId]);

  const nacti = useCallback(async () => {
    try {
      const [kSnap, cSnap, fSnap] = await Promise.all([
        getDocs(query(cesta(), where('stav', '==', 'aktivni'))),
        getDocs(query(collection(db, 'ciselnikRevizi'), where('stav', '==', 'aktivni'))),
        getDocs(query(collection(db, 'ciselnikFirem'), where('stav', '==', 'aktivni'))),
      ]);
      setSeznam(kSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as TypRevize));
      setCiselnik(cSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as CiselnikRevize)
        .sort((a, b) => a.nazev.localeCompare(b.nazev, 'cs')));
      setFirmy(fSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Firma)
        .sort((a, b) => a.nazev.localeCompare(b.nazev, 'cs')));
    } catch {
      setZprava('Načtení revizí selhalo.');
    } finally {
      setNacitam(false);
    }
  }, [cesta]);

  useEffect(() => { nacti(); }, [nacti]);

  async function pridejZCiselniku() {
    const zdroj = ciselnik.find((c) => c.id === vybrane);
    if (!zdroj) {
      setZprava('Vyber revizi z číselníku.');
      return;
    }
    try {
      await addDoc(cesta(), {
        ciselnikId: zdroj.id,
        nazev: zdroj.nazev,
        periodaMesice: zdroj.periodaMesice,
        provadiFirmaId: zdroj.provadiFirmaId ?? null,
        poznamka: null,
        cisloProtokolu: null,
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

  async function pridejVlastni() {
    try {
      const ref = await addDoc(cesta(), {
        ciselnikId: null,
        nazev: 'Nová revize',
        periodaMesice: 12,
        provadiFirmaId: null,
        poznamka: null,
        cisloProtokolu: null,
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

  async function uprav(id: string, zmeny: Partial<TypRevize>) {
    setSeznam((p) => p.map((r) => (r.id === id ? { ...r, ...zmeny } : r)));
    try {
      const cistec = Object.fromEntries(
        Object.entries(zmeny).map(([k, v]) => [k, v === undefined ? null : v]),
      );
      await updateDoc(doc(db, 'klienti', klientId, 'revize', id), cistec);
    } catch {
      setZprava('Uložení změny selhalo.');
    }
  }

  async function smaz(id: string) {
    setSeznam((p) => p.filter((r) => r.id !== id));
    await updateDoc(doc(db, 'klienti', klientId, 'revize', id), { stav: 'smazano' });
  }

  const firma = (id?: string | null) => firmy.find((f) => f.id === id);
  const formatDatum = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('cs-CZ') : '—');

  if (nacitam) return <div style={S.blok}><p style={S.mute}>Načítám…</p></div>;

  return (
    <div style={S.blok}>
      <h3 style={S.nadpis}>Revize klienta</h3>

      <div style={S.formRadek}>
        <select value={vybrane} onChange={(e) => setVybrane(e.target.value)}
          style={{ ...S.input, flex: 1, minWidth: 220 }}>
          <option value="">Vyber revizi z číselníku…</option>
          {ciselnik.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nazev} ({popisPeriody(c.periodaMesice)})
            </option>
          ))}
        </select>
        <button type="button" onClick={pridejZCiselniku} style={S.tlacitko}>Přidat</button>
        <button type="button" onClick={pridejVlastni} style={S.tlacitkoSekundarni}>+ Vlastní</button>
      </div>
      <p style={S.napoveda}>
        Stejnou revizi lze přidat vícekrát pro různá zařízení či objekty — rozliš je poznámkou.
      </p>

      {seznam.length === 0 && <p style={S.mute}>Klient zatím nemá přiřazené žádné revize.</p>}

      {seznam.map((r) => {
        const termin = platnyTermin(r);
        const otevreno = rozbaleno === r.id;
        const f = firma(r.provadiFirmaId);
        return (
          <div key={r.id} style={S.karta}>
            <div style={S.kartaHlavicka}>
              <button type="button" onClick={() => setRozbaleno(otevreno ? null : r.id)} style={S.rozbalit}>
                {otevreno ? '▾' : '▸'}
              </button>
              <div style={{ flex: 1 }}>
                <div style={S.kartaNazev}>
                  {r.nazev}
                  {r.poznamka && <span style={S.skupina}> — {r.poznamka}</span>}
                  {!r.ciselnikId && <span style={S.vlastniStitek}>vlastní</span>}
                </div>
                <div style={S.kartaMeta}>
                  {popisPeriody(r.periodaMesice)} · {f?.nazev ?? 'firma neurčena'} ·
                  {' další: '}<strong>{formatDatum(termin)}</strong>
                  {r.dalsiRucne && <span style={S.rucneStitek}>ručně</span>}
                </div>
                {r.cisloProtokolu && (
                  <div style={S.protokol}>protokol {r.cisloProtokolu}</div>
                )}
                {f && (f.telefon || f.email) && (
                  <div style={S.kontakt}>
                    {f.telefon && <a href={`tel:${f.telefon}`} style={S.odkaz}>{f.telefon}</a>}
                    {f.telefon && f.email && <span style={S.oddelovac}>·</span>}
                    {f.email && <a href={`mailto:${f.email}`} style={S.odkaz}>{f.email}</a>}
                  </div>
                )}
              </div>
              <button type="button" onClick={() => smaz(r.id)} style={S.tlacitkoSmazat}>×</button>
            </div>

            {otevreno && (
              <div style={S.detail}>
                <label style={S.label}>
                  Název
                  <input type="text" value={r.nazev}
                    onChange={(e) => uprav(r.id, { nazev: e.target.value })} style={S.input} />
                </label>

                <div style={S.dvojice}>
                  <label style={{ ...S.label, flex: 1 }}>
                    Poznámka / zařízení
                    <input type="text" value={r.poznamka ?? ''}
                      onChange={(e) => uprav(r.id, { poznamka: prazdneNaUndefined(e.target.value) })}
                      placeholder="např. hala B — rozvaděč RH2" style={S.input} />
                  </label>
                  <label style={{ ...S.label, flex: 1 }}>
                    Číslo protokolu
                    <input type="text" value={r.cisloProtokolu ?? ''}
                      onChange={(e) => uprav(r.id, { cisloProtokolu: prazdneNaUndefined(e.target.value) })}
                      placeholder="např. HR-2025/14" style={S.input} />
                  </label>
                </div>

                <div style={S.dvojice}>
                  <label style={{ ...S.label, flex: 1 }}>
                    Perioda
                    <select value={r.periodaMesice}
                      onChange={(e) => {
                        const perioda = Number(e.target.value);
                        const novyDalsi = r.dalsiRucne
                          ? r.dalsiIso
                          : dopocitejDalsi(r.posledniIso, perioda);
                        uprav(r.id, { periodaMesice: perioda, dalsiIso: novyDalsi });
                      }}
                      style={S.input}>
                      {PERIODY.map((p) => <option key={p.hodnota} value={p.hodnota}>{p.popis}</option>)}
                    </select>
                  </label>
                  <label style={{ ...S.label, flex: 1 }}>
                    Provádí firma
                    <select value={r.provadiFirmaId ?? ''}
                      onChange={(e) => uprav(r.id, { provadiFirmaId: prazdneNaUndefined(e.target.value) })}
                      style={S.input}>
                      <option value="">neurčeno</option>
                      {firmy.map((x) => <option key={x.id} value={x.id}>{x.nazev}</option>)}
                    </select>
                  </label>
                </div>

                <div style={S.dvojice}>
                  <label style={{ ...S.label, flex: 1 }}>
                    Poslední revize
                    <input type="date" value={isoNaDatum(r.posledniIso)}
                      onChange={(e) => {
                        const posledni = datumNaIso(e.target.value);
                        const novyDalsi = r.dalsiRucne
                          ? r.dalsiIso
                          : dopocitejDalsi(posledni, r.periodaMesice);
                        uprav(r.id, { posledniIso: posledni, dalsiIso: novyDalsi });
                      }}
                      style={S.input} />
                  </label>
                  <label style={{ ...S.label, flex: 1 }}>
                    Další termín
                    <input type="date" value={isoNaDatum(termin)}
                      onChange={(e) => uprav(r.id, {
                        dalsiIso: datumNaIso(e.target.value), dalsiRucne: true,
                      })}
                      style={S.input} />
                  </label>
                </div>

                {r.dalsiRucne && (
                  <button type="button"
                    onClick={() => uprav(r.id, {
                      dalsiRucne: false,
                      dalsiIso: dopocitejDalsi(r.posledniIso, r.periodaMesice),
                    })}
                    style={S.tlacitkoZpet}>
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
  tlacitkoZpet: { background: 'transparent', color: '#2F5FD0', border: '1px solid #E4E4DD', borderRadius: 8, padding: '7px 12px', fontSize: 13, cursor: 'pointer', marginTop: 10, alignSelf: 'flex-start' },
  karta: { border: '1px solid #E4E4DD', borderRadius: 10, marginTop: 10, overflow: 'hidden' },
  kartaHlavicka: { display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', background: '#FBFBF9' },
  kartaNazev: { fontSize: 14, fontWeight: 600, color: '#0F2038' },
  kartaMeta: { fontSize: 12, color: '#6B7280', marginTop: 3 },
  protokol: { fontSize: 12, color: '#888780', marginTop: 2 },
  kontakt: { fontSize: 12, marginTop: 4, display: 'flex', gap: 6, flexWrap: 'wrap' },
  odkaz: { color: '#2F5FD0', textDecoration: 'none' },
  oddelovac: { color: '#6B7280' },
  skupina: { fontWeight: 400, color: '#6B7280' },
  vlastniStitek: { marginLeft: 8, fontSize: 11, background: '#E6F1FB', color: '#185FA5', padding: '2px 7px', borderRadius: 10, fontWeight: 500 },
  rucneStitek: { marginLeft: 6, fontSize: 11, background: '#F1EFE8', color: '#6B7280', padding: '1px 6px', borderRadius: 8 },
  rozbalit: { background: 'transparent', border: 'none', color: '#6B7280', fontSize: 14, cursor: 'pointer', padding: 0, width: 16, flexShrink: 0, marginTop: 2 },
  detail: { padding: '14px', borderTop: '1px solid #E4E4DD', display: 'flex', flexDirection: 'column', gap: 12 },
  label: { display: 'block', fontSize: 13, color: '#0F2038', fontWeight: 500 },
  dvojice: { display: 'flex', gap: 12, flexWrap: 'wrap' },
  mute: { fontSize: 13, color: '#6B7280', margin: '8px 0 0' },
  chyba: { fontSize: 13, color: '#C0392B', marginTop: 12 },
};
