'use client';

import { useData, db } from "@/components/data-provider";
import { Button } from "@/components/ui/button";
import { Card, CardTitle, CardContent } from "@/components/ui/card";
import { 
  Plus, Search, Building2, MoreHorizontal, Eye, Edit2, 
  ClipboardCheck, X, Loader2, CheckCircle2, DownloadCloud, Contact, Briefcase, MapPin
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useState, useMemo } from "react";
import { formatCzechDate } from "@/app/lib/utils";
import { doc, collection, setDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";

export default function ClientsPage() {
  const { klienti, setKlienti, zaznamy, isLoading } = useData();
  const { toast } = useToast();
  const [search, setSearch] = useState("");

  // Stavy pro modální okno "Přidat klienta"
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingAres, setIsLoadingAres] = useState(false);
  
  // Komplexní stav pro nového klienta (vč. nových sekcí)
  const [newClient, setNewClient] = useState({
    nazev: "",
    ico: "",
    mesto: "",
    pracoviste: [{ id: "p1", nazev: "", adresa: "" }],
    pozice: [{ id: "fix1", nazev: "Zaměstnavatel / provozovatel", isFixed: true }],
    kontakty: [{ id: "k1", jmeno: "", funkce: "", email: "", telefon: "" }]
  });

  const filteredKlienti = useMemo(() => {
    return klienti.filter(k => 
      k.nazev?.toLowerCase().includes(search.toLowerCase()) || 
      k.ico?.includes(search)
    );
  }, [klienti, search]);

  // --- LOGIKA ARES API ---
  const fetchAresData = async () => {
    const cleanIco = newClient.ico.replace(/\s/g, '');
    if (!cleanIco || cleanIco.length !== 8) {
      toast({ title: "Neplatné IČO", description: "Zadejte platné 8místné IČO bez mezer.", variant: "destructive" });
      return;
    }
    
    setIsLoadingAres(true);
    try {
      // Volání oficiálního ARES REST API
      const response = await fetch(`https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${cleanIco}`);
      if (!response.ok) throw new Error("Subjekt nenalezen nebo chyba spojení");
      
      const data = await response.json();
      
      setNewClient(prev => ({
        ...prev,
        nazev: data.obchodniJmeno || prev.nazev,
        // Sídlo může být ve formátu textové adresy, nebo jen obec
        mesto: data.sidlo?.textovaAdresa || data.sidlo?.nazevObce || prev.mesto
      }));
      
      toast({ title: "Údaje načteny", description: "Informace z registru ARES byly úspěšně vyplněny." });
    } catch (err) {
      console.error(err);
      toast({ title: "Chyba načítání", description: "Subjekt s tímto IČO nebyl v registru ARES nalezen.", variant: "destructive" });
    } finally {
      setIsLoadingAres(false);
    }
  };

  // --- HANDLERY PRO DYNAMICKÉ SEZNAMY ---
  // 1. Provozovny
  const handleAddWorkplace = () => setNewClient(p => ({...p, pracoviste: [...p.pracoviste, { id: Math.random().toString(36).substring(7), nazev: "", adresa: "" }]}));
  const handleRemoveWorkplace = (idx: number) => setNewClient(p => ({...p, pracoviste: p.pracoviste.filter((_, i) => i !== idx)}));
  const handleWorkplaceChange = (idx: number, field: 'nazev'|'adresa', val: string) => {
    setNewClient(p => { const arr = [...p.pracoviste]; arr[idx][field] = val; return { ...p, pracoviste: arr }; });
  };

  // 2. Pozice
  const handleAddPozice = () => setNewClient(p => ({...p, pozice: [...p.pozice, { id: Math.random().toString(36).substring(7), nazev: "", isFixed: false }]}));
  const handleRemovePozice = (idx: number) => setNewClient(p => ({...p, pozice: p.pozice.filter((_, i) => i !== idx)}));
  const handlePoziceChange = (idx: number, val: string) => {
    setNewClient(p => { const arr = [...p.pozice]; arr[idx].nazev = val; return { ...p, pozice: arr }; });
  };

  // 3. Kontakty
  const handleAddKontakt = () => setNewClient(p => ({...p, kontakty: [...p.kontakty, { id: Math.random().toString(36).substring(7), jmeno: "", funkce: "", email: "", telefon: "" }]}));
  const handleRemoveKontakt = (idx: number) => setNewClient(p => ({...p, kontakty: p.kontakty.filter((_, i) => i !== idx)}));
  const handleKontaktChange = (idx: number, field: 'jmeno'|'funkce'|'email'|'telefon', val: string) => {
    setNewClient(p => { const arr = [...p.kontakty]; arr[idx][field] = val; return { ...p, kontakty: arr }; });
  };

  // --- ULOŽENÍ DO DATABÁZE ---
  const saveNewClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const newRef = doc(collection(db, 'klienti'));
      const clientData = {
        id: newRef.id,
        nazev: newClient.nazev,
        ico: newClient.ico,
        mesto: newClient.mesto,
        // Uložení s odfiltrováním prázdných řádků
        pracoviste: newClient.pracoviste.filter(p => p.nazev.trim() !== ''),
        pozice: newClient.pozice.filter(p => p.nazev.trim() !== ''),
        kontakty: newClient.kontakty.filter(k => k.jmeno.trim() !== ''),
        odpovedneOsoby: [] // Pro zpětnou kompatibilitu, pokud by to jinde aplikace očekávala
      };

      await setDoc(newRef, clientData);
      
      if (setKlienti) {
        setKlienti((prev: any[]) => [...prev, clientData]);
      }
      
      setIsAddModalOpen(false);
      // Reset formuláře
      setNewClient({
        nazev: "", ico: "", mesto: "",
        pracoviste: [{ id: "p1", nazev: "", adresa: "" }],
        pozice: [{ id: "fix1", nazev: "Zaměstnavatel / provozovatel", isFixed: true }],
        kontakty: [{ id: "k1", jmeno: "", funkce: "", email: "", telefon: "" }]
      });
      toast({ title: "Klient přidán", description: "Nový subjekt a všechny jeho vazby byly úspěšně uloženy." });
    } catch (err) {
      console.error(err);
      toast({ title: "Chyba uložení", description: "Nepodařilo se uložit klienta do databáze.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className="p-8 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 relative">
      
      {/* MODÁLNÍ OKNO PRO PŘIDÁNÍ KLIENTA (Nyní podstatně širší kvůli kontaktům) */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4 animate-in fade-in backdrop-blur-sm">
          <Card className="w-full max-w-4xl shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[95vh]">
            <div className="flex justify-between items-center p-6 border-b shrink-0">
              <div>
                <CardTitle className="text-xl font-bold">Přidat nového klienta</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">Komplexní karta kontrolovaného subjektu (Údaje, Provozovny, Pozice, Kontakty).</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setIsAddModalOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            
            <form onSubmit={saveNewClient} className="flex flex-col overflow-hidden">
              <CardContent className="p-6 space-y-8 overflow-y-auto">
                
                {/* ZÁKLADNÍ ÚDAJE + ARES */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-b pb-2">
                    <Building2 className="h-5 w-5 text-blue-600" />
                    <h3 className="font-bold text-slate-800 uppercase tracking-wider text-sm">Identifikační údaje</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="font-bold">IČO *</Label>
                      <div className="flex gap-2">
                        <Input required value={newClient.ico} onChange={e => setNewClient(p => ({...p, ico: e.target.value}))} placeholder="Např. 04399421" className="font-mono" />
                        <Button type="button" variant="secondary" onClick={fetchAresData} disabled={isLoadingAres} className="shrink-0 font-bold border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100">
                          {isLoadingAres ? <Loader2 className="h-4 w-4 animate-spin" /> : <DownloadCloud className="h-4 w-4 mr-2" />}
                          Načíst z ARES
                        </Button>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="font-bold">Sídlo společnosti (oficiální)</Label>
                      <Input value={newClient.mesto} onChange={e => setNewClient(p => ({...p, mesto: e.target.value}))} placeholder="Bude načteno z ARES..." />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label className="font-bold">Název společnosti *</Label>
                      <Input required value={newClient.nazev} onChange={e => setNewClient(p => ({...p, nazev: e.target.value}))} placeholder="Bude načteno z ARES..." className="text-lg font-bold" />
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
                    <Button type="button" variant="outline" size="sm" onClick={handleAddWorkplace} className="h-8 text-xs font-bold border-amber-200 text-amber-700 hover:bg-amber-50">
                      <Plus className="h-3 w-3 mr-1" /> Přidat
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {newClient.pracoviste.map((prac, idx) => (
                      <div key={prac.id} className="flex gap-2 items-start bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 flex-1">
                          <div>
                            <Label className="text-[10px] uppercase text-muted-foreground mb-1 block">Název pracoviště</Label>
                            <Input placeholder={`Např. Hlavní výrobní hala...`} value={prac.nazev} onChange={(e) => handleWorkplaceChange(idx, 'nazev', e.target.value)} />
                          </div>
                          <div>
                            <Label className="text-[10px] uppercase text-muted-foreground mb-1 block">Adresa (volitelné)</Label>
                            <Input placeholder={`Např. Průmyslová 12...`} value={prac.adresa} onChange={(e) => handleWorkplaceChange(idx, 'adresa', e.target.value)} />
                          </div>
                        </div>
                        {newClient.pracoviste.length > 1 && (
                          <Button type="button" variant="ghost" size="icon" className="text-red-500 shrink-0 mt-5" onClick={() => handleRemoveWorkplace(idx)}>
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* KONTAKTNÍ OSOBY */}
                <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                    <div className="flex items-center gap-2">
                      <Contact className="h-5 w-5 text-emerald-600" />
                      <h3 className="font-bold text-slate-800 uppercase tracking-wider text-sm">Kontaktní osoby</h3>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={handleAddKontakt} className="h-8 text-xs font-bold border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                      <Plus className="h-3 w-3 mr-1" /> Přidat
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {newClient.kontakty.map((kont, idx) => (
                      <div key={kont.id} className="flex gap-2 items-start bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 flex-1">
                          <div><Label className="text-[10px] uppercase text-muted-foreground mb-1 block">Jméno a příjmení</Label><Input placeholder="Jan Novák" value={kont.jmeno} onChange={(e) => handleKontaktChange(idx, 'jmeno', e.target.value)} /></div>
                          <div><Label className="text-[10px] uppercase text-muted-foreground mb-1 block">Funkce</Label><Input placeholder="Vedoucí pobočky" value={kont.funkce} onChange={(e) => handleKontaktChange(idx, 'funkce', e.target.value)} /></div>
                          <div><Label className="text-[10px] uppercase text-muted-foreground mb-1 block">E-mail</Label><Input type="email" placeholder="jan@firma.cz" value={kont.email} onChange={(e) => handleKontaktChange(idx, 'email', e.target.value)} /></div>
                          <div><Label className="text-[10px] uppercase text-muted-foreground mb-1 block">Telefon</Label><Input placeholder="+420..." value={kont.telefon} onChange={(e) => handleKontaktChange(idx, 'telefon', e.target.value)} /></div>
                        </div>
                        {newClient.kontakty.length > 1 && (
                          <Button type="button" variant="ghost" size="icon" className="text-red-500 shrink-0 mt-5" onClick={() => handleRemoveKontakt(idx)}>
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* PRACOVNÍ POZICE */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b pb-2">
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-5 w-5 text-purple-600" />
                      <h3 className="font-bold text-slate-800 uppercase tracking-wider text-sm">Přednastavené pracovní pozice</h3>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={handleAddPozice} className="h-8 text-xs font-bold border-purple-200 text-purple-700 hover:bg-purple-50">
                      <Plus className="h-3 w-3 mr-1" /> Přidat pozici
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Tyto pozice se vám budou primárně nabízet v roletkách při odstraňování závad u tohoto klienta.</p>
                  
                  <div className="flex flex-wrap gap-3">
                    {newClient.pozice.map((poz, idx) => (
                      <div key={poz.id} className={cn("flex items-center p-1 rounded-md border", poz.isFixed ? "bg-slate-100 border-slate-300" : "bg-white border-blue-200")}>
                        <Input 
                          value={poz.nazev} 
                          onChange={(e) => handlePoziceChange(idx, e.target.value)} 
                          disabled={poz.isFixed}
                          className={cn("h-8 border-none focus-visible:ring-0 shadow-none w-48 text-xs font-medium", poz.isFixed && "text-slate-500")}
                          placeholder="Zadejte název pozice..."
                        />
                        {!poz.isFixed && (
                          <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-red-400 hover:text-red-600 hover:bg-red-50 ml-1 shrink-0" onClick={() => handleRemovePozice(idx)}>
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

              </CardContent>
              <div className="p-6 border-t bg-slate-50 flex justify-end gap-3 shrink-0 rounded-b-xl">
                <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>Zrušit</Button>
                <Button type="submit" disabled={isSaving} className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-8">
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />} Vytvořit kartu klienta
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* HLAVIČKA STRÁNKY A VYHLEDÁVÁNÍ */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Klienti</h1>
          <p className="text-muted-foreground">Správa vašich zákazníků a jejich pracovišť.</p>
        </div>
        <Button onClick={() => setIsAddModalOpen(true)} className="h-11 bg-slate-900 text-white hover:bg-slate-800 font-bold px-6 shadow-sm">
          <Plus className="mr-2 h-5 w-5" />
          Přidat nového klienta
        </Button>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Hledat klienta podle názvu nebo IČO..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 h-11 bg-white shadow-sm border-slate-200" />
        </div>
      </div>

      {/* TABULKA KLIENTŮ */}
      <Card className="border-none shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-[10px] uppercase tracking-wider bg-slate-50 text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-bold">Název společnosti</th>
                <th className="px-6 py-4 font-bold">IČO</th>
                <th className="px-6 py-4 font-bold">Město</th>
                <th className="px-6 py-4 font-bold text-center">Pracovišť</th>
                <th className="px-6 py-4 font-bold text-center">Kontaktů</th>
                <th className="px-6 py-4 font-bold">Poslední kontrola</th>
                <th className="px-6 py-4 font-bold text-right">Akce</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredKlienti.length > 0 ? (
                filteredKlienti.map((k) => {
                  const clientRecords = zaznamy.filter(z => z.klientId === k.id);
                  const lastRecord = clientRecords.sort((a,b) => new Date(b.datum).getTime() - new Date(a.datum).getTime())[0];

                  return (
                    <tr key={k.id} className="hover:bg-blue-50/50 transition-colors group">
                      <td className="px-6 py-4 font-bold text-blue-700">{k.nazev}</td>
                      <td className="px-6 py-4 font-mono">{k.ico}</td>
                      <td className="px-6 py-4">{k.mesto || '-'}</td>
                      <td className="px-6 py-4 text-center">
                        <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded font-bold text-xs border border-slate-200">{k.pracoviste?.length || 0}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded font-bold text-xs border border-emerald-100">{k.kontakty?.length || 0}</span>
                      </td>
                      <td className="px-6 py-4">
                        {lastRecord ? formatCzechDate(lastRecord.datum) : <span className="text-muted-foreground italic text-xs">Žádná provedena</span>}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" asChild title="Detail klienta" className="hover:bg-blue-50 hover:text-blue-600">
                            <Link href={`/klienti/${k.id}`}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="hover:bg-slate-100">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 font-medium">
                              <DropdownMenuItem asChild>
                                <Link href={`/nova-kontrola?klient=${k.id}`} className="flex items-center gap-2 text-blue-700">
                                  <ClipboardCheck className="h-4 w-4" />
                                  Provést nový audit
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
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-500">
                      <Building2 className="h-12 w-12 text-slate-200 mb-2" />
                      <p className="font-medium text-slate-600">Nenalezen žádný klient vyhovující filtru.</p>
                      <Button variant="link" onClick={() => setIsAddModalOpen(true)} className="text-blue-600 font-bold">Vytvořit nového klienta</Button>
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
