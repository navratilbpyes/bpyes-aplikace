'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Loader2, Lock, CheckCircle2 } from 'lucide-react';

function NastavitHesloInner() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') ?? '';

  const [heslo, setHeslo] = useState('');
  const [heslo2, setHeslo2] = useState('');
  const [chyba, setChyba] = useState('');
  const [odesilani, setOdesilani] = useState(false);
  const [hotovo, setHotovo] = useState(false);

  async function odeslat(e: React.FormEvent) {
    e.preventDefault();
    setChyba('');
    if (heslo.length < 8) {
      setChyba('Heslo musí mít alespoň 8 znaků.');
      return;
    }
    if (heslo !== heslo2) {
      setChyba('Hesla se neshodují.');
      return;
    }
    if (!token) {
      setChyba('Chybí platný odkaz. Otevřete prosím odkaz z e-mailu.');
      return;
    }
    setOdesilani(true);
    try {
      const res = await fetch('/api/nastavit-heslo', {
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
            <p className="text-sm text-slate-600">
              Za okamžik vás přesměrujeme na přihlášení…
            </p>
          </div>
        ) : (
          <>
            <div className="text-center space-y-2 mb-6">
              <div className="mx-auto h-12 w-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 mb-2">
                <Lock className="h-6 w-6" />
              </div>
              <h1 className="text-2xl font-black tracking-tight">Nastavení hesla</h1>
              <p className="text-sm text-slate-500">
                Vytvořte si heslo pro přístup do BPyes AuditFlow.
              </p>
            </div>

            <form onSubmit={odeslat} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="heslo">
                  Nové heslo
                </label>
                <input
                  id="heslo"
                  type="password"
                  className="w-full h-11 px-3 rounded-md border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={heslo}
                  onChange={(e) => setHeslo(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="heslo2">
                  Heslo znovu
                </label>
                <input
                  id="heslo2"
                  type="password"
                  className="w-full h-11 px-3 rounded-md border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={heslo2}
                  onChange={(e) => setHeslo2(e.target.value)}
                  autoComplete="new-password"
                />
              </div>

              {chyba && <p className="text-sm text-red-600">{chyba}</p>}

              <button
                type="submit"
                disabled={odesilani}
                className="w-full h-11 rounded-md bg-slate-900 hover:bg-slate-800 text-white font-bold flex items-center justify-center disabled:opacity-60"
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
