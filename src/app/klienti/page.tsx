'use client';

import { useData, db } from "@/components/data-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Search, Building2, MoreHorizontal, Eye, Edit2, ClipboardCheck, X, Loader2 } from "lucide-react";
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
  const [newClient, setNewClient] = useState({
    nazev: "",
    ico: "",
    mesto: "",
    pracoviste: [{ id: Math.random().toString(36).substring(7), nazev: "" }]
  });

  const filteredKlienti = useMemo(() => {
    return klienti.filter(k => 
      k.nazev?.toLowerCase().includes(search.toLowerCase()) || 
      k.ico?.includes(search)
    );
  }, [klienti, search]);

  const handleAddWorkplace = () => {
    setNewClient(prev => ({
      ...prev,
      pracoviste: [...prev.pracoviste, { id: Math.random().toString(36).substring(7), nazev: "" }]
    }));
  };

  const handleRemoveWorkplace = (index: number) => {
    setNewClient(prev => ({
      ...prev,
      pracoviste: prev.pracoviste.filter((_, i) => i !== index)
    }));
  };

  const handleWorkplaceChange = (index: number, val: string) => {
    setNewClient(prev => {
      const arr = [...prev.pracoviste];
      arr[index].nazev = val;
      return { ...prev, pracoviste: arr };
    });
  };

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
        // Vyfiltrujeme prázdná pracoviště
        pracoviste: newClient.pracoviste.filter(p => p.nazev.trim() !== ''),
        odpovedneOsoby: []
      };

      await setDoc(newRef, clientData);
      
      // Aktualizujeme data v prohlížeči (pokud máme metodu setKlienti)
      if (setKlienti) {
        setKlienti((prev: any[]) => [...prev, clientData]);
      }
      
      setIsAddModalOpen(false);
      setNewClient({ nazev: "", ico: "", mesto: "", pracoviste: [{ id: "1", nazev: "" }] });
      toast({ title: "Klient přidán", description: "Nový subjekt byl úspěšně uložen do databáze." });
    } catch (err) {
      console.error(err);
      toast({ title: "Chyba uložení", description: "Nepodařilo se uložit klienta.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className="p-8 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 relative">
      
      {/* MODÁLNÍ OKNO PRO PŘIDÁNÍ KLIENTA */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4 animate-in fade-in backdrop-blur-sm">
          <Card className="w-full max-w-xl shadow-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-center p-6 border-b">
              <div>
                <CardTitle className="text-xl font-bold">Přidat nového klienta</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">Založte nový kontrolovaný subjekt do databáze.</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setIsAddModalOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            
            <form onSubmit={saveNewClient}>
              <CardContent className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                <div className="space-y-2">
                  <Label>Název společnosti *</Label>
                  <Input required value={newClient.nazev} onChange={e => setNewClient(p => ({...p, nazev: e.target.value}))} placeholder="Např. Kovárna Novák s.r.o." />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>IČO *</Label>
                    <Input required value={newClient.ico} onChange={e => setNewClient(p => ({...p, ico: e.target.value}))} placeholder="Např. 12345678" />
                  </div>
                  <div className="space-y-2">
                    <Label>Město / Sídlo</Label>
                    <Input value={newClient.mesto} onChange={e => setNewClient(p => ({...p, mesto: e.target.value}))} placeholder="Např. Praha" />
                  </div>
                </div>

                <div className="pt-4 border-t space-y-3">
                  <div className="flex justify-between items-center">
                    <Label className="font-bold">Pracoviště a provozovny</Label>
                    <Button type="button" variant="outline" size="sm" onClick={handleAddWorkplace}>
                      <Plus className="h-3 w-3 mr-1" /> Přidat provozovnu
                    </Button>
                  </div>
                  {newClient.pracoviste.map((prac, idx) => (
                    <div key={prac.id} className="flex gap-2 items-center">
                      <Input 
                        placeholder={`Název ${idx + 1}. provozovny...`} 
                        value={prac.nazev} 
                        onChange={(e) => handleWorkplaceChange(idx, e.target.value)} 
                        className="flex-1"
                      />
                      {newClient.pracoviste.length > 1 && (
                        <Button type="button" variant="ghost" size="icon" className="text-red-500 shrink-0" onClick={() => handleRemoveWorkplace(idx)}>
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
              <div className="p-6 border-t bg-slate-50 flex justify-end gap-3 rounded-b-xl">
                <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>Zrušit</Button>
                <Button type="submit" disabled={isSaving} className="bg-blue-600 hover:bg-blue-700 text-white font-bold">
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />} Uložit klienta
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Klienti</h1>
          <p className="text-muted-foreground">Správa vašich zákazníků a jejich pracovišť.</p>
        </div>
        <Button onClick={() => setIsAddModalOpen(true)} className="h-11 bg-slate-900 text-white hover:bg-slate-800 font-bold">
          <Plus className="mr-2 h-4 w-4" />
          Přidat klienta
        </Button>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Hledat klienta podle názvu nebo IČO..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 h-11 bg-white" />
        </div>
      </div>

      <Card className="border-none shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-[10px] uppercase tracking-wider bg-slate-50 text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-bold">Název společnosti</th>
                <th className="px-6 py-4 font-bold">IČO</th>
                <th className="px-6 py-4 font-bold">Město</th>
                <th className="px-6 py-4 font-bold text-center">Pracovišť</th>
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
                    <tr key={k.id} className="hover:bg-blue-50/50 transition-colors">
                      <td className="px-6 py-4 font-bold text-blue-700">{k.nazev}</td>
                      <td className="px-6 py-4 font-mono">{k.ico}</td>
                      <td className="px-6 py-4">{k.mesto || '-'}</td>
                      <td className="px-6 py-4 text-center">
                        <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded font-bold text-xs">{k.pracoviste?.length || 0}</span>
                      </td>
                      <td className="px-6 py-4">
                        {lastRecord ? formatCzechDate(lastRecord.datum) : <span className="text-muted-foreground italic">Žádná</span>}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" asChild title="Detail klienta">
                            <Link href={`/klienti/${k.id}`}>
                              <Eye className="h-4 w-4" />
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
                                <Link href={`/nova-kontrola?klient=${k.id}`} className="flex items-center gap-2 font-medium text-blue-700">
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
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Building2 className="h-12 w-12 opacity-20" />
                      <p>Nenalezen žádný klient vyhovující filtru.</p>
                      <Button variant="link" onClick={() => setIsAddModalOpen(true)}>Vytvořit nového klienta</Button>
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
