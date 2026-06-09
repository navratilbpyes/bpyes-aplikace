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
import { Checkbox } from "@/components/ui/checkbox";
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
  zavaznost: "none",
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
    pracovisteIds: [] as string[],
    typKontroly: 'BOZPaPO' as 'BOZPaPO' | 'PPP' | 'PBOZP',
    datum: new Date().toISOString().split('T')[0],
    ucastnici: [{ jmeno: '', pozice: '' }],
    poznamka: ''
  });

  const [checklist, setChecklist] = useState<Record<number, KontrolniBod & { foto?: string, doporuceni?: string, showDoporuceni?: boolean }>>({});
  const [pointDefects, setPointDefects] = useState<Record<number, DefectFormState[]>>({});
  const [googleZavady, setGoogleZavady] = useState<Record<string, Record<number, TypickaZavada[]>>>({});
  const [customPoints, setCustomPoints] = useState<ChecklistPoint[]>([]);
  const [disabledSections, setDisabledSections] = useState<string[]>([]);
  const [filterPosition, setFilterPosition] = useState<string>("all");
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [revisionNumber, setRevisionNumber] = useState("0");

  const selectedKlient = klienti.find(k => k.id === formData.klientId);

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

  const currentChecklistFlat = useMemo(() => {
    let base: any[] = [];
    if (formData.typKontroly === 'PPP') base = (CHECKLIST_PPP || []).map(p => ({ ...p, sekce: 'PPP' }));
    else if (formData.typKontroly === 'PBOZP') base = (CHECKLIST_PBOZP || []).map(p => ({ ...p, sekce: 'PBOZP' }));
    else if (formData.typKontroly === 'BOZPaPO') {
      base = (CHECKLIST_SECTIONS || []).flatMap(s => 
        s.points.map(p => ({ ...p, sekce: `ODDÍL ${s.id}: ${s.title}` }))
      );
    }
    return [...base, ...customPoints.map(p => ({ ...p, sekce: 'Vlastní zjištění' }))];
  }, [formData.typKontroly, customPoints]);

  const activeChecklistFlat = useMemo(() => {
    return currentChecklistFlat.filter(p => !disabledSections.includes(p.sekce));
  }, [currentChecklistFlat, disabledSections]);

  const totalPoints = activeChecklistFlat.length > 0 ? activeChecklistFlat.length : 1;
  const answeredPoints = activeChecklistFlat.filter(p => checklist[p.id] && checklist[p.id].hodnoceni !== '').length;
  const progressPercent = Math.round((answeredPoints / totalPoints) * 100);

  const stats = useMemo(() => {
    const vals = activeChecklistFlat.map(p => checklist[p.id]).filter(Boolean);
    return {
      V: vals.filter(v => v.hodnoceni === 'V').length,
      N: vals.filter(v => v.hodnoceni === 'N').length,
      NA: vals.filter(v => v.hodnoceni === 'NA').length,
      NK: vals.filter(v => v.hodnoceni === 'NK').length,
      unfilled: totalPoints - answeredPoints
    };
  }, [checklist, activeChecklistFlat, totalPoints, answeredPoints]);

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
    if (step === 1 && (!formData.klientId || formData.pracovisteIds.length === 0 || !formData.typKontroly)) {
      toast({ title: "Chyba", description: "Prosím vyberte klienta a alespoň jedno pracoviště.", variant: "destructive" });
      return;
    }
    setStep(s => s + 1);
    window.scrollTo(0, 0);
  };

  const executeSave = (isDraft: boolean = false) => {
    const year = new Date(formData.datum).getFullYear();
    const countInYear = zaznamy.filter(z => new Date(z.datum).getFullYear() === year).length + 1;
    
    const finalKontrolniBody: any[] = [];
    const aggregatedZavady: Zavada[] = [];
    let defectCounter = 1;

    activeChecklistFlat.forEach(basePoint => {
      const pointState = checklist[basePoint.id];
      if (!pointState || !pointState.hodnoceni || pointState.hodnoceni === 'NK') return;

      const isDefect = pointState.hodnoceni === 'N';
      const defectsForThisPoint = pointDefects[basePoint.id] || [];
      const primaryDefect = isDefect && defectsForThisPoint.length > 0 ? defectsForThisPoint[0] : null;

      finalKontrolniBody.push({
        bod: basePoint.id,
        otazka: basePoint.text || "Nepopsaný bod",
        sekce: basePoint.sekce,
        hodnoceni: pointState.hodnoceni,
        doporuceni: pointState.doporuceni || "",
        showDoporuceni: pointState.showDoporuceni || false,
        poznamka: pointState.poznamka || "",
        popis: primaryDefect?.popis || "",
        navrhOpatreni: primaryDefect?.navrhOpatreni || "",
        lokalizace: primaryDefect?.lokalizace || "",
        terminOdstraneni: primaryDefect?.terminOdstraneni || "",
        odpovednaOsoba: primaryDefect?.odpovednaOsoba === 'manual' ? primaryDefect.odpovednaOsobaManualni : (primaryDefect?.odpovednaOsoba || ""),
        foto: primaryDefect?.foto || ""
      });

      if (isDefect) {
        defectsForThisPoint.forEach(def => {
          aggregatedZavady.push({
            id: def.uid,
            cislo: defectCounter++,
            bodKontroly: basePoint.id,
            sekce: basePoint.sekce,
            popis: def.popis || "",
            navrhOpatreni: def.navrhOpatreni || "",
            terminOdstraneni: def.terminOdstraneni || "",
            odpovednaOsoba: def.odpovednaOsoba === 'manual' ? def.odpovednaOsobaManualni : def.odpovednaOsoba,
            stavOdstraneni: def.odstraneno ? 'odstranena' : 'otevrena',
            lokalizace: def.lokalizace,
            zavaznost: def.zavaznost === 'none' ? "" : def.zavaznost,
            datumOdstraneni: def.odstraneno ? def.datumOdstraneni : undefined,
            zaznamProvedl: def.od
