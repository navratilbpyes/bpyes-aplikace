'use client';

import { useData } from "@/components/data-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { Plus, FileText, ChevronRight } from "lucide-react";
import { cn } from "@/app/lib/utils";

export default function ZaznamyPage() {
  const { zaznamy, klienti } = useData();
  const router = useRouter();

  // Seřadíme záznamy od nejnovějšího po nejstarší
  const sortedZaznamy = [...zaznamy].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8 pb-24">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Provedené kontroly a audity</h1>
        <Button onClick={() => router.push('/nova-kontrola')}>
          <Plus className="mr-2 h-4 w-4" /> Nová kontrola
        </Button>
      </div>

      <Card className="border-none shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {sortedZaznamy.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground italic bg-slate-50">
              Zatím nebyly vytvořeny žádné záznamy o kontrolách.
            </div>
          ) : (
            <div className="divide-y">
              {sortedZaznamy.map(z => {
                const klient = klienti.find(k => k.id === z.klientId);
                return (
                  <div 
                    key={z.id} 
                    onClick={() => router.push(`/zaznamy/${z.id}`)} 
                    className="p-4 md:p-6 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 bg-blue-50 text-blue-700 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-blue-100 transition-colors">
                        <FileText className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-lg">{z.cislo}</p>
                          {z.revize > 0 && <span className="text-xs font-bold text-slate-500">R{z.revize}</span>}
                        </div>
                        <p className="text-sm text-slate-500 font-medium">
                          {klient?.nazev || 'Neznámý klient'} • {new Date(z.datum).toLocaleDateString('cs-CZ')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={cn(
                        "text-[10px] uppercase tracking-wider font-bold px-2.5 py-1 rounded-md border hidden md:inline-block", 
                        z.stav === 'uzavreny' ? "bg-green-50 text-green-700 border-green-200" : "bg-amber-50 text-amber-700 border-amber-200"
                      )}>
                        {z.stav === 'uzavreny' ? 'Uzavřeno' : 'Otevřený koncept'}
                      </span>
                      <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-blue-600 transition-colors" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
