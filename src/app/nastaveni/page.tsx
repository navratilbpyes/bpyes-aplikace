'use client';

import { useData } from "@/components/data-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Shield, Save, Award, Info, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function SettingsPage() {
  const { nastaveni, setNastaveni } = useData();
  const { toast } = useToast();

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    toast({
      title: "Uloženo",
      description: "Nastavení auditora bylo úspěšně aktualizováno.",
    });
  };

  // Bezpečnostní pojistka: Dokud se data z cloudu nenačtou, zobrazujeme loading obrazovku
  if (!nastaveni) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <p className="text-muted-foreground text-sm font-medium">Načítám nastavení z cloudu...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Nastavení</h1>
        <p className="text-muted-foreground">Konfigurace profilu auditora a certifikací.</p>
      </div>

      <div className="grid grid-cols-1 gap-8">
        <form onSubmit={handleSave} className="space-y-6">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/5 text-primary">
                  <Shield className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle>Profil společnosti</CardTitle>
                  <CardDescription>Tyto údaje budou použity v hlavičce auditních zpráv.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nazev">Název společnosti</Label>
                  <Input 
                    id="nazev" 
                    value={nastaveni.nazev || ""} 
                    onChange={(e) => setNastaveni({...nastaveni, nazev: e.target.value})} 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ico">IČO</Label>
                  <Input 
                    id="ico" 
                    value={nastaveni.ico || ""} 
                    onChange={(e) => setNastaveni({...nastaveni, ico: e.target.value})} 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="adresa">Sídlo společnosti</Label>
                <Input 
                  id="adresa" 
                  value={nastaveni.adresa || ""} 
                  onChange={(e) => setNastaveni({...nastaveni, adresa: e.target.value})} 
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/5 text-primary">
                  <Award className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle>Údaje o auditorovi</CardTitle>
                  <CardDescription>Identifikace odborně způsobilé osoby.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="auditor">Jméno auditora</Label>
                <Input 
                  id="auditor" 
                  value={nastaveni.auditor || ""} 
                  onChange={(e) => setNastaveni({...nastaveni, auditor: e.target.value})} 
                />
              </div>
              
              <div className="space-y-4">
                <Label>Čísla certifikací</Label>
                <div className="space-y-3">
                  {(nastaveni.certifikace || []).map((cert: string, index: number) => (
                    <div key={index} className="flex gap-2">
                      <Input 
                        value={cert} 
                        onChange={(e) => {
                          const newCerts = [...nastaveni.certifikace];
                          newCerts[index] = e.target.value;
                          setNastaveni({...nastaveni, certifikace: newCerts});
                        }}
                      />
                    </div>
                  ))}
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => setNastaveni({...nastaveni, certifikace: [...(nastaveni.certifikace || []), ""]})}
                  >
                    Přidat další certifikát
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button type="submit" className="h-11 px-8">
              <Save className="mr-2 h-4 w-4" />
              Uložit nastavení
            </Button>
          </div>
        </form>

        <Card className="border-none bg-blue-50 text-blue-800 shadow-none">
          <CardContent className="p-6 flex gap-4">
            <Info className="h-5 w-5 shrink-0" />
            <div className="space-y-1">
              <p className="font-bold">O aplikaci BPyes AuditFlow</p>
              <p className="text-sm opacity-90">Verze 1.0.0. Aplikace bezpečně synchronizuje svá data s podnikovým řešením Google Firebase.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
