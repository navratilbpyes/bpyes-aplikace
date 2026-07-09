'use client';

import { STAVY, POradi_TLACITEK, paskaPro } from "@/lib/stavy";
import { useData, db } from "@/components/data-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useState, useEffect, useMemo } from "react";
import { 
  CheckCircle2, ChevronRight, ChevronLeft, Plus, X, AlertTriangle,
  Calendar as CalendarIcon, User as UserIcon, StickyNote, Camera,
  CheckSquare, Square, Filter, Loader2, Info
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useRouter, useParams } from "next/navigation";
import { cn } from "@/app/lib/utils";
import { CHECKLIST_SECTIONS, CHECKLIST_PPP, CHECKLIST_PBOZP, ChecklistPoint } from "../../nova-kontrola/checklist-data";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { KontrolniBod, Zavada } from "@/app/lib/types";
import { doc, setDoc } from "firebase/firestore";

interface TypickaZavada { nazev: string; popis: string; opatreni: string; }
interface DefectFormState {
  uid: string; popis: string; navrhOpatreni: string; terminOdstraneni: string;
  odpovednaOsoba: string; odpovednaOsobaManualni: string; lokalizace: string;
  zavaznost: string; odstraneno: boolean; datumOdstraneni: string;
  zaznamProvedl: string; zaznamProvedlManualni: string; foto?: string[];
}

const createEmptyDefect = (): DefectFormState => ({
  uid: Math.random().toString(36).substring(7), popis: "", navrhOpatreni: "",
  terminOdstraneni: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  odpovednaOsoba: "", odpovednaOsobaManualni: "", lokalizace: "", zavaznost: "none",
  odstraneno: false, datumOdstraneni: "", zaznamProvedl: "", zaznamProvedlManualni: "", foto: []
});

const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1024; const MAX_HEIGHT = 1024;
        let width = img.width; let height = img.height;
        if (width > height) { if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } } 
        else { if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; } }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};
export const dynamic = 'force-dynamic';
const GOOGLE_SHEETS_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTqBDqcv7REG4fkbLQHUqOQP13KzwB-wAAEaotZldSvZMvTpzfc8OlJvo8isBWkmQBpjYTm-I_X6Lls/pub?output=csv";
function parseCSV(str: string) {
  const arr: string[][] = []; let quote = false; let row = 0, col = 0;
  for (let c = 0; c < str.length; c++) {
    let cc = str[c], nc = str[c+1];
    arr[row] = arr[row] || []; arr[row][col] = arr[row][col] || '';
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

export default function EditInspectionPage() {
  const { klienti, zaznamy, setZaznamy } = useData();
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const recordId = params.id as string;

  const recordToEdit = useMemo(() => zaznamy.find(z => z.id === recordId), [zaznamy, recordId]);

  const [isLoaded, setIsLoaded] = useState(false);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    klientId: '', pracovisteIds: [] as string[], typKontroly: 'BOZPaPO' as any,
    datum: '', ucastnici: [{ jmeno: '', pozice: '' }], poznamka: ''
  });

  const [checklist, setChecklist] = useState<Record<string, any>>({});
  const [pointDefects, setPointDefects] = useState<Record<string, DefectFormState[]>>({});
  const [googleZavady, setGoogleZavady] = useState<Record<string, Record<string, TypickaZavada[]>>>({});
  const [customPoints, setCustomPoints] = useState<ChecklistPoint[]>([]);
  const [disabledSections, setDisabledSections] = useState<string[]>([]);
  const [filterPosition, setFilterPosition] = useState<string>("all");
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [revisionNumber, setRevisionNumber] = useState("0");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!recordToEdit || isLoaded) return;
    setFormData({
      klientId: recordToEdit.klientId || '',
      pracovisteIds: recordToEdit.pracovisteIds || [],
      typKontroly: recordToEdit.typKontroly || 'BOZPaPO',
      datum: recordToEdit.datum || new Date().toISOString().split('T')[0],
      ucastnici: recordToEdit.ucastnici?.length > 0 ? recordToEdit.ucastnici : [{ jmeno: '', pozice: '' }],
      poznamka: recordToEdit.poznamka || ''
    });
    setRevisionNumber(String((recordToEdit.revize || 0) + 1));

    const initialChecklist: any = {};
    const initialCustomPoints: any[] = [];
    recordToEdit.kontrolniBody?.forEach((kb: any) => {
      initialChecklist[kb.bod] = {
        bod: kb.bod, hodnoceni: kb.hodnoceni, doporuceni: kb.doporuceni || "", showDoporuceni: kb.showDoporuceni || false, poznamka: kb.poznamka || "",
      };
      if (typeof kb.bod === 'number' && kb.bod >= 99000) initialCustomPoints.push({ id: kb.bod, text: kb.otazka });
    });
    setChecklist(initialChecklist);
    setCustomPoints(initialCustomPoints);

    const initialDefects: any = {};
    recordToEdit.zavady?.forEach((zav: any) => {
      if (!initialDefects[zav.bodKontroly]) initialDefects[zav.bodKontroly] = [];
      initialDefects[zav.bodKontroly].push({
        uid: zav.id || Math.random().toString(36).substring(7),
        popis: zav.popis || "", navrhOpatreni: zav.navrhOpatreni || "",
        terminOdstraneni: zav.terminOdstraneni || "", odpovednaOsoba: zav.odpovednaOsoba || "",
        odpovednaOsobaManualni: zav.odpovednaOsoba || "", lokalizace: zav.lokalizace || "",
        zavaznost: zav.zavaznost || "none", odstraneno: zav.stavOdstraneni === 'odstranena',
        datumOdstraneni: zav.datumOdstraneni || "", zaznamProvedl: zav.zaznamProvedl || "",
        zaznamProvedlManualni: zav.zaznamProvedl || "", foto: zav.foto || []
      });
    });
    setPointDefects(initialDefects);
    setIsLoaded(true);
  }, [recordToEdit, isLoaded]);

  const selectedKlient = klienti.find(k => k.id === formData.klientId);
  const uniquePositions = useMemo(() => {
    if (!selectedKlient) return [];
    return Array.from(new Set((selectedKlient.odpovedneOsoby || []).map((o: any) => o.pozice || o.funkce).filter(Boolean)));
  }, [selectedKlient]);

  useEffect(() => {
    fetch(GOOGLE_SHEETS_URL).then(res => res.text()).then(csvText => {
      const rows = parseCSV(csvText);
      if (rows.length > 1) {
        const headers = rows[0].map(h => h.toLowerCase().trim());
        const iTyp = headers.findIndex(h => h.includes('typ'));
        const iId = headers.findIndex(h => h.includes('id'));
        let iKratky = headers.findIndex(h => h === 'tag' || h.includes('zkrác') || h.includes('krát') || h.includes('název'));
        if (iKratky === -1) iKratky = headers.findIndex(h => h.includes('nedostatek'));
        const iPopis = headers.findIndex(h => h === 'popis' || (h.includes('popis') && !h.includes('zkr')));
        const iOpatreni = headers.findIndex(h => h.includes('opatřen') || h.includes('opatren'));
        const parsedDefects: Record<string, Record<string, TypickaZavada[]>> = {};
        for (let i = 1; i < rows.length; i++) {
          const r = rows[i]; if (!r || r.length < 3) continue;
          const typ = iTyp >= 0 ? r[iTyp]?.trim() : r[0]?.trim();
          const id = parseInt(iId >= 0 ? r[iId] : r[2]);
          const nazev = (iKratky >= 0 ? r[iKratky] : r[3])?.trim();
          const popis = (iPopis >= 0 ? r[iPopis] : r[4])?.trim();
          const opatreni = (iOpatreni >= 0 ? r[iOpatreni] : r[5])?.trim();
          if (typ && !isNaN(id) && nazev) {
            const idKey = String(id);
            if (!parsedDefects[typ]) parsedDefects[typ] = {};
            if (!parsedDefects[typ][idKey]) parsedDefects[typ][idKey] = [];
            parsedDefects[typ][idKey].push({ nazev, popis: popis || "", opatreni: opatreni || "" });
          }
        }
        setGoogleZavady(parsedDefects);
      }
    }).catch(console.error);
  }, []);

  const currentChecklistFlat = useMemo(() => {
    let base: any[] = [];
    if (formData.typKontroly === 'PPP') base = (CHECKLIST_PPP || []).map((p: any) => ({ ...p, sekce: 'PPP' }));
    else if (formData.typKontroly === 'PBOZP') base = (CHECKLIST_PBOZP || []).map((p: any) => ({ ...p, sekce: 'PBOZP' }));
    else if (formData.typKontroly === 'BOZPaPO') {
      base = (CHECKLIST_SECTIONS || []).flatMap(s => s.points.map((p: any) => ({ ...p, sekce: `ODDÍL ${s.id}: ${s.title}` })));
    }
    return [...base, ...customPoints.map((p: any) => ({ ...p, sekce: 'Vlastní zjištění' }))];
  }, [formData.typKontroly, customPoints]);

  const activeChecklistFlat = useMemo(() => currentChecklistFlat.filter(p => !disabledSections.includes(p.sekce)), [currentChecklistFlat, disabledSections]);
  const totalPoints = activeChecklistFlat.length > 0 ? activeChecklistFlat.length : 1;
  const answeredPoints = activeChecklistFlat.filter(p => checklist[p.id] && checklist[p.id].hodnoceni !== '').length;
  const progressPercent = Math.round((answeredPoints / totalPoints) * 100);

  const stats = useMemo(() => {
    const vals = activeChecklistFlat.map((p: any) => checklist[p.id]).filter(Boolean);
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
      setPointDefects(prev => ({ ...prev, [point.id]: prev[point.id] && prev[point.id].length > 0 ? prev[point.id] : [createEmptyDefect()] }));
    }
    setChecklist(prev => ({ ...prev, [point.id]: { ...(prev[point.id] || {}), bod: point.id, hodnoceni: rating, textHodnoceni: text } }));
  };

  const updateDefect = (pointId: string, index: number, field: keyof DefectFormState, value: any) => {
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
    setStep(s => s + 1); window.scrollTo(0, 0);
  };

  const executeSave = async (isDraft: boolean = false) => {
    if (!recordToEdit) return;
    setIsSaving(true);
    try {
      const finalKontrolniBody: any[] = [];
      const aggregatedZavady: Zavada[] = [];
      let defectCounter = 1;

      activeChecklistFlat.forEach(basePoint => {
        const pointState = checklist[basePoint.id];
        if (!pointState || !pointState.hodnoceni || pointState.hodnoceni === 'NK') return;

        const isDefect = pointState.hodnoceni === 'N';
        const defectsForThisPoint = pointDefects[basePoint.id] || [];
        const primaryDefect = isDefect && defectsForThisPoint.length > 0 ? defectsForThisPoint[0] : null;
        
        const existingKb = recordToEdit.kontrolniBody?.find((kb: any) => kb.bod === basePoint.id);

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
          foto: primaryDefect?.foto || [],
          vyresenoKlientem: existingKb?.vyresenoKlientem || false,
          datumVyreseniKlientem: existingKb?.datumVyreseniKlientem || "",
          jmenoVyresitele: existingKb?.jmenoVyresitele || "",
          poznamkaKlienta: existingKb?.poznamkaKlienta || "",
          fotoVyreseni: existingKb?.fotoVyreseni || []
        });

        if (isDefect) {
          defectsForThisPoint.forEach(def => {
            aggregatedZavady.push({
              id: def.uid, cislo: defectCounter++, bodKontroly: basePoint.id, sekce: basePoint.sekce,
              popis: def.popis || "", navrhOpatreni: def.navrhOpatreni || "", terminOdstraneni: def.terminOdstraneni || "",
              odpovednaOsoba: def.odpovednaOsoba === 'manual' ? def.odpovednaOsobaManualni : def.odpovednaOsoba,
              stavOdstraneni: def.odstraneno ? 'odstranena' : 'otevrena', lokalizace: def.lokalizace || "",
              zavaznost: def.zavaznost === 'none' ? "" : def.zavaznost,
              datumOdstraneni: def.odstraneno ? def.datumOdstraneni : "",
              zaznamProvedl: def.odstraneno ? (def.zaznamProvedl === 'manual' ? def.zaznamProvedlManualni : def.zaznamProvedl) : "",
              foto: def.foto || []
            } as any);
          });
        }
      });

      // ZDE JE BEZPEČNOSTNÍ POJISTKA - NIKDY NEZAVŘE REPORT S NESHODOU
      const hasUnresolvedDefects = finalKontrolniBody.some(kb => kb.hodnoceni === 'N');
      const finalStav = (isDraft || hasUnresolvedDefects) ? 'otevreny' : 'uzavreny';

      // Snímek klienta je pořízen při vytvoření protokolu (dokument k datu).
      // Při editaci ho zachováváme; přepočítáme jen když admin změnil klienta
      // nebo výběr pracovišť – jinak by protokol nesouhlasil se svým obsahem.
      const klientZmenen = recordToEdit.klientId !== formData.klientId;
      const pracovisteZmenena =
        JSON.stringify([...(recordToEdit.pracovisteIds || [])].sort()) !==
        JSON.stringify([...(formData.pracovisteIds || [])].sort());

      let klientSnapshot = recordToEdit.klientSnapshot;
      if (!klientSnapshot || klientZmenen || pracovisteZmenena) {
        const vybranaPracoviste = (selectedKlient?.pracoviste || [])
          .filter((p: any) => formData.pracovisteIds.includes(p.id));
        klientSnapshot = {
          nazev: selectedKlient?.nazev || '',
          ico: selectedKlient?.ico || '',
          mesto: selectedKlient?.mesto || '',
          pracoviste: vybranaPracoviste.map((p: any) => ({
            id: p.id,
            nazev: p.nazev || '',
            adresa: p.adresa || '',
          })),
        };
      }

      const updatedRecord = {
        id: recordToEdit.id,
        cislo: recordToEdit.cislo,
        cisloKlientske: recordToEdit.cisloKlientske,
        revize: parseInt(revisionNumber) || 0,
        ...formData,
        klientNazev: klientSnapshot?.nazev || recordToEdit.klientNazev || '',
        klientSnapshot,
        kontrolniBody: finalKontrolniBody,
        zavady: aggregatedZavady,
        stav: finalStav,
        createdAt: recordToEdit.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const sanitizedRecord = JSON.parse(JSON.stringify(updatedRecord));
      const recordRef = doc(db, 'zaznamy', recordToEdit.id);
      await setDoc(recordRef, sanitizedRecord);

      setZaznamy(prev => prev.map((p: any) => p.id === sanitizedRecord.id ? sanitizedRecord : p));
      
      setShowSaveModal(false);
      toast({ title: "Úpravy uloženy", description: `Záznam R${revisionNumber} byl úspěšně zapsán do cloudu.` });
      
      setTimeout(() => { router.push(`/zaznamy/${sanitizedRecord.id}`); }, 500);
    } catch (e: any) {
       console.error("Chyba editace:", e);
       toast({ title: "Chyba uložení", description: "Nepodařilo se uložit záznam.", variant: "destructive" });
       setIsSaving(false);
    }
  };

  const renderDefectForm = (def: DefectFormState, idx: number, pointId: string) => {
    const dostupneZavady = pointId ? (googleZavady[formData.typKontroly]?.[pointId] || []) : [];
    const updateFn = (f: keyof DefectFormState, v: any) => updateDefect(pointId, idx, f, v);
    const removeFn = () => setPointDefects(p => ({ ...p, [pointId]: p[pointId].filter((_, i) => i !== idx) }));
    const ukazatSablony = !!pointId && Number(pointId) < 90000;

    return (
      <div key={def.uid} className="p-4 bg-white rounded-lg border border-amber-200/60 shadow-sm space-y-5 relative">
        {pointDefects[pointId]?.length > 1 && (
          <Button variant="ghost" size="icon" className="absolute top-2 right-2 text-muted-foreground hover:bg-red-50 hover:text-red-600" onClick={removeFn}><X className="h-4 w-4" /></Button>
        )}
        {ukazatSablony && (
          <div className="bg-amber-50/50 -mx-4 -mt-4 p-4 rounded-t-lg border-b border-amber-100 mb-4">
            <Label className="text-xs font-bold text-amber-900 mb-2 block">Rychlý výběr ze šablony zjištění</Label>
            <Select disabled={dostupneZavady.length === 0} onValueChange={(v) => { const vybrana = dostupneZavady[parseInt(v)]; if (vybrana) { updateFn('popis', vybrana.popis); updateFn('navrhOpatreni', vybrana.opatreni); } }}>
              <SelectTrigger className="bg-white"><SelectValue placeholder={dostupneZavady.length > 0 ? "-- Vyberte typický nedostatek --" : `Žádné šablony pro bod ID ${pointId}.`} /></SelectTrigger>
              <SelectContent>{dostupneZavady.map((tz, i) => <SelectItem key={i} value={i.toString()}>{tz.nazev}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2"><Label className="text-xs">Místo zjištění (Lokalizace)</Label><Input value={def.lokalizace} onChange={(e) => updateFn('lokalizace', e.target.value)} className="bg-white h-10" /></div>
          <div className="space-y-2">
            <Label className="text-xs">Závažnost (Priorita)</Label>
            <Select value={def.zavaznost || "none"} onValueChange={(v) => updateFn('zavaznost', v)}>
              <SelectTrigger className="bg-white h-10"><SelectValue placeholder="Nevyplněno" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">-- Bez určení závažnosti --</SelectItem>
                <SelectItem value="low">Nízká</SelectItem><SelectItem value="medium">Střední</SelectItem><SelectItem value="high">Vysoká</SelectItem><SelectItem value="critical">Kritická (Ihned řešit!)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label className="text-xs">Popis závady *</Label><Textarea value={def.popis} onChange={(e) => updateFn('popis', e.target.value)} className="bg-white min-h-[100px]" /></div>
          <div className="space-y-2"><Label className="text-xs">Návrh opatření *</Label><Textarea value={def.navrhOpatreni} onChange={(e) => updateFn('navrhOpatreni', e.target.value)} className="bg-white min-h-[100px]" /></div>
          <div className="space-y-2"><Label className="text-xs">Termín odstranění</Label><Input type="date" value={def.terminOdstraneni} onChange={(e) => updateFn('terminOdstraneni', e.target.value)} className="bg-white h-10" /></div>
          <div className="space-y-2">
            <Label className="text-xs">Odpovědná pozice k řešení</Label>
            <Select value={def.odpovednaOsoba} onValueChange={(v) => updateFn('odpovednaOsoba', v)}>
              <SelectTrigger className="bg-white h-10"><SelectValue placeholder="Vyberte pozici" /></SelectTrigger>
              <SelectContent>
                {uniquePositions.map((pozice: any) => <SelectItem key={pozice} value={pozice}>{pozice}</SelectItem>)}
                <SelectItem value="manual">-- Zadat manuálně --</SelectItem>
              </SelectContent>
            </Select>
            {def.odpovednaOsoba === 'manual' && <Input placeholder="Vepište konkrétní pozici..." value={def.odpovednaOsobaManualni} onChange={(e) => updateFn('odpovednaOsobaManualni', e.target.value)} className="mt-2 h-10 bg-white border-dashed" />}
          </div>
        </div>

        <div className="pt-2">
          <div className="relative inline-block">
            <Button variant="outline" size="sm" className="text-muted-foreground cursor-pointer"><Camera className="h-4 w-4 mr-2" /> Přidat fotodokumentaci</Button>
            <Input type="file" accept="image/*" multiple className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" 
              onChange={async (e) => {
                const files = Array.from(e.target.files || []) as File[]; if (files.length === 0) return;
                const newPhotos: string[] = [];
                for (const file of files) { const compressed = await compressImage(file); newPhotos.push(compressed); }
                updateFn('foto', [...(def.foto || []), ...newPhotos]);
              }}
            />
          </div>
          {def.foto && def.foto.length > 0 && (
            <div className="flex flex-wrap gap-3 mt-4 bg-muted/20 p-3 rounded-md border border-dashed">
              {def.foto.map((photoStr, photoIdx) => (
                <div key={photoIdx} className="relative inline-block">
                  <Button variant="destructive" size="icon" className="absolute -top-2 -right-2 h-6 w-6 rounded-full shadow z-10" onClick={() => { const newArr = [...(def.foto || [])]; newArr.splice(photoIdx, 1); updateFn('foto', newArr); }}><X className="h-3 w-3" /></Button>
                  <img src={photoStr} alt="Závada" className="h-24 w-auto object-cover rounded shadow-sm border border-slate-200" />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pt-4 mt-2 border-t border-amber-200/60 bg-amber-50/30 -mx-4 -mb-4 p-4 rounded-b-lg">
          <div className="flex items-center gap-2 cursor-pointer select-none" onClick={() => { updateFn('odstraneno', !def.odstraneno); if (!def.odstraneno && !def.datumOdstraneni) updateFn('datumOdstraneni', new Date().toISOString().split('T')[0]); }}>
            {def.odstraneno ? <CheckSquare className="h-5 w-5 text-green-600" /> : <Square className="h-5 w-5 text-muted-foreground" />}
            <span className={cn("font-bold text-sm", def.odstraneno ? "text-green-700" : "text-muted-foreground")}>Nedostatek byl odstraněn</span>
          </div>
          {def.odstraneno && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 animate-in slide-in-from-top-2">
              <div className="space-y-2"><Label className="text-xs">Datum odstranění</Label><Input type="date" value={def.datumOdstraneni} onChange={(e) => updateFn('datumOdstraneni', e.target.value)} className="bg-white h-10" /></div>
              <div className="space-y-2">
                <Label className="text-xs">Záznam o odstranění provedl</Label>
                <Select value={def.zaznamProvedl} onValueChange={(v) => updateFn('zaznamProvedl', v)}>
                  <SelectTrigger className="bg-white h-10"><SelectValue placeholder="Vyberte pozici" /></SelectTrigger>
                  <SelectContent><SelectItem value="Provedl BPyes">Provedl (My / BPyes)</SelectItem>{uniquePositions.map((pozice: any) => <SelectItem key={pozice} value={pozice}>{pozice}</SelectItem>)}<SelectItem value="manual">-- Zadat manuálně --</SelectItem></SelectContent>
                </Select>
                {def.zaznamProvedl === 'manual' && <Input placeholder="Vepište pozici..." value={def.zaznamProvedlManualni} onChange={(e) => updateFn('zaznamProvedlManualni', e.target.value)} className="mt-2 h-10 bg-white border-dashed" />}
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
    const existingKb = recordToEdit?.kontrolniBody?.find((kb: any) => kb.bod === point.id);
    const isResolvedByClient = existingKb?.vyresenoKlientem;

    return (
      <div key={point.id} className="pt-8 first:pt-0 space-y-4 relative group">
        {isCustom && <Button variant="ghost" size="icon" className="absolute top-2 right-0 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => setCustomPoints(prev => prev.filter(p => p.id !== point.id))}><X className="h-4 w-4" /></Button>}
        <div className="flex flex-col md:flex-row justify-between items-start gap-4">
          <div className="flex gap-3 flex-1 w-full"><span className="font-mono text-muted-foreground font-bold">{isCustom ? '*' : point.id}.</span>{isCustom ? <Input value={point.text} onChange={(e) => setCustomPoints(prev => prev.map((p: any) => p.id === point.id ? { ...p, text: e.target.value } : p))} className="font-medium text-[15px] h-8" /> : <p className="font-medium text-[15px]">{point.text}</p>}</div>
          <div className="grid grid-cols-5 gap-1 w-full md:w-auto">
            {POradi_TLACITEK.map((kod) => (
              <Button key={kod} variant="outline" data-state={state?.hodnoceni === kod ? 'active' : 'inactive'} className={cn("h-12 min-w-[50px] font-bold shadow-none transition-all", STAVY[kod].tlacitko)} onClick={() => handleRatingChange(point, kod as any)}>{kod}</Button>
            ))}
            <Button key="D" variant="outline" data-state={state?.showDoporuceni ? 'active' : 'inactive'} className={cn("h-12 min-w-[50px] font-bold shadow-none transition-all", STAVY.D.tlacitko)} onClick={() => setChecklist(prev => ({ ...prev, [point.id]: { ...(prev[point.id] || { bod: point.id, hodnoceni: '' }), showDoporuceni: !prev[point.id]?.showDoporuceni } }))}>D</Button>
          </div>
        </div>
        
        {state?.showDoporuceni && <div className="space-y-2 mt-4 ml-8"><Label className="text-xs text-blue-700 font-semibold">Doporučení auditora k tomuto bodu</Label><Textarea value={state.doporuceni || ""} onChange={(e) => setChecklist(prev => ({ ...prev, [point.id]: { ...prev[point.id], doporuceni: e.target.value }}))} className="bg-blue-50/50 border-blue-200" /></div>}
        
        {state?.hodnoceni && state.hodnoceni !== 'NA' && (
          <div className="space-y-4 ml-8">
            {isResolvedByClient && state.hodnoceni === 'N' && (
               <div className="p-4 rounded-xl bg-emerald-50 border-2 border-emerald-400 shadow-sm mt-4">
                 <div className="flex items-center gap-2 font-bold text-emerald-800 mb-2">
                   <Info className="h-5 w-5" />
                   <span>POZOR: Klient u této závady nahlásil vyřešení!</span>
                 </div>
                 <div className="text-sm text-emerald-800 space-y-1 bg-white/60 p-3 rounded-lg border border-emerald-200">
                   <p><span className="font-semibold">Nahlásil(a):</span> {existingKb.jmenoVyresitele} ({existingKb.datumVyreseniKlientem ? new Date(existingKb.datumVyreseniKlientem).toLocaleDateString('cs-CZ') : '-'})</p>
                   {existingKb.poznamkaKlienta && <p className="italic mt-1">"{existingKb.poznamkaKlienta}"</p>}
                   {existingKb.fotoVyreseni && existingKb.fotoVyreseni.length > 0 && (
                     <div className="pt-2 mt-2 border-t border-emerald-200/50">
                       <span className="text-[10px] uppercase font-bold text-emerald-600 block mb-1">Přiložené fotodůkazy od klienta:</span>
                       <div className="flex flex-wrap gap-2">
                         {existingKb.fotoVyreseni.map((f: string, i: number) => (
                           <a href={f} target="_blank" rel="noreferrer" key={i}><img src={f} alt="Důkaz" className="h-12 w-12 object-cover rounded border border-emerald-300 hover:scale-110 transition-transform" /></a>
                         ))}
                       </div>
                     </div>
                   )}
                 </div>
                 <p className="pt-3 text-[11px] font-bold uppercase text-emerald-600">
                   Pokud je zaslaný důkaz v pořádku, klikněte výše na tlačítko [V] Vyhovuje. Závada tím z protokolu zmizí.
                 </p>
               </div>
            )}

            {state.hodnoceni === 'N' && (
              <div className="p-4 bg-amber-50/50 rounded-xl border border-amber-200 space-y-6"><div className="flex items-center gap-2 text-amber-800 font-bold text-sm uppercase"><AlertTriangle className="h-4 w-4" /> Evidence nedostatků</div><div className="space-y-6">{defects.map((def, idx) => renderDefectForm(def, idx, point.id))}</div><Button variant="outline" className="w-full border-dashed border-amber-300 text-amber-800 hover:bg-amber-100" onClick={() => setPointDefects(prev => ({ ...prev, [point.id]: [...(prev[point.id] || []), createEmptyDefect()] }))}><Plus className="h-4 w-4 mr-2" /> Přidat další závadu pod tento bod</Button></div>
            )}
            
            <div className="flex items-center gap-2">
              {!state.poznamka && <Button variant="ghost" size="sm" onClick={() => setChecklist(prev => ({ ...prev, [point.id]: { ...prev[point.id], poznamka: " " }}))} className="text-muted-foreground"><Plus className="h-3 w-3 mr-1" /> Přidat interní poznámku</Button>}
              {state.poznamka && <div className="flex-1 space-y-2 mt-2"><Label className="text-xs text-muted-foreground flex items-center gap-1"><StickyNote className="h-3 w-3" /> Interní poznámka k hodnocení bodu</Label><Textarea value={state.poznamka} onChange={(e) => setChecklist(prev => ({ ...prev, [point.id]: { ...prev[point.id], poznamka: e.target.value }}))} className="bg-muted/30" /></div>}
            </div>
          </div>
        )}
      </div>
    );
  };

  const filteredPointDefects = useMemo(() => {
    return (Object.entries(pointDefects) as [string, DefectFormState[]][]).filter(([id]) => checklist[id]?.hodnoceni === 'N').map(([id, defects]) => {
      const filtered = defects.filter(def => {
        if (filterPosition !== 'all') { const actualPosition = def.odpovednaOsoba === 'manual' ? def.odpovednaOsobaManualni : def.odpovednaOsoba; if (actualPosition !== filterPosition) return false; }
        return true;
      });
      return { id, defects: filtered };
    }).filter(group => group.defects.length > 0);
  }, [pointDefects, checklist, filterPosition]);

  if (!isLoaded) return <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-4"><Loader2 className="h-8 w-8 text-blue-600 animate-spin" /><p className="text-muted-foreground text-sm font-medium">Načítám data k editaci...</p></div>;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8 pb-24">
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 animate-in fade-in">
          <Card className="w-full max-w-md shadow-2xl">
            <CardHeader><CardTitle>Potvrzení úprav</CardTitle><CardDescription>{stats.N > 0 ? "Záznam obsahuje neshody. Bude zapsán ve stavu 'V řešení'." : "Zkontrolujte číslo revize. Aktuální záznam bude přepsán."}</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2"><Label>Číslo revize (R)</Label><div className="flex items-center gap-2"><span className="text-lg font-bold text-muted-foreground">R</span><Input type="number" min="0" value={revisionNumber} onChange={(e) => setRevisionNumber(e.target.value)} className="text-lg font-bold" /></div></div>
            </CardContent>
            <div className="p-4 border-t flex justify-end gap-2 bg-muted/20">
              <Button variant="outline" onClick={() => setShowSaveModal(false)}>Zrušit</Button><Button onClick={() => executeSave(false)} disabled={isSaving}>{isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Přepsat záznam</Button>
            </div>
          </Card>
        </div>
      )}

      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center"><h1 className="text-3xl font-bold tracking-tight">Upravit záznam <span className="text-muted-foreground">{recordToEdit?.cislo}</span></h1>{step > 1 && <div className="flex items-center gap-3 w-48"><span className="text-xs font-bold text-muted-foreground uppercase">{progressPercent}%</span><Progress value={progressPercent} className="h-2" /></div>}</div>
        <div className="flex items-center gap-2">{[1, 2, 3].map((i) => (<div key={i} className="flex items-center gap-2"><div className={cn("h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold", step === i ? "bg-primary text-white" : step > i ? "bg-muted text-muted-foreground" : "bg-blue-100 text-blue-700")}>{step > i ? <CheckCircle2 className="h-5 w-5" /> : i}</div>{i < 3 && <div className={cn("h-px w-8 bg-muted", step > i && "bg-blue-200")} />}</div>))}<span className="ml-4 text-sm font-medium text-muted-foreground">{step === 1 ? "Výběr klienta a typu" : step === 2 ? "Kontrolní list" : "Shrnutí"}</span></div>
      </div>

      {step === 1 && (
        <Card className="border-none shadow-sm"><CardHeader><CardTitle>Základní parametry kontroly</CardTitle></CardHeader><CardContent className="space-y-6"><div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div className="space-y-2"><Label>Klient</Label><Select value={formData.klientId} onValueChange={(v) => setFormData({...formData, klientId: v, pracovisteIds: []})}><SelectTrigger className="h-11"><SelectValue placeholder="Vyberte klienta" /></SelectTrigger><SelectContent>{klienti.map(k => <SelectItem key={k.id} value={k.id}>{k.nazev}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Pracoviště / Provozovny</Label>{!formData.klientId ? <div className="h-11 bg-muted rounded-md flex items-center px-3 text-sm italic">Nejprve zvolte klienta</div> : <div className="grid grid-cols-1 gap-2 p-3 border rounded-md bg-white max-h-[150px] overflow-y-auto">{(selectedKlient?.pracoviste || []).map((p: any) => (<label key={p.id} className="flex items-center gap-3 cursor-pointer"><Checkbox checked={formData.pracovisteIds.includes(p.id)} onCheckedChange={(c) => { setFormData(prev => ({...prev, pracovisteIds: c ? [...prev.pracovisteIds, p.id] : prev.pracovisteIds.filter(id => id !== p.id)})) }} /><span className="text-sm font-medium leading-none">{p.nazev}</span></label>))}</div>}</div><div className="space-y-2 md:col-span-2"><Label>Typ kontroly</Label><Select value={formData.typKontroly} onValueChange={(v: any) => setFormData({...formData, typKontroly: v})}><SelectTrigger className="h-11"><SelectValue placeholder="Zvolte typ kontroly" /></SelectTrigger><SelectContent><SelectItem value="BOZPaPO">BOZPaPO</SelectItem><SelectItem value="PPP">PPP</SelectItem><SelectItem value="PBOZP">PBOZP</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Datum kontroly</Label><Input type="date" className="h-11" value={formData.datum} onChange={(e) => setFormData({...formData, datum: e.target.value})} /></div></div><div className="space-y-4 pt-6 border-t mt-6"><div className="flex justify-between items-center"><Label>Účastníci kontroly</Label><Button variant="ghost" size="sm" onClick={() => setFormData({...formData, ucastnici: [...formData.ucastnici, {jmeno: '', pozice: ''}]})}><Plus className="mr-2 h-4 w-4" /> Přidat osobu</Button></div>{formData.ucastnici.map((u, i) => (<div key={i} className="flex gap-2 items-center"><Input placeholder="Jméno a příjmení" value={u.jmeno} onChange={(e) => { const next = [...formData.ucastnici]; next[i].jmeno = e.target.value; setFormData({...formData, ucastnici: next}); }} className="flex-1" /><Input placeholder="Pracovní pozice" value={u.pozice} onChange={(e) => { const next = [...formData.ucastnici]; next[i].pozice = e.target.value; setFormData({...formData, ucastnici: next}); }} className="flex-1" />{formData.ucastnici.length > 1 && <Button variant="ghost" size="icon" onClick={() => setFormData({...formData, ucastnici: formData.ucastnici.filter((_, idx) => idx !== i)})} className="shrink-0 text-muted-foreground hover:text-red-500"><X className="h-4 w-4" /></Button>}</div>))}</div></CardContent></Card>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm pb-4 border-b"><div className="flex justify-between items-center"><h2 className="font-bold text-lg">Úprava auditování</h2><span className="px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-xs font-bold">Typ: {formData.typKontroly}</span></div></div>
          {formData.typKontroly === 'BOZPaPO' && <Accordion type="multiple" className="space-y-4" defaultValue={["A"]}>{CHECKLIST_SECTIONS.map((section) => { const sectionName = `ODDÍL ${section.id}: ${section.title}`; const isSectionDisabled = disabledSections.includes(sectionName); return (<div key={section.id} className={cn("border rounded-lg bg-white shadow-sm relative", isSectionDisabled && "opacity-50")}><div className="absolute top-4 right-10 z-10 flex items-center gap-2 bg-white/90 px-3 py-1.5 rounded-full shadow-sm border"><Checkbox id={`disable-${section.id}`} checked={!isSectionDisabled} onCheckedChange={(c) => setDisabledSections(prev => c ? prev.filter(s => s !== sectionName) : [...prev, sectionName])} /><label htmlFor={`disable-${section.id}`} className="text-xs font-bold cursor-pointer select-none">Zahrnout do prověrky</label></div><AccordionItem value={section.id} className={cn("border-none", isSectionDisabled && "pointer-events-none")}><AccordionTrigger className="px-6 py-4"><div className="flex flex-col items-start gap-1"><span className="text-xs font-bold uppercase text-muted-foreground">Oddíl {section.id}</span><span className="text-base font-bold">{section.title}</span></div></AccordionTrigger><AccordionContent className="px-6 pb-6 space-y-8 pt-4 divide-y">{section.points.map((p: any) => renderPoint(p, false))}</AccordionContent></AccordionItem></div>) })}</Accordion>}
          {formData.typKontroly === 'PPP' && <div className="border rounded-lg bg-white overflow-hidden shadow-sm"><div className="px-6 py-4 bg-muted/10 border-b"><span className="text-base font-bold">Preventivní požární prohlídka</span></div><div className="px-6 pb-6 space-y-8 pt-4 divide-y">{CHECKLIST_PPP.map((p: any) => renderPoint(p, false))}</div></div>}
          {formData.typKontroly === 'PBOZP' && <div className="border rounded-lg bg-white overflow-hidden shadow-sm"><div className="px-6 py-4 bg-muted/10 border-b"><span className="text-base font-bold">Prověrka BOZP pracoviště</span></div><div className="px-6 pb-6 space-y-8 pt-4 divide-y">{CHECKLIST_PBOZP.map((p: any) => renderPoint(p, false))}</div></div>}
          <div className="border rounded-lg bg-white overflow-hidden shadow-sm border-blue-200 mt-6"><div className="px-6 py-4 bg-blue-50 border-b flex justify-between items-center"><span className="text-base font-bold text-blue-900">Vlastní zjištění (Volné body)</span><Button size="sm" onClick={() => setCustomPoints(prev => [...prev, { id: String(99000 + prev.length), text: "" }])}><Plus className="h-4 w-4 mr-2" /> Přidat vlastní bod</Button></div>{customPoints.length > 0 ? <div className="px-6 pb-6 space-y-8 pt-4 divide-y">{customPoints.map((p: any) => renderPoint(p, true))}</div> : <div className="p-8 text-center text-muted-foreground text-sm italic">Zatím nebyly přidány žádné volné body.</div>}</div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-8">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4"><Card className="p-4 flex flex-col items-center gap-1 border-green-200 bg-green-50"><span className="text-2xl font-bold text-green-700">{stats.V}</span><span className="text-[10px] uppercase font-bold text-green-600">Vyhovuje</span></Card><Card className="p-4 flex flex-col items-center gap-1 border-red-200 bg-red-50"><span className="text-2xl font-bold text-red-700">{stats.N}</span><span className="text-[10px] uppercase font-bold text-red-600">Nevyhovuje</span></Card><Card className="p-4 flex flex-col items-center gap-1 border-gray-200 bg-gray-50"><span className="text-2xl font-bold text-gray-700">{stats.NA}</span><span className="text-[10px] uppercase font-bold text-gray-600">Neaplikováno</span></Card><Card className="p-4 flex flex-col items-center gap-1 border-gray-200 bg-gray-50"><span className="text-2xl font-bold text-gray-700">{stats.NK}</span><span className="text-[10px] uppercase font-bold text-gray-600">Nekontrolováno</span></Card><Card className="p-4 flex flex-col items-center gap-1 border-amber-200 bg-amber-50"><span className="text-2xl font-bold text-amber-700">{stats.unfilled}</span><span className="text-[10px] uppercase font-bold text-amber-600">Nevyplněno</span></Card></div>
          
          {/* NOVÁ POJISTKA - INFORMAČNÍ PANEL */}
          {stats.N > 0 && (
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3 shadow-inner">
              <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-amber-900 text-lg">Tento report nelze uzavřít</h4>
                <p className="text-sm text-amber-800 mt-1">Dokud nebudou všechny zjištěné neshody ({stats.N}) opraveny klientem a vámi překlasifikovány na <strong>[V] Vyhovuje</strong>, záznam bude automaticky ukládán do stavu <strong>V řešení</strong>.</p>
              </div>
            </div>
          )}

          <Card className="border-none shadow-sm"><CardHeader><CardTitle>Závěrečné hodnocení a doporučení</CardTitle></CardHeader><CardContent><Textarea placeholder="Napište celkové zhodnocení..." className="min-h-[120px] bg-white" value={formData.poznamka} onChange={(e) => setFormData(prev => ({ ...prev, poznamka: e.target.value }))} /></CardContent></Card>
          <Card className="border-none shadow-sm">
            <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-muted/20 border-b pb-4">
              <div><CardTitle>Náhled zjištěných závad</CardTitle></div>
              <div className="flex items-center gap-2 bg-white p-2 rounded-md border shadow-sm"><Filter className="h-4 w-4 text-muted-foreground ml-2" /><Select value={filterPosition} onValueChange={setFilterPosition}><SelectTrigger className="h-9 w-[220px] border-none shadow-none focus:ring-0"><SelectValue placeholder="Filtrovat pozici" /></SelectTrigger><SelectContent><SelectItem value="all">Zobrazit vše</SelectItem>{uniquePositions.map((pozice: any) => <SelectItem key={pozice} value={pozice}>{pozice}</SelectItem>)}<SelectItem value="manual">Vlastní zadání</SelectItem></SelectContent></Select></div>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              {filteredPointDefects.map(group => group.defects.map(defect => (<div key={defect.uid} className="p-4 border rounded-lg flex items-start gap-4 hover:bg-muted/20"><div className="bg-red-600 text-white font-mono text-xs h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-1">{Number(group.id) > 90000 ? '*' : group.id}</div><div className="flex-1 space-y-2"><p className="font-bold">{defect.popis}</p><div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-muted-foreground"><div className="flex items-center gap-2"><CalendarIcon className="h-3 w-3" />{defect.terminOdstraneni ? new Date(defect.terminOdstraneni).toLocaleDateString('cs-CZ') : 'Neuvedeno'}</div><div className="flex items-center gap-2"><UserIcon className="h-3 w-3" /><span className="font-medium text-black">{defect.odpovednaOsoba === 'manual' ? defect.odpovednaOsobaManualni : (defect.odpovednaOsoba || 'Neuvedena')}</span></div></div></div></div>)))}
              {filteredPointDefects.length === 0 && <div className="py-12 text-center text-muted-foreground italic">Nebyly zjištěny žádné závady k uložení.</div>}
            </CardContent>
          </Card>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 z-50 flex justify-center shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
        <div className="max-w-5xl w-full flex justify-between items-center px-4 md:px-8">
          <Button variant="ghost" disabled={step === 1} onClick={() => { setStep(s => s - 1); window.scrollTo(0, 0); }} className="h-11 px-6"><ChevronLeft className="mr-2 h-4 w-4" /> Zpět</Button>
          <div className="flex gap-2">
            {step === 3 && stats.N === 0 && (
              <Button variant="outline" className="h-11 px-6 text-amber-700 hover:text-amber-800 hover:bg-amber-50" onClick={() => executeSave(true)}>Uložit jako koncept (V řešení)</Button>
            )}
            <Button onClick={step === 3 ? () => setShowSaveModal(true) : handleNext} disabled={isSaving} className={cn("h-11 px-8 shadow-sm font-bold text-white", step === 3 && stats.N > 0 ? "bg-amber-600 hover:bg-amber-700" : "bg-blue-600 hover:bg-blue-700")}>
              {step === 3 ? (isSaving ? "Ukládám..." : (stats.N > 0 ? "Uložit (Zůstane v řešení)" : "Přepsat jako Uzavřeno")) : "Pokračovat"}
              {step !== 3 && <ChevronRight className="ml-2 h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
