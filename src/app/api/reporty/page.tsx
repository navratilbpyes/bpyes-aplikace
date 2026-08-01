'use client';

/**
 * AuditFlow — klientský přehled reportů.
 * Umístění: src/app/reporty/page.tsx
 *
 * Vzhled a filtry jako admin /zaznamy, ale:
 *  - jen reporty přihlášeného klienta (data-provider je už filtruje podle klientId),
 *  - bez sloupce „klient" (je to jen jeho),
 *  - read-only (žádné úpravy/mazání/nová kontrola),
 *  - proklik na detail /zaznamy/{id} (ten je klient-aware).
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useData } from '@/components/data-provider';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Search, ArrowUpDown } from 'lucide-react';
import { cn } from '@/app/lib/utils';

export default function ReportyKlientaPage() {
  const { zaznamy } = useData(); // klient dostává jen své záznamy
  const router = useRouter();

  const [search, setSearch] = useState('');
  const [dateSearch, setDateSearch] = useState('');
  const [monthFilter, setMonthFilter] = useState(false);
  const [colFilter, setColFilter] = useState({ typ: 'all', stav: 'all' });
  const [sort, setSort] = useState({ key: 'cislo', dir: 'desc' as 'asc' | 'desc' });

  const handleSort = (key: string) => {
    setSort((prev) => ({ key, dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc' }));
  };

  const processed = useMemo(() => {
    const arr = zaznamy.filter((z: any) => {
      if (search && !z.cislo.toLowerCase().includes(search.toLowerCase())) return false;
      if (colFilter.typ !== 'all' && z.typKontroly !== colFilter.typ) return false;
      if (colFilter.stav !== 'all' && z.stav !== colFilter.stav) return false;
      if (monthFilter) {
        if (!z.datum) return false;
        const d = new Date(z.datum);
        const now = new Date();
        if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) return false;
      }
      if (dateSearch) {
        if (!z.datum) return false;
        const dCz = new Date(z.datum).toLocaleDateString('cs-CZ').replace(/\s/g, '');
        const clean = dateSearch.replace(/\s/g, '');
        if (!dCz.includes(clean) && !z.datum.includes(clean)) return false;
      }
      return true;
    });

    arr.sort((a: any, b: any) => {
      let valA = '', valB = '';
      if (sort.key === 'cislo') { valA = a.cislo; valB = b.cislo; }
      else if (sort.key === 'typ') { valA = a.typKontroly || ''; valB = b.typKontroly || ''; }
      else if (sort.key === 'datum') { valA = a.datum || ''; valB = b.datum || ''; }
      else if (sort.key === 'stav') { valA = a.stav || ''; valB = b.stav || ''; }
      const res = valA.localeCompare(valB);
      return sort.dir === 'asc' ? res : -res;
    });

    return arr;
  }, [zaznamy, search, dateSearch, colFilter, monthFilter, sort]);

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reporty</h1>
        <p className="text-muted-foreground">Přehled vašich auditů a kontrol s možnostmi filtrování.</p>
      </div>

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        {/* Rychlé přepínače */}
        <div className="p-3 border-b bg-slate-50/50">
          <div className="inline-flex rounded-lg border bg-muted p-1">
            <button
              onClick={() => { setColFilter({ typ: 'all', stav: 'all' }); setMonthFilter(false); setSearch(''); setDateSearch(''); }}
              className={cn('px-4 py-1.5 text-xs font-bold rounded-md transition-all', (!monthFilter && colFilter.stav === 'all') ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700')}
            >
              Zobrazit všechny
            </button>
            <button
              onClick={() => { setColFilter((p) => ({ ...p, stav: 'otevreny' })); setMonthFilter(false); }}
              className={cn('px-4 py-1.5 text-xs font-bold rounded-md transition-all', (!monthFilter && colFilter.stav === 'otevreny') ? 'bg-white shadow-sm text-amber-700' : 'text-slate-500 hover:text-slate-700')}
            >
              Pouze v řešení
            </button>
            <button
              onClick={() => { setMonthFilter(true); setColFilter((p) => ({ ...p, stav: 'all' })); }}
              className={cn('px-4 py-1.5 text-xs font-bold rounded-md transition-all', monthFilter ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700')}
            >
              Tento měsíc
            </button>
          </div>
          <span className="text-xs text-muted-foreground ml-3">Celkem nalezeno: {processed.length}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50/80">
              <tr>
                <th className="px-4 py-3 cursor-pointer hover:bg-slate-50 select-none group" onClick={() => handleSort('cislo')}>
                  <div className="flex items-center gap-1">Číslo zprávy <ArrowUpDown className={cn('h-3 w-3', sort.key === 'cislo' ? 'text-blue-600' : 'text-slate-300 group-hover:text-slate-500')} /></div>
                </th>
                <th className="px-4 py-3 cursor-pointer hover:bg-slate-50 select-none group" onClick={() => handleSort('typ')}>
                  <div className="flex items-center gap-1">Typ kontroly <ArrowUpDown className={cn('h-3 w-3', sort.key === 'typ' ? 'text-blue-600' : 'text-slate-300 group-hover:text-slate-500')} /></div>
                </th>
                <th className="px-4 py-3 cursor-pointer hover:bg-slate-50 select-none group" onClick={() => handleSort('datum')}>
                  <div className="flex items-center gap-1">Datum <ArrowUpDown className={cn('h-3 w-3', sort.key === 'datum' ? 'text-blue-600' : 'text-slate-300 group-hover:text-slate-500')} /></div>
                </th>
                <th className="px-4 py-3 cursor-pointer hover:bg-slate-50 select-none group" onClick={() => handleSort('stav')}>
                  <div className="flex items-center gap-1">Stav řešení <ArrowUpDown className={cn('h-3 w-3', sort.key === 'stav' ? 'text-blue-600' : 'text-slate-300 group-hover:text-slate-500')} /></div>
                </th>
              </tr>
              <tr>
                <th className="px-2 py-2 font-normal">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
                    <Input placeholder="Hledat číslo..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-6 h-8 text-xs bg-white border-slate-200 shadow-sm" />
                  </div>
                </th>
                <th className="px-2 py-2 font-normal">
                  <Select value={colFilter.typ} onValueChange={(v) => setColFilter((p) => ({ ...p, typ: v }))}>
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
                  <Select value={colFilter.stav} onValueChange={(v) => setColFilter((p) => ({ ...p, stav: v }))}>
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
                processed.map((z: any) => (
                  <tr key={z.id} className="hover:bg-slate-50 cursor-pointer transition-colors bg-white group" onClick={() => router.push(`/zaznamy/${z.id}`)}>
                    <td className={cn('px-4 py-3 font-bold text-foreground font-mono flex items-center gap-2', z.stav === 'uzavreny' ? 'paska paska-V' : 'paska paska-N')}>
                      <FileText className="h-4 w-4 text-slate-400 group-hover:text-slate-600 transition-colors" /> {z.cislo}
                      <span className="text-muted-foreground font-normal text-[10px] ml-1 bg-slate-100 px-1.5 py-0.5 rounded border">R{z.revize || 0}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 font-medium">{z.typKontroly}</td>
                    <td className="px-4 py-3 text-slate-600 font-mono text-sm">{z.datum ? new Date(z.datum).toLocaleDateString('cs-CZ') : '-'}</td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs font-medium', z.stav === 'uzavreny' ? 'text-[hsl(var(--stav-vyhovuje))]' : 'text-[hsl(var(--stav-zavada))]')}>
                        {z.stav === 'uzavreny' ? 'Uzavřeno' : 'V řešení'}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-muted-foreground text-sm">
                    Žádné reporty neodpovídají filtru.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
