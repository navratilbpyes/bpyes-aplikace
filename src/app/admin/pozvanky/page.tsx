// src/app/admin/pozvanky/page.tsx
// Admin stranka: overi, ze jsi prihlaseny admin, nacte klienty z Firestore
// (vcetne kontakty[] a odpovedneOsoby) a preda je komponente VytvoritPozvanku.
"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase"; // uprav dle sveho firebase initu
import VytvoritPozvanku, {
  KlientProUI,
} from "@/components/VytvoritPozvanku";

type Stav = "nacitani" | "neprihlasen" | "neni-admin" | "ok";

export default function AdminPozvankyPage() {
  const [stav, setStav] = useState<Stav>("nacitani");
  const [klienti, setKlienti] = useState<KlientProUI[]>([]);
  const [chyba, setChyba] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setStav("neprihlasen");
        return;
      }
      try {
        // over roli admin
        const profilSnap = await getDoc(doc(db, "uzivatele", user.uid));
        if (!profilSnap.exists() || profilSnap.data().role !== "admin") {
          setStav("neni-admin");
          return;
        }

        // nacti vsechny klienty s poli kontakty[] a odpovedneOsoby
        const snap = await getDocs(collection(db, "klienti"));
        const list: KlientProUI[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            nazev: (data.nazev as string) ?? "(bez nazvu)",
            kontakty: (data.kontakty as KlientProUI["kontakty"]) ?? [],
            odpovedneOsoby:
              (data.odpovedneOsoby as KlientProUI["odpovedneOsoby"]) ?? [],
          };
        });
        // serad podle nazvu
        list.sort((a, b) => a.nazev.localeCompare(b.nazev, "cs"));

        setKlienti(list);
        setStav("ok");
      } catch (e) {
        console.error(e);
        setChyba("Nepodarilo se nacist klienty.");
        setStav("ok"); // ukaz komponentu i tak (prazdny seznam)
      }
    });
    return () => unsub();
  }, []);

  if (stav === "nacitani")
    return <div style={wrap}>Nacitam…</div>;
  if (stav === "neprihlasen")
    return (
      <div style={wrap}>
        <h1>Pozvanky</h1>
        <p>Nejste prihlaseni.</p>
      </div>
    );
  if (stav === "neni-admin")
    return (
      <div style={wrap}>
        <h1>Pozvanky</h1>
        <p>Tato sekce je jen pro administratora.</p>
      </div>
    );

  return (
    <div style={wrap}>
      <h1 style={{ marginBottom: 24 }}>Pozvanky do AuditFlow</h1>
      {chyba && <p style={{ color: "#e00" }}>{chyba}</p>}
      <VytvoritPozvanku klienti={klienti} />
    </div>
  );
}

const wrap: React.CSSProperties = {
  maxWidth: 640,
  margin: "40px auto",
  padding: 24,
  fontFamily: "system-ui, sans-serif",
};
