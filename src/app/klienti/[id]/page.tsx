'use client';

import { useData } from "@/components/data-provider";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  Building2, 
  MapPin, 
  User, 
  Mail, 
  Phone, 
  Plus, 
  ChevronLeft, 
  RefreshCw,
  MoreVertical,
  ClipboardList,
  Eye
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { cn } from "@/app/lib/utils";

export default function ClientDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { klienti, zaznamy, setKlienti } = useData();
  const { toast } = useToast();
  const [isAresLoading, setIsAresLoading] = useState(false);

  const klient = klienti.find(k => k.id === id);
  const clientRecords = zaznamy.filter(z => z.klientId === id);

  if (!klient) {
    return <div className="p-8">Klient nenalezen.</div>;
  }

  const handleAresMock = () => {
    setIsAresLoading(true);
    setTimeout(() => {
      setIsAresLoading(false);
      toast({
        title: "Načteno z ARES",
        description: "Data klienta byla úspěšně aktualizována ze státního registru.",
      });
    }, 1500);
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{klient.nazev}</h1>
            <p className="text-muted-foreground">Detail klienta a správa pracovišť</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleAresMock} disabled={isAresLoading}>
            <RefreshCw className={cn("mr-2 h-4 w-4", isAresLoading && "animate-spin")} />
            Načíst z ARES
          </Button>
          <Button asChild>
            <Link href={`/nova-kontrola?klient=${klient.id}`}>
              <Plus className="mr-2 h-4 w-4" />
              Nová kontrola
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Info */}
        <div className="space-y-6">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Základní údaje</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs uppercase">Název / IČO</Label>
                  <p className="font-semibold">{klient.nazev}</p>
                  <p className="text-sm font-mono">{klient.ico} {klient.dic && `/ ${klient.dic}`}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs uppercase">Sídlo</Label>
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 mt-1 text-muted-foreground" />
                    <div>
                      <p>{klient.sidlo}</p>
                      <p>{klient.psc} {klient.mesto}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs uppercase">Hlavní kontakt</Label>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span>{klient.kontaktOsoba}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <a href={`mailto:${klient.email}`} className="text-blue-600 hover:underline">{klient.email}</a>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{klient.telefon}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Tabs */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="pracoviste" className="space-y-6">
            <TabsList className="w-full justify-start h-auto p-1 bg-secondary">
              <TabsTrigger value="pracoviste" className="px-6 py-2">Pracoviště</TabsTrigger>
              <TabsTrigger value="osoby" className="px-6 py-2">Odpovědné osoby</TabsTrigger>
              <TabsTrigger value="zaznamy" className="px-6 py-2">Záznamy kontrol</TabsTrigger>
            </TabsList>

            <TabsContent value="pracoviste" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold">Seznam pracovišť ({klient.pracoviste.length})</h3>
                <Button size="sm" variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  Přidat pracoviště
                </Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {klient.pracoviste.map(p => (
                  <Card key={p.id} className="border-none shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-base">{p.nazev}</CardTitle>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </div>
                      <CardDescription>{p.adresa}, {p.mesto}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {p.prostory.map(area => (
                          <Badge key={area} variant="secondary" className="font-normal">{area}</Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="osoby" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold">Odpovědné osoby ({klient.odpovedneOsoby.length})</h3>
                <Button size="sm" variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  Přidat osobu
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {klient.odpovedneOsoby.map(o => (
                  <Card key={o.id} className="border-none shadow-sm">
                    <CardContent className="flex items-center justify-between p-6">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-primary/5 flex items-center justify-center">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-bold">{o.jmeno} {o.prijmeni}</p>
                          <p className="text-sm text-muted-foreground">{o.pozice}</p>
                        </div>
                      </div>
                      <div className="flex gap-8">
                        {o.email && (
                          <div className="hidden md:flex flex-col">
                            <span className="text-[10px] uppercase text-muted-foreground font-bold">Email</span>
                            <span className="text-sm">{o.email}</span>
                          </div>
                        )}
                        {o.telefon && (
                          <div className="hidden md:flex flex-col">
                            <span className="text-[10px] uppercase text-muted-foreground font-bold">Telefon</span>
                            <span className="text-sm">{o.telefon}</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="zaznamy" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold">Historie kontrol ({clientRecords.length})</h3>
              </div>

              <Card className="border-none shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-secondary/50 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-6 py-4">Číslo</th>
                        <th className="px-6 py-4">Typ</th>
                        <th className="px-6 py-4">Datum</th>
                        <th className="px-6 py-4">Závady</th>
                        <th className="px-6 py-4">Stav</th>
                        <th className="px-6 py-4"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {clientRecords.map(z => (
                        <tr key={z.id} className="hover:bg-muted/30">
                          <td className="px-6 py-4 font-mono font-medium">{z.cislo}</td>
                          <td className="px-6 py-4">
                            <Badge variant="outline">{z.typKontroly}</Badge>
                          </td>
                          <td className="px-6 py-4">{new Date(z.datum).toLocaleDateString('cs-CZ')}</td>
                          <td className="px-6 py-4">
                            <span className={z.zavady.length > 0 ? "text-red-600 font-bold" : "text-green-600 font-bold"}>
                              {z.zavady.length}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <Badge variant={z.stav === 'otevreny' ? 'destructive' : 'secondary'}>{z.stav}</Badge>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <Button variant="ghost" size="icon" asChild>
                              <Link href={`/zaznamy/${z.id}`}>
                                <Eye className="h-4 w-4" />
                              </Link>
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {clientRecords.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                            Pro tohoto klienta zatím nebyla provedena žádná kontrola.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
