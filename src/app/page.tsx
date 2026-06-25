'use client';

import { useData } from "@/components/data-provider";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, FileText, AlertTriangle, Calendar, Plus, CheckCircle2, ArrowRight, Eye, Info } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMemo } from "react";

export default function Dashboard() {
  const { zaznamy, klienti, userProfile } = useData();
  const router = useRouter();

  const isAdmin = userProfile?.role === 'admin';

  // Výpočty pro statistické karty
  const zavadyKReseni = zaznamy.reduce((acc, z) => {
    if (z.stav !== 'uzavreny' && z.kontrolniBody) {
      return acc + z.kontrolniBody.filter((b: any) => b.hodnoceni === 'N').length;
    }
    return acc;
  }, 0);

  const zaznamyTentoMesic = zaznamy.filter(z => {
    if (!z.datum) return false;
    const d = new Date(z.datum);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  // AGREGÁTOR ZÁVAD K REVIZI (To-Do list pro auditora)
  const zavadyKRevizi = useMemo(() => {
    if (!isAdmin) return [];
    const kRevizi: any[] = [];
    
    zaznamy.forEach(z => {
      if (z.stav !== 'uzavreny' && z.kontrolniBody) {
        z.kontrolniBody.forEach((kb: any) => {
          // Hledáme pouze neshody, které klient označil jako vyřešené
          if (kb.hodnoceni === 'N' && kb.vyresenoKlientem) {
            kRevizi.push({
              zaznamId: z.id,
              cisloZpravy: z.cislo,
              klientNazev: klienti.find(k => k.id === z.klientId)?.nazev || 'Neznámý klient',
              bod: kb.bod,
              otazka: kb.otazka || kb.popis,
              datum: kb.datumVyreseniKlientem,
              jmeno: kb.jmenoVyresitele
            });
          }
        });
      }
    });
    
    // Seřadíme od nejnověji vyřešených
    return kRevizi.sort((a, b) => new Date(b.datum).getTime() - new Date(a.datum).getTime());
  }, [zaznamy, klienti, isAdmin]);

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto pb-24">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Přehled</h1>
          <p className="text-muted-foreground">
            {isAdmin ? "Vítejte v systému pro správu auditů BPyes." : "Vítejte v klientském portálu. Zde naleznete své reporty."}
          </p>
        </div>
        
        {isAdmin && (
          <Button asChild className="bg-blue-600 hover:bg-blue-700 text-white font-bold shrink-0 shadow-sm h-11 px-6">
            <Link href="/nova-kontrola">
              <Plus className="mr-2 h-4 w-4" /> Nová kontrola
            </Link>
          </Button>
        )}
      </div>

      <div className={`grid gap-4 md:grid-cols-2 ${isAdmin ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
        
        {isAdmin && (
          <Card className="border-none shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Celkem klientů</CardTitle>
              <Users className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-slate-900">{klienti.length}</div>
            </CardContent>
          </Card>
        )}
        
        {/* INTERAKTIVNÍ KARTA: Otevřené záznamy */}
        <Link href="/zaznamy?filter=all" className="block focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-xl transition-transform hover:scale-[1.02]">
          <Card className="border-none shadow-sm h-full hover:bg-blue-50/30 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {isAdmin ? "Celkem reportů" : "Celkem mých reportů"}
              </CardTitle>
              <FileText className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-slate-900">
                {zaznamy.length}
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* INTERAKTIVNÍ KARTA: Závady k řešení */}
        <Link href="/zaznamy?filter=open" className="block focus:outline-none focus:ring-2 focus:ring-red-500 rounded-xl transition-transform hover:scale-[1.02]">
          <Card className="border-none shadow-sm h-full hover:bg-red-50/30 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Závady k řešení</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-slate-900">{zavadyKReseni}</div>
            </CardContent>
          </Card>
        </Link>

        {/* INTERAKTIVNÍ KARTA: Záznamy tento měsíc */}
        <Link href="/zaznamy?filter=month" className="block focus:outline-none focus:ring-2 focus:ring-green-500 rounded-xl transition-transform hover:scale-[1.02]">
          <Card className="border-none shadow-sm h-full hover:bg-green-50/30 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Záznamy tento měsíc</CardTitle>
              <Calendar className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-slate-900">{zaznamyTentoMesic}</div>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 pt-4">
        
        {/* LEVÝ SLOUPEC: Poslední záznamy */}
        <div className="xl:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight">Poslední záznamy</h2>
            <Link href="/zaznamy" className="text-sm font-bold text-blue-600 hover:text-blue-800 transition-colors">Všechny záznamy &rarr;</Link>
          </div>
          
          <div className="border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4">Číslo zprávy</th>
                    {isAdmin && <th className="px-6 py-4">Klient</th>}
                    <th className="px-6 py-4">Typ kontroly</th>
                    <th className="px-6 py-4">Datum</th>
                    <th className="px-6 py-4">Stav</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {zaznamy.length > 0 ? (
                    zaznamy.slice(0, 8).map(z => (
                      <tr 
                        key={z.id} 
                        className="hover:bg-blue-50/50 cursor-pointer transition-colors" 
                        onClick={() => router.push(`/zaznamy/${z.id}`)}
                      >
                        <td className="px-6 py-4 font-bold text-blue-700">{z.cislo}</td>
                        {isAdmin && (
                          <td className="px-6 py-4 font-medium text-slate-900 truncate max-w-[150px]">
                            {klienti.find(k => k.id === z.klientId)?.nazev || 'Neznámý klient'}
                          </td>
                        )}
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
                      <td colSpan={isAdmin ? 5 : 4} className="px-6 py-12 text-center text-slate-500 italic">
                        Zatím nejsou k dispozici žádné auditní záznamy.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* PRAVÝ SLOUPEC: To-Do list k revizi (Pouze pro Admina) */}
        {isAdmin && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold tracking-tight text-emerald-800">Čeká na vaši revizi</h2>
              {zavadyKRevizi.length > 0 && (
                <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-1 rounded-full border border-emerald-200">
                  {zavadyKRevizi.length} novinek
                </span>
              )}
            </div>
            
            <Card className="border-emerald-200 shadow-sm bg-emerald-50/30">
              <CardContent className="p-0">
                {zavadyKRevizi.length > 0 ? (
                  <div className="divide-y divide-emerald-100">
                    {zavadyKRevizi.map((zavada, idx) => (
                      <div key={idx} className="p-4 hover:bg-emerald-50/80 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-emerald-600 tracking-wider">
                            <CheckCircle2 className="h-3 w-3" />
                            Klient hlásí odstranění
                          </div>
                          <span className="text-xs font-bold text-slate-400">
                            {zavada.datum ? new Date(zavada.datum).toLocaleDateString('cs-CZ') : ''}
                          </span>
                        </div>
                        
                        <div className="space-y-1 mb-3">
                          <p className="text-sm font-bold text-slate-900 leading-tight line-clamp-2">{zavada.otazka}</p>
                          <p className="text-xs font-medium text-slate-500 truncate">{zavada.klientNazev} • {zavada.cisloZpravy}</p>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div className="text-xs text-emerald-700 bg-emerald-100 px-2 py-1 rounded border border-emerald-200 truncate max-w-[120px]">
                            Od: <span className="font-bold">{zavada.jmeno}</span>
                          </div>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-7 text-xs font-bold border-emerald-300 text-emerald-700 hover:bg-emerald-100"
                            onClick={() => router.push(`/upravit-zaznam/${zavada.zaznamId}`)}
                          >
                            <Eye className="h-3 w-3 mr-1.5" /> Revidovat
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center flex flex-col items-center justify-center space-y-3">
                    <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center">
                      <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                    </div>
                    <p className="text-sm font-medium text-slate-500">Máte čistý stůl! Žádné nové závady nečekají na kontrolu.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

      </div>
    </div>
  );
}
