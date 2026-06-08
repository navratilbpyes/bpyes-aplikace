
'use client';

import { useData } from "@/components/data-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Search, Building2, MapPin, MoreHorizontal, Eye, Edit2, ClipboardCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { formatCzechDate } from "@/app/lib/utils";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";

export default function ClientsPage() {
  const { klienti, zaznamy, isLoading } = useData();

  if (isLoading) return <div className="p-8">Načítání...</div>;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Klienti</h1>
          <p className="text-muted-foreground">Správa vašich zákazníků a jejich pracovišť.</p>
        </div>
        <Button asChild className="h-11">
          <Link href="/klienti/novy">
            <Plus className="mr-2 h-4 w-4" />
            Přidat klienta
          </Link>
        </Button>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Hledat klienta podle názvu nebo IČO..." className="pl-10 h-11" />
        </div>
      </div>

      <Card className="border-none shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase bg-secondary/50 text-muted-foreground">
              <tr>
                <th className="px-6 py-4 font-bold">Název společnosti</th>
                <th className="px-6 py-4 font-bold">IČO</th>
                <th className="px-6 py-4 font-bold">Město</th>
                <th className="px-6 py-4 font-bold text-center">Pracovišť</th>
                <th className="px-6 py-4 font-bold">Poslední kontrola</th>
                <th className="px-6 py-4 font-bold text-right">Akce</th>
              </tr>
            </thead>
            <tbody className="divide-y bg-white">
              {klienti.length > 0 ? (
                klienti.map((k) => {
                  const clientRecords = zaznamy.filter(z => z.klientId === k.id);
                  const lastRecord = clientRecords.sort((a,b) => new Date(b.datum).getTime() - new Date(a.datum).getTime())[0];

                  return (
                    <tr key={k.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4 font-semibold text-primary">{k.nazev}</td>
                      <td className="px-6 py-4 font-mono">{k.ico}</td>
                      <td className="px-6 py-4">{k.mesto}</td>
                      <td className="px-6 py-4 text-center">{k.pracoviste.length}</td>
                      <td className="px-6 py-4">
                        {lastRecord ? formatCzechDate(lastRecord.datum) : <span className="text-muted-foreground italic">Žádná</span>}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" asChild title="Detail">
                            <Link href={`/klienti/${k.id}`}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button variant="ghost" size="icon" asChild title="Upravit">
                            <Link href={`/klienti/${k.id}/edit`}>
                              <Edit2 className="h-4 w-4" />
                            </Link>
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem asChild>
                                <Link href={`/nova-kontrola?klient=${k.id}`} className="flex items-center gap-2">
                                  <ClipboardCheck className="h-4 w-4" />
                                  Nová kontrola
                                </Link>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Building2 className="h-12 w-12 opacity-20" />
                      <p>Zatím nebyli přidáni žádní klienti.</p>
                      <Button variant="link" asChild>
                        <Link href="/klienti/novy">Vytvořit prvního klienta</Link>
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
