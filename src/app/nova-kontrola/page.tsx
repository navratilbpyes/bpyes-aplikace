'use client';

import { createEmptyDefect, extractEmail, parsujTypoveZavady } from "@/lib/kontroly";
import { nactiCsv, stariZalohy } from "@/lib/csv-cache";
import type { DefectFormState, TypickaZavada } from "@/lib/kontroly";
import { compressImage, FOTO_NEDOSTATKU } from "@/lib/obrazky";
import { STAVY, POradi_TLACITEK, paskaPro } from "@/lib/stavy";
import { useData, db, auth } from "@/components/data-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useState, useEffect, useMemo } from "react";
import { 
  CheckCircle2, ChevronRight, ChevronLeft, Plus, X, AlertTriangle,
  Calendar as CalendarIcon, User as UserIcon, StickyNote, Camera,
  CheckSquare, Square, Filter, Loader2, Trash2, Send,
  WifiOff,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { cn } from "@/app/lib/utils";
import { CHECKLIST_SECTIONS, CHECKLIST_PPP, CHECKLIST_PBOZP, ChecklistPoint } from "./checklist-data";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Zavada } from "@/app/lib/types";
import { doc, collection, setDoc } from "firebase/firestore";






export const dynamic = 'force-dynamic';
const GOOGLE_SHEETS_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTqBDqcv7REG4fkbLQHUqOQP13KzwB-wAAEaotZldSvZMvTpzfc8OlJvo8isBWkmQBpjYTm-I_X6Lls/pub?output=csv";


// ADRESNÝ VYHLEDÁVAČ VŠECH E-MAILŮ


export default function NewInspectionPage() {
  const { klienti, zaznamy, setZaznamy } = useData();
  const { toast } = useToast();
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    klientId: '', pracovisteIds: [] as string[], typKontroly: 'BOZPaPO' as any,
    datum: new Date().toISOString().split('T')[0], ucastnici: [{ jmeno: '', pozice: '' }], poznamka: ''
  });

  const [checklist, setChecklist] = useState<Record<string, any>>({});
  const [pointDefects, setPointDefects] = useState<Record<string, DefectFormState[]>>({});
  const [googleZavady, setGoogleZavady] = useState<Record<string, Record<string, TypickaZavada[]>>>({});
  const [zalohaStari, setZalohaStari] = useState<string | null>(null);
  const [sablonyChyba, setSablonyChyba] = useState(false);
  const [customPoints, setCustomPoints] = useState<ChecklistPoint[]>([]);
  const [disabledSections, setDisabledSections] = useState<string[]>([]);
  const [filterPosition, setFilterPosition] = useState<string>("all");
  
  // Stavy pro modální okna
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  
  // Speciální stavy pro odesílání e-mailu
  const [showEmailPrompt, setShowEmailPrompt] = useState(false);
  const [justSavedRecordId, setJustSavedRecordId] = useState<string | null>(null);
  const [justSavedRecordCislo, setJustSavedRecordCislo] = useState<string | null>(null);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState("");

  const [revisionNumber, setRevisionNumber] = useState("0");
  const [isSaving, setIsSaving] = useState(false);

  const selectedKlient = klienti.find(k => k.id === formData.klientId);
  const uniquePositions = useMemo(() => {
    if (!selectedKlient) return [];
    let positions: string[] = [];
    if (selectedKlient.pozice && selectedKlient.pozice.length > 0) {
      positions = selectedKlient.pozice.map((p:any) => p.nazev);
    } else if (selectedKlient.odpovedneOsoby && selectedKlient.odpovedneOsoby.length > 0) {
      positions = selectedKlient.odpovedneOsoby.map((o:any) => o.pozice || o.funkce);
    }
    return Array.from(new Set(positions.filter(Boolean)));
  }, [selectedKlient]);

  useEffect(() => {
    const controller = new AbortController();

    nactiCsv(GOOGLE_SHEETS_URL, controller.signal)
      .then(({ csv, zeZalohy, stariMs }) => {
        setGoogleZavady(parsujTypoveZavady(csv));
        setZalohaStari(zeZalohy && stariMs ? stariZalohy(stariMs) : null);
      })
      .catch((e) => {
        if (controller.signal.aborted) return;
        console.error('Šablony závad se nepodařilo načíst:', e);
        setSablonyChyba(true);
      });

    return () => controller.abort();
  }, []);

  const currentChecklistFlat = useMemo(() => {
    let base: any[] = [];
    if (formData.typKontroly === 'PPP') base = (CHECKLIST_PPP || []).map(p => ({ ...p, sekce: 'PPP' }));
    else if (formData.typKontroly === 'PBOZP') base = (CHECKLIST_PBOZP || []).map(p => ({ ...p, sekce: 'PBOZP' }));
    else if (formData.typKontroly === 'BOZPaPO') {
      base = (CHECKLIST_SECTIONS || []).flatMap(s => s.points.map(p => ({ ...p, sekce: `ODDÍL ${s.id}: ${s.title}` })));
    }
    return [...base, ...customPoints.map(p => ({ ...p, sekce: 'Vlastní zjištění' }))];
  }, [formData.typKontroly, customPoints]);

  const activeChecklistFlat = useMemo(() => currentChecklistFlat.filter(p => !disabledSections.includes(p.sekce)), [currentChecklistFlat, disabledSections]);
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

  // --------------------------------------------------------------------------
  // NOVÁ FUNKCE PRO ODESLÁNÍ E-MAILU
  // --------------------------------------------------------------------------
  const sendEmailToClient = async () => {
    if (!selectedKlient?.email) {
      toast({ title: "Chyba", description: "Klient nemá vyplněný e-mail ve své vizitce.", variant: "destructive" });
      router.push(`/zaznamy/${justSavedRecordId}`);
      return;
    }

    setIsSendingEmail(true);
    try {
      const odkaz = `${window.location.origin}/zaznamy/${justSavedRecordId}`;
      
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          email: selectedKlient.email,
          jmenoKlienta: selectedKlient.nazev,
          cisloZpravy: justSavedRecordCislo,
          odkaz: odkaz
        })
      });

      const result = await response.json();
      
      if (result.success) {
        toast({ title: "E-mail úspěšně odeslán", description: `Potvrzení bylo zasláno na: ${selectedKlient.email}` });
      } else {
        toast({ title: "Chyba při odesílání e-mailu", description: "E-mail se nepodařilo odeslat. Report je ale v pořádku uložen.", variant: "destructive" });
      }
    } catch (err) {
      console.error(err);
      toast({ title: "Kritická chyba sítě", description: "Nepodařilo se připojit k poštovnímu serveru.", variant: "destructive" });
    } finally {
      setIsSendingEmail(false);
      router.push(`/zaznamy/${justSavedRecordId}`);
    }
  };

  const executeSave = async (isDraft: boolean = false) => {
    setIsSaving(true);
    try {
      const year = new Date(formData.datum).getFullYear();
      
      // 1. GLOBÁLNÍ ČÍSLOVÁNÍ (Hledá vždy nejvyšší použité číslo v roce)
      const zaznamyTentoRok = zaznamy.filter((z: any) => z.datum && new Date(z.datum).getFullYear() === year);
      let maxGlobal = 0;
      zaznamyTentoRok.forEach((z: any) => {
        if (z.cislo) {
          const casti = z.cislo.split('/');
          if (casti.length > 1) {
            const cislo = parseInt(casti[1], 10);
            if (!isNaN(cislo) && cislo > maxGlobal) maxGlobal = cislo;
          }
        }
      });
      const nextGlobal = maxGlobal + 1;
      const globalCislo = `${year}/${nextGlobal.toString().padStart(3, '0')}/${formData.typKontroly}`;
      
      // 2. KLIENTSKÉ ČÍSLOVÁNÍ
      const zaznamyKlientaRok = zaznamyTentoRok.filter((z: any) => z.klientId === formData.klientId);
      let maxKlient = 0;
      zaznamyKlientaRok.forEach((z: any) => {
        if (z.cisloKlientske) {
          const match = z.cisloKlientske.match(/-K(\d+)\//);
          if (match && match[1]) {
            const cislo = parseInt(match[1], 10);
            if (!isNaN(cislo) && cislo > maxKlient) maxKlient = cislo;
          }
        }
      });
      const nextKlient = maxKlient + 1;
      const klientskeCislo = `${year}-K${nextKlient.toString().padStart(3, '0')}/${formData.typKontroly}`;
      
      const finalKontrolniBody: any[] = [];
      const aggregatedZavady: Zavada[] = [];
      let defectCounter = 1;

      activeChecklistFlat.forEach(basePoint => {
        const pointState = checklist[basePoint.id];
        if (!pointState) return;

        // Doporučení je nezávislé na hodnocení – bod s doporučením
        // se uloží, i když není ohodnocen nebo je nekontrolován.
        const maDoporuceni = pointState.showDoporuceni && pointState.doporuceni?.trim();
        if (!maDoporuceni && (!pointState.hodnoceni || pointState.hodnoceni === 'NK')) return;

        const isDefect = pointState.hodnoceni === 'N';
        const defectsForThisPoint = pointDefects[basePoint.id] || [];
        const primaryDefect = isDefect && defectsForThisPoint.length > 0 ? defectsForThisPoint[0] : null;

        finalKontrolniBody.push({
          bod: basePoint.id,
          otazka: basePoint.text || "Nepopsaný bod",
          sekce: basePoint.sekce,
          hodnoceni: pointState.hodnoceni,
          doporuceni: pointState.doporuceni || "",
          doporuceniFoto: pointState.doporuceniFoto || [],
          showDoporuceni: pointState.showDoporuceni || false,
          poznamka: pointState.poznamka || "",
          popis: primaryDefect?.popis || "",
          navrhOpatreni: primaryDefect?.navrhOpatreni || "",
          lokalizace: primaryDefect?.lokalizace || "",
          terminOdstraneni: primaryDefect?.terminOdstraneni || "",
          odpovednaOsoba: primaryDefect?.odpovednaOsoba === 'manual' ? primaryDefect.odpovednaOsobaManualni : (primaryDefect?.odpovednaOsoba || ""),
          foto: primaryDefect?.foto || []
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

      const hasUnresolvedDefects = finalKontrolniBody.some(kb => kb.hodnoceni === 'N');
      const finalStav = (isDraft || hasUnresolvedDefects) ? 'otevreny' : 'uzavreny';

      const newRecordRef = doc(collection(db, 'zaznamy'));

      // Snímek klienta k datu kontroly. Protokol je dokument k datu –
      // pozdější změna názvu/adresy klienta nesmí zpětně měnit vydaný protokol.
      const vybranaPracoviste = (selectedKlient?.pracoviste || [])
        .filter((p: any) => formData.pracovisteIds.includes(p.id));

      const klientSnapshot = {
        nazev: selectedKlient?.nazev || '',
        ico: selectedKlient?.ico || '',
        sidlo: selectedKlient?.sidlo || '',
        psc: selectedKlient?.psc || '',
        mesto: selectedKlient?.mesto || '',
        pracoviste: vybranaPracoviste.map((p: any) => ({
          id: p.id,
          nazev: p.nazev || '',
          adresa: p.adresa || '',
        })),
      };

      const newRecord = {
        id: newRecordRef.id,
        cislo: globalCislo,             
        cisloKlientske: klientskeCislo, 
        revize: parseInt(revisionNumber) || 0,
        ...formData,
        klientNazev: klientSnapshot.nazev,
        klientSnapshot,
        kontrolniBody: finalKontrolniBody,
        zavady: aggregatedZavady,
        stav: finalStav,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const sanitizedRecord = JSON.parse(JSON.stringify(newRecord));
      await setDoc(newRecordRef, sanitizedRecord);

      setZaznamy(prev => {
        if (prev.some(p => p.id === sanitizedRecord.id)) return prev;
        return [...prev, sanitizedRecord as any];
      });
      
      toast({ title: isDraft ? "Uloženo jako rozpracované" : "Záznam vytvořen", description: `Kontrola úspěšně uložena do cloudu.` });
      
      // ZDE JE ZMĚNA: Uložíme ID reportu do stavu a ukážeme modal pro odeslání e-mailu
      setJustSavedRecordId(sanitizedRecord.id);
      setJustSavedRecordCislo(klientskeCislo);
      setEmailRecipient(extractEmail(selectedKlient));
      setShowEmailPrompt(true);
      setShowSaveModal(false);
      setIsSaving(false);
      
    } catch (e: any) {
       console.error("Chyba při ukládání záznamu do Firebase:", e);
       toast({ title: "Chyba uložení", description: e.message?.includes('size') ? "Záznam je příliš velký. Smažte některé fotografie." : "Nepodařilo se uložit záznam.", variant: "destructive" });
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
                {uniquePositions.map((pozice: string) => <SelectItem key={pozice} value={pozice}>{pozice}</SelectItem>)}
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
                for (const file of files) { const compressed = await compressImage(file, FOTO_NEDOSTATKU); newPhotos.push(compressed); }
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
                  <SelectContent><SelectItem value="Provedl BPyes">Provedl (My / BPyes)</SelectItem>{uniquePositions.map((pozice: string) => <SelectItem key={pozice} value={pozice}>{pozice}</SelectItem>)}<SelectItem value="manual">-- Zadat manuálně --</SelectItem></SelectContent>
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
    const state = checklist[point.id]; const defects = pointDefects[point.id] || [];
    return (
      <div key={point.id} className="pt-8 first:pt-0 space-y-4 relative group">
        {isCustom && <Button variant="ghost" size="icon" className="absolute top-2 right-0 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => setCustomPoints(prev => prev.filter(p => p.id !== point.id))}><X className="h-4 w-4" /></Button>}
        <div className="flex flex-col md:flex-row justify-between items-start gap-4">
          <div className="flex gap-3 flex-1 w-full"><span className="font-mono text-muted-foreground font-bold">{isCustom ? '*' : point.id}.</span>{isCustom ? <Input value={point.text} onChange={(e) => setCustomPoints(prev => prev.map(p => p.id === point.id ? { ...p, text: e.target.value } : p))} className="font-medium text-[15px] h-8" /> : <p className="font-medium text-[15px]">{point.text}</p>}</div>
          <div className="grid grid-cols-5 gap-1 w-full md:w-auto">
            {POradi_TLACITEK.map((kod) => (
              <Button key={kod} variant="outline" data-state={state?.hodnoceni === kod ? 'active' : 'inactive'} className={cn("h-12 min-w-[50px] font-bold shadow-none transition-all", STAVY[kod].tlacitko)} onClick={() => handleRatingChange(point, kod as any)}>{kod}</Button>
            ))}
            <Button key="D" variant="outline" data-state={state?.showDoporuceni ? 'active' : 'inactive'} className={cn("h-12 min-w-[50px] font-bold shadow-none transition-all", STAVY.D.tlacitko)} onClick={() => setChecklist(prev => ({ ...prev, [point.id]: { ...(prev[point.id] || { bod: point.id, hodnoceni: '' }), showDoporuceni: !prev[point.id]?.showDoporuceni } }))}>D</Button>
          </div>
        </div>
        {state?.showDoporuceni && (
          <div className="space-y-3 mt-4 ml-8 p-4 rounded-md bg-[hsl(var(--stav-doporuceni))]/5 border border-[hsl(var(--stav-doporuceni))]/20">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-[hsl(var(--stav-doporuceni))]">Doporučení auditora k tomuto bodu</Label>
              <Textarea
                value={state.doporuceni || ""}
                onChange={(e) => setChecklist(prev => ({ ...prev, [point.id]: { ...prev[point.id], doporuceni: e.target.value }}))}
                placeholder="Bod není v rozporu s předpisem, ale lze jej zlepšit…"
                className="bg-white border-[hsl(var(--stav-doporuceni))]/30"
              />
            </div>

            <div className="flex flex-wrap gap-3 items-center">
              <Button asChild variant="outline" size="sm" className="cursor-pointer h-8">
                <label>
                  <Camera className="h-3.5 w-3.5 mr-2" /> Přidat foto
                  <input type="file" accept="image/*" multiple className="hidden" onChange={async (e) => {
                    const files = Array.from(e.target.files || []) as File[];
                    if (files.length === 0) return;
                    const nove: string[] = [];
                    for (const f of files) nove.push(await compressImage(f, FOTO_NEDOSTATKU));
                    setChecklist(prev => ({ ...prev, [point.id]: { ...prev[point.id], doporuceniFoto: [...(prev[point.id]?.doporuceniFoto || []), ...nove] }}));
                    e.target.value = '';
                  }} />
                </label>
              </Button>

              {(state.doporuceniFoto || []).map((photoStr: string, idx: number) => (
                <div key={idx} className="relative inline-block">
                  <Button variant="destructive" size="icon" className="absolute -top-2 -right-2 h-6 w-6 rounded-full shadow z-10" onClick={() => {
                    setChecklist(prev => ({ ...prev, [point.id]: { ...prev[point.id], doporuceniFoto: (prev[point.id]?.doporuceniFoto || []).filter((_: string, i: number) => i !== idx) }}));
                  }}><X className="h-3 w-3" /></Button>
                  <img src={photoStr} alt="Doporučení" className="h-24 w-auto object-cover rounded shadow-sm border border-slate-200" />
                </div>
              ))}
            </div>
          </div>
        )}
        {state?.hodnoceni && state.hodnoceni !== 'NA' && (
          <div className="space-y-4 ml-8">
            {state.hodnoceni === 'N' && (
              <div className="p-4 bg-amber-50/50 rounded-xl border border-amber-200 space-y-6"><div className="flex items-center gap-2 text-amber-800 font-bold text-sm uppercase"><AlertTriangle className="h-4 w-4" /> Evidence nedostatků</div><div className="space-y-6">{defects.map((def: any, idx: number) => renderDefectForm(def, idx, point.id))}</div><Button variant="outline" className="w-full border-dashed border-amber-300 text-amber-800 hover:bg-amber-100" onClick={() => setPointDefects(prev => ({ ...prev, [point.id]: [...(prev[point.id] || []), createEmptyDefect()] }))}><Plus className="h-4 w-4 mr-2" /> Přidat další závadu pod tento bod</Button></div>
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

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8 pb-24 relative">

      {zalohaStari && (
        <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-md bg-[hsl(var(--stav-neutral))]/10 text-muted-foreground">
          <WifiOff className="h-3.5 w-3.5 shrink-0" />
          <span>Šablony závad načteny z offline zálohy (stáří {zalohaStari}). Kontrolu můžete normálně vyplnit.</span>
        </div>
      )}

      {sablonyChyba && (
        <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-md bg-[hsl(var(--stav-zavada))]/10 text-[hsl(var(--stav-zavada))]">
          <WifiOff className="h-3.5 w-3.5 shrink-0" />
          <span>Šablony závad se nepodařilo načíst. Popis a opatření vyplňte ručně.</span>
        </div>
      )}
      
      {/* MODÁLNÍ OKNO: ZRUŠENÍ KONTROLY */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 animate-in fade-in">
          <Card className="w-full max-w-md shadow-2xl border-red-200">
            <CardHeader className="bg-red-50 border-b border-red-100 rounded-t-xl pb-4">
              <CardTitle className="text-xl font-bold flex items-center gap-2 text-red-700">
                <AlertTriangle className="h-6 w-6" /> Zrušit rozpracovanou kontrolu
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <p className="text-slate-700">Opravdu chcete zrušit tento rozpracovaný audit? <strong>Veškerá dosud nevyplněná data budou nenávratně ztracena.</strong> Do databáze se nic neuloží.</p>
            </CardContent>
            <div className="p-4 border-t flex justify-end gap-2 bg-muted/20 rounded-b-xl">
              <Button variant="outline" onClick={() => setShowCancelModal(false)}>Pokračovat v auditu</Button>
              <Button variant="destructive" onClick={() => router.push('/')}>Ano, zrušit a odejít</Button>
            </div>
          </Card>
        </div>
      )}

      {/* MODÁLNÍ OKNO: ULOŽENÍ */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 animate-in fade-in">
          <Card className="w-full max-w-md shadow-2xl">
            <CardHeader><CardTitle>Dokončení a uložení kontroly</CardTitle><CardDescription>{stats.N > 0 ? "Záznam obsahuje neshody. Bude zapsán ve stavu 'V řešení'." : "Před uložením záznamu potvrďte číslo revize dokumentu."}</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2"><Label>Číslo revize (R)</Label><div className="flex items-center gap-2"><span className="text-lg font-bold text-muted-foreground">R</span><Input type="number" min="0" value={revisionNumber} onChange={(e) => setRevisionNumber(e.target.value)} className="text-lg font-bold" /></div></div>
            </CardContent>
            <div className="p-4 border-t flex justify-end gap-2 bg-muted/20 rounded-b-xl">
              <Button variant="outline" onClick={() => setShowSaveModal(false)}>Zrušit</Button>
              <Button onClick={() => executeSave(false)} disabled={isSaving}>{isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Potvrdit a uložit do cloudu</Button>
            </div>
          </Card>
        </div>
      )}

      {/* MODÁLNÍ OKNO: VÝZVA K ODESLÁNÍ E-MAILU */}
      {showEmailPrompt && justSavedRecordId && (
        <div className="fixed inset-0 bg-black/60 z-[150] flex items-center justify-center p-4 animate-in fade-in">
          <Card className="w-full max-w-md shadow-2xl border-blue-200">
            <CardHeader className="bg-blue-50 border-b border-blue-100 rounded-t-xl pb-4">
              <CardTitle className="text-xl font-bold flex items-center gap-2 text-blue-900">
                <CheckCircle2 className="h-6 w-6 text-green-600" /> Kontrola byla uložena
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4 text-slate-700">
              <p>Záznam byl úspěšně zaevidován pod číslem <strong>{justSavedRecordCislo}</strong>.</p>
              <p>Přejete si nyní odeslat e-mail s upozorněním a odkazem na klientský dispečink reportu?</p>
              
              <div className="space-y-2 pt-2">
                <Label>E-mail příjemce (můžete upravit):</Label>
                <div className="flex items-center gap-2">
                  <Input 
                    value={emailRecipient} 
                    onChange={(e) => setEmailRecipient(e.target.value)}
                    placeholder="Zadejte e-mail..."
                    className="bg-white"
                  />
                </div>
              </div>
            </CardContent>
            <div className="p-4 border-t flex justify-end gap-2 bg-muted/20 rounded-b-xl">
              <Button variant="outline" onClick={() => router.push(`/zaznamy/${justSavedRecordId}`)}>Neodesílat, přejít na detail</Button>
              <Button 
                onClick={async () => {
                  setIsSendingEmail(true);
                  try {
                    const odkaz = `${window.location.origin}/zaznamy/${justSavedRecordId}`;
                    const token = await auth.currentUser?.getIdToken();
                    const response = await fetch('/api/send-email', { 
                      method: 'POST', 
                      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, 
                      body: JSON.stringify({ 
                        email: emailRecipient.split(',').map((e: string) => e.trim()).filter((e: string) => e.includes('@')), 
                        jmenoKlienta: selectedKlient?.nazev || "Klient", 
                        cisloZpravy: justSavedRecordCislo, 
                        odkaz: odkaz 
                      }) 
                    });
                    const result = await response.json();
                    if (result.success) toast({ title: "Odesláno", description: `E-mail odeslán na: ${emailRecipient}` });
                    else toast({ title: "Chyba", description: "Nepodařilo se odeslat.", variant: "destructive" });
                  } catch (err) { toast({ title: "Kritická chyba", description: "Chyba sítě.", variant: "destructive" }); } 
                  finally { setIsSendingEmail(false); router.push(`/zaznamy/${justSavedRecordId}`); }
                }} 
                disabled={isSendingEmail || emailRecipient.trim() === ""} 
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
              >
                {isSendingEmail ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />} Odeslat
              </Button>
            </div>
          </Card>
        </div>
      )}

      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center"><h1 className="text-3xl font-bold tracking-tight">Nová kontrola</h1>{step > 1 && <div className="flex items-center gap-3 w-48"><span className="text-xs font-bold text-muted-foreground uppercase">{progressPercent}%</span><Progress value={progressPercent} className="h-2" /></div>}</div>
        <div className="flex items-center gap-2">{[1, 2, 3].map((i) => (<div key={i} className="flex items-center gap-2"><div className={cn("h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold", step === i ? "bg-primary text-white" : step > i ? "bg-muted text-muted-foreground" : "bg-green-100 text-green-700")}>{step > i ? <CheckCircle2 className="h-5 w-5" /> : i}</div>{i < 3 && <div className={cn("h-px w-8 bg-muted", step > i && "bg-green-200")} />}</div>))}<span className="ml-4 text-sm font-medium text-muted-foreground">{step === 1 ? "Výběr klienta a typu" : step === 2 ? "Kontrolní list" : "Shrnutí"}</span></div>
      </div>

      {step === 1 && (
        <Card className="border-none shadow-sm"><CardHeader><CardTitle>Základní parametry kontroly</CardTitle></CardHeader><CardContent className="space-y-6"><div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div className="space-y-2"><Label>Klient</Label><Select value={formData.klientId} onValueChange={(v) => setFormData({...formData, klientId: v, pracovisteIds: []})}><SelectTrigger className="h-11"><SelectValue placeholder="Vyberte klienta" /></SelectTrigger><SelectContent>{klienti.map(k => <SelectItem key={k.id} value={k.id}>{k.nazev}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Pracoviště / Provozovny</Label>{!formData.klientId ? <div className="h-11 bg-muted rounded-md flex items-center px-3 text-sm italic">Nejprve zvolte klienta</div> : <div className="grid grid-cols-1 gap-2 p-3 border rounded-md bg-white max-h-[150px] overflow-y-auto">{(selectedKlient?.pracoviste || []).map((p: any) => (<label key={p.id} className="flex items-center gap-3 cursor-pointer"><Checkbox checked={formData.pracovisteIds.includes(p.id)} onCheckedChange={(c) => { setFormData(prev => ({...prev, pracovisteIds: c ? [...prev.pracovisteIds, p.id] : prev.pracovisteIds.filter(id => id !== p.id)})) }} /><span className="text-sm font-medium leading-none">{p.nazev}</span></label>))}</div>}</div><div className="space-y-2 md:col-span-2"><Label>Typ kontroly</Label><Select value={formData.typKontroly} onValueChange={(v: any) => setFormData({...formData, typKontroly: v})}><SelectTrigger className="h-11"><SelectValue placeholder="Zvolte typ kontroly" /></SelectTrigger><SelectContent><SelectItem value="BOZPaPO">BOZPaPO</SelectItem><SelectItem value="PPP">PPP</SelectItem><SelectItem value="PBOZP">PBOZP</SelectItem><SelectItem value="KONTROLA">Vlastní (Volná kontrola)</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Datum kontroly</Label><Input type="date" className="h-11" value={formData.datum} onChange={(e) => setFormData({...formData, datum: e.target.value})} /></div></div><div className="space-y-4 pt-6 border-t mt-6"><div className="flex justify-between items-center"><Label>Účastníci kontroly</Label><Button variant="ghost" size="sm" onClick={() => setFormData({...formData, ucastnici: [...formData.ucastnici, {jmeno: '', pozice: ''}]})}><Plus className="mr-2 h-4 w-4" /> Přidat osobu</Button></div>{formData.ucastnici.map((u, i) => (<div key={i} className="flex gap-2 items-center"><Input placeholder="Jméno a příjmení" value={u.jmeno} onChange={(e) => { const next = [...formData.ucastnici]; next[i].jmeno = e.target.value; setFormData({...formData, ucastnici: next}); }} className="flex-1" /><Select value={u.pozice} onValueChange={(val) => { const next = [...formData.ucastnici]; next[i].pozice = val; setFormData({...formData, ucastnici: next}); }}><SelectTrigger className="flex-1"><SelectValue placeholder="Vyberte pozici" /></SelectTrigger><SelectContent>{uniquePositions.map((pozice: string) => <SelectItem key={pozice} value={pozice}>{pozice}</SelectItem>)}{uniquePositions.length === 0 && <SelectItem value="Neuvedeno">Žádné pozice u klienta</SelectItem>}</SelectContent></Select>{formData.ucastnici.length > 1 && <Button variant="ghost" size="icon" onClick={() => setFormData({...formData, ucastnici: formData.ucastnici.filter((_, idx) => idx !== i)})} className="shrink-0 text-muted-foreground hover:text-red-500"><X className="h-4 w-4" /></Button>}</div>))}</div></CardContent></Card>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm pb-4 border-b"><div className="flex justify-between items-center"><h2 className="font-bold text-lg">Průběh auditování</h2><span className="px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-xs font-bold">Typ: {formData.typKontroly}</span></div></div>
          {formData.typKontroly === 'BOZPaPO' && <Accordion type="multiple" className="space-y-4" defaultValue={["A"]}>{CHECKLIST_SECTIONS.map((section) => { const sectionName = `ODDÍL ${section.id}: ${section.title}`; const isSectionDisabled = disabledSections.includes(sectionName); return (<div key={section.id} className={cn("border rounded-lg bg-white shadow-sm relative", isSectionDisabled && "opacity-50")}><div className="absolute top-4 right-10 z-10 flex items-center gap-2 bg-white/90 px-3 py-1.5 rounded-full shadow-sm border"><Checkbox id={`disable-${section.id}`} checked={!isSectionDisabled} onCheckedChange={(c) => setDisabledSections(prev => c ? prev.filter(s => s !== sectionName) : [...prev, sectionName])} /><label htmlFor={`disable-${section.id}`} className="text-xs font-bold cursor-pointer select-none">Zahrnout do prověrky</label></div><AccordionItem value={section.id} className={cn("border-none", isSectionDisabled && "pointer-events-none")}><AccordionTrigger className="px-6 py-4"><div className="flex flex-col items-start gap-1"><span className="text-xs font-bold uppercase text-muted-foreground">Oddíl {section.id}</span><span className="text-base font-bold">{section.title}</span></div></AccordionTrigger><AccordionContent className="px-6 pb-6 space-y-8 pt-4 divide-y">{section.points.map(p => renderPoint(p, false))}</AccordionContent></AccordionItem></div>) })}</Accordion>}
          {formData.typKontroly === 'PPP' && <div className="border rounded-lg bg-white overflow-hidden shadow-sm"><div className="px-6 py-4 bg-muted/10 border-b"><span className="text-base font-bold">Preventivní požární prohlídka</span></div><div className="px-6 pb-6 space-y-8 pt-4 divide-y">{CHECKLIST_PPP.map(p => renderPoint(p, false))}</div></div>}
          {formData.typKontroly === 'PBOZP' && <div className="border rounded-lg bg-white overflow-hidden shadow-sm"><div className="px-6 py-4 bg-muted/10 border-b"><span className="text-base font-bold">Prověrka BOZP pracoviště</span></div><div className="px-6 pb-6 space-y-8 pt-4 divide-y">{CHECKLIST_PBOZP.map(p => renderPoint(p, false))}</div></div>}
          <div className="border rounded-lg bg-white overflow-hidden shadow-sm border-blue-200 mt-6"><div className="px-6 py-4 bg-blue-50 border-b flex justify-between items-center"><span className="text-base font-bold text-blue-900">Vlastní zjištění (Volné body)</span><Button size="sm" onClick={() => setCustomPoints(prev => [...prev, { id: String(99000 + prev.length), text: "" }])}><Plus className="h-4 w-4 mr-2" /> Přidat vlastní bod</Button></div>{customPoints.length > 0 ? <div className="px-6 pb-6 space-y-8 pt-4 divide-y">{customPoints.map(p => renderPoint(p, true))}</div> : <div className="p-8 text-center text-muted-foreground text-sm italic">Zatím nebyly přidány žádné volné body.</div>}</div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-8">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4"><Card className="p-4 flex flex-col items-center gap-1 border-green-200 bg-green-50"><span className="text-2xl font-bold text-green-700">{stats.V}</span><span className="text-[10px] uppercase font-bold text-green-600">Vyhovuje</span></Card><Card className="p-4 flex flex-col items-center gap-1 border-red-200 bg-red-50"><span className="text-2xl font-bold text-red-700">{stats.N}</span><span className="text-[10px] uppercase font-bold text-red-600">Nevyhovuje</span></Card><Card className="p-4 flex flex-col items-center gap-1 border-gray-200 bg-gray-50"><span className="text-2xl font-bold text-gray-700">{stats.NA}</span><span className="text-[10px] uppercase font-bold text-gray-600">Neaplikováno</span></Card><Card className="p-4 flex flex-col items-center gap-1 border-gray-200 bg-gray-50"><span className="text-2xl font-bold text-gray-700">{stats.NK}</span><span className="text-[10px] uppercase font-bold text-gray-600">Nekontrolováno</span></Card><Card className="p-4 flex flex-col items-center gap-1 border-amber-200 bg-amber-50"><span className="text-2xl font-bold text-amber-700">{stats.unfilled}</span><span className="text-[10px] uppercase font-bold text-amber-600">Nevyplněno</span></Card></div>
          
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
              <div className="flex items-center gap-2 bg-white p-2 rounded-md border shadow-sm"><Filter className="h-4 w-4 text-muted-foreground ml-2" /><Select value={filterPosition} onValueChange={setFilterPosition}><SelectTrigger className="h-9 w-[220px] border-none shadow-none focus:ring-0"><SelectValue placeholder="Filtrovat pozici" /></SelectTrigger><SelectContent><SelectItem value="all">Zobrazit vše</SelectItem>{uniquePositions.map((pozice: string) => <SelectItem key={pozice} value={pozice}>{pozice}</SelectItem>)}<SelectItem value="manual">Vlastní zadání</SelectItem></SelectContent></Select></div>
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
          <div className="flex gap-2">
            <Button variant="ghost" disabled={step === 1} onClick={() => { setStep(s => s - 1); window.scrollTo(0, 0); }} className="h-11 px-3 sm:px-6"><ChevronLeft className="sm:mr-2 h-4 w-4" /> <span className="hidden sm:inline">Zpět</span></Button>
            <Button variant="ghost" onClick={() => setShowCancelModal(true)} className="h-11 px-3 sm:px-6 text-red-500 hover:text-red-700 hover:bg-red-50"><Trash2 className="sm:mr-2 h-4 w-4" /> <span className="hidden sm:inline">Zrušit audit</span></Button>
          </div>
          <div className="flex gap-2">
            {step === 3 && stats.N === 0 && (
              <Button variant="outline" className="h-11 px-6 text-amber-700 hover:text-amber-800 hover:bg-amber-50 hidden sm:flex" onClick={() => executeSave(true)}>Uložit jako koncept</Button>
            )}
            <Button onClick={step === 3 ? () => setShowSaveModal(true) : handleNext} disabled={isSaving} className={cn("h-11 px-4 sm:px-8 shadow-sm font-bold text-white", step === 3 && stats.N > 0 ? "bg-amber-600 hover:bg-amber-700" : "bg-blue-600 hover:bg-blue-700")}>
              {step === 3 ? (isSaving ? "Ukládám..." : (stats.N > 0 ? "Uložit (Zůstane v řešení)" : "Uložit jako Uzavřeno")) : "Pokračovat"}
              {step !== 3 && <ChevronRight className="ml-2 h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
