'use client';

import { useData, db } from "@/components/data-provider";
import { Button } from "@/components/ui/button";
import { Card, CardTitle, CardContent } from "@/components/ui/card";
import { 
  Building2, X, Loader2, CheckCircle2, DownloadCloud, Contact, Briefcase, MapPin, ChevronLeft
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, updateDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/app/lib/utils";

export default function EditClientPage() {
  const params = useParams();
  const router = useRouter();
  const { klienti, setKlienti } = useData();
  const { toast } = useToast();

  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingAres, setIsLoadingAres] = useState(false);
  const [editClient, setEditClient] = useState<any>(null);

  // Načtení dat klienta podle ID
  useEffect(() => {
    if (klienti && klienti.length > 0) {
      const client = klienti.find((k: any) => k.id === params.id);
      if (client) {
        // Zajištění kompatibility se starými záznamy (pokud některá pole chybí, doplníme je)
        setEditClient({
          ...client,
          pracoviste: client.pracoviste?.length > 0 ? client.pracoviste : [{ id: "p1", nazev: "", adresa: "" }],
          pozice: client.pozice?.length > 0 ? client.pozice : [{ id: "fix1", nazev: "Zaměstnavatel / provozovatel", isFixed: true }],
          kontakty: client.kontakty?.length > 0 ? client.kontakty : [{ id: "k1", jmeno: "", funkce: "", email: "", telefon: "" }]
        });
      }
    }
  }, [klienti, params.id]);

  const fetchAresData = async () => {
    const cleanIco = editClient.ico.replace(/\s/g, '');
    if (!cleanIco || cleanIco.length !== 8) {
      toast({ title: "Neplatné IČO", description: "Zadejte platné 8místné IČO bez mezer.", variant: "destructive" });
      return;
    }
    
    setIsLoadingAres(true);
    try {
      const response = await fetch(`https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${cleanIco}`);
      if (!response.ok) throw new Error("Subjekt nenalezen nebo chyba spojení");
      
      const data = await response.json();
      
      setEditClient((prev: any) => ({
        ...prev,
        nazev: data.obchodniJmeno || prev.nazev,
        mesto: data.sidlo?.textovaAdresa || data.sidlo?.nazevObce || prev.mesto
      }));
      
      toast({ title: "Údaje načteny", description: "Informace z registru ARES byly úspěšně zaktualizovány." });
    } catch (err) {
      console.error(err);
      toast({ title: "Chyba načítání", description: "Subjekt s tímto IČO nebyl v registru ARES nalezen.", variant: "destructive" });
    } finally {
      setIsLoadingAres(false);
    }
  };

  const handleAddWorkplace = () => setEditClient((p:any) => ({...p, pracoviste: [...p.pracoviste, { id: Math.random().toString(36).substring(7), nazev: "", adresa: "" }]}));
  const handleRemoveWorkplace = (idx: number) => setEditClient((p:any) => ({...p, pracoviste: p.pracoviste.filter((_:any, i:number) => i !== idx)}));
  const handleWorkplaceChange = (idx: number, field: 'nazev'|'adresa', val: string) => {
    setEditClient((p:any) => { const arr = [...p.pracoviste]; arr[idx][field] = val; return { ...p, pracoviste: arr }; });
  };

  const handleAddPozice = () => setEditClient((p:any) => ({...p, pozice: [...p.pozice, { id: Math.random().toString(36).substring(7), nazev: "", isFixed: false }]}));
  const handleRemovePozice = (idx: number) => setEditClient((p:any) => ({...p, pozice: p.pozice.filter((_:any, i:number) => i !== idx)}));
  const handlePoziceChange = (idx: number, val: string) => {
    setEditClient((p:any) => { const arr = [...p.pozice]; arr[idx].nazev = val; return { ...p, pozice: arr }; });
  };

  const handleAddKontakt = () => setEditClient((p:any) => ({...p, kontakty: [...p.kontakty, { id: Math.random().toString(36).substring(7), jmeno: "", funkce: "", email: "", telefon: "" }]}));
  const handleRemoveKontakt = (idx: number) => setEditClient((p:any) => ({...p, kontakty: p.kontakty.filter((_:any, i:number) => i !== idx)}));
  const handleKontaktChange = (idx: number, field: 'jmeno'|'funkce'|'email'|'telefon', val: string) => {
    setEditClient((p:any) => { const arr = [...p.kontakty]; arr[idx][field] = val; return { ...p, kontakty: arr }; });
  };

  const saveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const clientRef = doc(db, 'klienti', editClient.id);
      
      const updatedData = {
        nazev: editClient.nazev,
        ico: editClient.ico,
        mesto: editClient.mesto,
        pracoviste: editClient.pracoviste.filter((p:any) => p.nazev.trim() !== ''),
        pozice: editClient.pozice.filter((p:any) => p.nazev.trim() !== ''),
        kontakty: editClient.kontakty.filter((k:any) => k.jmeno.trim() !== '')
      };

      await updateDoc(clientRef, updatedData);
      
      if (setKlienti) {
        setKlienti((prev: any[]) => prev.map(k => k.id === editClient.id ? { ...k, ...updatedData } : k));
      }
      
      toast({ title: "Úspěšně uloženo", description: "Karta klienta byla zaktualizována." });
      router.push('/klienti');
    } catch (err) {
      console.error(err);
      toast({ title: "Chyba uložení", description: "Změny se nepodařilo uložit.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !editClient) return <div className="p-8 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6 pb-24">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="shrink-0"><Link href="/klienti"><ChevronLeft className="h-5 w-5" /></Link></Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Úprava klienta: {editClient.nazev}</h1>
          <p className="text-muted-foreground text-sm">Aktualizace všech informací, poboček a nastavení pro tohoto klienta.</p>
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <form onSubmit={saveClient}>
          <CardContent className="p-6 space-y-8">
            
            {/* ZÁKLADNÍ ÚDAJE */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b pb-2">
                <Building2 className="h-5 w-5 text-blue-600" />
                <h3 className="font-bold text-slate-800 uppercase tracking-wider text-sm">Identifikační údaje</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="font-bold">IČO *</Label>
                  <div className="flex gap-2">
                    <Input required value={editClient.ico} onChange={e => setEditClient((p:any) => ({...p, ico: e.target.value}))} className="font-mono" />
                    <Button type="button" variant="secondary" onClick={fetchAresData} disabled={isLoadingAres} className="shrink-0 font-bold border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100">
                      {isLoadingAres ? <Loader2 className="h-4 w-4 animate-spin" /> : <DownloadCloud className="h-4 w-4 mr-2" />} Načíst z ARES
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="font-bold">Sídlo společnosti (oficiální)</Label>
                  <Input value={editClient.mesto} onChange={e => setEditClient((p:any) => ({...p, mesto: e.target.value}))} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label className="font-bold">Název společnosti *</Label>
                  <Input required value={editClient.nazev} onChange={e => setEditClient((p:any) => ({...p, nazev: e.target.value}))} className="text-lg font-bold" />
                </div>
              </div>
            </div>

            {/* PROVOZOVNY */}
            <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-amber-600" />
                  <h3 className="font-bold text-slate-800 uppercase tracking-wider text-sm">Provozovny a pracoviště</h3>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={handleAddWorkplace} className="h-8 text-xs font-bold border-amber-200 text-amber-700 hover:bg-amber-50">Přidat</Button>
              </div>
              <div className="space-y-3">
                {editClient.pracoviste.map((prac:any, idx:number) => (
                  <div key={prac.id} className="flex gap-2 items-start bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 flex-1">
                      <div><Label className="text-[10px] uppercase text-muted-foreground mb-1 block">Název pracoviště</Label><Input value={prac.nazev} onChange={(e) => handleWorkplaceChange(idx, 'nazev', e.target.value)} /></div>
                      <div><Label className="text-[10px] uppercase text-muted-foreground mb-1 block">Adresa (volitelné)</Label><Input value={prac.adresa || ''} onChange={(e) => handleWorkplaceChange(idx, 'adresa', e.target.value)} /></div>
                    </div>
                    {editClient.pracoviste.length > 1 && (<Button type="button" variant="ghost" size="icon" className="text-red-500 shrink-0 mt-5" onClick={() => handleRemoveWorkplace(idx)}><X className="h-4 w-4" /></Button>)}
                  </div>
                ))}
              </div>
            </div>

            {/* KONTAKTY */}
            <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                <div className="flex items-center gap-2">
                  <Contact className="h-5 w-5 text-emerald-600" />
                  <h3 className="font-bold text-slate-800 uppercase tracking-wider text-sm">Kontaktní osoby</h3>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={handleAddKontakt} className="h-8 text-xs font-bold border-emerald-200 text-emerald-700 hover:bg-emerald-50">Přidat</Button>
              </div>
              <div className="space-y-3">
                {editClient.kontakty.map((kont:any, idx:number) => (
                  <div key={kont.id} className="flex gap-2 items-start bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 flex-1">
                      <div><Label className="text-[10px] uppercase text-muted-foreground mb-1 block">Jméno</Label><Input value={kont.jmeno} onChange={(e) => handleKontaktChange(idx, 'jmeno', e.target.value)} /></div>
                      <div><Label className="text-[10px] uppercase text-muted-foreground mb-1 block">Funkce</Label><Input value={kont.funkce} onChange={(e) => handleKontaktChange(idx, 'funkce', e.target.value)} /></div>
                      <div><Label className="text-[10px] uppercase text-muted-foreground mb-1 block">E-mail</Label><Input type="email" value={kont.email} onChange={(e) => handleKontaktChange(idx, 'email', e.target.value)} /></div>
                      <div><Label className="text-[10px] uppercase text-muted-foreground mb-1 block">Telefon</Label><Input value={kont.telefon} onChange={(e) => handleKontaktChange(idx, 'telefon', e.target.value)} /></div>
                    </div>
                    {editClient.kontakty.length > 1 && (<Button type="button" variant="ghost" size="icon" className="text-red-500 shrink-0 mt-5" onClick={() => handleRemoveKontakt(idx)}><X className="h-4 w-4" /></Button>)}
                  </div>
                ))}
              </div>
            </div>

            {/* POZICE */}
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b pb-2">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-purple-600" />
                  <h3 className="font-bold text-slate-800 uppercase tracking-wider text-sm">Přednastavené pracovní pozice</h3>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={handleAddPozice} className="h-8 text-xs font-bold border-purple-200 text-purple-700 hover:bg-purple-50">Přidat pozici</Button>
              </div>
              <div className="flex flex-wrap gap-3">
                {editClient.pozice.map((poz:any, idx:number) => (
                  <div key={poz.id} className={cn("flex items-center p-1 rounded-md border", poz.isFixed ? "bg-slate-100 border-slate-300" : "bg-white border-blue-200")}>
                    <Input value={poz.nazev} onChange={(e) => handlePoziceChange(idx, e.target.value)} disabled={poz.isFixed} className={cn("h-8 border-none focus-visible:ring-0 shadow-none w-48 text-xs font-medium", poz.isFixed && "text-slate-500")} />
                    {!poz.isFixed && (<Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-red-400 hover:text-red-600 hover:bg-red-50 ml-1 shrink-0" onClick={() => handleRemovePozice(idx)}><X className="h-3 w-3" /></Button>)}
                  </div>
                ))}
              </div>
            </div>

          </CardContent>
          <div className="p-6 border-t bg-slate-50 flex justify-end gap-3 rounded-b-lg">
            <Button type="button" variant="outline" asChild><Link href="/klienti">Zrušit</Link></Button>
            <Button type="submit" disabled={isSaving} className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-8">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />} Uložit všechny změny
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
