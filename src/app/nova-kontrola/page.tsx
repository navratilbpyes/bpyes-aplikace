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
  AlertTriangle,
  Calendar as CalendarIcon,
  User as UserIcon,
  StickyNote,
  Camera,
  CheckSquare,
  Square,
  Filter
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { generateRecordNumber, cn } from "@/app/lib/utils";
import { CHECKLIST_SECTIONS, CHECKLIST_PPP, CHECKLIST_PBOZP, ChecklistPoint } from "./checklist-data";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Progress } from "@/components/ui/progress";
import { KontrolniBod, Zavada } from "@/app/lib/types";

interface TypickaZavada {
  nazev: string;
  popis: string;
  opatreni: string;
}

interface DefectFormState {
  uid: string;
  popis: string;
  navrhOpatreni: string;
  terminOdstraneni: string;
  odpovednaOsoba: string;
  odpovednaOsobaManualni: string;
  lokalizace: string;
  zavaznost: string;
  odstraneno: boolean;
  datumOdstraneni: string;
  zaznamProvedl: string;
  zaznamProvedlManualni: string;
  foto?: string;
}

const createEmptyDefect = (): DefectFormState => ({
  uid: Math.random().toString(36).substring(7),
  popis: "",
  navrhOpatreni: "",
  terminOdstraneni: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  odpovednaOsoba: "",
  odpovednaOsobaManualni: "",
  lokalizace: "",
  zavaznost: "none", // Ošetřeno pro stabilitu UI
  odstraneno: false,
  datumOdstraneni: "",
  zaznamProvedl: "",
  zaznamProvedlManualni: ""
});

const GOOGLE_SHEETS_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTqBDqcv7REG4fkbLQHUqOQP13KzwB-wAAEaotZldSvZMvTpzfc8OlJvo8isBWkmQBpjYTm-I_X6Lls/pub?output=csv";

function parseCSV(str: string) {
  const arr: string[][] = [];
  let quote = false;
  let row = 0, col = 0;
  for (let c = 0; c < str.length; c++) {
    let cc = str[c], nc = str[c+1];
    arr[row] = arr[row] || [];
    arr[row][col] = arr[row][col] || '';
    if (cc == '"' && quote && nc == '"') { arr[row][col] += cc; ++c; continue; }
    if (cc == '"') { quote = !quote; continue; }
    if (cc == ',' && !quote) { ++col; continue; }
    if (cc == '\r' && nc == '\n' && !quote) { ++row; col = 0; ++c; continue; }
    if (cc == '\n' && !quote) { ++row; col = 0; continue; }
    if (cc == '\r' && !quote) { ++row; col = 0; continue; }
    arr[row][col] += cc;
  }
  return arr;
}

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
    ucastnici: [{ jmeno: '', pozice: '' }],
    poznamka: ''
  });

  const [checklist, setChecklist] = useState<Record<number, KontrolniBod & { foto?: string, doporuceni?: string, showDoporuceni?: boolean }>>({});
  const [pointDefects, setPointDefects] = useState<Record<number, DefectFormState[]>>({});
  const [googleZavady, setGoogleZavady] = useState<Record<string, Record<number, TypickaZavada[]>>>({});
  const [customPoints, setCustomPoints] = useState<ChecklistPoint[]>([]);
  const [manualDefects, setManualDefects] = useState<DefectFormState[]>([]);
  const [filterPosition, setFilterPosition] = useState<string>("all");
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [revisionNumber, setRevisionNumber] = useState("0");

  const selectedKlient = klienti.find(k => k.id === formData.klientId);
  const selectedPrac = selectedKlient?.pracoviste.find(p => p.id === formData.pracovisteId);

  const uniquePositions = useMemo(() => {
    if (!selectedKlient) return [];
    const positions = selectedKlient.odpovedneOsoby.map(o => o.pozice).filter(Boolean);
    return Array.from(new Set(positions));
  }, [selectedKlient]);

  useEffect(() => {
    const fetchZavady = async () => {
      try {
        const response = await fetch(GOOGLE_SHEETS_URL);
        const csvText = await response.text();
        const rows = parseCSV(csvText);
        
        if (rows.length > 1) {
          const headers = rows[0].map(h => h.toLowerCase().trim());
          const iTyp = headers.findIndex(h => h.includes('typ'));
          const iId = headers.findIndex(h => h.includes('id'));
          let iKratky = headers.findIndex(h => h === 'tag' || h.includes('zkrác') || h.includes('krát') || h.includes('název'));
          if (iKratky === -1) iKratky = headers.findIndex(h => h.includes('nedostatek'));
          const iPopis = headers.findIndex(h => h === 'popis' || (h.includes('popis') && !h.includes('zkr')));
          const iOpatreni = headers.findIndex(h => h.includes('opatřen') || h.includes('opatren'));

          const parsedDefects: Record<string, Record<number, TypickaZavada[]>> = {};

          for (let i = 1; i < rows.length; i++) {
            const r = rows[i];
            if (!r || r.length < 3) continue;
            const typ = iTyp >= 0 ? r[iTyp]?.trim() : r[0]?.trim();
            const id = parseInt(iId >= 0 ? r[iId] : r[2]);
            const nazev = (iKratky >= 0 ? r[iKratky] : r[3])?.trim();
            const popis = (iPopis >= 0 ? r[iPopis] : r[4])?.trim();
            const opatreni = (iOpatreni >= 0 ? r[iOpatreni] : r[5])?.trim();

            if (typ && !isNaN(id) && nazev) {
              if (!parsedDefects[typ]) parsedDefects[typ] = {};
              if (!parsedDefects[typ][id]) parsedDefects[typ][id] = [];
              parsedDefects[typ][id].push({ nazev, popis: popis || "", opatreni: opatreni || "" });
            }
          }
          setGoogleZavady(parsedDefects);
        }
      } catch (error) {
        console.error("Chyba při stahování závad:", error);
      }
    };
    fetchZavady();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (formData.klientId) {
        localStorage.setItem('bpyes_draft_kontrola', JSON.stringify({
          formData, checklist, pointDefects, customPoints
        }));
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [formData, checklist, pointDefects, customPoints]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (formData.klientId) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [formData.klientId]);

  const currentChecklistFlat = useMemo(() => {
    let base = [];
    if (formData.typKontroly === 'PPP') base = CHECKLIST_PPP || [];
    else if (formData.typKontroly === 'PBOZP') base = CHECKLIST_PBOZP || [];
    else if (formData.typKontroly === 'BOZPaPO') base = CHECKLIST_SECTIONS.flatMap(s => s.points);
    return [...base, ...customPoints];
  }, [formData.typKontroly, customPoints]);

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
      text = point.nText || "Zjištěn nedostatek. Je nutné zjednat nápravu.";
      setPointDefects(prev => ({
        ...prev,
        [point.id]: prev[point.id] && prev[point.id].length > 0 ? prev[point.id] : [createEmptyDefect()]
      }));
    }

    setChecklist(prev => ({
      ...prev,
      [point.id]: {
        ...(prev[point.id] || {}),
        bod: point.id,
        hodnoceni: rating,
        textHodnoceni: text,
      }
    }));
  };

  const updateDefect = (pointId: number, index: number, field: keyof DefectFormState, value: any) => {
    setPointDefects(prev => {
      const arr = [...(prev[pointId] || [])];
      arr[index] = { ...arr[index], [field]: value };
      return { ...prev, [pointId]: arr };
    });
  };

  const handleNext = () => {
    if (step === 1 && (!formData.klientId || !formData.pracovisteId || !formData.typKontroly)) {
      toast({ title: "Chyba", description: "Prosím vyplňte základní údaje.", variant: "destructive" });
      return;
    }
    setStep(s => s + 1);
    window.scrollTo(0, 0);
  };

  const executeSave = (isDraft: boolean = false) => {
    const year = new Date(formData.datum).getFullYear();
    const countInYear = zaznamy.filter(z => new Date(z.datum).getFullYear() === year).length + 1;
    
    const aggregatedZavady: Zavada[] = [];
    let defectCounter = 1;

    const buildZavadaAPI = (def: DefectFormState, pointId?: number): Zavada => ({
      id: def.uid,
      cislo: defectCounter++,
      bodKontroly: pointId,
      popis: def.popis || "",
      navrhOpatreni: def.navrhOpatreni || "",
      terminOdstraneni: def.terminOdstraneni || "",
      odpovednaOsoba: def.odpovednaOsoba === 'manual' ? def.odpovednaOsobaManualni : def.odpovednaOsoba,
      stavOdstraneni: def.odstraneno ? 'odstranena' : 'otevrena',
      lokalizace: def.lokalizace,
      zavaznost: def.zavaznost === 'none' ? "" : def.zavaznost, // Zde ošetřeno vymazání pro API a PDF
      datumOdstraneni: def.odstraneno ? def.datumOdstraneni : undefined,
      zaznamProvedl: def.odstraneno ? (def.zaznamProvedl === 'manual' ? def.zaznamProvedlManualni : def.zaznamProvedl) : undefined,
      foto: def.foto
    } as any);

    Object.entries(pointDefects).forEach(([pointId, defects]) => {
      if (checklist[Number(pointId)]?.hodnoceni === 'N') {
        defects.forEach(def => aggregatedZavady.push(buildZavadaAPI(def, Number(pointId))));
      }
    });

    const newRecord = {
      id: Math.random().toString(36).substring(7),
      cislo: generateRecordNumber(year, countInYear, formData.typKontroly),
      revize: parseInt(revisionNumber) || 0,
      ...formData,
      kontrolniBody: Object.values(checklist),
      zavady: aggregatedZavady,
      stav: isDraft ? 'otevreny' : 'uzavreny' as any,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setZaznamy(prev => [...prev, newRecord as any]);
    localStorage.removeItem('bpyes_draft_kontrola');
    setShowSaveModal(false);
    toast({ title: isDraft ? "Uloženo jako rozpracované" : "Záznam vytvořen", description: `Kontrola ${newRecord.cislo} (R${newRecord.revize}) uložena.` });
    router.push(`/zaznamy/${newRecord.id}`);
  };

  const renderDefectForm = (def: DefectFormState, idx: number, pointId: number) => {
    const dostupneZavady = pointId ? (googleZavady[formData.typKontroly]?.[pointId] || []) : [];
    const updateFn = (f: any, v: any) => updateDefect(pointId, idx, f, v);
    const removeFn = () => setPointDefects(p => ({ ...p, [pointId]: p[pointId].filter((_, i) => i !== idx) }));
    const ukazatSablony = !!pointId && pointId < 90000;

    return (
      <div key={def.uid} className="p-4 bg-white rounded-lg border border-amber-200/60 shadow-sm space-y-5 relative">
        {pointDefects[pointId]?.length > 1 && (
          <Button variant="ghost" size="icon" className="absolute top-2 right-2 text-muted-foreground hover:bg-red-50 hover:text-red-600" onClick={removeFn}>
            <X className="h-4 w-4" />
          </Button>
        )}

        {ukazatSablony && (
          <div className="bg-amber-50/50 -mx-4 -mt-4 p-4 rounded-t-lg border-b border-amber-100 mb-4">
            <Label className="text-xs font-bold text-amber-900 mb-2 block">Rychlý výběr ze šablony zjištění</Label>
            <Select 
              disabled={dostupneZavady.length === 0}
              onValueChange={(v) => {
                const vybrana = dostupneZavady[parseInt(v)];
                if (vybrana) {
                  updateFn('popis', vybrana.popis);
                  updateFn('navrhOpatreni', vybrana.opatreni);
                }
              }}
            >
              <SelectTrigger className="bg-white">
                <SelectValue placeholder={dostupneZavady.length > 0 ? "-- Vyberte typický nedostatek --" : `Žádné šablony pro bod ID ${pointId}. (Doplňte do Tabulky)`} />
              </SelectTrigger>
              <SelectContent>
                {dostupneZavady.map((tz, i) => <SelectItem key={i} value={i.toString()}>{tz.nazev}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs">Místo zjištění (Lokalizace)</Label>
            <Input value={def.lokalizace} onChange={(e) => updateFn('lokalizace', e.target.value)} placeholder="Např. Hala B, 1. patro..." className="bg-white h-10" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Závažnost (Priorita)</Label>
            <Select value={def.zavaznost || "none"} onValueChange={(v) => updateFn('zavaznost', v)}>
              <SelectTrigger className="bg-white h-10"><SelectValue placeholder="Nevyplněno (Volitelné)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">-- Bez určení závažnosti --</SelectItem>
                <SelectItem value="low">Nízká</SelectItem>
                <SelectItem value="medium">Střední</SelectItem>
                <SelectItem value="high">Vysoká</SelectItem>
                <SelectItem value="critical">Kritická (Ihned řešit!)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Popis závady *</Label>
            <Textarea value={def.popis} onChange={(e) => updateFn('popis', e.target.value)} placeholder="Detailní popis nedostatku..." className="bg-white min-h-[100px]" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Návrh opatření *</Label>
            <Textarea value={def.navrhOpatreni} onChange={(e) => updateFn('navrhOpatreni', e.target.value)} placeholder="Co je nutné udělat..." className="bg-white min-h-[100px]" />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Termín odstranění</Label>
            <Input type="date" value={def.terminOdstraneni} onChange={(e) => updateFn('terminOdstraneni', e.target.value)} className="bg-white h-10" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Odpovědná pozice k řešení</Label>
            <Select value={def.odpovednaOsoba} onValueChange={(v) => updateFn('odpovednaOsoba', v)}>
              <SelectTrigger className="bg-white h-10"><SelectValue placeholder="Vyberte pozici" /></SelectTrigger>
              <SelectContent>
                {uniquePositions.map(pozice => <SelectItem key={pozice} value={pozice}>{pozice}</SelectItem>)}
                <SelectItem value="manual">-- Zadat manuálně --</SelectItem>
              </SelectContent>
            </Select>
            {def.odpovednaOsoba === 'manual' && (
              <Input placeholder="Vepište konkrétní pozici..." value={def.odpovednaOsobaManualni} onChange={(e) => updateFn('odpovednaOsobaManualni', e.target.value)} className="mt-2 h-10 bg-white border-dashed" />
            )}
          </div>
        </div>

        <div className="pt-2">
          <div className="relative inline-block">
            <Button variant="outline" size="sm" className="text-muted-foreground cursor-pointer">
              <Camera className="h-4 w-4 mr-2" /> {def.foto ? "Změnit fotku" : "Přidat fotodokumentaci"}
            </Button>
            <Input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" 
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const r = new FileReader();
                r.onloadend = () => updateFn('foto', r.result as string);
                r.readAsDataURL(file);
              }}
            />
          </div>
          {def.foto && (
            <div className="relative mt-3 inline-block border rounded-md p-1 bg-muted/30">
              <Button variant="destructive" size="icon" className="absolute -top-2 -right-2 h-6 w-6 rounded-full shadow" onClick={() => updateFn('foto', '')}><X className="h-3 w-3" /></Button>
              <img src={def.foto} alt="Závada" className="h-40 w-auto object-cover rounded shadow-sm" />
            </div>
          )}
        </div>

        <div className="pt-4 mt-2 border-t border-amber-200/60 bg-amber-50/30 -mx-4 -mb-4 p-4 rounded-b-lg">
          <div className="flex items-center gap-2 cursor-pointer select-none" 
               onClick={() => {
                 updateFn('odstraneno', !def.odstraneno);
                 if (!def.odstraneno && !def.datumOdstraneni) updateFn('datumOdstraneni', new Date().toISOString().split('T')[0]);
               }}>
            {def.odstraneno ? <CheckSquare className="h-5 w-5 text-green-600" /> : <Square className="h-5 w-5 text-muted-foreground" />}
            <span className={cn("font-bold text-sm", def.odstraneno ? "text-green-700" : "text-muted-foreground")}>Nedostatek byl odstraněn</span>
          </div>
          
          {def.odstraneno && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 animate-in slide-in-from-top-2">
              <div className="space-y-2">
                <Label className="text-xs">Datum odstranění</Label>
                <Input type="date" value={def.datumOdstraneni} onChange={(e) => updateFn('datumOdstraneni', e.target.value)} className="bg-white h-10" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Záznam o odstranění provedl (Pozice)</Label>
                <Select value={def.zaznamProvedl} onValueChange={(v) => updateFn('zaznamProvedl', v)}>
                  <SelectTrigger className="bg-white h-10"><SelectValue placeholder="Vyberte pozici" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Provedl BPyes">Provedl (My / BPyes)</SelectItem>
                    {uniquePositions.map(pozice => <SelectItem key={pozice} value={pozice}>{pozice}</SelectItem>)}
                    <SelectItem value="manual">-- Zadat manuálně --</SelectItem>
                  </SelectContent>
                </Select>
                {def.zaznamProvedl === 'manual' && (
                  <Input placeholder="Vepište pozici..." value={def.zaznamProvedlManualni} onChange={(e) => updateFn('zaznamProvedlManualni', e.target.value)} className="mt-2 h-10 bg-white border-dashed" />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderPoint = (point: ChecklistPoint, isCustom: boolean = false) => {
    const state = checklist[point.id];
    const defects = pointDefects[point.id] || [];
    
    return (
      <div key={point.id} className="pt-8 first:pt-0 space-y-4 relative group">
        {isCustom && (
          <Button variant="ghost" size="icon" className="absolute top-2 right-0 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => setCustomPoints(prev => prev.filter(p => p.id !== point.id))}>
            <X className="h-4 w-4" />
          </Button>
        )}
        
        <div className="flex flex-col md:flex-row justify-between items-start gap-4">
          <div className="flex gap-3 flex-1 w-full">
            <span className="font-mono text-muted-foreground font-bold">{isCustom ? '*' : point.id}.</span>
            {isCustom ? (
              <Input value={point.text} onChange={(e) => setCustomPoints(prev => prev.map(p => p.id === point.id ? { ...p, text: e.target.value } : p))} placeholder="Zadejte název vlastního bodu zjištění..." className="font-medium text-[15px] h-8" />
            ) : (
              <p className="font-medium text-[15px]">{point.text}</p>
            )}
          </div>
          
          <div className="grid grid-cols-5 gap-1 w-full md:w-auto">
            {[
              { label: 'V', rating: 'V', color: 'bg-green-100 text-green-700 hover:bg-green-200 border-green-200 data-[state=active]:bg-green-600 data-[state=active]:text-white' },
              { label: 'N', rating: 'N', color: 'bg-red-100 text-red-700 hover:bg-red-200 border-red-200 data-[state=active]:bg-red-600 data-[state=active]:text-white' },
              { label: 'NA', rating: 'NA', color: 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-200 data-[state=active]:bg-gray-600 data-[state=active]:text-white' },
              { label: 'NK', rating: 'NK', color: 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-200 data-[state=active]:bg-gray-600 data-[state=active]:text-white' }
            ].map((btn) => (
              <Button
                key={btn.label} variant="outline" data-state={state?.hodnoceni === btn.rating ? 'active' : 'inactive'}
                className={cn("h-12 min-w-[50px] font-bold shadow-none transition-all", btn.color)}
                onClick={() => handleRatingChange(point, btn.rating as any)}
              >
                {btn.label}
              </Button>
            ))}
            
            <Button
              key="D"
              variant="outline"
              data-state={state?.showDoporuceni ? 'active' : 'inactive'}
              className={cn("h-12 min-w-[50px] font-bold shadow-none transition-all", "bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200 data-[state=active]:bg-blue-600 data-[state=active]:text-white")}
              onClick={() => setChecklist(prev => ({
                ...prev,
                [point.id]: {
                  ...(prev[point.id] || { bod: point.id, hodnoceni: '' }),
                  showDoporuceni: !prev[point.id]?.showDoporuceni
                }
              }))}
            >
              D
            </Button>
          </div>
        </div>

        {state?.showDoporuceni && (
          <div className="space-y-2 mt-4 ml-8 animate-in fade-in slide-in-from-top-2">
            <Label className="text-xs text-blue-700 font-semibold">Doporučení auditora k tomuto bodu</Label>
            <Textarea 
              value={state.doporuceni || ""} 
              onChange={(e) => setChecklist(prev => ({ ...prev, [point.id]: { ...prev[point.id], doporuceni: e.target.value }}))}
              placeholder="Zde můžete uvést doporučení pro klienta, i když je bod hodnocen jako vyhovující..." 
              className="bg-blue-50/50 border-blue-200" 
            />
          </div>
        )}

        {state?.hodnoceni && state.hodnoceni !== 'NA' && (
          <div className="space-y-4 ml-8 animate-in fade-in slide-in-from-top-2 duration-300">
            {state.hodnoceni === 'N' && (
              <div className="p-4 bg-amber-50/50 rounded-xl border border-amber-200 space-y-6 shadow-inner">
                <div className="flex items-center gap-2 text-amber-800 font-bold text-sm uppercase">
                  <AlertTriangle className="h-4 w-4" /> Evidence zjištěných nedostatků k tomuto bodu
                </div>
                
                <div className="space-y-6">
                  {defects.map((def, idx) => renderDefectForm(def, idx, point.id))}
                </div>

                <Button 
                  variant="outline" 
                  className="w-full border-dashed border-amber-300 text-amber-800 hover:bg-amber-100"
                  onClick={() => setPointDefects(prev => ({ ...prev, [point.id]: [...(prev[point.id] || []), createEmptyDefect()] }))}
                >
                  <Plus className="h-4 w-4 mr-2" /> Přidat další, nesouvisející závadu pod tento stejný bod
                </Button>
              </div>
            )}

            <div className="flex items-center gap-2">
              {!state.poznamka && (
                <Button variant="ghost" size="sm" onClick={() => setChecklist(prev => ({ ...prev, [point.id]: { ...prev[point.id], poznamka: " " }}))} className="text-muted-foreground">
                  <Plus className="h-3 w-3 mr-1" /> Přidat interní poznámku (nebude v reportu)
                </Button>
              )}
              {state.poznamka && (
                <div className="flex-1 space-y-2 mt-2">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1"><StickyNote className="h-3 w-3" /> Interní poznámka k hodnocení bodu</Label>
                  <Textarea value={state.poznamka} onChange={(e) => setChecklist(prev => ({ ...prev, [point.id]: { ...prev[point.id], poznamka: e.target.value }}))} className="bg-muted/30" />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const filteredPointDefects = useMemo(() => {
    return Object.entries(pointDefects).filter(([id]) => checklist[Number(id)]?.hodnoceni === 'N').map(([id, defects]) => {
      const filtered = defects.filter(def => {
        if (filterPosition !== 'all') {
          const actualPosition = def.odpovednaOsoba === 'manual' ? def.odpovednaOsobaManualni : def.odpovednaOsoba;
          if (actualPosition !== filterPosition) return false;
        }
        return true;
      });
      return { id, defects: filtered };
    }).filter(group => group.defects.length > 0);
  }, [pointDefects, checklist, filterPosition]);

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8 pb-24">
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 animate-in fade-in">
          <Card className="w-full max-w-md shadow-2xl">
            <CardHeader>
              <CardTitle>Dokončení a uložení kontroly</CardTitle>
              <CardDescription>Před uložením záznamu potvrďte číslo revize dokumentu.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Číslo revize (R)</Label>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-muted-foreground">R</span>
                  <Input 
                    type="number" 
                    min="0" 
                    value={revisionNumber} 
                    onChange={(e) => setRevisionNumber(e.target.value)}
                    className="text-lg font-bold"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">Výchozí hodnota je 0. Pokud se jedná o aktualizaci stávající zprávy, zvyšte číslo.</p>
              </div>
            </CardContent>
            <div className="p-4 border-t flex justify-end gap-2 bg-muted/20">
              <Button variant="outline" onClick={() => setShowSaveModal(false)}>Zrušit</Button>
              <Button onClick={() => executeSave(false)}>Potvrdit a uložit</Button>
            </div>
          </Card>
        </div>
      )}

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
              <div className={cn("h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold", step === i ? "bg-primary text-white" : step > i ? "bg-muted text-muted-foreground" : "bg-green-100 text-green-700")}>
                {step > i ? <CheckCircle2 className="h-5 w-5" /> : i}
              </div>
              {i < 3 && <div className={cn("h-px w-8 bg-muted", step > i && "bg-green-200")} />}
            </div>
          ))}
          <span className="ml-4 text-sm font-medium text-muted-foreground">{step === 1 ? "Výběr klienta a typu" : step === 2 ? "Kontrolní list" : "Shrnutí"}</span>
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
                  <SelectTrigger className="h-11"><SelectValue placeholder="Vyberte klienta" /></SelectTrigger>
                  <SelectContent>
                    {klienti.map(k => <SelectItem key={k.id} value={k.id}>{k.nazev}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Pracoviště</Label>
                <Select disabled={!formData.klientId} value={formData.pracovisteId} onValueChange={(v) => setFormData({...formData, pracovisteId: v})}>
                  <SelectTrigger className="h-11"><SelectValue placeholder="Vyberte pracoviště" /></SelectTrigger>
                  <SelectContent>
                    {selectedKlient?.pracoviste.map(p => <SelectItem key={p.id} value={p.id}>{p.nazev}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Typ kontroly</Label>
                <Select value={formData.typKontroly} onValueChange={(v: any) => setFormData({...formData, typKontroly: v})}>
                  <SelectTrigger className="h-11"><SelectValue placeholder="Zvolte typ kontroly" /></SelectTrigger>
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

            {/* SEkce pro přidávání účastníků vrácena */}
            <div className="space-y-4 pt-6 border-t mt-6">
              <div className="flex justify-between items-center">
                <Label>Účastníci kontroly (Uvedení v protokolu)</Label>
                <Button variant="ghost" size="sm" onClick={() => setFormData({...formData, ucastnici: [...formData.ucastnici, {jmeno: '', pozice: ''}]})}>
                  <Plus className="mr-2 h-4 w-4" /> Přidat osobu
                </Button>
              </div>
              {formData.ucastnici.map((u, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Input placeholder="Jméno a příjmení" value={u.jmeno} onChange={(e) => { const next = [...formData.ucastnici]; next[i].jmeno = e.target.value; setFormData({...formData, ucastnici: next}); }} className="flex-1" />
                  <Input placeholder="Pracovní pozice" value={u.pozice} onChange={(e) => { const next = [...formData.ucastnici]; next[i].pozice = e.target.value; setFormData({...formData, ucastnici: next}); }} className="flex-1" />
                  {formData.ucastnici.length > 1 && (
                    <Button variant="ghost" size="icon" onClick={() => setFormData({...formData, ucastnici: formData.ucastnici.filter((_, idx) => idx !== i)})} className="shrink-0 text-muted-foreground hover:text-red-500">
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
              <span className="px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-xs font-bold">Typ: {formData.typKontroly}</span>
            </div>
          </div>

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
                    {section.points.map(p => renderPoint(p, false))}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}

          {formData.typKontroly === 'PPP' && (
            <div className="border rounded-lg bg-white overflow-hidden shadow-sm">
              <div className="px-6 py-4 bg-muted/10 border-b"><span className="text-base font-bold">Kontrolní list - Preventivní požární prohlídka</span></div>
              <div className="px-6 pb-6 space-y-8 pt-4 divide-y">
                {CHECKLIST_PPP.map(p => renderPoint(p, false))}
              </div>
            </div>
          )}

          {formData.typKontroly === 'PBOZP' && (
            <div className="border rounded-lg bg-white overflow-hidden shadow-sm">
              <div className="px-6 py-4 bg-muted/10 border-b"><span className="text-base font-bold">Kontrolní list - Prověrka BOZP pracoviště</span></div>
              <div className="px-6 pb-6 space-y-8 pt-4 divide-y">
                {CHECKLIST_PBOZP.map(p => renderPoint(p, false))}
              </div>
            </div>
          )}

          <div className="border rounded-lg bg-white overflow-hidden shadow-sm border-blue-200">
            <div className="px-6 py-4 bg-blue-50 border-b border-blue-100 flex justify-between items-center">
              <span className="text-base font-bold text-blue-900">Vlastní zjištění (Volné body)</span>
              <Button size="sm" onClick={() => setCustomPoints(prev => [...prev, { id: 99000 + prev.length, text: "" }])}>
                <Plus className="h-4 w-4 mr-2" /> Přidat vlastní bod
              </Button>
            </div>
            {customPoints.length > 0 ? (
              <div className="px-6 pb-6 space-y-8 pt-4 divide-y">
                {customPoints.map(p => renderPoint(p, true))}
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground text-sm italic">Zatím nebyly přidány žádné volné body zjištění.</div>
            )}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-8">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card className="p-4 flex flex-col items-center gap-1 border-green-200 bg-green-50"><span className="text-2xl font-bold text-green-700">{stats.V}</span><span className="text-[10px] uppercase font-bold text-green-600">Vyhovuje</span></Card>
            <Card className="p-4 flex flex-col items-center gap-1 border-red-200 bg-red-50"><span className="text-2xl font-bold text-red-700">{stats.N}</span><span className="text-[10px] uppercase font-bold text-red-600">Nevyhovuje</span></Card>
            <Card className="p-4 flex flex-col items-center gap-1 border-gray-200 bg-gray-50"><span className="text-2xl font-bold text-gray-700">{stats.NA}</span><span className="text-[10px] uppercase font-bold text-gray-600">Neaplikováno</span></Card>
            <Card className="p-4 flex flex-col items-center gap-1 border-gray-200 bg-gray-50"><span className="text-2xl font-bold text-gray-700">{stats.NK}</span><span className="text-[10px] uppercase font-bold text-gray-600">Nekontrolováno</span></Card>
            <Card className="p-4 flex flex-col items-center gap-1 border-amber-200 bg-amber-50"><span className="text-2xl font-bold text-amber-700">{stats.unfilled}</span><span className="text-[10px] uppercase font-bold text-amber-600">Nevyplněno</span></Card>
          </div>

          <Card className="border-none shadow-sm">
            <CardHeader><CardTitle>Závěrečné hodnocení a doporučení</CardTitle><CardDescription>Celkové shrnutí kontroly nebo hlavní doporučení pro klienta.</CardDescription></CardHeader>
            <CardContent>
              <Textarea placeholder="Napište celkové zhodnocení prověrky/prohlídky..." className="min-h-[120px] bg-white" value={formData.poznamka} onChange={(e) => setFormData(prev => ({ ...prev, poznamka: e.target.value }))} />
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-muted/20 border-b pb-4">
              <div>
                <CardTitle>Náhled zjištěných závad</CardTitle>
                <CardDescription>Zde si můžete prohlédnout evidované nedostatky před uložením.</CardDescription>
              </div>
              
              <div className="flex items-center gap-2 bg-white p-2 rounded-md border shadow-sm">
                <Filter className="h-4 w-4 text-muted-foreground ml-2" />
                <Select value={filterPosition} onValueChange={setFilterPosition}>
                  <SelectTrigger className="h-9 w-[220px] border-none shadow-none focus:ring-0">
                    <SelectValue placeholder="Filtrovat podle pozice" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Zobrazit vše (Všechny pozice)</SelectItem>
                    {uniquePositions.map(pozice => <SelectItem key={pozice} value={pozice}>{pozice}</SelectItem>)}
                    <SelectItem value="manual">Vlastní manuální zadání</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4 pt-6">
              {filteredPointDefects.map(group => (
                group.defects.map(defect => (
                  <div key={defect.uid} className="p-4 border rounded-lg flex items-start gap-4 hover:bg-muted/20 transition-colors">
                    <div className="bg-red-600 text-white font-mono text-xs h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-1">
                      {Number(group.id) > 90000 ? '*' : group.id}
                    </div>
                    <div className="flex-1 space-y-2">
                      <p className="font-bold">{defect.popis}</p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <CalendarIcon className="h-3 w-3" />
                          {defect.terminOdstraneni ? new Date(defect.terminOdstraneni).toLocaleDateString('cs-CZ') : 'Neuvedeno'}
                        </div>
                        <div className="flex items-center gap-2">
                          <UserIcon className="h-3 w-3" />
                          <span className="font-medium text-black">
                            {defect.odpovednaOsoba === 'manual' ? defect.odpovednaOsobaManualni : (defect.odpovednaOsoba || 'Neuvedena')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ))}
              
              {filteredPointDefects.length === 0 && (
                <div className="py-12 text-center text-muted-foreground italic">
                  {filterPosition === 'all' ? "Nebyly zjištěny žádné systémové závady." : `Pro vybranou pozici nebyly zjištěny žádné závady.`}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 z-50 flex justify-center shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
        <div className="max-w-5xl w-full flex justify-between items-center px-4 md:px-8">
          <Button variant="ghost" disabled={step === 1} onClick={() => { setStep(s => s - 1); window.scrollTo(0, 0); }} className="h-11 px-6"><ChevronLeft className="mr-2 h-4 w-4" /> Zpět</Button>
          <div className="flex gap-2">
            {step === 3 && <Button variant="outline" className="h-11 px-6" onClick={() => executeSave(true)}>Uložit rozpracované</Button>}
            <Button onClick={step === 3 ? () => setShowSaveModal(true) : handleNext} className="h-11 px-8 shadow-sm">
              {step === 3 ? "Uložit a dokončit" : "Pokračovat"}
              {step !== 3 && <ChevronRight className="ml-2 h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
