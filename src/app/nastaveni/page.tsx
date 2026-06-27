'use client';

import { db } from "@/components/data-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { Camera, CheckCircle2, Loader2, ShieldCheck, Signature, Upload, X } from "lucide-react";
import { useEffect, useState } from "react";

// Funkce pro kompresi a převod razítka na Base64
const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        // Pro razítko stačí menší rozlišení, aby nezabíralo moc místa v DB
        const MAX_WIDTH = 500; 
        const MAX_HEIGHT = 500;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        // Vyšší komprese (0.6) pro úsporu místa, u razítka to bohatě stačí
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};

export default function NastaveniAuditoraPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Hlavní stav pro údaje auditora
  const [auditorData, setAuditorData] = useState({
    jmeno: "",
    titul: "",
    email: "",
    telefon: "",
    firmaNazev: "",
    firmaIco: "",
    firmaAdresa: "",
    zpusobilostNazev: "",
    cisloOsvědceni: "",
    razitkoBase64: ""
  });

  // Načtení stávajícího nastavení z Firebase při otevření stránky
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const docRef = doc(db, "konfigurace", "auditor");
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          setAuditorData(prev => ({
            ...prev,
            ...docSnap.data()
          }));
        }
      } catch (error) {
        console.error("Chyba při načítání nastavení:", error);
        toast({
          title: "Chyba načítání",
          description: "Nepodařilo se stáhnout vaše nastavení z cloudu.",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [toast]);

  // Handler pro uložení změn
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const docRef = doc(db, "konfigurace", "auditor");
      // Uložíme čistý JSON bez undefined hodnot
      const cleanData = JSON.parse(JSON.stringify(auditorData));
      await setDoc(docRef, cleanData);

      toast({
        title: "Nastavení uloženo",
        description: "Vaše certifikace, údaje a otisk razítka byly úspěšně aktualizovány.",
      });
    } catch (error) {
      console.error("Chyba při ukládání nastavení:", error);
      toast({
        title: "Chyba uložení",
        description: "Nepodařilo se nahrát data do cloudu. Zkontrolujte velikost obrázku razítka.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-4">
        <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
        <p className="text-muted-foreground text-sm font-medium">Načítám konfiguraci z cloudu...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-8 pb-24">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Nastavení auditora</h1>
        <p className="text-muted-foreground">Správa vašich profesních údajů, certifikátů a autorizačního razítka.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        
        {/* PROFESNÍ ZPŮSOBILOST A OSVĚDČENÍ */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="bg-slate-50/50 border-b">
            <CardTitle className="text-base flex items-center gap-2 text-slate-800">
              <ShieldCheck className="h-5 w-5 text-blue-600" /> Profesní způsobilost a oprávnění
            </CardTitle>
            <CardDescription>Tyto údaje se budou automaticky generovat do závěrečných ustanovení PDF zpráv.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="zpusobilost" className="font-bold">Přesný název způsobilosti</Label>
              <Input 
                id="zpusobilost"
                placeholder="Např. Osoba odborně způsobilá v prevenci rizik (OZO) nebo Technik PO" 
                value={auditorData.zpusobilostNazev}
                onChange={e => setAuditorData(p => ({ ...p, zpusobilostNazev: e.target.value }))}
                className="h-11 bg-white"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="osvedceni" className="font-bold">Číslo osvědčení / certifikátu</Label>
              <Input 
                id="osvedceni"
                placeholder="Např. RO/000/OZO/2026 nebo ev. č. AZO-123-00/PO" 
                value={auditorData.cisloOsvědceni}
                onChange={e => setAuditorData(p => ({ ...p, cisloOsvědceni: e.target.value }))}
                className="h-11 bg-white"
              />
            </div>
          </CardContent>
        </Card>

        {/* OSOBNÍ A KONTAKTNÍ ÚDAJE */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="bg-slate-50/50 border-b">
            <CardTitle className="text-base flex items-center gap-2 text-slate-800">
              <Signature className="h-5 w-5 text-emerald-600" /> Identifikační a kontaktní údaje
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="jmeno" className="font-bold">Jméno a příjmení</Label>
                <Input 
                  id="jmeno" 
                  value={auditorData.jmeno}
                  onChange={e => setAuditorData(p => ({ ...p, jmeno: e.target.value }))}
                  placeholder="Jan Novák" 
                  className="h-11 bg-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="titul" className="font-bold">Tituly (před / za)</Label>
                <Input 
                  id="titul" 
                  value={auditorData.titul}
                  onChange={e => setAuditorData(p => ({ ...p, titul: e.target.value }))}
                  placeholder="Ing." 
                  className="h-11 bg-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="font-bold">E-mail</Label>
                <Input 
                  id="email" 
                  type="email"
                  value={auditorData.email}
                  onChange={e => setAuditorData(p => ({ ...p, email: e.target.value }))}
                  placeholder="novak@email.cz" 
                  className="h-11 bg-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="telefon" className="font-bold">Telefon</Label>
                <Input 
                  id="telefon" 
                  value={auditorData.telefon}
                  onChange={e => setAuditorData(p => ({ ...p, telefon: e.target.value }))}
                  placeholder="+420 123 456 789" 
                  className="h-11 bg-white"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 space-y-4">
              <h4 className="font-bold text-sm text-slate-700 uppercase tracking-wider">Fakturační hlavička poskytovatele</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="firmaNazev" className="font-bold">Obchodní jméno / Společnost</Label>
                  <Input 
                    id="firmaNazev" 
                    value={auditorData.firmaNazev}
                    onChange={e => setAuditorData(p => ({ ...p, firmaNazev: e.target.value }))}
                    placeholder="BPyes s.r.o." 
                    className="h-11 bg-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="firmaIco" className="font-bold">IČO</Label>
                  <Input 
                    id="firmaIco" 
                    value={auditorData.firmaIco}
                    onChange={e => setAuditorData(p => ({ ...p, firmaIco: e.target.value }))}
                    placeholder="04399421" 
                    className="h-11 bg-white font-mono"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="firmaAdresa" className="font-bold">Sídlo podnikání / Adresa</Label>
                  <Input 
                    id="firmaAdresa" 
                    value={auditorData.firmaAdresa}
                    onChange={e => setAuditorData(p => ({ ...p, firmaAdresa: e.target.value }))}
                    placeholder="Ulice 123, 790 01 Jeseník" 
                    className="h-11 bg-white"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* OTISK RAZÍTKA A PODPISU */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="bg-slate-50/50 border-b">
            <CardTitle className="text-base flex items-center gap-2 text-slate-800">
              <Camera className="h-5 w-5 text-amber-600" /> Otisk kulatého razítka a podpisu
            </CardTitle>
            <CardDescription>Nahrajte naskenovaný nebo vyfocený otisk vašeho razítka s podpisem (ideálně na bílém podkladu). Obrázek se automaticky vloží do patky PDF protokolů.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 flex flex-col md:flex-row items-center gap-8">
            
            {/* OBLAST PRO NAHRÁNÍ OBRÁZKU */}
            <div className="w-full md:w-1/2 flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-xl p-8 bg-slate-50/50 hover:bg-slate-50 transition-colors relative group">
              <Upload className="h-8 w-8 text-slate-400 mb-3 group-hover:scale-110 transition-transform" />
              <p className="text-xs font-bold text-slate-700 text-center mb-1">Klikněte pro nahrání obrázku razítka</p>
              <p className="text-[10px] text-muted-foreground text-center">Podporuje formáty JPG, PNG (max 5 MB)</p>
              
              <Input 
                type="file" 
                accept="image/*" 
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" 
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    const compressed = await compressImage(file);
                    setAuditorData(p => ({ ...p, razitkoBase64: compressed }));
                    toast({ title: "Obrázek zpracován", description: "Otisk razítka byl připraven k uložení." });
                  } catch (err) {
                    toast({ title: "Chyba zpracování", description: "Obrázek se nepodařilo zkomprimovat.", variant: "destructive" });
                  }
                }}
              />
            </div>

            {/* ŽIVÝ NÁHLED NAHRANÉHO RAZÍTKA */}
            <div className="w-full md:w-1/2 flex flex-col items-center justify-center bg-white p-4 rounded-xl border border-slate-200 min-h-[180px] shadow-inner relative">
              {auditorData.razitkoBase64 ? (
                <>
                  <Button 
                    type="button"
                    variant="destructive" 
                    size="icon" 
                    className="absolute -top-2 -right-2 h-7 w-7 rounded-full shadow-md"
                    onClick={() => setAuditorData(p => ({ ...p, razitkoBase64: "" }))}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <img 
                    src={auditorData.razitkoBase64} 
                    alt="Otisk razítka auditora" 
                    className="max-h-36 w-auto object-contain rounded-md border p-1 bg-white shadow-sm" 
                  />
                  <span className="text-[10px] font-bold text-emerald-600 mt-2 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Razítko je připraveno v mezipaměti
                  </span>
                </>
              ) : (
                <div className="text-center space-y-1 text-slate-400">
                  <Camera className="h-8 w-8 mx-auto stroke-[1.5]" />
                  <p className="text-xs italic">Žádné razítko zatím nebylo nahráno</p>
                </div>
              )}
            </div>

          </CardContent>
        </Card>

        {/* FIXNÍ SPODNÍ LIŠTA PRO UKLÁDÁNÍ */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 z-50 flex justify-center shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
          <div className="max-w-4xl w-full flex justify-end px-4 md:px-8">
            <Button 
              type="submit" 
              disabled={isSaving} 
              className="h-11 px-10 bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md transition-all"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" /> Ukládám konfiguraci...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" /> Uložit nastavení auditora
                </>
              )}
            </Button>
          </div>
        </div>

      </form>
    </div>
  );
}
