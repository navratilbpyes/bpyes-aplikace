'use client';

import { useData } from "@/components/data-provider";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRouter, useSearchParams } from "next/navigation";
import { FileText, Search, Plus, Filter, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState, Suspense } from "react";
import Link from "next/link";
import { cn } from "@/app/lib/utils";

function ZaznamyList() {
  const { zaznamy, klienti, userProfile } = useData();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialFilter = searchParams.get('filter') || 'all';

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState(initialFilter);

  const isAdmin = userProfile?.role === 'admin';

  const filtered = zaznamy.filter(z => {
     if(search && !z.cislo.toLowerCase().includes(search.toLowerCase())) return false;
     if(filter === 'open' && z.stav === 'uzavreny') return false;
     if(filter === 'month') {
        if (!z.datum) return false;
        const d = new Date(z.datum);
        const now = new Date();
        if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) return false;
     }
     return true;
  });

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Databáze reportů</h1>
          <p className="text-muted-foreground">Kompletní přehled provedených auditů a kontrol.</p>
        </div>
        {isAdmin && (
          <Button asChild className="bg-slate-900 hover:bg-slate-800 font-bold shrink-0 shadow-sm">
            <Link href="/nova-kontrola"><Plus className="mr-2 h-4 w-4" /> Nová kontrola</Link>
          </Button>
        )}
      </div>

      <Card className="border-none shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b pb-4">
           <div className="flex flex-col md:flex-row justify-between gap-4">
             <div className="relative flex-1 max-w-md">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
               <Input placeholder="Hledat podle čísla zprávy..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-10 bg-white" />
             </div>
             <div className="flex bg-slate-100 p-1 rounded-lg shrink-0">
                <button onClick={() => setFilter('all')} className={cn("px-4 py-1.5 text-xs font-bold rounded-md transition-all", filter === 'all' ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700")}>Všechny</button>
                <button onClick={() => setFilter('open')} className={cn("px-4 py-1.5 text-xs font-bold rounded-md transition-all", filter === 'open' ? "bg-white shadow-sm text-amber-700" : "text-slate-500 hover:text-slate-700")}>V řešení</button>
                <button onClick={() => setFilter('month')} className={cn("px-4 py-1.5 text-xs font-bold rounded-md transition-all", filter === 'month' ? "bg-white shadow-sm text-blue-700" : "text-slate-500 hover:text-slate-700")}>Tento měsíc</button>
             </div>
           </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-white text-[10px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">Číslo zprávy</th>
                  {isAdmin && <th className="px-6 py-4">Kontrolovaný subjekt</th>}
                  <th className="px-6 py-4">Typ kontroly</th>
                  <th className="px-6 py-4">Datum provedení</th>
                  <th className="px-6 py-4">Stav řešení</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length > 0 ? (
                  filtered.map(z => (
                    <tr key={z.id} className="hover:bg-blue-50/50 cursor-pointer transition-colors bg-white" onClick={() => router.push(`/zaznamy/${z.id}`)}>
                      <td className="px-6 py-4 font-bold text-blue-700 flex items-center gap-2">
                        <FileText className="h-4 w-4 text-blue-400" /> {z.cislo} 
                        <span className="text-muted-foreground font-normal text-xs ml-1">R{z.revize || 0}</span>
                      </td>
                      {isAdmin && <td className="px-6 py-4 font-medium text-slate-900">{klienti.find(k => k.id === z.klientId)?.nazev || 'Neznámý klient'}</td>}
                      <td className="px-6 py-4 text-slate-600 font-medium">{z.typKontroly}</td>
                      <td className="px-6 py-4 text-slate-600">{z.datum ? new Date(z.datum).toLocaleDateString('cs-CZ') : '-'}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide border ${z.stav === 'uzavreny' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                          {z.stav === 'uzavreny' ? 'Uzavřeno' : 'V řešení'}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={isAdmin ? 5 : 4} className="px-6 py-16 text-center text-slate-500">
                      <div className="flex flex-col items-center gap-2">
                        <Filter className="h-8 w-8 text-slate-300" />
                        <p className="font-medium">Nenalezeny žádné záznamy odpovídající filtru.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={<div className="p-8 text-center flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600"/></div>}><ZaznamyList /></Suspense>;
}
