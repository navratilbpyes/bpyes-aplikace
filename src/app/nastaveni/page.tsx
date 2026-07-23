'use client';

import { compressImage, RAZITKO_PODPIS } from "@/lib/obrazky";
import { db } from "@/components/data-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { 
  Camera, CheckCircle2, Loader2, ShieldCheck, Signature, 
  Upload, X, Plus, Trash2, Award, Briefcase
} from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/app/lib/utils";

// NEPRŮSTŘELNÁ KOMPRESE S BÍLÝM POZADÍM


export default function NastaveniAuditoraPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [auditorData, setAuditorData] = useState({
    jmeno: "",
    titul: "",
    email: "",
    telefon: "",
    firmaNazev: "",
    firmaIco: "",
    firmaAdresa: "",
    certifikace: [{ id: "c1", nazev: "", cislo: "" }],
    razitkoBase64: "",
    podpisBase64: ""
  });

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const docRef = doc(db, "konfigurace", "auditor");
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          setAuditorData(prev => ({
            ...prev,
            ...data,
            certifikace: data.certifikace && data.certifikace.length > 0 
              ? data.certifikace 
              : [{ id: "c1", nazev: data.zpusobilostNazev || "", cislo: data.cisloOsvědceni || "" }]
          }));
        }
      } catch (error) {
        toast({ title: "Chyba načítání", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    };
    loadSettings();
  }, [toast]);

  const addCertifikace = () => {
    setAuditorData(p => ({
      ...p,
      certifikace: [...p.certifikace, { id: Math.random().toString(36).substring(7), nazev: "", cislo: "" }]
    }));
  };

  const removeCertifikace = (idx: number) => {
    if (auditorData.certifikace.length <= 1) return;
    setAuditorData(p => ({
      ...p,
      certifikace: p.certifikace.filter((_, i) => i !== idx)
    }));
  };

  const updateCertifikace = (idx: number, field: 'nazev' | 'cislo', val: string) => {
    const newCerts = [...auditorData.certifikace];
    newCerts[idx][field] = val;
    setAuditorData(p => ({ ...p, certifikace: newCerts }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const docRef = doc(db, "konfigurace", "auditor");
      const cleanData = JSON.parse(JSON.stringify(auditorData));
      await setDoc(docRef, cleanData);
      toast({ title: "Nastavení uloženo", description: "Všechny údaje, certifikace i podpisy byly uloženy." });
    } catch (error) {
      toast({ title: "Chyba uložení", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-4">
      <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
      <p className="text-muted-foreground text-sm font-medium">Načítám konfiguraci...</p>
    </div>
  );

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8 pb-24">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Nastavení auditora</h1>
        <p className="text-muted-foreground">Správa profesních způsobilostí, identifikačních údajů a podpisových vzorů.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        
        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b">
            <div className="flex justify-between items-center">
              <div className="space-y-1">
                <CardTitle className="text-base flex items-center gap-2 text-slate-800">
                  <Award className="h-5 w-5 text-blue-600" /> Profesní způsobilosti a osvědčení
                </CardTitle>
                <CardDescription>Zadejte všechna svá oprávnění.</CardDescription>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addCertifikace} className="font-bold border-blue-200 text-blue-700 hover:bg-blue-50">
                <Plus className="h-4 w-4 mr-1" /> Přidat způsobilost
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {auditorData.certifikace.map((cert, idx) => (
              <div key={cert.id} className="flex gap-4 items-end bg-white p-4 rounded-lg border border-slate-100 shadow-sm">
                <div className="flex-1 space-y-2">
                  <Label className="text-[10px] uppercase font-bold text-slate-500">Název způsobilosti</Label>
                  <Input placeholder="Např. Odborně způsobilá osoba..." value={cert.nazev} onChange={e => updateCertifikace(idx, 'nazev', e.target.value)} />
                </div>
                <div className="flex-1 space-y-2">
                  <Label className="text-[10px] uppercase font-bold text-slate-500">Číslo osvědčení / certifikátu</Label>
                  <Input placeholder="Např. RO/000/OZO/2026" value={cert.cislo} onChange={e => updateCertifikace(idx, 'cislo', e.target.value)} />
                </div>
                {auditorData.certifikace.length > 1 && (
                  <Button type="button" variant="ghost" size="icon" className="text-red-400 hover:text-red-600 hover:bg-red-50 mb-0.5" onClick={() => removeCertifikace(idx)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="bg-slate-50/50 border-b">
            <CardTitle className="text-base flex items-center gap-2 text-slate-800">
              <Signature className="h-5 w-5 text-emerald-600" /> Identifikační a kontaktní údaje
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2"><Label className="font-bold">Jméno a příjmení</Label><Input value={auditorData.jmeno} onChange={e => setAuditorData(p => ({ ...p, jmeno: e.target.value }))} placeholder="Jan Novák" className="h-11" /></div>
              <div className="space-y-2"><Label className="font-bold">Tituly</Label><Input value={auditorData.titul} onChange={e => setAuditorData(p => ({ ...p, titul: e.target.value }))} placeholder="Ing." className="h-11" /></div>
              <div className="space-y-2"><Label className="font-bold">E-mail</Label><Input value={auditorData.email} onChange={e => setAuditorData(p => ({ ...p, email: e.target.value }))} type="email" placeholder="novak@bpyes.cz" className="h-11" /></div>
              <div className="space-y-2"><Label className="font-bold">Telefon</Label><Input value={auditorData.telefon} onChange={e => setAuditorData(p => ({ ...p, telefon: e.target.value }))} placeholder="+420 123 456 789" className="h-11" /></div>
            </div>

            <div className="pt-6 border-t border-slate-100 space-y-4">
              <h4 className="font-bold text-xs text-slate-400 uppercase tracking-widest">Fakturační hlavička auditora</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2"><Label className="font-bold">Společnost</Label><Input value={auditorData.firmaNazev} onChange={e => setAuditorData(p => ({ ...p, firmaNazev: e.target.value }))} /></div>
                <div className="space-y-2"><Label className="font-bold">IČO</Label><Input value={auditorData.firmaIco} onChange={e => setAuditorData(p => ({ ...p, firmaIco: e.target.value }))} className="font-mono" /></div>
                <div className="space-y-2 md:col-span-2"><Label className="font-bold">Adresa sídla</Label><Input value={auditorData.firmaAdresa} onChange={e => setAuditorData(p => ({ ...p, firmaAdresa: e.target.value }))} /></div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-slate-200 shadow-sm flex flex-col">
            <CardHeader className="bg-slate-50/50 border-b">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Camera className="h-4 w-4 text-amber-600" /> Kulaté razítko
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6 flex-1 flex flex-col">
              <div className="relative group flex-1 min-h-[160px] border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/30 flex flex-col items-center justify-center p-4">
                {auditorData.razitkoBase64 ? (
                  <>
                    <img src={auditorData.razitkoBase64} alt="Razítko" className="max-h-32 object-contain" />
                    <Button type="button" variant="destructive" size="icon" className="absolute -top-2 -right-2 h-6 w-6 rounded-full shadow-lg" onClick={() => setAuditorData(p => ({ ...p, razitkoBase64: "" }))}><X className="h-3 w-3" /></Button>
                  </>
                ) : (
                  <div className="text-center space-y-2">
                    <Upload className="h-6 w-6 mx-auto text-slate-400" />
                    <p className="text-[10px] font-bold text-slate-600">Klikněte pro nahrání</p>
                    <Input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" 
                      onChange={async (e) => {
                        const file = e.target.files?.[0]; if (!file) return;
                        const res = await compressImage(file, RAZITKO_PODPIS); setAuditorData(p => ({ ...p, razitkoBase64: res }));
                      }} 
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm flex flex-col">
            <CardHeader className="bg-slate-50/50 border-b">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Signature className="h-4 w-4 text-blue-600" /> Vlastnoruční podpis
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6 flex-1 flex flex-col">
              <div className="relative group flex-1 min-h-[160px] border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/30 flex flex-col items-center justify-center p-4">
                {auditorData.podpisBase64 ? (
                  <>
                    <img src={auditorData.podpisBase64} alt="Podpis" className="max-h-32 object-contain" />
                    <Button type="button" variant="destructive" size="icon" className="absolute -top-2 -right-2 h-6 w-6 rounded-full shadow-lg" onClick={() => setAuditorData(p => ({ ...p, podpisBase64: "" }))}><X className="h-3 w-3" /></Button>
                  </>
                ) : (
                  <div className="text-center space-y-2">
                    <Upload className="h-6 w-6 mx-auto text-slate-400" />
                    <p className="text-[10px] font-bold text-slate-600">Klikněte pro nahrání</p>
                    <Input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" 
                      onChange={async (e) => {
                        const file = e.target.files?.[0]; if (!file) return;
                        const res = await compressImage(file, RAZITKO_PODPIS); setAuditorData(p => ({ ...p, podpisBase64: res }));
                      }} 
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 z-50 flex justify-center shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
          <div className="max-w-5xl w-full flex justify-end px-4 md:px-8">
            <Button type="submit" disabled={isSaving} className="h-11 px-10 bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md transition-all">
              {isSaving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Ukládám...</> : <><CheckCircle2 className="h-4 w-4 mr-2" /> Uložit vše do cloudu</>}
            </Button>
          </div>
        </div>
      </form>

      {/* Číselníky mají vlastní ukládání, proto stojí mimo formulář auditora. */}
      <div className="max-w-5xl mx-auto px-4 md:px-8 pb-32 space-y-8">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight">Číselníky</h2>
          <p className="text-sm text-muted-foreground">
            Katalogy školení a revizí. Při přiřazení klientovi se hodnoty zkopírují —
            pozdější úprava zde už přiřazené položky nezmění.
          </p>
        </div>
        <CiselnikSkoleni />
        <CiselnikRevizi />
      </div>
    </div>
  );
}
