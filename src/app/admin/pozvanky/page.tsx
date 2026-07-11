// src/app/admin/pozvanky/page.tsx
// Admin stranka pro pozvanky. Klienty bere z DataProvideru (uz nactene se spravnou
// izolaci), takze nic nenacita sama. Zobrazi se jen adminovi.
"use client";

import { useData } from "@/components/data-provider";
import VytvoritPozvanku, {
  KlientProUI,
} from "@/components/VytvoritPozvanku";

export default function AdminPozvankyPage() {
  const { user, userProfile, authLoading, klienti } = useData();

  if (authLoading)
    return <div className="p-8 text-slate-600">Načítám…</div>;

  if (!user || !userProfile)
    return <div className="p-8 text-slate-600">Nejste přihlášeni.</div>;

  if (userProfile.role !== "admin")
    return (
      <div className="p-8 text-slate-600">
        Tato sekce je jen pro administrátora.
      </div>
    );

  // mapovani na tvar, ktery ceka VytvoritPozvanku
  const klientiProUI: KlientProUI[] = klienti
    .map((k) => ({
      id: k.id,
      nazev: k.nazev ?? "(bez názvu)",
      kontakty: (k.kontakty ?? []).map((c) => ({
        id: c.id,
        jmeno: c.jmeno,
        email: c.email,
        funkce: c.funkce,
      })),
      odpovedneOsoby: (k.odpovedneOsoby ?? []).map((o) => ({
        id: o.id ?? "",
        jmeno: o.jmeno,
        funkce: o.funkce ?? o.pozice,
      })),
    }))
    .sort((a, b) => a.nazev.localeCompare(b.nazev, "cs"));

  return (
    <div className="max-w-2xl mx-auto p-6 md:p-8">
      <h1 className="text-2xl font-black tracking-tight mb-2">
        Pozvánky do AuditFlow
      </h1>
      <p className="text-sm text-slate-500 mb-8">
        Vyber klienta a osobu. Osoba dostane e-mailem odkaz pro dokončení účtu.
      </p>
      <VytvoritPozvanku klienti={klientiProUI} />
    </div>
  );
}
