'use client';

import { useData } from "@/components/data-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, ChevronUp, Check, AlertTriangle, HelpCircle } from "lucide-react";

// Kompletní auditní osnova s fixně nadefinovanými sekcemi (Oddíl B, C, D...)
const PRESET_QUESTIONS = [
  { id: 1, sekce: "ODDÍL B: Vyhledávání a hodnocení rizik", otazka: "Má zaměstnavatel zpracovaný registr rizik a jsou s ním zaměstnanci prokazatelně seznámeni?" },
  { id: 2, sekce: "ODDÍL B: Vyhledávání a hodnocení rizik", otazka: "Jsou na pracovištích zavedena konkrétní opatření k minimalizaci zjištěných rizik?" },
  { id: 3, sekce: "ODDÍL B: Vyhledávání a hodnocení rizik", otazka: "Jsou rizika pravidelně (minimálně 1x ročně) aktualizována specialistou OZO?" },
  
  { id: 4, sekce: "ODDÍL C: Systém BOZP a odpovědnost", otazka: "Je jmenována odpovědná osoba za oblast BOZP a PO a má k tomu odpovídající kvalifikaci?" },
  { id: 5, sekce: "ODDÍL C: Systém BOZP a odpovědnost", otazka: "Jsou k dispozici platné prověrky BOZP z minulých období a jsou nápravná opatření splněna?" },
  
  { id: 6, sekce: "ODDÍL D: Školení a odborná způsobilost", otazka: "Mají všichni zaměstnanci platné školení o právních předpisech BOZP a PO (včetně vedoucích)?" },
  { id: 7, sekce: "ODDÍL D: Školení a odborná způsobilost", otazka: "Je vedena prokazatelná osnova školení a prezenční listiny s podpisy všech účastníků?" },
  
  { id: 8, sekce: "ODDÍL E: Pracovnělékařská péče", otazka: "Má zaměstnavatel uzavřenou platnou smlouvu s poskytovatelem pracovnělékařských služeb?" },
  { id: 9, sekce: "ODDÍL E: Pracovnělékařská péče", otazka: "Mají všichni zaměstnanci platné lékařské posudky odpovídající jejich zařazení do kategorií práce?" },
  
  { id: 10, sekce: "ODDÍL F: Úrazy", otazka: "Je na pracovišti vedena kniha úrazů a jsou v ní zaznamenána všechna drobná poranění?" },
  { id: 11, sekce: "ODDÍL F: Úrazy", otazka: "Jsou pracovní úrazy řádně hlášeny a evidovány podle platných zákonných lhůt?" }
];

export default function NewInspectionPage() {
  const { klienti, addZaznam } = useData();
  const router = useRouter();
  const { toast } = useToast();

  const [klientId, setKlientId] = useState("");
  const [pracovisteId, setPracovisteId] = useState("");
  const [typKontroly, setTypKontroly] = useState("BOZPaPO");
  const [poznamka, setPoznamka] = useState("");

  // Stavy pro rozbalené sekce ve formuláři
  const uniqueSections = Array.from(new Set(PRESET_QUESTIONS.map(q => q.sekce)));
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    [uniqueSections[0]]: true // Výchozí rozbalená první sekce
  });

  // Hlavní stav pro odpovědi auditu
  const [answers, setAnswers] = useState<Record<number, {
    hodnoceni: string;
    navrhOpatreni?: string;
    lokalizace?: string;
    terminOdstraneni?: string;
    odpovednaOsoba?: string;
    foto?: string;
  }>>({});

  const selectedKlient = klienti.find(k => k.id === klientId);

  const handleRatingChange = (id: number, rating: string) => {
    setAnswers(prev => ({
      ...prev,
      [id]: { ...(prev[id] || {}), hodnoceni: rating }
    }));
  };

  const handleInputFieldChange = (id: number, field: string, value: string) => {
    setAnswers(prev => ({
      ...prev,
      [id]: { ...(prev[id] || {}), [field]: value }
    }));
  };

  // Simulace nahrání fotografie (převede obrázek na odkaz/Base64)
  const handlePhotoUploadPlaceholder = (id: number) => {
    // Použijeme ilustrační reálnou fotku úrazu/staveniště, aby export vypadal reálně
    const placeholderPhotos = [
      "https://images.unsplash.com/photo-1581094288338-2314dddb7eed?w=500",
      "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=500"
    ];
    const selectedPhoto = placeholderPhotos[id % 2 === 0 ? 0 : 1];
    
    handleInputFieldChange(id, "foto", selectedPhoto);
    toast({ title: "Fotografie přidána", description: "Snímek závady byl úspěšně připojen k bodu." });
  };

  const handleSave = async () => {
    if (!klientId || !pracovisteId) {
      toast({ title: "Chyba zadání", description: "Musíte vybrat klienta a jeho konkrétní pracoviště.", variant: "destructive" });
      return;
    }

    // MAPOVÁNÍ: Sestavíme kompletní pole kontrolních bodů se správnými vlastnostmi
    const kontrolniBody = PRESET_QUESTIONS.map(q => {
      const ans = answers[q.id] || { hodnoceni: "NK" }; // Výchozí Nehodnoceno
      return {
        bod: q.id,
        sekce: q.sekce, // STRIKTNÍ ULOŽENÍ SEKCE
        otazka: q.otazka,
        hodnoceni: ans.hodnoceni,
        navrhOpatreni: ans.navrhOpatreni || "",
        lokalizace: ans.lokalizace || "",
        terminOdstraneni: ans.terminOdstraneni || "",
        odpovednaOsoba: ans.odpovednaOsoba || "",
        foto: ans.foto || ""
      };
    });

    const randomNum = Math.floor(100 + Math.random() * 900);
    const newRecord = {
      id: `zaznam-${Date.now()}`,
      cislo: `2026/002/BOZPaPO`, // Formát čísla
      klientId,
      pracovisteId,
      typKontroly,
      datum: new Date().toISOString().split('T')[0],
      stav: "uzavreny" as const,
      revize: 0,
      poznamka,
      createdAt: new Date().toISOString(),
      kontrolniBody,
      ucastnici: [
        { jmeno: "Martin Navrátil", pozice: "Specialista BOZP a PO (BPyes)" },
        { jmeno: "vedoucí skladu", pozice: "Zástupce kontrolovaného subjektu" }
      ]
    };

    addZaznam(newRecord);
    toast({ title: "Audit uložen", description: "Záznam byl úspěšně vytvořen a data byla konzistentně zapsána." });
    router.push(`/zaznamy/${newRecord.id}`);
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6 pb-24">
      <div className="border-b pb-4">
        <h1 className="text-3xl font-bold tracking-tight">Nový audit / Kontrola pracoviště</h1>
        <p className="text-muted-foreground text-sm">Proklikejte osnovu a zadejte neshody legislativy.</p>
      </div>

      {/* Základní informace */}
      <Card className="shadow-sm">
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 pt-6">
          <div className="space-y-2">
            <Label>Vyberte klienta</Label>
            <Select value={klientId} onValueChange={setKlientId}>
              <SelectTrigger><SelectValue placeholder="Zvolit firmu" /></SelectTrigger>
              <SelectContent>
                {klienti.map(k => <SelectItem key={k.id} value={k.id}>{k.nazev}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Pracoviště / Provozovna</Label>
            <Select value={pracovisteId} onValueChange={setPracovisteId} disabled={!klientId}>
              <SelectTrigger><SelectValue placeholder="Vyberte lokaci" /></SelectTrigger>
              <SelectContent>
                {selectedKlient?.pracoviste.map(p => <SelectItem key={p.id} value={p.id}>{p.nazev}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Typ prováděné kontroly</Label>
            <Select value={typKontroly} onValueChange={setTypKontroly}>
              <SelectTrigger><SelectValue placeholder="Typ" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="BOZPaPO">BOZP + Požární ochrana</SelectItem>
                <SelectItem value="PBOZP">Čistě prověrka BOZP</SelectItem>
                <SelectItem value="PPP">Preventivní prohlídka PO</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* OSNOVA AUDITU PO KAPITOLÁCH */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-slate-800 uppercase tracking-wide">Osnova kontrolního protokolu</h2>
        
        {uniqueSections.map(sectionName => {
          const sectionQuestions = PRESET_QUESTIONS.filter(q => q.sekce === sectionName);
          const isExpanded = !!expandedSections[sectionName];

          return (
            <Card key={sectionName} className="overflow-hidden shadow-sm border-slate-200">
              <div 
                className="bg-slate-100 p-3 flex justify-between items-center cursor-pointer hover:bg-slate-200/70 transition-colors"
                onClick={() => setExpandedSections(prev => ({ ...prev, [sectionName]: !prev[sectionName] }))}
              >
                <h3 className="font-bold text-sm text-slate-800 uppercase tracking-wide">{sectionName}</h3>
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>

              {isExpanded && (
                <CardContent className="p-0 divide-y">
                  {sectionQuestions.map(q => {
                    const currentAns = answers[q.id] || { hodnoceni: "NK" };
                    return (
                      <div key={q.id} className="p-4 space-y-4 bg-white">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                          <p className="font-medium text-[15px] max-w-xl"><span className="text-muted-foreground font-mono mr-1">{q.id}.</span> {q.otazka}</p>
                          
                          {/* Volba hodnocení tlačítky */}
                          <div className="flex gap-1 bg-slate-100 p-1 rounded-lg shrink-0">
                            <Button size="sm" variant={currentAns.hodnoceni === 'V' ? 'default' : 'ghost'} className={cn("h-8 px-2 text-xs font-bold", currentAns.hodnoceni === 'V' && "bg-green-600 hover:bg-green-700")} onClick={() => handleRatingChange(q.id, 'V')}><Check className="h-3 w-3 mr-1" /> Vyhovuje</Button>
                            <Button size="sm" variant={currentAns.hodnoceni === 'N' ? 'destructive' : 'ghost'} className="h-8 px-2 text-xs font-bold" onClick={() => handleRatingChange(q.id, 'N')}><AlertTriangle className="h-3 w-3 mr-1" /> Neshoda</Button>
                            <Button size="sm" variant={currentAns.hodnoceni === 'NA' ? 'secondary' : 'ghost'} className="h-8 px-2 text-xs font-bold" onClick={() => handleRatingChange(q.id, 'NA')}><HelpCircle className="h-3 w-3 mr-1" /> N/A</Button>
                          </div>
                        </div>

                        {/* Formulář pro zadání neshody, pokud svítí Neshoda */}
                        {currentAns.hodnoceni === 'N' && (
                          <div className="p-4 border border-red-100 bg-red-50/10 rounded-xl space-y-3 text-sm animate-in fade-in slide-in-from-top-2">
                            <p className="font-bold text-red-900 text-xs uppercase tracking-wider">Specifikace legislativního nedostatku</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <Label className="text-xs">Popis zjištěné závady</Label>
                                <Input placeholder="např. Chybí zpracovaná dokumentace..." value={currentAns.navrhOpatreni || ""} onChange={(e) => handleInputFieldChange(q.id, "navrhOpatreni", e.target.value)} />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Přesné místo / Lokalizace</Label>
                                <Input placeholder="např. Budova A, 2. patro" value={currentAns.lokalizace || ""} onChange={(e) => handleInputFieldChange(q.id, "lokalizace", e.target.value)} />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Odpovědná pracovní pozice</Label>
                                <Input placeholder="např. vedoucí skladu, údržba" value={currentAns.odpovednaOsoba || ""} onChange={(e) => handleInputFieldChange(q.id, "odpovednaOsoba", e.target.value)} />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Termín k nápravě</Label>
                                <Input type="date" value={currentAns.terminOdstraneni || ""} onChange={(e) => handleInputFieldChange(q.id, "terminOdstraneni", e.target.value)} />
                              </div>
                            </div>
                            
                            <div className="pt-2 flex items-center gap-3">
                              <Button type="button" variant="outline" size="sm" onClick={() => handlePhotoUploadPlaceholder(q.id)}>Připojit fotodokumentaci</Button>
                              {currentAns.foto && <span className="text-xs font-bold text-green-700">✅ Snímek závady nahrán</span>}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      <div className="space-y-2">
        <Label>Závěrečné slovní hodnocení specialisty (Zobrazí se v PDF)</Label>
        <Textarea rows={3} placeholder="Shrnutí celkového stavu bezpečnosti u klienta..." value={poznamka} onChange={(e) => setPoznamka(e.target.value)} />
      </div>

      <div className="pt-4 border-t flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.push("/")}>Zrušit</Button>
        <Button className="bg-green-600 hover:bg-green-700 text-white font-bold px-6" onClick={handleSave}>Uzavřít audit a přejít na tisk</Button>
      </div>
    </div>
  );
}
