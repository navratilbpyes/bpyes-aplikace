'use client';

import { useData } from "@/components/data-provider";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRouter, useSearchParams } from "next/navigation";
import { FileText, Search, Plus, Filter, Loader2, ArrowUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, Suspense, useMemo, useEffect } from "react";
import Link from "next/link";
import { cn } from "@/app/lib/utils";

function ZaznamyList() {
  const { zaznamy, klienti, userProfile } = useData();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialFilter = searchParams.get('filter') || 'all';

  const isAdmin = userProfile?.role === 'admin';

  // Stavy pro řazení a fitry sloupců
  const [search, setSearch] = useState("");
  const [dateSearch, setDateSearch] = useState("");
  const [monthFilter, setMonthFilter] = useState(false);
  const [sort, setSort] = useState({ key: 'cislo', dir: 'desc' });
  const [colFilter, setColFilter] = useState({ klient: 'all', typ: 'all', stav: 'all' });

  // Načtení filtrů z URL
  useEffect(() => {
     if (initialFilter === 'open') { setColFilter(p => ({...p, stav: 'otevreny'})); setMonthFilter(false); }
     if (initialFilter === 'month') { setMonthFilter(true); setColFilter(p => ({...p, stav: 'all'})); }
     if (initialFilter === 'all') { setColFilter({ klient: 'all', typ: 'all', stav: 'all' }); setMonthFilter(false); }
  }, [initialFilter]);

  const handleSort = (key: string) => {
    setSort(prev => ({ key, dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc' }));
  };

  // Filtrování a řazení dat
  const processed = useMemo(() => {
    let arr = zaznamy.filter(z => {
      // 1. Textové hledání čísla
      if(search && !z.cislo.toLowerCase().includes(search.toLowerCase())) return false;
      
      // 2. Roletkové filtry
      if(colFilter.klient !== 'all' && z.klientId !== colFilter.klient) return false;
      if(colFilter.typ !== 'all' && z.typKontroly !== colFilter.typ) return false;
      if(colFilter.stav !== 'all' && z.stav !== colFilter.stav) return false;
      
      // 3. Tlačítko "Tento měsíc"
      if(monthFilter) {
        if(!z.datum) return false;
        const d = new Date(z.datum);
        const now = new Date();
        if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) return false;
      }

      // 4. Chytré textové vyhledávání v datu (podporuje "25. 6.", "2026", "2026-06" atd.)
      if(dateSearch) {
        if(!z.datum) return false;
        const dCz = new Date(z.datum).toLocaleDateString('cs-CZ').replace(/\s/g, '');
        const searchClean = dateSearch.replace(/\s/g, '');
        // Prohledáme jak český formát "25.6.2026", tak ISO formát "2026-06-25"
        if(!dCz.includes(searchClean) && !z.datum.includes(searchClean)) return false;
      }

      return true;
    });

    arr.sort((a, b) => {
      let valA = '', valB = '';
      if (sort.key === 'cislo') { valA = a.cislo; valB = b.cislo; }
      else if (sort.key === 'klient') {
          valA = a.klientNazev || klienti.find(k => k.id === a.klientId)?.nazev || '';
          valB = b.klientNazev || klienti.find(k => k.id === b.klientId)?.nazev || '';
      }
      else if (sort.key === 'typ') { valA = a.typKontroly || ''; valB = b.typKontroly || ''; }
      else if (sort.key === 'datum') { valA = a.datum || ''; valB = b.datum || ''; }
      else if (sort.key === 'stav') { valA = a.stav || ''; valB = b.stav || ''; }

      const res = valA.localeCompare(valB);
      return sort.dir === 'asc' ? res : -res;
    });

    return arr;
  }, [zaznamy, klienti, search, dateSearch, colFilter, monthFilter, sort]);

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Databáze reportů</h1>
          <p className="text-muted-foreground">Kompletní přehled provedených auditů a kontrol s možnostmi filtrování.</p>
        </div>
        {isAdmin && (
          <Button asChild className="bg-slate-900 hover:bg-slate-800 font-bold shrink-0 shadow-sm">
            <Link href="/nova-kontrola"><Plus className="mr-2 h-4 w-4" /> Nová kontrola</Link>
          </Button>
        )}
      </div>

      <Card className="border-none shadow-sm overflow-hidden bg-white">
        <CardHeader className="bg-slate-50/50 border-b pb-4">
           <div className="flex flex-col md:flex-row justify-between gap-4">
             <div className="flex bg-slate-100 p-1 rounded-lg shrink-0 w-fit">
                <button 
                  onClick={() => { setColFilter({ klient: 'all', typ: 'all', stav: 'all' }); setMonthFilter(false); setSearch(""); setDateSearch(""); }} 
                  className={cn("px-4 py-1.5 text-xs font-bold rounded-md transition-all", (!monthFilter && colFilter.stav === 'all') ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700")}
                >Zobrazit všechny</button>
                <button 
                  onClick={() => { setColFilter(p => ({...p, stav: 'otevreny'})); setMonthFilter(false); }} 
                  className={cn("px-4 py-1.5 text-xs font-bold rounded-md transition-all", (!monthFilter && colFilter.stav === 'otevreny') ? "bg-white shadow-sm text-amber-700" : "text-slate-500 hover:text-slate-700")}
                >Pouze v řešení</button>
                <button 
                  onClick={() => { setMonthFilter(true); setColFilter(p => ({...p, stav: 'all'})); }} 
                  className={cn("px-4 py-1.5 text-xs font-bold rounded-md transition-all", monthFilter ? "bg-white shadow-sm text-blue-700" : "text-slate-500 hover:text-slate-700")}
                >Tento měsíc</button>
             </div>
             <div className="text-sm font-bold text-slate-500 flex items-center">
               Celkem nalezeno: {processed.length}
             </div>
           </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-white text-[10px] uppercase tracking-wider text-slate-600 font-bold">
                {/* 1. ŘÁDEK: HLAVIČKY S ŘAZENÍM */}
                <tr>
                  <th className="px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors select-none group" onClick={() => handleSort('cislo')}>
                    <div className="flex items-center gap-1">Číslo zprávy <ArrowUpDown className={cn("h-3 w-3", sort.key === 'cislo' ? "text-blue-600" : "text-slate-300 group-hover:text-slate-500")}/></div>
                  </th>
                  {isAdmin && (
                    <th className="px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors select-none group" onClick={() => handleSort('klient')}>
                      <div className="flex items-center gap-1">Klient / Subjekt <ArrowUpDown className={cn("h-3 w-3", sort.key === 'klient' ? "text-blue-600" : "text-slate-300 group-hover:text-slate-500")}/></div>
                    </th>
                  )}
                  <th className="px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors select-none group" onClick={() => handleSort('typ')}>
                    <div className="flex items-center gap-1">Typ kontroly <ArrowUpDown className={cn("h-3 w-3", sort.key === 'typ' ? "text-blue-600" : "text-slate-300 group-hover:text-slate-500")}/></div>
                  </th>
                  <th className="px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors select-none group" onClick={() => handleSort('datum')}>
                    <div className="flex items-center gap-1">Datum <ArrowUpDown className={cn("h-3 w-3", sort.key === 'datum' ? "text-blue-600" : "text-slate-300 group-hover:text-slate-500")}/></div>
                  </th>
                  <th className="px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors select-none group" onClick={() => handleSort('stav')}>
                    <div className="flex items-center gap-1">Stav řešení <ArrowUpDown className={cn("h-3 w-3", sort.key === 'stav' ? "text-blue-600" : "text-slate-300 group-hover:text-slate-500")}/></div>
                  </th>
                </tr>
                
                {/* 2. ŘÁDEK: ROLETKOVÉ FILTRY */}
                <tr className="bg-slate-50/80 border-b border-slate-200">
                  <th className="px-2 py-2 font-normal">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
                      <Input placeholder="Hledat číslo..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-6 h-8 text-xs bg-white border-slate-200 shadow-sm" />
                    </div>
                  </th>
                  {isAdmin && (
                    <th className="px-2 py-2 font-normal">
                      <Select value={colFilter.klient} onValueChange={v => setColFilter(p => ({...p, klient: v}))}>
                        <SelectTrigger className="h-8 text-xs bg-white border-slate-200 shadow-sm font-medium"><SelectValue placeholder="Všichni" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Všichni klienti</SelectItem>
                          {klienti.map(k => <SelectItem key={k.id} value={k.id}>{k.nazev}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </th>
                  )}
                  <th className="px-2 py-2 font-normal">
                    <Select value={colFilter.typ} onValueChange={v => setColFilter(p => ({...p, typ: v}))}>
                      <SelectTrigger className="h-8 text-xs bg-white border-slate-200 shadow-sm font-medium"><SelectValue placeholder="Vše" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Všechny typy</SelectItem>
                        <SelectItem value="BOZPaPO">BOZPaPO</SelectItem>
                        <SelectItem value="PPP">PPP</SelectItem>
                        <SelectItem value="PBOZP">PBOZP</SelectItem>
                      </SelectContent>
                    </Select>
                  </th>
                  <th className="px-2 py-2 font-normal">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
                      <Input placeholder="Rok, měsíc nebo den..." value={dateSearch} onChange={(e) => setDateSearch(e.target.value)} className="pl-6 h-8 text-xs bg-white border-slate-200 shadow-sm" />
                    </div>
                  </th>
                  <th className="px-2 py-2 font-normal">
                    <Select value={colFilter.stav} onValueChange={v => setColFilter(p => ({...p, stav: v}))}>
                      <SelectTrigger className="h-8 text-xs bg-white border-slate-200 shadow-sm font-medium"><SelectValue placeholder="Stav" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Všechny stavy</SelectItem>
                        <SelectItem value="otevreny">V řešení</SelectItem>
                        <SelectItem value="uzavreny">Uzavřeno</SelectItem>
                      </SelectContent>
                    </Select>
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {processed.length > 0 ? (
                  processed.map(z => (
                    <tr key={z.id} className="hover:bg-blue-50/50 cursor-pointer transition-colors bg-white group" onClick={() => router.push(`/zaznamy/${z.id}`)}>
                      <td className="px-4 py-3 font-bold text-blue-700 flex items-center gap-2">
                        <FileText className="h-4 w-4 text-blue-400 group-hover:text-blue-600 transition-colors" /> {z.cislo} 
                        <span className="text-muted-foreground font-normal text-[10px] ml-1 bg-slate-100 px-1.5 py-0.5 rounded border">R{z.revize || 0}</span>
                      </td>
                      {isAdmin && <td className="px-4 py-3 font-medium text-slate-900">{z.klientNazev || klienti.find(k => k.id === z.klientId)?.nazev || 'Neznámý klient'}</td>}
                      <td className="px-4 py-3 text-slate-600 font-medium">{z.typKontroly}</td>
                      <td className="px-4 py-3 text-slate-600">{z.datum ? new Date(z.datum).toLocaleDateString('cs-CZ') : '-'}</td>
                      <td className="px-4 py-3">
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
                        <Button variant="link" size="sm" onClick={() => {setColFilter({ klient: 'all', typ: 'all', stav: 'all' }); setSearch(""); setDateSearch(""); setMonthFilter(false);}}>
                          Zrušit všechny filtry
                        </Button>
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
