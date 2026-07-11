// src/app/pozvanka/page.tsx
"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase"; // tvoje stávající inicializace firebase klienta

function PozvankaInner() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";

  const [stav, setStav] = useState<"nacitani" | "formular" | "neplatna">(
    "nacitani"
  );
  const [duvod, setDuvod] = useState<string>("");
  const [email, setEmail] = useState("");
  const [klientNazev, setKlientNazev] = useState<string | null>(null);
  const [osobaJmeno, setOsobaJmeno] = useState<string | null>(null);
  const [heslo, setHeslo] = useState("");
  const [heslo2, setHeslo2] = useState("");
  const [chyba, setChyba] = useState("");
  const [odesilani, setOdesilani] = useState(false);

  useEffect(() => {
    if (!token) {
      setStav("neplatna");
      setDuvod("notfound");
      return;
    }
    fetch(`/api/pozvanky/overit?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.valid) {
          setEmail(d.email);
          setKlientNazev(d.klientNazev);
          setOsobaJmeno(d.osobaJmeno ?? null);
          setStav("formular");
        } else {
          setDuvod(d.reason ?? "notfound");
          setStav("neplatna");
        }
      })
      .catch(() => {
        setStav("neplatna");
        setDuvod("error");
      });
  }, [token]);

  async function dokoncit() {
    setChyba("");
    if (heslo.length < 8) {
      setChyba("Heslo musí mít alespoň 8 znaků.");
      return;
    }
    if (heslo !== heslo2) {
      setChyba("Hesla se neshodují.");
      return;
    }
    setOdesilani(true);
    try {
      // 1) vytvoř Auth účet v prohlížeči
      const cred = await createUserWithEmailAndPassword(auth, email, heslo);
      const idToken = await cred.user.getIdToken();

      // 2) server dopíše profil (role, klientId) a uzavře pozvánku
      const res = await fetch("/api/pozvanky/prijmout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, idToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        setChyba(data.error ?? "Něco se nepovedlo.");
        // Účet vznikl, ale profil ne – ať to nezůstane v půlce, zkusíme účet smazat
        try {
          await cred.user.delete();
        } catch {}
        setOdesilani(false);
        return;
      }

      // 3) hotovo – uživatel je přihlášený
      router.push("/"); // nebo /dashboard
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Chyba registrace";
      if (msg.includes("email-already-in-use"))
        setChyba("Tento email už je zaregistrovaný. Přihlas se místo toho.");
      else setChyba(msg);
      setOdesilani(false);
    }
  }

  if (stav === "nacitani")
    return <div style={styleWrap}>Ověřuji pozvánku…</div>;

  if (stav === "neplatna") {
    const texty: Record<string, string> = {
      notfound: "Pozvánka nebyla nalezena.",
      expired: "Platnost pozvánky vypršela. Požádej o novou.",
      revoked: "Pozvánka byla zneplatněna.",
      accepted: "Tato pozvánka už byla použita. Přihlas se.",
      error: "Něco se pokazilo. Zkus to prosím znovu.",
    };
    return (
      <div style={styleWrap}>
        <h1 style={styleH1}>Pozvánka neplatná</h1>
        <p>{texty[duvod] ?? texty.notfound}</p>
      </div>
    );
  }

  return (
    <div style={styleWrap}>
      <h1 style={styleH1}>Dokončení účtu</h1>
      {osobaJmeno && (
        <p style={{ marginBottom: 4 }}>
          Jméno: <strong>{osobaJmeno}</strong>
        </p>
      )}
      <p style={{ marginBottom: 4 }}>
        Účet pro: <strong>{email}</strong>
      </p>
      {klientNazev && (
        <p style={{ marginBottom: 20, color: "#888" }}>Firma: {klientNazev}</p>
      )}

      <label style={styleLabel}>Heslo</label>
      <input
        type="password"
        value={heslo}
        onChange={(e) => setHeslo(e.target.value)}
        style={styleInput}
        autoComplete="new-password"
      />

      <label style={styleLabel}>Heslo znovu</label>
      <input
        type="password"
        value={heslo2}
        onChange={(e) => setHeslo2(e.target.value)}
        style={styleInput}
        autoComplete="new-password"
      />

      {chyba && <p style={{ color: "#e00", marginTop: 12 }}>{chyba}</p>}

      <button onClick={dokoncit} disabled={odesilani} style={styleButton}>
        {odesilani ? "Zakládám účet…" : "Vytvořit účet"}
      </button>
    </div>
  );
}

export default function PozvankaPage() {
  return (
    <Suspense fallback={<div style={styleWrap}>Načítám…</div>}>
      <PozvankaInner />
    </Suspense>
  );
}

// Inline styly ať je soubor samostatný; ve svém repu použij Tailwind/shadcn.
const styleWrap: React.CSSProperties = {
  maxWidth: 400,
  margin: "80px auto",
  padding: 24,
  fontFamily: "system-ui, sans-serif",
};
const styleH1: React.CSSProperties = { fontSize: 24, marginBottom: 16 };
const styleLabel: React.CSSProperties = {
  display: "block",
  marginTop: 12,
  marginBottom: 4,
  fontSize: 14,
};
const styleInput: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid #ccc",
  borderRadius: 6,
  boxSizing: "border-box",
};
const styleButton: React.CSSProperties = {
  marginTop: 20,
  width: "100%",
  padding: "10px 16px",
  border: "none",
  borderRadius: 6,
  background: "#111",
  color: "#fff",
  cursor: "pointer",
};
