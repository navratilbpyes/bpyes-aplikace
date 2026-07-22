'use client';

import React, { useState, useMemo } from 'react';
import {
  dniDo, sklonDny, sestavCasovyPlan, spoctiMetriky, spoctiMetrikyBasic,
  tonZMetrik, tonBasic, seznamOdpovednychOsob,
} from './transform';
import {
  DNES, MOCK_TERMINY, MOCK_NEDOSTATKY, MOCK_ZAZNAMY, MOCK_NAVSTEVY, MOCK_DOTAZY,
} from './mock';
import type {
  Metriky, MetrikyBasic, PolozkaCasovehoPlanu, Navsteva, Dotaz, UrovenKlienta,
} from '../../types/dashboard';

// ── Design tokeny (BPyes) ──
const C = {
  navy: '#0F2038', accent: '#2F5FD0', paper: '#FBFBF9',
  red: '#C0392B', amber: '#D9820A', okgreen: '#4A7A5C',
  line: '#E4E4DD', muted: '#6B7280', faint: '#888780',
  redBg: '#FCEBEB', blueBg: '#E6F1FB', chipBg: '#F1EFE8',
} as const;

const barvaNal: Record<string, string> = { po_terminu: C.red, blizi_se: C.amber, ok: C.okgreen };
const ikonaTyp: Record<string, string> = { revize: '⚡', skoleni: '🪑', nalez: '🛡' };

const disp: React.CSSProperties = { fontFamily: "'Space Grotesk', system-ui, sans-serif" };
const card: React.CSSProperties = { background: '#fff', border: `1px solid ${C.line}`, borderRadius: 12 };

const HLASKY = {
  ok: [
    'Všechno v pořádku. Nejbližší problém je ten zapomenutý jogurt v lednici.',
    'Čistý stůl. Kontrola by nenašla, o co zakopnout.',
    'Žádné resty. Tohle je ten vzácný stav, kdy BOZP nikoho netrápí.',
  ],
  soon: [
    'Pár věcí klepe na dveře. Zatím zdvořile.',
    'Do dvou týdnů něco čeká. Klidně to stihnete, když to nenecháte na poslední den.',
  ],
  critical: [
    'Revize hromosvodu propadla před pár dny. To se neodkládá.',
    'Máte otevřené resty po lhůtě. Začněte tím červeným nahoře.',
  ],
} as const;

// ── Komponenty ──
function StavovySignal({ ton, hlaska }: { ton: 'ok' | 'soon' | 'critical'; hlaska: string }) {
  const okraj = ton === 'critical' ? C.red : ton === 'soon' ? C.amber : C.okgreen;
  const popis = ton === 'ok' ? 'Vše v pořádku' : ton === 'soon' ? 'Blíží se termíny' : 'Vyžaduje pozornost';
  return (
    <section style={{ ...card, borderLeft: `6px solid ${okraj}`, padding: '20px 24px' }}>
      <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.muted, marginBottom: 6 }}>{popis}</div>
      <div style={{ ...disp, fontSize: 21, fontWeight: 600, color: C.navy, lineHeight: 1.3 }}>{hlaska}</div>
    </section>
  );
}

function Teplomer({ metriky }: { metriky: Metriky }) {
  const items = [
    { n: metriky.do14dni, l: 'termíny do 14 dní', hot: false },
    { n: metriky.otevreneNalezy, l: 'otevřené nálezy', hot: false },
    { n: metriky.poTerminu, l: 'po termínu', hot: metriky.poTerminu > 0 },
    { n: metriky.nevyrizeneDotazy, l: 'nevyřízené dotazy', hot: metriky.nevyrizeneDotazy > 0 },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
      {items.map((it, i) => (
        <div key={i} style={{ ...card, padding: 14 }}>
          <div style={{ ...disp, fontSize: 26, fontWeight: 700, color: it.hot ? C.red : C.navy, lineHeight: 1 }}>{it.n}</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{it.l}</div>
        </div>
      ))}
    </div>
  );
}

function TeplomerBasic({ metriky }: { metriky: MetrikyBasic }) {
  const items = [
    { n: metriky.otevreneNalezy, l: 'otevřené nálezy', hot: metriky.otevreneNalezy > 0 },
    { n: metriky.nevyrizeneDotazy, l: 'nevyřízené dotazy', hot: metriky.nevyrizeneDotazy > 0 },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
      {items.map((it, i) => (
        <div key={i} style={{ ...card, padding: 14 }}>
          <div style={{ ...disp, fontSize: 26, fontWeight: 700, color: it.hot ? C.red : C.navy, lineHeight: 1 }}>{it.n}</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{it.l}</div>
        </div>
      ))}
    </div>
  );
}

function Chip({ aktivni, onClick, children }: { aktivni: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      background: aktivni ? C.navy : C.chipBg, color: aktivni ? '#fff' : C.navy,
      border: 'none', padding: '5px 12px', borderRadius: 16, fontSize: 12, cursor: 'pointer',
    }}>{children}</button>
  );
}

function CasovyPlan({ polozky, osoby }: { polozky: PolozkaCasovehoPlanu[]; osoby: string[] }) {
  const [filtrTyp, setFiltrTyp] = useState('vse');
  const [predvolba, setPredvolba] = useState<null | 'mesic' | 'kvartal'>(null);
  const [osoba, setOsoba] = useState('vse');

  const zobraz = useMemo(() => polozky.filter((p) => {
    if (filtrTyp === 'po_terminu' && p.naliehavost !== 'po_terminu') return false;
    if (['revize', 'skoleni', 'nalez'].includes(filtrTyp) && p.typ !== filtrTyp) return false;
    if (osoba !== 'vse' && p.odpovednaOsoba !== osoba) return false;
    if (predvolba && p.terminIso) {
      const d = dniDo(p.terminIso, DNES);
      if (predvolba === 'mesic' && !(d >= 0 && d <= 31)) return false;
      if (predvolba === 'kvartal' && !(d >= 0 && d <= 92)) return false;
    }
    return true;
  }), [polozky, filtrTyp, predvolba, osoba]);

  const TYPY: [string, string][] = [['vse', 'vše'], ['po_terminu', 'po termínu'], ['revize', 'revize'], ['nalez', 'nálezy'], ['skoleni', 'školení']];

  return (
    <section style={{ ...card, padding: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ ...disp, fontWeight: 600, fontSize: 16, color: C.navy }}>Časový plán</div>
        <button onClick={() => window.print()} style={{ background: C.navy, color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 13, cursor: 'pointer' }}>Tisk ToDo ↗</button>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {TYPY.map(([k, l]) => <Chip key={k} aktivni={filtrTyp === k} onClick={() => setFiltrTyp(k)}>{l}</Chip>)}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8, alignItems: 'center' }}>
        <Chip aktivni={predvolba === 'mesic'} onClick={() => setPredvolba(predvolba === 'mesic' ? null : 'mesic')}>tento měsíc</Chip>
        <Chip aktivni={predvolba === 'kvartal'} onClick={() => setPredvolba(predvolba === 'kvartal' ? null : 'kvartal')}>tento kvartál</Chip>
        <select value={osoba} onChange={(e) => setOsoba(e.target.value)} style={{ marginLeft: 4, border: `1px solid ${C.line}`, borderRadius: 16, padding: '5px 10px', fontSize: 12, color: C.navy, background: '#fff', cursor: 'pointer' }}>
          <option value="vse">Odpovědná osoba: vše</option>
          {osoby.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>

      <div>
        {zobraz.length === 0 && (
          <div style={{ padding: '24px 0', textAlign: 'center', color: C.muted, fontSize: 14 }}>Nic k zobrazení pro zvolený filtr.</div>
        )}
        {zobraz.map((p) => (
          <div key={p.id} style={{ display: 'flex', gap: 12, padding: '12px 0 12px 12px', borderTop: `1px solid ${C.line}`, borderLeft: `3px solid ${barvaNal[p.naliehavost]}` }}>
            <div style={{ fontSize: 18, color: barvaNal[p.naliehavost] }}>{ikonaTyp[p.typ]}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, color: C.navy }}>{p.nazev}</div>
              {p.meta && <div style={{ fontSize: 12, color: C.muted }}>{p.meta}</div>}
              {p.zdroj && <div style={{ fontSize: 12, color: C.faint }}>{p.zdroj}</div>}
            </div>
            <div style={{ fontSize: 12, color: barvaNal[p.naliehavost], fontWeight: 600, whiteSpace: 'nowrap' }}>{p.stitek}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.line}`, fontSize: 11, color: C.muted }}>
        <span>⚡ revize</span><span>🛡 nález</span><span>🪑 školení</span>
        <span style={{ marginLeft: 'auto' }}>🔴 po termínu · 🟠 blíží se · 🟢 v pořádku</span>
      </div>
    </section>
  );
}

function RadekNavstevy({ navsteva }: { navsteva?: Navsteva }) {
  if (!navsteva) return null;
  const d = dniDo(navsteva.datumIso, DNES);
  const datum = new Date(navsteva.datumIso).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <section style={{ background: C.navy, color: C.paper, borderRadius: 12, padding: '18px 24px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
      <div style={{ fontSize: 22 }}>🦺</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.7, marginBottom: 4 }}>Termín další návštěvy bezpečáka</div>
        <div style={{ ...disp, fontSize: 18, fontWeight: 600 }}>{datum} · za {d} {sklonDny(d)}</div>
        {navsteva.poznamka && <div style={{ fontSize: 13, opacity: 0.8, marginTop: 2 }}>{navsteva.poznamka}</div>}
      </div>
    </section>
  );
}

function Dotazy({ dotazy }: { dotazy: Dotaz[] }) {
  const nevyrizene = dotazy.filter((d) => d.stav === 'nevyrizeno').length;
  return (
    <div style={{ ...card, padding: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ ...disp, fontWeight: 600, color: C.navy }}>Dotazy</div>
        {nevyrizene > 0 && <span style={{ background: C.redBg, color: C.red, fontSize: 12, padding: '3px 10px', borderRadius: 12 }}>{nevyrizene} nevyřízený</span>}
      </div>
      {dotazy.map((d) => (
        <div key={d.id} style={{ borderBottom: `1px solid ${C.line}`, paddingBottom: 10, marginBottom: 10 }}>
          <div style={{ fontSize: 13, color: C.navy, display: 'flex', gap: 6, alignItems: 'baseline' }}>
            {d.stav === 'nevyrizeno' && <span style={{ width: 7, height: 7, borderRadius: '50%', background: C.red, flexShrink: 0 }} />}
            {d.text}
          </div>
          <div style={{ fontSize: 11, color: C.faint, marginTop: 3 }}>{d.autor.kdo} · {new Date(d.vytvoreno).toLocaleDateString('cs-CZ')}</div>
        </div>
      ))}
      <button style={{ background: C.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer' }}>Nový dotaz</button>
    </div>
  );
}

function Dokumentace() {
  const soubory = ['Protokol_HR-2025-14.pdf', 'Kontrola_BOZP_3-2026.pdf', 'Skoleni_PP_2024.pdf'];
  return (
    <div style={{ ...card, padding: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ ...disp, fontWeight: 600, color: C.navy }}>Dokumentace</div>
        <span style={{ background: C.blueBg, color: '#185FA5', fontSize: 12, padding: '3px 10px', borderRadius: 12 }}>zrcadlo Disku</span>
      </div>
      {soubory.map((s) => (
        <div key={s} style={{ fontSize: 13, color: C.navy, borderBottom: `1px solid ${C.line}`, paddingBottom: 8, marginBottom: 8 }}>📄 {s}</div>
      ))}
      <button style={{ background: '#fff', color: C.navy, border: `1px solid ${C.line}`, borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer', marginTop: 2 }}>Nahrát PDF</button>
    </div>
  );
}

function Rozcestnik() {
  const dlazdice = [
    { ik: '🛡', t: 'Reporty z kontrol', s: '3 otevřené nálezy · 5 protokolů', hot: false },
    { ik: '⚡', t: 'Termíny revizí', s: '1 po termínu · 2 do 14 dní', hot: true },
    { ik: '🪑', t: 'Termíny školení', s: 'nejbližší za 3 měsíce', hot: false },
    { ik: '📁', t: 'Dokumentace', s: 'zrcadlo Disku · 12 souborů', hot: false },
  ];
  return (
    <>
      <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.muted }}>Detailní přehledy</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        {dlazdice.map((d) => (
          <a key={d.t} href="#" style={{ ...card, padding: 18, textDecoration: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 20, color: C.accent }}>{d.ik}</span>
              <span style={{ color: C.accent }}>↗</span>
            </div>
            <div style={{ ...disp, fontWeight: 600, color: C.navy }}>{d.t}</div>
            <div style={{ fontSize: 13, color: d.hot ? C.red : C.muted }}>{d.s}</div>
          </a>
        ))}
      </div>
    </>
  );
}

function KartaKontakt() {
  return (
    <div style={{ ...card, padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 40, height: 40, borderRadius: '50%', background: C.blueBg, color: '#185FA5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 13, ...disp }}>MN</div>
      <div style={{ flex: 1 }}>
        <div style={{ ...disp, fontWeight: 600, color: C.navy, fontSize: 14 }}>Martin Navrátil</div>
        <div style={{ fontSize: 12, color: C.muted }}>+420 … · martin@bpyes.cz</div>
      </div>
      <button style={{ background: C.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '7px 12px', fontSize: 13, cursor: 'pointer' }}>Napsat dotaz</button>
    </div>
  );
}

function FreeloKontakt() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <a href="#" style={{ ...card, padding: 16, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ ...disp, fontWeight: 600, color: C.navy }}>Otevřít úkoly ve Freelu</span>
        <span style={{ color: C.accent }}>↗</span>
      </a>
      <KartaKontakt />
    </div>
  );
}

// ── Přepínač rolí (jen prototyp; v ostré verzi řídí useProfil().uroven) ──
function Prepinac({ uroven, setUroven }: { uroven: UrovenKlienta; setUroven: (u: UrovenKlienta) => void }) {
  return (
    <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.12)', borderRadius: 8, padding: 3 }}>
      {(['full', 'basic'] as UrovenKlienta[]).map((k) => (
        <button key={k} onClick={() => setUroven(k)} style={{
          background: uroven === k ? '#fff' : 'transparent', color: uroven === k ? C.navy : C.paper,
          border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 500,
        }}>{k === 'full' ? 'Plný klient' : 'Jednorázový'}</button>
      ))}
    </div>
  );
}

function DashboardFull() {
  const metriky = useMemo(() => spoctiMetriky(MOCK_TERMINY, MOCK_ZAZNAMY, MOCK_DOTAZY, DNES), []);
  const polozky = useMemo(() => sestavCasovyPlan(MOCK_TERMINY, MOCK_NEDOSTATKY, MOCK_ZAZNAMY, DNES), []);
  const osoby = useMemo(() => seznamOdpovednychOsob(polozky), [polozky]);
  const hlaska = HLASKY[tonZMetrik(metriky)][0];
  const navsteva = MOCK_NAVSTEVY.find((n) => n.stav === 'aktivni');
  return (
    <main style={{ maxWidth: 1080, margin: '0 auto', padding: '24px 20px 80px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <StavovySignal ton={tonZMetrik(metriky)} hlaska={hlaska} />
      <Teplomer metriky={metriky} />
      <CasovyPlan polozky={polozky} osoby={osoby} />
      <RadekNavstevy navsteva={navsteva} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Dotazy dotazy={MOCK_DOTAZY} />
        <Dokumentace />
      </div>
      <Rozcestnik />
      <FreeloKontakt />
    </main>
  );
}

function StrankaAudit() {
  const metriky = useMemo(() => spoctiMetrikyBasic(MOCK_ZAZNAMY, MOCK_DOTAZY), []);
  const hlaska = HLASKY[tonBasic(metriky)][0];
  const reporty = MOCK_ZAZNAMY.filter((z) => z.stav === 'aktivni');
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '24px 20px 80px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <StavovySignal ton={tonBasic(metriky)} hlaska={hlaska} />
      <TeplomerBasic metriky={metriky} />
      <section style={{ ...card, padding: 18 }}>
        <div style={{ ...disp, fontWeight: 600, fontSize: 16, color: C.navy, marginBottom: 12 }}>Reporty z kontrol</div>
        {reporty.map((z) => (
          <div key={z.id} style={{ padding: '12px 0', borderTop: `1px solid ${C.line}` }}>
            <div style={{ fontWeight: 600, color: C.navy }}>{z.nazev}</div>
            <div style={{ fontSize: 12, color: C.faint }}>{z.zdroj}</div>
          </div>
        ))}
      </section>
      <Dotazy dotazy={MOCK_DOTAZY} />
      <KartaKontakt />
    </main>
  );
}

export default function KlientNahledPage() {
  const [uroven, setUroven] = useState<UrovenKlienta>('full');
  return (
    <div style={{ minHeight: '100vh', background: C.paper, color: C.navy, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <header style={{ background: C.navy, color: C.paper, padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ ...disp, fontWeight: 700, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          AuditFlow <span style={{ background: C.accent, color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 12 }}>BOZP / PO</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Prepinac uroven={uroven} setUroven={setUroven} />
          <div style={{ fontSize: 12, opacity: 0.85 }}>náhled · mock data</div>
        </div>
      </header>
      {uroven === 'full' ? <DashboardFull /> : <StrankaAudit />}
    </div>
  );
}
