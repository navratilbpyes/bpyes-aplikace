'use client';

import { useData } from "@/components/data-provider";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  FileText, 
  MapPin, 
  User, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  Archive, 
  Edit, 
  ChevronLeft,
  Printer,
  MoreVertical,
  Clock,
  ShieldAlert,
  Building2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { formatCzechDate, cn } from "@/app/lib/utils";
import Link from "next/link";
import { Label } from "@/components/ui/label";

export default function RecordDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { zaznamy, klienti, setZaznamy } = useData();
  const { toast } = useToast();

  const zaznam = zaznamy.find(z => z.id === id);
  const klient = klienti.find(k => k.id === zaznam?.klientId);
  const prac = klient?.pracoviste.find(p => p.id === zaznam?.pracovisteId);

  if (!zaznam) return <div className="p-8">Záznam nenalezen.</div>;

  const updateStav = (novyStav: 'uzavreny' | 'archivovany') => {
    setZaznamy(prev => prev.map(z => z.id === id ? {...z, stav: novyStav, updatedAt: new Date().toISOString()} : z));
    toast({ 
      title: novyStav === 'uzavreny' ? "Záznam uzavřen" : "Záznam archivován", 
      description: `Záznam ${zaznam.cislo} byl úspěšně aktualizován.` 
    });
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight">{zaznam.cislo}</h1>
              <Badge 
                className={cn(
                  "font-medium",
                  zaznam.stav === 'otevreny' ? "bg-amber-100 text-amber-800 border-amber-200" : 
                  zaznam.stav === 'uzavreny' ? "bg-green-100 text-green-800 border-green-200" :
                  "bg-gray-100 text-gray-800 border-gray-200"
                )}
              >
                {zaznam.stav === 'otevreny' ? 'Otevřený' : zaznam.stav === 'uzavreny' ? 'Uzavřený' : 'Archiv'}
              </Badge>
            </div>
            <p className="text-muted-foreground">{zaznam.typKontroly} — Provedeno dne {formatCzechDate(zaznam.datum)}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline">
            <Printer className="mr-2 h-4 w-4" />
            Tisk PDF
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/zaznamy/${id}/edit`}>
              <Edit className="mr-2 h-4 w-4" />
              Upravit
            </Link>
          </Button>
          {zaznam.stav === 'otevreny' && (
            <Button className="bg-green-600 hover:bg-green-700" onClick={() => updateStav('uzavreny')}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Uzavřít záznam
            </Button>
          )}
          {zaznam.stav === 'uzavreny' && (
            <Button variant="secondary" onClick={() => updateStav('archivovany')}>
              <Archive className="mr-2 h-4 w-4" />
              Archivovat
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Main Content */}
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle>Zjištěné závady a neshody</CardTitle>
              <CardDescription>Přehled všech bodů, které vyžadují nápravná opatření.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {zaznam.zavady.length > 0 ? (
                <div className="space-y-4">
                  {zaznam.zavady.map((zavada) => (
                    <div key={zavada.id} className="border rounded-lg overflow-hidden">
                      <div className="bg-secondary/30 p-4 flex justify-between items-center border-b">
                        <div className="flex items-center gap-3">
                          <Badge variant="destructive" className="h-6 w-6 rounded-full p-0 flex items-center justify-center font-bold">
                            {zavada.cislo}
                          </Badge>
                          <span className="font-bold">{zavada.popis}</span>
                        </div>
                        <Badge variant="outline" className={cn(
                          zavada.stavOdstraneni === 'otevrena' ? "bg-red-50 text-red-700 border-red-200" :
                          zavada.stavOdstraneni === 'v_reseni' ? "bg-amber-50 text-amber-700 border-amber-200" :
                          "bg-green-50 text-green-700 border-green-200"
                        )}>
                          {zavada.stavOdstraneni === 'otevrena' ? 'Otevřeno' : zavada.stavOdstraneni === 'v_reseni' ? 'V řešení' : 'Odstraněno'}
                        </Badge>
                      </div>
                      <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md:col-span-2 space-y-3">
                          <div className="space-y-1">
                            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Návrh opatření</span>
                            <p className="text-sm">{zavada.navrhOpatreni}</p>
                          </div>
                        </div>
                        <div className="space-y-4 border-l pl-6">
                          <div className="space-y-1">
                            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Termín</span>
                            <div className="flex items-center gap-2 text-sm">
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              {formatCzechDate(zavada.terminOdstraneni)}
                            </div>
                          </div>
                          <div className="space-y-1">
                            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Odpovědná osoba</span>
                            <div className="flex items-center gap-2 text-sm">
                              <User className="h-3 w-3 text-muted-foreground" />
                              {zavada.odpovednaOsoba}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500 opacity-20" />
                  <p>Žádné závady nebyly v rámci této kontroly zjištěny.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle>Účastníci kontroly</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {zaznam.ucastnici.map((u, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg">
                    <div className="h-8 w-8 rounded-full bg-white flex items-center justify-center border">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-bold text-sm">{u.jmeno}</p>
                      <p className="text-xs text-muted-foreground">{u.pozice}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Info Sidebar */}
        <div className="space-y-6">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Detaily kontroly</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-1">
                <Label className="text-xs uppercase text-muted-foreground font-bold">Zadavatel / Klient</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <p className="font-bold">{klient?.nazev}</p>
                </div>
                <p className="text-sm ml-6">{klient?.ico}</p>
              </div>

              <div className="space-y-1">
                <Label className="text-xs uppercase text-muted-foreground font-bold">Místo kontroly</Label>
                <div className="flex items-center gap-2 mt-1">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <p className="font-bold">{prac?.nazev}</p>
                </div>
                <p className="text-sm ml-6">{prac?.adresa}, {prac?.mesto}</p>
              </div>

              <div className="space-y-1 pt-4 border-t">
                <Label className="text-xs uppercase text-muted-foreground font-bold">Vytvořeno v systému</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm">{new Date(zaznam.createdAt).toLocaleString('cs-CZ')}</p>
                </div>
              </div>

              {zaznam.zavady.length > 0 && (
                <div className="p-4 bg-red-50 rounded-lg border border-red-100 flex items-start gap-3">
                  <ShieldAlert className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-red-800 uppercase tracking-wider">Upozornění</p>
                    <p className="text-sm text-red-700">Záznam obsahuje nevyřešené závady ({zaznam.zavady.filter(zv => zv.stavOdstraneni !== 'odstranena').length}).</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
