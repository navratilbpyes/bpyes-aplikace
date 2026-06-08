'use client';

import { useData } from "@/components/data-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useState, useEffect, useMemo } from "react";
import { 
  CheckCircle2, 
  ChevronRight, 
  ChevronLeft, 
  Plus, 
  X,
  ClipboardList,
  AlertTriangle,
  Calendar as CalendarIcon,
  User as UserIcon,
  StickyNote
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { generateRecordNumber, cn } from "@/app/lib/utils";
// Pridany importy novych seznamu z vaseho souboru
import { CHECKLIST_SECTIONS, CHECKLIST_PPP, CHECKLIST_PBOZP, ChecklistSection, ChecklistPoint } from "./checklist-data";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Progress } from "@/components/ui/progress";
import { KontrolniBod, Zavada } from "@/app/lib/types";

export default function NewInspectionPage() {
  const { klienti, zaznamy, setZaznamy } = useData();
  const { toast } = useToast();
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    klientId: '',
    pracovisteId: '',
    typKontroly: '' as 'BOZPaPO' | 'PPP' | 'PBOZP',
    datum: new Date().toISOString().split('T')[0],
    ucastnici: [{ jmeno: '', pozice: '' }]
  });

  const [checklist, setChecklist] = useState<Record<number, KontrolniBod>>({});
  const [pointDefects, setPointDefects] = useState<Record<number, Partial<Zavada>>>({});
  const [manualDefects, setManualDefects] = useState<Partial<Zavada>[]>([]);

  const selectedKlient = klienti.find(k => k.id === formData.klientId);
  const selectedPrac = selectedKlient?.pracoviste.find(p => p.id === formData.pracovisteId);

  // Auto-save logic
  useEffect(() => {
    const interval = setInterval(() => {
      if (formData.klientId) {
        localStorage.setItem('bpyes_draft_kontrola', JSON.stringify({
          formData,
          checklist,
          pointDefects,
          manualDefects
        }));
        console.log('Draft auto-saved');
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [formData, checklist, pointDefects, manualDefects]);

  // Leave warning
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (formData.klientId) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [formData.klientId]);

  // Dynamicky vypocet poctu otazek podle vybraneho typu kontroly
  const currentChecklistFlat = useMemo(() => {
    if (formData.typKontroly === 'PPP') return CHECKLIST_PPP || [];
    if (formData.typKontroly === 'PBOZP') return CHECKLIST_PBOZP || [];
    if (formData.typKontroly === 'BOZPaPO') return CHECKLIST_SECTIONS.flatMap(s => s.points);
    return [];
  }, [formData.typKontroly]);

  const totalPoints = currentChecklistFlat.length > 0 ? currentChecklistFlat.length : 1;
  const answeredPoints = Object.keys(checklist).length;
  const progressPercent = Math.round((answeredPoints / totalPoints) * 100);

  const stats = useMemo(() => {
    const vals = Object.values(checklist);
    return {
      V: vals.filter(v => v.hodnoceni === 'V').length,
      N: vals.filter(v => v.hodnoceni === 'N').length,
      NA: vals.filter(v => v.hodnoceni === 'NA').length,
      NK: vals.filter(v => v.hodnoceni === 'NK').length,
      unfilled: currentChecklistFlat.length - answeredPoints
    };
  }, [checklist, currentChecklistFlat.length, answeredPoints]);

  const handleRatingChange = (point: ChecklistPoint, rating: 'V' | 'N' | 'NA' | 'NK') => {
    let text = "";
    if (rating === 'V') text = "Bez zjištěných závad.";
    if (rating === 'NK') text = "V rámci prověrky, prohlídky nebo auditu nebyla tato část kontrolována.";
    if (rating === 'N') {
      text = point.nText || "Zjištěn nedostatek. Je nutné zjednat nápravu v souladu s platnými právními předpisy.";
      
      // Pre-fill defect
      setPointDefects(prev => ({
        ...prev,
        [point.id]: {
          popis: text,
          navrhOpatreni: "Provést nápravu v souladu s legislativou.",
          terminOdstraneni: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days
          odpovednaOsoba: selectedKlient?.kontaktOsoba || ""
        }
      }));
    }

    setChecklist(prev => ({
      ...prev,
      [point.id]: {
        bod: point.id,
        hodnoceni: rating,
        textHodnoceni: text,
        poznamka: prev[point.id]?.poznamka
      }
    }));
  };

  const handleNext = () => {
    if (step === 1 && (!formData.klientId || !formData.pracovisteId || !formData.typKontroly)) {
      toast({ title: "Chyba", description: "Prosím vyplňte základní údaje.", variant: "destructive" });
      return;
    }
    setStep(s => s + 1);
    window.scrollTo(0, 0);
  };

  const handleFinish = (isDraft: boolean = false) => {
    const year = new Date(formData.datum).getFullYear();
    const countInYear = zaznamy.filter(z => new Date(z.datum).getFullYear() === year).length + 1;
    
    // Aggregate defects
    const aggregatedZavady: Zavada[] = [];
    let defectCounter = 1;

    // From points
    Object.entries(pointDefects).forEach(([pointId, defect]) => {
      if (checklist[Number(pointId)]?.hodnoceni === 'N') {
        aggregatedZavady.push({
          id: Math.random().toString(36).substring(7),
          cislo: defectCounter++,
          bodKontroly: Number(pointId),
          popis: defect.popis || "",
          navrhOpatreni: defect.navrhOpatreni || "",
          terminOdstraneni: defect.terminOdstraneni || "",
          odpovednaOsoba: defect.odpovednaOsoba || "",
          stavOdstraneni: 'otevrena'
        });
      }
    });

    // From manual
    manualDefects.forEach((defect) => {
      aggregatedZavady.push({
        id: Math.random().toString(36).substring(7),
        cislo: defectCounter++,
        popis: defect.popis || "",
        navrhOpatreni: defect.navrhOpatreni || "",
        terminOdstraneni: defect.terminOdstraneni || "",
        odpovednaOsoba: defect.odpovednaOsoba || "",
        stavOdstraneni: 'otevrena'
      });
    });

    const newRecord = {
      id: Math.random().toString(36).substring(7),
      cislo: generateRecordNumber(year, countInYear, formData.typKontroly),
      ...formData,
      kontrolniBody: Object.values(checklist),
      zavady: aggregatedZavady,
      stav: isDraft ? 'otevreny' : 'uzavreny' as any,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setZaznamy(prev => [...prev, newRecord as any]);
    localStorage.removeItem('bpyes_draft_kontrola');
    toast({ title: isDraft ? "Uloženo jako koncept" : "Záznam vytvořen", description: `Kontrola ${newRecord.cislo} byla úspěšně založena.` });
    router.push(`/zaznamy/${newRecord.id}`);
  };

  // Univerzalni komponenta pro vykresleni jednoho bodu checklistu
  const renderPoint = (point: ChecklistPoint) => {
    const state = checklist[point.id];
    const defect = pointDefects[point.id];
    
    return (
      <div key={point.id} className="pt-8 first:pt-0 space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start gap-4">
          <div className="flex gap-3 flex-1">
            <span className="font-mono text-muted-foreground font-bold">{point.id}.</span>
            <p className="font-medium text-[15px]">{point.text}</p>
          </div>
          
          <div className="grid grid-cols-4 gap-1 w-full md:w-auto">
            {[
              { label: 'V', rating: 'V', color: 'bg-green-100 text-green-700 hover:bg-green-200 border-green-200 data-[state=active]:bg-green-600 data-[state=active]:text-white' },
              { label: 'N', rating: 'N', color: 'bg-red-100 text-red-700 hover:bg-red-200 border-red-200 data-[state=active]:bg-red-600 data-[state=active]:text-white' },
              { label: 'NA', rating: 'NA', color: 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-200 data-[state=active]:bg-gray-600 data-[state=active]:text-white' },
              { label: 'NK', rating: 'NK', color: 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-200 data-[state=active]:bg-gray-600 data-[state=active]:text-white' }
            ].map((btn) => (
              <Button
                key={btn.label}
                variant="outline"
                data-state={state?.hodnoceni === btn.rating ? 'active' : 'inactive'}
                className={cn("h-12 min-w-[50px] font-bold shadow-none transition-all", btn.color)}
                onClick={() => handleRatingChange(point, btn.rating as any)}
              >
                {btn.label}
              </Button>
            ))}
          </div>
        </div>

        {state?.hodnoceni && state.hodnoceni !== 'NA' && (
          <div className="space-y-4 ml-8 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="space-y-2">
              <Label className="text-xs uppercase text-muted-foreground">Text hodnocení</Label>
              <Textarea 
                value={state.textHodnoceni} 
                onChange={(e) => setChecklist(prev => ({ ...prev, [point.id]: { ...prev[point.id], textHodnoceni: e.target.value }}))}
                className="min-h-[80px]"
              />
            </div>

            {state.hodnoceni === 'N' && (
              <div className="p-4 bg-amber-50 rounded-lg border border-amber-200 space-y-4 shadow-inner">
                <div className="flex items-center gap-2 text-amber-800 font-bold text-sm uppercase">
                  <AlertTriangle className="h-4 w-4" />
                  Definice závady
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Popis závady</Label>
                    <Textarea 
                      value={defect?.popis} 
                      onChange={(e) => setPointDefects(prev => ({ ...prev, [point.id]: { ...prev[point.id], popis: e.target.value }}))}
                      placeholder="Popište zjištěný nedostatek..."
                      className="bg-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Návrh opatření</Label>
                    <Textarea 
                      value={defect?.navrhOpatreni} 
                      onChange={(e) => setPointDefects(prev => ({ ...prev, [point.id]: { ...prev[point.id], navrhOpatreni: e.target.value }}))}
                      placeholder="Navrhněte řešení..."
                      className="bg-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Termín odstranění</Label>
                    <Input 
                      type="date"
                      value={defect?.terminOdstraneni} 
                      onChange={(e) => setPointDefects(prev => ({ ...prev, [point.id]: { ...prev[point.id], terminOdstraneni: e.target.value }}))}
                      className="bg-white h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Odpovědná osoba</Label>
                    <div className="flex gap-2">
                      <Select 
                        value={defect?.odpovednaOsoba} 
                        onValueChange={(v) => setPointDefects(prev => ({ ...prev, [point.id]: { ...prev[point.id], odpovednaOsoba: v }}))}
                      >
                        <SelectTrigger className="bg-white h-11">
                          <SelectValue placeholder="Vyberte osobu" />
                        </SelectTrigger>
                        <SelectContent>
                          {selectedKlient?.odpovedneOsoby.map(o => (
                            <SelectItem key={o.id} value={`${o.jmeno} ${o.prijmeni}`}>{o.jmeno} {o.prijmeni} ({o.pozice})</SelectItem>
                          ))}
                          <SelectItem value="manual">-- Zadat manuálně --</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              {!state.poznamka && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setChecklist(prev => ({ ...prev, [point.id]: { ...prev[point.id], poznamka: " " }}))}
                  className="text-muted-foreground"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Poznámka
                </Button>
              )}
              {state.poznamka && (
                <div className="flex-1 space-y-2">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <StickyNote className="h-3 w-3" />
                    Interní poznámka
                  </Label>
                  <Textarea 
                    value={state.poznamka} 
                    onChange={(e) => setChecklist(prev => ({ ...prev, [point.id]: { ...prev[point.id], poznamka: e.target.value }}))}
                    placeholder="Libovolný doprovodný text k bodu..."
                    className="bg-muted/30"
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8 pb-24">
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight">Nová kontrola</h1>
          {step > 1 && (
            <div className="flex items-center gap-3 w-48">
              <span className="text-xs font-bold text-muted-foreground uppercase">{progressPercent}%</span>
              <Progress value={progressPercent} className="h-2" />
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <div 
                className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold",
                  step === i ? "bg-primary text-white" : step > i ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"
                )}
              >
                {step > i ? <CheckCircle2 className="h-5 w-5" /> : i}
              </div>
              {i < 3 && <div className={cn("h-px w-8 bg-muted", step > i && "bg-green-200")} />}
            </div>
          ))}
          <span className="ml-4 text-sm font-medium text-muted-foreground">
            {step === 1 ? "Výběr klienta a typu" : step === 2 ? "Kontrolní list" : "Shrnutí"}
          </span>
        </div>
      </div>

      {step === 1 && (
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle>Základní parametry kontroly</CardTitle>
            <CardDescription>Vyberte klienta, pracoviště a typ kontroly pro zahájení procesu.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Klient</Label>
                <Select value={formData.klientId} onValueChange={(v) => setFormData({...formData, klientId: v, pracovisteId: ''})}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Vyberte klienta" />
                  </SelectTrigger>
                  <SelectContent>
                    {klienti.map(k => <SelectItem key={k.id} value={k.id}>{k.nazev}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Pracoviště</Label>
                <Select 
                  disabled={!formData.klientId} 
                  value={formData.pracovisteId} 
                  onValueChange={(v) => setFormData({...formData, pracovisteId: v})}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Vyberte pracoviště" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedKlient?.pracoviste.map(p => <SelectItem key={p.id} value={p.id}>{p.nazev}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Typ kontroly</Label>
                <Select value={formData.typKontroly} onValueChange={(v: any) => setFormData({...formData, typKontroly: v})}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Zvolte typ kontroly" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BOZPaPO">BOZPaPO — Prověrka / audit BOZP a PO</SelectItem>
                    <SelectItem value="PPP">PPP — Preventivní požární prohlídka</SelectItem>
                    <SelectItem value="PBOZP">PBOZP — Prověrka BOZP pracoviště</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Datum kontroly</Label>
                <Input type="date" className="h-11" value={formData.datum} onChange={(e) => setFormData({...formData, datum: e.target.value})} />
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t">
              <div className="flex justify-between items-center">
                <Label>Účastníci kontroly</Label>
                <Button variant="ghost" size="sm" onClick={() => setFormData({...formData, ucastnici: [...formData.ucastnici, {jmeno: '', pozice: ''}]})}>
                  <Plus className="mr-2 h-4 w-4" />
                  Přidat řádek
                </Button>
              </div>
              {formData.ucastnici.map((u, i) => (
                <div key={i} className="flex gap-2">
                  <Input placeholder="Jméno a příjmení" value={u.jmeno} onChange={(e) => {
                    const next = [...formData.ucastnici];
                    next[i].jmeno = e.target.value;
                    setFormData({...formData, ucastnici: next});
                  }} />
                  <Input placeholder="Pozice" value={u.pozice} onChange={(e) => {
                    const next = [...formData.ucastnici];
                    next[i].pozice = e.target.value;
                    setFormData({...formData, ucastnici: next});
                  }} />
                  {formData.ucastnici.length > 1 && (
                    <Button variant="ghost" size="icon" onClick={() => setFormData({...formData, ucastnici: formData.ucastnici.filter((_, idx) => idx !== i)})}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm pb-4 border-b">
            <div className="flex justify-between items-center">
              <h2 className="font-bold text-lg">Průběh auditování</h2>
              <span className="px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-xs font-bold">
                Typ: {formData.typKontroly}
              </span>
            </div>
          </div>

          {/* Zobrazeni pro komplexni BOZPaPO (se sekcemi A-T) */}
          {formData.typKontroly === 'BOZPaPO' && (
            <Accordion type="single" collapsible className="space-y-4" defaultValue="A">
              {CHECKLIST_SECTIONS.map((section) => (
                <AccordionItem key={section.id} value={section.id} className="border rounded-lg bg-white overflow-hidden shadow-sm">
                  <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/50">
                    <div className="flex flex-col items-start gap-1">
                      <span className="text-xs font-bold uppercase text-muted-foreground">Oddíl {section.id}</span>
                      <span className="text-base font-bold">{section.title}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-6 pb-6 space-y-8 pt-4 divide-y">
                    {section.points.map(renderPoint)}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}

          {/* Zobrazeni pro Preventivni pozarni prohlidku (PPP) */}
          {formData.typKontroly === 'PPP' && (
            <div className="border rounded-lg bg-white overflow-hidden shadow-sm">
              <div className="px-6 py-4 bg-muted/10 border-b">
                <span className="text-base font-bold">Kontrolní list - Preventivní požární prohlídka</span>
              </div>
              <div className="px-6 pb-6 space-y-8 pt-4 divide-y">
                {CHECKLIST_PPP.map(renderPoint)}
              </div>
            </div>
          )}

          {/* Zobrazeni pro Proverku BOZP pracoviste (PBOZP) */}
          {formData.typKontroly === 'PBOZP' && (
            <div className="border rounded-lg bg-white overflow-hidden shadow-sm">
              <div className="px-6 py-4 bg-muted/10 border-b">
                <span className="text-base font-bold">Kontrolní list - Prověrka BOZP pracoviště</span>
              </div>
              <div className="px-6 pb-6 space-y-8 pt-4 divide-y">
                {CHECKLIST_PBOZP.map(renderPoint)}
              </div>
            </div>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-8">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card className="p-4 flex flex-col items-center gap-1 border-green-200 bg-green-50">
              <span className="text-2xl font-bold text-green-700">{stats.V}</span>
              <span className="text-[10px]
