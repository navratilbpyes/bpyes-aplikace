'use client';

import { useState, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Loader2, Lock, CheckCircle2, Wand2, Copy, Check, X } from 'lucide-react';

// pozadavky na heslo
function vyhodnotit(heslo: string) {
  return {
    delka: heslo.length >= 8,
    male: /[a-z]/.test(heslo),
    velke: /[A-Z]/.test(heslo),
    cislo: /[0-9]/.test(heslo),
    special: /[^A-Za-z0-9]/.test(heslo),
  };
}

function generujHeslo(): string {
  const male = 'abcdefghijkmnpqrstuvwxyz';
  const velke = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const cisla = '23456789';
  const special = '!@#$%&*?-+';
  const vse = male + velke + cisla + special;
  const rand = (s: string) => s[Math.floor((crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32) * s.length)];
  // zajisti aspon jeden z kazde kategorie
  let h = [rand(male), rand(velke), rand(cisla), rand(special)];
  for (let i = 0; i < 10; i++) h.push(rand(vse));
  // zamichej
  for (let i = h.length - 1; i > 0; i--) {
    const j = Math.floor((crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32) * (i + 1));
    [h[i], h[j]] = [h[j], h[i]];
  }
  return h.join('');
}

function NastavitHesloInner() {
  const params = useSearchParams();
  const router = useRouter();
  // Dva režimy:
  //  - oobCode: Firebase reset/pozvánka (3-lite flow) → accounts:resetPassword
  //  - token: starší vlastní token flow (zpětná kompatibilita)
  // Firebase může poslat kód jako ?oobCode= (přímo) i uvnitř mode=resetPassword.
  const oobCode = params.get('oobCode') ?? '';
  const token = params.get('token') ?? '';
  const maOdkaz = !!oobCode || !!token;

  const [heslo, setHeslo] = useState('');
  const [heslo2, setHeslo2] = useState('');
  const [ukazHeslo, setUkazHeslo] = useState(false);
  const [zkopirovano, setZkopirovano] = useState(false);
  const [chyba, setChyba] = useState('');
  const [odesilani, setOdesilani] = useState(false);
  const [hotovo, setHotovo] = useState(false);

  const pozadavky = useMemo(() => vyhodnotit(heslo), [heslo]);
  const splneno = Object.values(pozadavky).filter(Boolean).length;
  const vsePlni = splneno === 5;

  const sila = useMemo(() => {
    if (heslo.length === 0) return { popis: '', barva: '', sirka: 0 };
    if (splneno <= 2) return { popis: 'Slabé', barva: '#dc2626', sirka: 33 };
    if (splneno <= 4) return { popis: 'Střední', barva: '#d97706', sirka: 66 };
    return { popis: 'Silné', barva: '#16a34a', sirka: 100 };
  }, [heslo, splneno]);

  function pouzitGenerovane() {
    const nove = generujHeslo();
    setHeslo(nove);
    setHeslo2(nove);
    setUkazHeslo(true);
    setChyba('');
  }

  async function zkopirovat() {
    try {
      await navigator.clipboard.writeText(heslo);
      setZkopirovano(true);
      setTimeout(() => setZkopirovano(false), 2000);
    } catch {}
  }

  async function odeslat(e: React.FormEvent) {
    e.preventDefault();
    setChyba('');
    if (!vsePlni) {
      setChyba('Heslo nesplňuje všechny požadavky.');
      return;
    }
    if (heslo !== heslo2) {
      setChyba('Hesla se neshodují.');
      return;
    }
    if (!maOdkaz) {
      setChyba('Chybí platný odkaz. Otevřete prosím odkaz z e-mailu.');
      return;
    }
    setOdesilani(true);
    try {
      // oobCode → Firebase reset flow (nová, spolehlivá cesta bez CREDENTIAL_TOO_OLD)
      // token   → starší vlastní flow (zpětná kompatibilita)
      const res = oobCode
        ? await fetch('/api/nastavit-heslo-oob', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ oobCode, heslo }),
          })
        : await fetch('/api/nastavit-heslo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, heslo }),
          });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setChyba(data.error ?? 'Něco se nepovedlo.');
        setOdesilani(false);
        return;
      }
      setHotovo(true);
      setTimeout(() => router.push('/'), 2500);
    } catch {
      setChyba('Chyba spojení. Zkuste to prosím znovu.');
      setOdesilani(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white/95 backdrop-blur shadow-2xl border-none rounded-2xl p-8">
        {hotovo ? (
          <div className="text-center space-y-4">
            <div className="mx-auto h-12 w-12 rounded-2xl bg-green-50 flex items-center justify-center text-green-600">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-black tracking-tight">Heslo nastaveno</h1>
            <p className="text-sm text-slate-600">Za okamžik vás přesměrujeme na přihlášení…</p>
          </div>
        ) : (
          <>
            <div className="text-center space-y-2 mb-6">
              <div className="mx-auto h-12 w-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 mb-2">
                <Lock className="h-6 w-6" />
              </div>
              <h1 className="text-2xl font-black tracking-tight">Nastavení hesla</h1>
              <p className="text-sm text-slate-500">Vytvořte si silné heslo pro přístup do BPyes AuditFlow.</p>
            </div>

            <form onSubmit={odeslat} className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium" htmlFor="heslo">Nové heslo</label>
                  <button
                    type="button"
                    onClick={() => setUkazHeslo((v) => !v)}
                    className="text-xs text-slate-500 hover:text-slate-700"
                  >
                    {ukazHeslo ? 'Skrýt' : 'Zobrazit'}
                  </button>
                </div>
                <div className="relative">
                  <input
                    id="heslo"
                    type={ukazHeslo ? 'text' : 'password'}
                    className="w-full h-11 px-3 pr-10 rounded-md border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={heslo}
                    onChange={(e) => setHeslo(e.target.value)}
                    autoComplete="new-password"
                  />
                  {heslo && (
                    <button
                      type="button"
                      onClick={zkopirovat}
                      title="Kopírovat heslo"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {zkopirovano ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                    </button>
                  )}
                </div>

                {/* indikator sily */}
                {heslo && (
                  <div className="space-y-1">
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${sila.sirka}%`, backgroundColor: sila.barva }}
                      />
                    </div>
                    <p className="text-xs font-medium" style={{ color: sila.barva }}>
                      Síla hesla: {sila.popis}
                    </p>
                  </div>
                )}
              </div>

              {/* generator */}
              <button
                type="button"
                onClick={pouzitGenerovane}
                className="w-full h-10 rounded-md border border-blue-200 bg-blue-50 text-blue-700 text-sm font-medium flex items-center justify-center hover:bg-blue-100"
              >
                <Wand2 className="h-4 w-4 mr-2" /> Vygenerovat silné heslo
              </button>

              {/* checklist pozadavku */}
              <ul className="space-y-1 text-sm">
                <Pozadavek splneno={pozadavky.delka} text="Alespoň 8 znaků" />
                <Pozadavek splneno={pozadavky.male} text="Malé písmeno (a–z)" />
                <Pozadavek splneno={pozadavky.velke} text="Velké písmeno (A–Z)" />
                <Pozadavek splneno={pozadavky.cislo} text="Číslice (0–9)" />
                <Pozadavek splneno={pozadavky.special} text="Speciální znak (!@#…)" />
              </ul>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="heslo2">Heslo znovu</label>
                <input
                  id="heslo2"
                  type={ukazHeslo ? 'text' : 'password'}
                  className="w-full h-11 px-3 rounded-md border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={heslo2}
                  onChange={(e) => setHeslo2(e.target.value)}
                  autoComplete="new-password"
                />
                {heslo2 && heslo !== heslo2 && (
                  <p className="text-xs text-red-600">Hesla se neshodují.</p>
                )}
              </div>

              {chyba && <p className="text-sm text-red-600">{chyba}</p>}

              <button
                type="submit"
                disabled={odesilani || !vsePlni || heslo !== heslo2}
                className="w-full h-11 rounded-md bg-slate-900 hover:bg-slate-800 text-white font-bold flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {odesilani ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Nastavit heslo a vstoupit
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

function Pozadavek({ splneno, text }: { splneno: boolean; text: string }) {
  return (
    <li className={`flex items-center gap-2 ${splneno ? 'text-green-700' : 'text-slate-400'}`}>
      {splneno ? <Check className="h-4 w-4 shrink-0" /> : <X className="h-4 w-4 shrink-0" />}
      {text}
    </li>
  );
}

export default function NastavitHesloPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
          Načítám…
        </div>
      }
    >
      <NastavitHesloInner />
    </Suspense>
  );
}
