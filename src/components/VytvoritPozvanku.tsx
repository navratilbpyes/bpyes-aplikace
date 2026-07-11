// src/components/VytvoritPozvanku.tsx
// Admin: vyber klienta -> vyber osobu (kontakty + odpovedneOsoby) -> email se predvyplni.
"use client";

import { useMemo, useState } from "react";
import { auth } from "@/lib/firebase";

// Typy odpovidaji strukture v kolekci `klienti`
interface Kontakt {
  id: string;
  jmeno?: string;
  email?: string;
  funkce?: string;
}
interface OdpovednaOsoba {
  id: string;
  jmeno?: string;
  funkce?: string;
}
export interface KlientProUI {
  id: string;
  nazev: string;
  kontakty?: Kontakt[];
  odpovedneOsoby?: OdpovednaOsoba[];
}

// sjednocena polozka pro dropdown osob
interface OsobaVolba {
  key: string;         // unikatni klic pro <option>
  osobaId: string;
  osobaTyp: "kontakt" | "odpovednaOsoba";
  jmeno: string;
  email: string;       // predvyplneny email (u odpovedne osoby casto prazdny)
  popis: string;       // co ukazat v seznamu
}

export default function VytvoritPozvanku({
  klienti,
}: {
  klienti: KlientProUI[]; // nacti z Firestore (vcetne kontakty[] a odpovedneOsoby)
}) {
  const [klientId, setKlientId] = useState("");
  const [osobaKey, setOsobaKey] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("firma");
  const [vysledek, setVysledek] = useState("");
  const [link, setLink] = useState("");
  const [odesilani, setOdesilani] = useState(false);

  const klient = klienti.find((k) => k.id === klientId);

  // sjednoceny seznam osob daneho klienta
  const osoby: OsobaVolba[] = useMemo(() => {
    if (!klient) return [];
    const zKontaktu: OsobaVolba[] = (klient.kontakty ?? []).map((k) => ({
      key: `kontakt:${k.id}`,
      osobaId: k.id,
      osobaTyp: "kontakt",
      jmeno: k.jmeno ?? "(bez jmena)",
      email: k.email ?? "",
      popis: `${k.jmeno ?? "(bez jmena)"}${k.funkce ? " – " + k.funkce : ""} [kontakt]`,
    }));
    const zOdpovednych: OsobaVolba[] = (klient.odpovedneOsoby ?? []).map((o) => ({
      key: `odpovednaOsoba:${o.id}`,
      osobaId: o.id,
      osobaTyp: "odpovednaOsoba",
      jmeno: o.jmeno ?? "(bez jmena)",
      email: "", // odpovedna osoba nema email -> zada se rucne
      popis: `${o.jmeno ?? "(bez jmena)"}${o.funkce ? " – " + o.funkce : ""} [odpovedna osoba]`,
    }));
    return [...zKontaktu, ...zOdpovednych];
  }, [klient]);

  function vyberOsobu(key: string) {
    setOsobaKey(key);
    const o = osoby.find((x) => x.key === key);
    // predvyplni email z kontaktu; u odpovedne osoby nechame co je / prazdne
    if (o && o.email) setEmail(o.email);
  }

  async function odeslat() {
    setVysledek("");
    setLink("");
    const osoba = osoby.find((o) => o.key === osobaKey);
    if (!klientId || !osoba) {
      setVysledek("Vyber klienta i osobu.");
      return;
    }
    if (!email) {
      setVysledek("Doplnu email (u odpovedne osoby neni predvyplneny).");
      return;
    }
    setOdesilani(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/pozvanky/vytvorit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          email,
          klientId,
          osobaId: osoba.osobaId,
          osobaTyp: osoba.osobaTyp,
          role,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setVysledek(data.error ?? "Chyba.");
      } else {
        setVysledek(`Pozvanka pro ${osoba.jmeno} vytvorena a odeslana.`);
        setLink(data.link);
        setOsobaKey("");
        setEmail("");
      }
    } catch {
      setVysledek("Chyba spojeni.");
    } finally {
      setOdesilani(false);
    }
  }

  return (
    <div style={{ maxWidth: 520 }}>
      <h2>Nova pozvanka</h2>

      <label style={lbl}>Klient</label>
      <select
        value={klientId}
        onChange={(e) => {
          setKlientId(e.target.value);
          setOsobaKey("");
          setEmail("");
        }}
        style={inp}
      >
        <option value="">— vyber klienta —</option>
        {klienti.map((k) => (
          <option key={k.id} value={k.id}>
            {k.nazev}
          </option>
        ))}
      </select>

      {klient && (
        <>
          <label style={lbl}>Osoba</label>
          <select
            value={osobaKey}
            onChange={(e) => vyberOsobu(e.target.value)}
            style={inp}
          >
            <option value="">— vyber osobu —</option>
            {osoby.map((o) => (
              <option key={o.key} value={o.key}>
                {o.popis}
              </option>
            ))}
          </select>
          {osoby.length === 0 && (
            <p style={{ fontSize: 13, color: "#888" }}>
              Tento klient nema zadne kontakty ani odpovedne osoby.
            </p>
          )}
        </>
      )}

      <label style={lbl}>Email</label>
      <input
        placeholder="email@klienta.cz"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={inp}
      />

      <label style={lbl}>Role</label>
      <select value={role} onChange={(e) => setRole(e.target.value)} style={inp}>
        <option value="firma">firma</option>
        <option value="manazer">manazer</option>
      </select>

      <button onClick={odeslat} disabled={odesilani} style={btn}>
        {odesilani ? "Odesilam…" : "Vytvorit a odeslat"}
      </button>

      {vysledek && <p style={{ marginTop: 12 }}>{vysledek}</p>}
      {link && (
        <p style={{ marginTop: 8, fontSize: 13 }}>
          Odkaz k rucni kopii:{" "}
          <code style={{ wordBreak: "break-all" }}>{link}</code>
        </p>
      )}
    </div>
  );
}

const lbl: React.CSSProperties = {
  display: "block",
  marginTop: 12,
  marginBottom: 4,
  fontSize: 14,
};
const inp: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "8px 10px",
  border: "1px solid #ccc",
  borderRadius: 6,
  boxSizing: "border-box",
};
const btn: React.CSSProperties = {
  marginTop: 16,
  padding: "10px 16px",
  border: "none",
  borderRadius: 6,
  background: "#111",
  color: "#fff",
  cursor: "pointer",
};
