'use client';

import { useData } from "@/components/data-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { 
  Plus, 
  Search, 
  Filter, 
  Eye, 
  Download, 
  FileCheck,
  Calendar,
  Building
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from "next/link";
import { formatCzechDate, cn } from "@/app/lib/utils";
import { Badge } from "@/components/ui/badge";

export default function RecordsPage() {
  const { klienti, zaznamy, isLoading } = useData();

  if (isLoading) return <div className="p-8">Načítání...</div>;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Záznamy kontrol</h1>
          <p className="text-muted-foreground">Evidence všech provedených kontrol BOZP a PO.</p>
        </div>
        <Button asChild className="h-11">
          <Link href="/nova-kontrola">
            <Plus className="mr-2 h-4 w-4" />
            Nová kontrola
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="relative md:col-span-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Číslo záznamu..." className="pl-10 h-11" />
        </div>
        <Select>
          <SelectTrigger className="h-11">
            <div className="flex items-center gap-2">
              <Building className="h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="Všichni klienti" />
            </div>
          </SelectTrigger>
          <SelectContent>
            {klienti.map(k => (
              <SelectItem key={k.id} value={k.id}>{k.nazev}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select>
          <SelectTrigger className="h-11">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="Všechny typy" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="BOZPaPO">BOZPaPO</SelectItem>
            <SelectItem value="PPP">PPP</SelectItem>
            <SelectItem value="PBOZP">PBOZP</SelectItem>
          </SelectContent>
        </Select>
        <Select>
          <SelectTrigger className="h-11">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="Všechny roky" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="2026">2026</SelectItem>
            <SelectItem value="2025">2025</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="border-none shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase bg-secondary/50 text-muted-foreground">
              <tr>
                <th className="px-6 py-4 font-bold">Číslo</th>
                <th className="px-6 py-4 font-bold">Klient</th>
                <th className="px-6 py-4 font-bold">Pracoviště</th>
                <th className="px-6 py-4 font-bold">Typ</th>
                <th className="px-6 py-4 font-bold">Datum</th>
                <th className="px-6 py-4 font-bold text-center">Závad</th>
                <th className="px-6 py-4 font-bold">Stav</th>
                <th className="px-6 py-4 font-bold text-right">Akce</th>
              </tr>
            </thead>
            <tbody className="divide-y bg-white">
              {zaznamy.length > 0 ? (
                zaznamy.map((z) => {
                  const klient = klienti.find(k => k.id === z.klientId);
                  const prac = klient?.pracoviste.find(p => p.id === z.pracovisteId);

                  return (
                    <tr key={z.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4 font-mono font-medium text-primary">{z.cislo}</td>
                      <td className="px-6 py-4 font-medium">{klient?.nazev}</td>
                      <td className="px-6 py-4 text-muted-foreground">{prac?.nazev}</td>
                      <td className="px-6 py-4">
                        <Badge variant="outline" className="font-normal">{z.typKontroly}</Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">{formatCzechDate(z.datum)}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={z.zavady.length > 0 ? "text-red-600 font-bold" : "text-green-600 font-medium"}>
                          {z.zavady.length}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <Badge 
                          className={cn(
                            "font-medium",
                            z.stav === 'otevreny' ? "bg-amber-100 text-amber-800 border-amber-200" : 
                            z.stav === 'uzavreny' ? "bg-green-100 text-green-800 border-green-200" :
                            "bg-gray-100 text-gray-800 border-gray-200"
                          )}
                        >
                          {z.stav === 'otevreny' ? 'Otevřený' : z.stav === 'uzavreny' ? 'Uzavřený' : 'Archiv'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" asChild title="Detail">
                            <Link href={`/zaznamy/${z.id}`}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button variant="ghost" size="icon" title="Stáhnout PDF">
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <FileCheck className="h-12 w-12 opacity-20" />
                      <p>Žádné záznamy kontrol nebyly nalezeny.</p>
                      <Button variant="link" asChild>
                        <Link href="/nova-kontrola">Vytvořit první záznam</Link>
                      </Button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}