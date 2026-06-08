'use client';

import { useData } from "@/components/data-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Users, 
  FileText, 
  AlertTriangle, 
  Calendar,
  ArrowRight,
  Plus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatCzechDate, cn } from "@/app/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardPage() {
  const { klienti, zaznamy, isLoading } = useData();

  if (isLoading) {
    return (
      <div className="p-4 md:p-8 space-y-8">
        <div className="flex justify-between items-center">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      </div>
    );
  }

  const openRecords = zaznamy.filter(z => z.stav === 'otevreny');
  const pendingDefects = zaznamy.reduce((acc, z) => 
    acc + z.zavady.filter(zv => zv.stavOdstraneni !== 'odstranena').length, 0);
  
  const now = new Date();
  const recordsThisMonth = zaznamy.filter(z => {
    const d = new Date(z.datum);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const recentRecords = [...zaznamy]
    .sort((a, b) => new Date(b.datum).getTime() - new Date(a.datum).getTime())
    .slice(0, 5);

  const stats = [
    { label: "Celkem klientů", value: klienti.length, icon: Users, color: "text-blue-600" },
    { label: "Otevřené záznamy", value: openRecords.length, icon: FileText, color: "text-amber-600" },
    { label: "Závady k řešení", value: pendingDefects, icon: AlertTriangle, color: "text-red-600" },
    { label: "Záznamy tento měsíc", value: recordsThisMonth, icon: Calendar, color: "text-green-600" },
  ];

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Přehled</h1>
          <p className="text-muted-foreground">Vítejte v systému pro správu auditů BPyes.</p>
        </div>
        <Button asChild className="h-11 px-6 shadow-sm">
          <Link href="/nova-kontrola">
            <Plus className="mr-2 h-4 w-4" />
            Nová kontrola
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="border-none shadow-sm bg-white hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                {stat.label}
              </CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight">Poslední záznamy</h2>
          <Button variant="ghost" asChild className="text-muted-foreground hover:text-primary">
            <Link href="/zaznamy">
              Všechny záznamy
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>

        <Card className="border-none shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-secondary/50 text-muted-foreground">
                <tr>
                  <th className="px-6 py-4 font-bold">Číslo</th>
                  <th className="px-6 py-4 font-bold">Klient</th>
                  <th className="px-6 py-4 font-bold">Typ</th>
                  <th className="px-6 py-4 font-bold">Datum</th>
                  <th className="px-6 py-4 font-bold text-center">Závad</th>
                  <th className="px-6 py-4 font-bold">Stav</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {recentRecords.length > 0 ? (
                  recentRecords.map((z) => {
                    const klient = klienti.find(k => k.id === z.klientId);
                    return (
                      <tr key={z.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-4 font-mono font-medium">{z.cislo}</td>
                        <td className="px-6 py-4">{klient?.nazev || 'Neznámý'}</td>
                        <td className="px-6 py-4">
                          <Badge variant="outline" className="font-normal">{z.typKontroly}</Badge>
                        </td>
                        <td className="px-6 py-4">{formatCzechDate(z.datum)}</td>
                        <td className="px-6 py-4 text-center">
                          <span className={z.zavady.length > 0 ? "text-red-600 font-bold" : "text-green-600 font-medium"}>
                            {z.zavady.length}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <Badge 
                            className={cn(
                              "font-medium",
                              z.stav === 'otevreny' ? "bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200" : 
                              z.stav === 'uzavreny' ? "bg-green-100 text-green-800 hover:bg-green-100 border-green-200" :
                              "bg-gray-100 text-gray-800 hover:bg-gray-100 border-gray-200"
                            )}
                          >
                            {z.stav === 'otevreny' ? 'Otevřený' : z.stav === 'uzavreny' ? 'Uzavřený' : 'Archiv'}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                      Zatím nejsou k dispozici žádné záznamy.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
