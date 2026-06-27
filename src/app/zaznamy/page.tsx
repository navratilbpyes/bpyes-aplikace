'use client';

import { useData, db } from "@/components/data-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  ChevronLeft, Printer, Building, MapPin, FileText,
  Loader2, Edit, ChevronDown, CheckCircle2, Clock, X, Camera,
  CheckSquare, Square, AlertTriangle, Trash2
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/app/lib/utils";
import { doc, deleteDoc, getDoc } from "firebase/firestore";

const TEXTS_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRiXWE13sHgXwCiFobHGpI3zvKR8nIOnzLtLxWdK7kyn2c4BhZDOwOf5ulUycMyfF1xJXonFSTG88JS/pub?gid=1978510431&single=true&output=csv";

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

export default function RecordDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { zaznamy, klienti, userProfile, setZaznamy } = useData();

  const [t, setT] = useState<Record<string, string>>({
    nadpis_zavady: "Registr zjištěných nedostatků a nápravných opatření",
    nadpis_komplet: "Kompletní auditní protokol zjištění",
    karta_opatreni: "Návrh opatření:",
    nadpis_misto: "Místo prověrky:",
    karta_termin: "Termín:",
    karta_odpovednost: "Pozice:",
    stat_vyhovuje: "VYHOVUJE",
    stat_neshody: "NESHODY (N)"
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [isPreparingPdf, setIsPreparingPdf] = useState(false);
  const [resolvingBod, setResolvingBod] = useState<string | number | null>(null);
  const [resolveData, setResolveData] = useState({ datum: '', jmeno: '', poznamka: '', foto: [] as string[] });
  
  // STAV PRO NASTAVENÍ AUDITORA
  const [auditorConfig, setAuditorConfig] = useState<any>(null);

  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isAdmin = userProfile?.role === 'admin';

  // Oddělené načítání konfigurace auditora
  useEffect(() => {
    const fetchAuditorConfig = async () => {
      try {
        const docRef = doc(db, "konfigurace", "auditor");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setAuditorConfig(docSnap.data());
        }
      } catch (err) {
        console.error("Nepodařilo se načíst konfiguraci auditora", err);
      }
    };
    fetchAuditorConfig();
  }, []);

  // Načítání záznamů
  useEffect(() => {
    if (zaznamy && zaznamy.length > 0) setIsLoading(false);
    const timer = setTimeout(() => setIsLoading(false), 2000);
    return () => clearTimeout(timer);
  }, [zaznamy]);

  useEffect(() => {
    fetch(TEXTS_URL).then(res => res.text()).then(csv => {
        const rows = parseCSV(csv);
        const map: Record<string, string> = {};
        rows.forEach(r => { 
          if(r[0] && r[1]) {
            let val = r[1].trim();
            if (r[0].trim() === 'nadpis_komplet' && val.startsWith('2. ')) val = val.substring(3).trim();
            if (r[0].trim() === 'nadpis_zavady' && val.startsWith('2. ')) val = val.substring(3).trim();
            map[r[0].trim()] = val;
          }
        });
        setT(prev => ({ ...prev, ...map }));
      }).catch(console.error);
  }, []);

  const record = useMemo(() => zaznamy.find(z => z.id === params.id), [zaznamy, params.id]);
  const klient = useMemo(() => klienti.find(k => k.id === record?.klientId), [klienti, record]);
  
  const pracovisteList = useMemo(() => {
    if (!klient || !record) return [];
    const prac = klient.pracoviste || [];
    if (record.pracovisteIds && Array.isArray(record.pracovisteIds)) return prac.filter(p => record.pracovisteIds.includes(p.id));
    if (record.pracovisteId) return prac.filter(p => p.id === record.pracovisteId);
    return [];
  }, [klient, record]);

  const [filterPosition, setFilterPosition] = useState<string>("all");
  const [onlyDefects, setOnlyDefects] = useState<boolean>(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (sec: string) => setCollapsedGroups(prev => ({ ...prev, [sec]: !prev[sec] }));

  const handlePrint = () => {
    setIsPreparingPdf(true);
    const allOpen: Record<string, boolean> = {};
    groupedKontrolniBody.forEach(group => { allOpen[group.sekce] = false; });
    setCollapsedGroups(allOpen);
    setTimeout(() => {
      window.print();
      setIsPreparingPdf(false);
    }, 500);
  };

  const handleDeleteRecord = async () => {
    if (!record) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'zaznamy', record.id));
      if (setZaznamy) {
        setZaznamy((prev: any[]) => prev.filter(z => z.id !== record.id));
      }
      toast({ title: "Záznam smazán", description: "Audit byl úspěšně a nenávratně odstraněn ze systému." });
      router.push("/");
    } catch (error) {
      console.error(error);
      toast({ title: "Chyba při mazání", description: "Nepodařilo se odstranit tento záznam.", variant: "destructive" });
      setIsDeleting(false);
    }
  };

  const handleConfirmResolve = async (bodId: string | number) => {
    if (!record) return;
    if (!resolveData.jmeno.trim()) { toast({ title: "Chybí jméno", description: "Zadejte prosím své jméno a příjmení.", variant: "destructive" }); return; }
    const updatedBody = record.kontrolniBody.map((kb: any) => {
      if ((kb.id || kb.bod) === bodId) {
        return { ...kb, vyresenoKlientem: true, datumVyreseniKlientem: resolveData.datum, jmenoVyresitele: resolveData.jmeno, poznamkaKlienta: resolveData.poznamka, fotoVyreseni: resolveData.foto };
      }
      return kb;
    });
    try {
      setZaznamy((prev: any[]) => prev.map(z => z.id === record.id ? { ...z, kontrolniBody: updatedBody } : z));
      setResolvingBod(null);
      toast({ title: "Závada odstraněna", description: "Úspěšně jste nahlásili odstranění závady auditorovi." });
    } catch (e) { toast({ title: "Chyba", description: "Nepodařilo se uložit data.", variant: "destructive" }); }
  };

  const handleCancelResolve = async (bodId: string | number) => {
    if (!record) return;
    const updatedBody = record.kontrolniBody.map((kb: any) => {
      if ((kb.id || kb.bod) === bodId) { return { ...kb, vyresenoKlientem: false, datumVyreseniKlientem: null, jmenoVyresitele: null, poznamkaKlienta: null, fotoVyreseni: [] }; }
      return kb;
    });
    setZaznamy((prev: any[]) => prev.map(z => z.id === record.id ? { ...z, kontrolniBody: updatedBody } : z));
    toast({ title: "Zrušeno", description: "Závada byla vrácena do řešení." });
  };

  const allSectionsInRecord = useMemo(() => {
    const sections = new Set<string>();
    if (record?.kontrolniBody) record.kontrolniBody.forEach((kb: any) => { if (kb.sekce) sections.add(kb.sekce); });
    return Array.from(sections) as string[];
  }, [record]);

  const [visibleSections, setVisibleSections] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (allSectionsInRecord.length > 0 && Object.keys(visibleSections).length === 0) {
      const initial: Record<string, boolean> = {};
      allSectionsInRecord.forEach(sec => { initial[sec] = true; });
      setVisibleSections(initial);
    }
  }, [allSectionsInRecord]);

  const uniquePositionsInRecord = useMemo(() => {
    if (!record?.kontrolniBody) return [];
    const positions = record.kontrolniBody.filter((kb: any) => kb.hodnoceni === 'N' && kb.odpovednaOsoba).map((kb: any) => kb.odpovednaOsoba);
    return Array.from(new Set(positions)) as string[];
  }, [record]);

  const filteredKontrolniBody = useMemo(() => {
    if (!record?.kontrolniBody) return [];
    return record.kontrolniBody.filter((kb: any) => {
      const sec = kb.sekce || "Ostatní";
      if (visibleSections[sec] === false) return false;
      if (onlyDefects && kb.hodnoceni !== 'N') return false;
      if (filterPosition !== "all" && kb.hodnoceni === 'N' && kb.odpovednaOsoba !== filterPosition) return false;
      return true;
    });
  }, [record, visibleSections, onlyDefects, filterPosition]);

  const groupedKontrolniBody = useMemo(() => {
    const groups: { sekce: string; items: any[] }[] = [];
    const secMap = new Map<string, number>();
    filteredKontrolniBody.forEach((kb: any) => {
      const sec = kb.sekce || "Ostatní";
      if (!secMap.has(sec)) { secMap.set(sec, groups.length); groups.push({ sekce: sec, items: [] }); }
      groups[secMap.get(sec)!].items.push(kb);
    });
    return groups;
  }, [filteredKontrolniBody]);

  const stats = useMemo(() => {
    if (!record?.kontrolniBody) return { total: 0, V: 0, N: 0, NA: 0 };
    return {
      total: record.kontrolniBody.length,
      V: record.kontrolniBody.filter((k:any) => k.hodnoceni === 'V').length,
      N: record.kontrolniBody.filter((k:any) => k.hodnoceni === 'N').length,
      NA: record.kontrolniBody.filter((k:any) => k.hodnoceni === 'NA' || k.hodnoceni === 'NK').length,
    };
  }, [record]);

  if (!record) {
    if (isLoading) return <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-4"><Loader2 className="h-8 w-8 text-primary animate-spin" /><p className="text-muted-foreground text-sm font-medium">Načítám report z cloudu...</p></div>;
    return <div className="p-8 text-center space-y-4"><p className="text-muted-foreground italic">Záznam nebyl nalezen.</p><Button onClick={() => router.push("/")}><ChevronLeft className="mr-2 h-4 w-4" /> Zpět</Button></div>;
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8 pb-24 relative overflow-hidden print:p-0 print:m-0 print:space-y-0">
      
      {showDeleteModal && (
        <div className="fixed inset-0 z-[200] bg-black/70 flex items-center justify-center p-4 animate-in fade-in backdrop-blur-sm print:hidden">
          <Card className="w-full max-w-md shadow-2xl animate-in zoom-in-95 border-red-200">
            <CardHeader className="bg-red-50 border-b border-red-100 rounded-t-xl pb-4">
              <CardTitle className="text-xl font-bold flex items-center gap-2 text-red-700">
                <AlertTriangle className="h-6 w-6" /> Varování: Smazání reportu
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <p className="text-slate-700 font-medium">
                Opravdu chcete <strong>nenávratně smazat</strong> auditní zprávu č. {record.cislo}? Tato akce je nevratná a odstraní všechna její data.
              </p>
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => setShowDeleteModal(false)} disabled={isDeleting}>Zrušit</Button>
                <Button variant="destructive" onClick={handleDeleteRecord} disabled={isDeleting} className="font-bold">
                  {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />} Ano, smazat
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {fullscreenImage && (
        <div 
          className="fixed inset-0 z-[1000] bg-black/90 flex flex-col items-center justify-center p-4 print:hidden backdrop-blur-sm"
          onClick={() => setFullscreenImage(null)}
        >
          <div className="relative max-w-[95vw] max-h-[95vh] animate-in zoom-in-95 duration-200">
            <Button variant="ghost" size="icon" className="absolute -top-12 right-0 text-white hover:bg-white/20 hover:text-white" onClick={(e) => { e.stopPropagation(); setFullscreenImage(null); }}>
              <X className="h-8 w-8" />
            </Button>
            <img src={fullscreenImage} alt="Zvětšená fotografie" className="max-w-full max-h-[90vh] object-contain rounded-md shadow-2xl" onClick={(e) => e.stopPropagation()} />
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { size: A4 portrait; margin: 15mm 15mm 20mm 15mm; }
          body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; background: white !important; }
          ::-webkit-scrollbar { display: none; }
          .page-break { page-break-before: always; }
          .avoid-break { page-break-inside: avoid; break-inside: avoid; }
        }
      `}} />

      {/* ================================================================= */}
      {/* 1. TISKOVÁ VERZE (Zcela oddělený design, na webu neviditelný)     */}
      {/* ================================================================= */}
      <div className="hidden print:block text-slate-900 w-full bg-white text-sm">
        
        <div className="pb-8">
          <div className="mb-8">
            <img src="/logo.png" onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src="/logo.svg"; }} alt="Logo" className="h-10 object-contain" />
          </div>

          <h1 className="text-2xl font-bold uppercase text-slate-900 mb-6">
            {record.typKontroly === 'BOZPaPO' ? 'PROVĚRKA BOZP A PREVENTIVNÍ POŽÁRNÍ PROHLÍDKA, KONTROLA DOKUMENTACE POŽÁRNÍ OCHRANY' : 
             record.typKontroly === 'PPP' ? 'PREVENTIVNÍ POŽÁRNÍ PROHLÍDKA' : 'PROVĚRKA BOZP PRACOVIŠTĚ'}
          </h1>
          
          <div className="text-lg font-bold mb-10">
            ČÍSLO ZPRÁVY: {record.cisloKlientske || record.cislo} | REVIZE: R{record.revize || 0}
          </div>

          <div className="space-y-6 mb-12">
            <div>
              <p className="font-bold uppercase mb-1">ZPRACOVATEL/POSKYTOVATEL:</p>
              <p className="font-bold">{auditorConfig?.firmaNazev || 'BPyes s.r.o.'}</p>
              <p>{auditorConfig?.firmaAdresa || 'Specializovaný poskytovatel služeb'} | IČO: {auditorConfig?.firmaIco || '04399421'}</p>
              <p>E-mail: {auditorConfig?.email || 'navratil@bpyes.cz'} {auditorConfig?.telefon ? `| Tel: ${auditorConfig.telefon}` : ''}</p>
            </div>
            
            <div>
              <p className="font-bold uppercase mb-1">KONTROLOVANÝ SUBJEKT/KLIENT:</p>
              <p className="font-bold">{klient?.nazev}</p>
              <p>IČO: {klient?.ico}</p>
              <p>Místo prověrky: {pracovisteList.map(p => p.nazev).join(', ')}</p>
            </div>
          </div>

          <div className="mb-24">
            <p className="font-bold uppercase mb-2">PROHLÁŠENÍ A KONSTATOVÁNÍ O SEZNÁMENÍ:</p>
            <p className="text-justify leading-relaxed">
              Kontrolovaný subjekt / zástupce klienta svým níže uvedeným podpisem stvrzuje, že byl v plném rozsahu, prokazatelně a jasně seznámen se všemi zjištěnými legislativními nedostatky, systémovými neshodami a doporučeními, která jsou detailně specifikována uvnitř této auditní zprávy. Souhlasí s navrženými nápravnými opatřeními a zavazuje se k jejich vyřešení a odstranění v definovaných zákonných či dohodnutých termínech.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-16 mt-32">
            <div className="relative pt-12">
               {/* RAZÍTKO A PODPIS PŘES SEBE V TISKU */}
               <div className="absolute -top-12 left-0 flex items-center justify-start pointer-events-none z-0">
                 {auditorConfig?.razitkoBase64 && (
                   <img src={auditorConfig.razitkoBase64} alt="Razítko" className="h-32 w-auto object-contain mix-blend-multiply opacity-95 -ml-4" />
                 )}
                 {auditorConfig?.podpisBase64 && (
                   <img src={auditorConfig.podpisBase64} alt="Podpis" className="h-20 w-auto object-contain mix-blend-multiply absolute left-14 top-4" />
                 )}
               </div>

               <p className="font-bold uppercase mb-2 relative z-10">
                 PROVEDL (ZA {auditorConfig?.firmaNazev?.toUpperCase() || 'BPYES'}):
               </p>
               <div className="border-b border-black mb-2 relative z-10"></div>
               
               <p className="font-bold text-sm text-slate-800">{auditorConfig?.titul ? auditorConfig.titul + ' ' : ''}{auditorConfig?.jmeno || 'Specialista BOZP a PO'}</p>
               {auditorConfig?.certifikace && auditorConfig.certifikace.length > 0 && (
                 <div className="mt-1">
                   {auditorConfig.certifikace.map((cert: any) => (
                     <p key={cert.id} className="text-[11px] text-slate-600">{cert.nazev}{cert.cislo ? `, ${cert.cislo}` : ''}</p>
                   ))}
                 </div>
               )}
            </div>
            
            <div className="pt-12">
               <p className="font-bold uppercase mb-2">ZÁSTUPCE KLIENTA / SUBJEKTU:</p>
               <div className="border-b border-black mb-2"></div>
               <p className="text-sm text-slate-600">Osoba seznámená s reportem</p>
            </div>
          </div>
        </div>

        <div className="page-break"></div>

        <div className="pt-4">
          <div className="font-bold mb-4">{auditorConfig?.firmaNazev || 'BPyes s.r.o.'}</div>
          <h2 className="text-lg font-bold mb-6">1. SHRNUTÍ A STATISTIKY</h2>
          
          <div className="grid grid-cols-4 gap-4 text-center mb-10">
            <div className="border border-slate-300 p-4 bg-slate-50">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-xs uppercase font-bold text-slate-700 mt-1">CELKEM BODŮ</div>
            </div>
            <div className="border border-green-200 bg-green-50 p-4">
              <div className="text-2xl font-bold text-green-700">{stats.V}</div>
              <div className="text-xs uppercase font-bold text-green-700 mt-1">VYHOVUJE</div>
            </div>
            <div className="border border-red-200 bg-red-50 p-4">
              <div className="text-2xl font-bold text-red-700">{stats.N}</div>
              <div className="text-xs uppercase font-bold text-red-700 mt-1">NESHODY (N)</div>
            </div>
            <div className="border border-slate-200 bg-slate-50 p-4">
              <div className="text-2xl font-bold text-slate-600">{stats.NA}</div>
              <div className="text-xs uppercase font-bold text-slate-600 mt-1">NEHODNOCENO</div>
            </div>
          </div>

          <div className="mb-10">
            <p className="text-sm font-bold uppercase mb-2">ZÁVĚREČNÉ VYHODNOCENÍ:</p>
            <div className="bg-slate-50 border border-slate-300 p-4 italic">
              {record.poznamka || "Při prověrce nebylo vloženo žádné doprovodné textové hodnocení."}
            </div>
          </div>

          <div>
            <p className="text-sm font-bold uppercase mb-2">ZÚČASTNĚNÉ OSOBY:</p>
            <table className="w-full border-collapse border border-slate-300 text-sm">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-300 p-3 text-left w-1/2">Jméno a příjmení</th>
                  <th className="border border-slate-300 p-3 text-left w-1/2">Pracovní pozice / Vztah k subjektu</th>
                </tr>
              </thead>
              <tbody>
                {record.ucastnici && record.ucastnici.length > 0 ? (
                  record.ucastnici.map((u: any, idx: number) => (
                    <tr key={idx}>
                      <td className="border border-slate-300 p-3 font-medium">{u.jmeno || '-'}</td>
                      <td className="border border-slate-300 p-3">{u.pozice || '-'}</td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={2} className="border border-slate-300 p-3 text-center text-slate-500">Neuvedeno</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="page-break"></div>

        <div className="pt-4">
          <div className="font-bold mb-4">{auditorConfig?.firmaNazev || 'BPyes s.r.o.'}</div>
          <h2 className="text-lg font-bold mb-8">2. KOMPLETNÍ AUDITNÍ PROTOKOL ZJIŠTĚNÍ</h2>
          
          <div className="space-y-8">
            {groupedKontrolniBody.map((group) => (
               group.items.map((kb: any) => {
                 const isDefect = kb.hodnoceni === 'N';
                 return (
                   <div key={kb.id || kb.bod} className="avoid-break mb-6">
                     <div className="text-xs uppercase text-slate-600 mb-1">
                       [{kb.bod}] KAPITOLA: {group.sekce}
                     </div>
                     <div className="text-sm mb-2">
                       <span className="font-bold">KONTROLOVANÝ BOD/OTÁZKA:</span> <br/>
                       {kb.otazka || kb.popis}
                     </div>
                     
                     <div className="mt-2">
                       {!isDefect ? (
                         <div className="text-sm font-bold flex items-center gap-2">
                           <CheckSquare className="h-5 w-5" /> VYHOVUJE
                         </div>
                       ) : (
                         <div className="mt-3">
                           <div className="text-sm font-bold text-red-700 flex items-center gap-2 mb-2">
                             <Square className="h-5 w-5" /> NESHODA
                           </div>
                           <table className="w-full text-xs border-collapse border border-slate-300 mt-2">
                             <tbody>
                               <tr>
                                 <td className="border border-slate-300 p-2 bg-slate-50 w-[20%] font-bold">Návrh opatření:</td>
                                 <td className="border border-slate-300 p-2 w-[30%]">{kb.navrhOpatreni || '-'}</td>
                                 <td className="border border-slate-300 p-2 bg-slate-50 w-[20%] font-bold">Místo prověrky:</td>
                                 <td className="border border-slate-300 p-2 w-[30%]">{kb.lokalizace || '-'}</td>
                               </tr>
                               <tr>
                                 <td className="border border-slate-300 p-2 bg-slate-50 font-bold">Termín:</td>
                                 <td className="border border-slate-300 p-2">{kb.terminOdstraneni ? new Date(kb.terminOdstraneni).toLocaleDateString('cs-CZ') : '-'}</td>
                                 <td className="border border-slate-300 p-2 bg-slate-50 font-bold">Pozice:</td>
                                 <td className="border border-slate-300 p-2 font-bold">{kb.odpovednaOsoba || '-'}</td>
                               </tr>
                             </tbody>
                           </table>
                           
                           {kb.foto && kb.foto.length > 0 && (
                             <div className="mt-3">
                               <span className="text-[10px] uppercase font-bold text-slate-600 block mb-1">Fotodokumentace k neshodě</span>
                               <div className="flex flex-wrap gap-2">
                                 {kb.foto.map((f: string, i: number) => (
                                   <img src={f} alt="Fotodokumentace" key={`aud-pdf-${i}`} className="h-40 w-40 object-cover border border-slate-300" />
                                 ))}
                               </div>
                             </div>
                           )}
                           
                           {kb.vyresenoKlientem && (
                             <div className="mt-3 p-3 bg-slate-50 border border-slate-300 text-xs">
                               <div className="font-bold uppercase text-emerald-700 mb-1 flex items-center gap-1">
                                 <CheckCircle2 className="h-3 w-3" /> Zpráva od klienta - závada odstraněna
                               </div>
                               <div><span className="font-bold">Osoba:</span> {kb.jmenoVyresitele}</div>
                               <div><span className="font-bold">Datum:</span> {kb.datumVyreseniKlientem ? new Date(kb.datumVyreseniKlientem).toLocaleDateString('cs-CZ') : '-'}</div>
                               {kb.poznamkaKlienta && <div className="mt-1 italic">"{kb.poznamkaKlienta}"</div>}
                               
                               {kb.fotoVyreseni && kb.fotoVyreseni.length > 0 && (
                                <div className="mt-2">
                                  <span className="text-[9px] uppercase font-bold text-emerald-600 block mb-1">Důkazy o odstranění</span>
                                  <div className="flex flex-wrap gap-2">
                                    {kb.fotoVyreseni.map((f: string, i: number) => (
                                      <img src={f} alt="Důkaz" key={`kli-pdf-${i}`} className="h-40 w-40 object-cover border border-emerald-200" />
                                    ))}
                                  </div>
                                </div>
                               )}
                             </div>
                           )}
                         </div>
                       )}
                     </div>
                     <div className="border-b border-slate-300 mt-6"></div>
                   </div>
                 )
               })
            ))}
          </div>
        </div>

      </div>


      {/* ================================================================= */}
      {/* 2. WEBOVÁ VERZE (Interaktivní dashboard, při tisku zmizí)       */}
      {/* ================================================================= */}
      <div className="print:hidden space-y-8">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="p-0 h-auto text-muted-foreground hover:bg-transparent" onClick={() => router.push("/")}>
                <ChevronLeft className="h-4 w-4" /> Zpět na přehled
              </Button>
              <span className={cn("text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded border", record.stav === 'uzavreny' ? "text-green-700 bg-green-50 border-green-200" : "text-amber-700 bg-amber-50 border-amber-200")}>
                {record.stav === 'uzavreny' ? 'Uzavřený report' : 'Koncept (V řešení)'}
              </span>
            </div>
            
            <h1 className="text-3xl font-bold tracking-tight">
              {record.cisloKlientske || record.cislo} 
              <span className="text-muted-foreground font-normal text-xl ml-2">R{record.revize || 0}</span>
            </h1>
            
            <p className="text-sm text-muted-foreground">Provedeno dne {record.datum ? new Date(record.datum).toLocaleDateString('cs-CZ') : 'Neuvedeno'}</p>
            {record.cisloKlientske && record.cisloKlientske !== record.cislo && (
               <p className="text-[10px] uppercase font-bold text-slate-400 mt-1">Interní kód: {record.cislo}</p>
            )}
          </div>
          
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            <Button variant="default" className="h-11 shadow-sm font-bold bg-blue-600 hover:bg-blue-700 text-white" onClick={handlePrint} disabled={isPreparingPdf}>
              {isPreparingPdf ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Printer className="h-4 w-4 mr-2" />}
              {isPreparingPdf ? "Příprava k tisku..." : "Stáhnout PDF report"}
            </Button>
            {isAdmin && (
              <>
                <Button variant="secondary" className="h-11 shadow-sm" onClick={() => router.push(`/upravit-zaznam/${record.id}`)}>
                  <Edit className="h-4 w-4 mr-2" /> Upravit záznam
                </Button>
                <Button variant="outline" className="h-11 shadow-sm text-red-500 hover:text-red-700 border-red-200 hover:bg-red-50" onClick={() => setShowDeleteModal(true)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>

        <Card className="border-blue-100 bg-blue-50/20">
          <CardHeader className="py-4 space-y-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-3">
              <div>
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-blue-900">
                  <FileText className="h-4 w-4" /> 
                  {isAdmin ? "Manažerský dispečink pro exporty" : "Klientský dispečink reportu"}
                </CardTitle>
                <CardDescription className="text-xs">Filtrujte kapitoly a odpovědnosti pro webový náhled.</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                {uniquePositionsInRecord.length > 0 && (
                  <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-md border shadow-sm w-full md:w-64">
                    <span className="text-xs font-bold text-muted-foreground shrink-0">Pozice:</span>
                    <Select value={filterPosition} onValueChange={setFilterPosition}>
                      <SelectTrigger className="h-7 border-none p-0 focus:ring-0 shadow-none text-xs font-bold"><SelectValue placeholder="Filtrovat pozici" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Zobrazit vše</SelectItem>
                        {uniquePositionsInRecord.map(pos => <SelectItem key={pos} value={pos}>{pos}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="flex items-center space-x-2 bg-white px-3 py-2 rounded-md border shadow-sm h-10">
                  <Checkbox id="onlyDefects" checked={onlyDefects} onCheckedChange={(checked) => setOnlyDefects(!!checked)} />
                  <label htmlFor="onlyDefects" className="text-xs font-bold text-slate-700 cursor-pointer select-none">Pouze neshody</label>
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <Card className="border-none shadow-sm">
              <CardHeader><CardTitle className="text-lg">{onlyDefects ? t.nadpis_zavady : t.nadpis_komplet} ({filteredKontrolniBody.length})</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                {groupedKontrolniBody.map((group) => {
                  const { sekce, items } = group;
                  const isCollapsed = collapsedGroups[sekce];
                  const groupStats = { N: items.filter(i => i.hodnoceni === 'N').length };

                  return (
                    <div key={sekce} className="space-y-3">
                      <div onClick={() => toggleGroup(sekce)} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors">
                        <h3 className="font-bold text-slate-800 text-sm uppercase">{sekce}</h3>
                        <div className="flex items-center gap-4">
                          <div className="flex gap-2 text-[10px] font-bold uppercase tracking-wider">
                            {groupStats.N > 0 && <span className="text-red-700 bg-red-100 px-2 py-0.5 rounded">{t.stat_neshody}: {groupStats.N}</span>}
                          </div>
                          <ChevronDown className={cn("h-5 w-5 text-slate-500 transition-transform", isCollapsed && "-rotate-90")} />
                        </div>
                      </div>

                      {!isCollapsed && (
                        <div className="space-y-4 pl-2 ml-2 border-l-2 border-blue-100">
                          {items.map((kb: any) => {
                            const isDefect = kb.hodnoceni === 'N';
                            const bodId = kb.id || kb.bod;
                            const isResolvedByClient = !!kb.vyresenoKlientem;

                            return (
                              <div key={bodId} className={cn("p-4 border rounded-xl space-y-4 transition-all bg-white", isDefect ? "border-slate-200 shadow-sm" : "bg-slate-50/40 border-slate-100 text-slate-600")}>
                                <div className="flex justify-between items-start gap-2">
                                  <div className="flex items-center gap-2">
                                    <span className={cn("font-mono text-xs font-bold h-6 w-6 rounded-md flex items-center justify-center shrink-0", isDefect ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800")}>{kb.bod}</span>
                                    <div>
                                      <h4 className="font-bold text-[14px] leading-tight text-slate-900">{kb.otazka || kb.popis}</h4>
                                      <span className="text-[10px] text-muted-foreground font-bold uppercase">{kb.sekce || 'Ostatní'}</span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {isDefect && isResolvedByClient && (
                                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1"><Clock className="h-3 w-3" /> Vyřešeno</span>
                                    )}
                                    <span className={cn("text-[10px] font-bold uppercase px-2 py-0.5 rounded border", isDefect ? (isResolvedByClient ? "bg-slate-50 text-slate-500" : "bg-red-50 text-red-700 border-red-200") : "bg-green-50 text-green-700 border-green-200")}>
                                      {isDefect ? 'Neshoda' : 'Vyhovuje'}
                                    </span>
                                  </div>
                                </div>

                                {isDefect && (
                                  <div className="space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-lg border">
                                      <div><span className="text-muted-foreground block mb-0.5">{t.karta_opatreni}</span><p className="font-medium text-slate-900">{kb.navrhOpatreni || 'Není definováno'}</p></div>
                                      <div><span className="text-muted-foreground block mb-0.5">{t.nadpis_misto}</span><p className="font-bold text-blue-900">{kb.lokalizace || 'Celé pracoviště'}</p></div>
                                      <div><span className="text-muted-foreground block mb-0.5">{t.karta_termin}</span><p className="font-medium">{kb.terminOdstraneni ? new Date(kb.terminOdstraneni).toLocaleDateString('cs-CZ') : 'Neurčeno'}</p></div>
                                      <div><span className="text-muted-foreground block mb-0.5">{t.karta_odpovednost}</span><p className="font-bold text-black">{kb.odpovednaOsoba || 'Neuvedena'}</p></div>
                                    </div>

                                    {kb.foto && kb.foto.length > 0 && (
                                      <div className="mt-4">
                                        <span className="text-[10px] uppercase font-bold text-slate-500 block mb-2">Fotodokumentace auditora</span>
                                        <div className="flex flex-wrap gap-4">
                                          {kb.foto.map((f: string, i: number) => (
                                            <div 
                                              key={`aud-web-${i}`} 
                                              onClick={() => setFullscreenImage(f)} 
                                              className="cursor-zoom-in inline-block relative group"
                                            >
                                              <img src={f} alt="Fotodokumentace" className="h-32 w-32 sm:h-40 sm:w-40 object-cover rounded-lg border border-slate-300 shadow-sm group-hover:scale-105 transition-transform" />
                                              <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center pointer-events-none">
                                                <Camera className="text-white h-6 w-6 drop-shadow-md" />
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {!isAdmin && (
                                      <div className="flex flex-col p-4 rounded-lg border border-blue-200 bg-blue-50/60 mt-4 space-y-4">
                                        <div className="space-y-0.5">
                                          <p className="text-sm font-bold text-blue-900">Odstranili jste tento nedostatek?</p>
                                          <p className="text-[11px] font-medium text-blue-700">Vyplňte detaily o nápravě pro revizi auditorem.</p>
                                        </div>

                                        {isResolvedByClient ? (
                                           <div className="bg-white p-3 rounded border border-blue-100 text-sm space-y-3">
                                             <div className="flex justify-between items-start">
                                               <div><span className="text-xs text-muted-foreground block">Odstranil(a)</span><p className="font-bold">{kb.jmenoVyresitele || 'Neuvedeno'}</p></div>
                                               <div className="text-right"><span className="text-xs text-muted-foreground block">Datum</span><p className="font-bold">{kb.datumVyreseniKlientem ? new Date(kb.datumVyreseniKlientem).toLocaleDateString('cs-CZ') : '-'}</p></div>
                                             </div>
                                             {kb.poznamkaKlienta && (
                                               <div className="mt-1 pt-2 border-t border-blue-50">
                                                 <span className="text-xs text-muted-foreground block mb-0.5">Zanechaná poznámka:</span>
                                                 <p className="text-sm font-medium text-slate-800 whitespace-pre-wrap">{kb.poznamkaKlienta}</p>
                                               </div>
                                             )}
                                             
                                             {kb.fotoVyreseni && kb.fotoVyreseni.length > 0 && (
                                               <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t border-blue-50">
                                                 {kb.fotoVyreseni.map((f: string, i: number) => (
                                                   <div 
                                                     key={`kli-web-${i}`} 
                                                     onClick={() => setFullscreenImage(f)} 
                                                     className="cursor-zoom-in inline-block relative group"
                                                   >
                                                      <img src={f} alt="Důkaz" className="h-32 w-32 sm:h-40 sm:w-40 object-cover rounded-lg border border-emerald-200 shadow-sm group-hover:scale-105 transition-transform" />
                                                      <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center pointer-events-none">
                                                        <Camera className="text-white h-6 w-6 drop-shadow-md" />
                                                      </div>
                                                   </div>
                                                 ))}
                                               </div>
                                             )}
                                             <Button variant="outline" size="sm" onClick={() => handleCancelResolve(bodId)} className="mt-4 w-full text-red-600 hover:bg-red-50 border-red-200">Zrušit a vrátit do řešení</Button>
                                           </div>
                                        ) : (
                                          resolvingBod === bodId ? (
                                            <div className="space-y-4 bg-white p-4 rounded border border-blue-100 shadow-sm animate-in fade-in zoom-in-95 duration-200">
                                               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                 <div className="space-y-1.5"><Label className="text-xs font-bold text-slate-700">Datum odstranění *</Label><Input type="date" value={resolveData.datum} onChange={e => setResolveData(prev => ({...prev, datum: e.target.value}))} className="h-9" /></div>
                                                 <div className="space-y-1.5"><Label className="text-xs font-bold text-slate-700">Jméno a příjmení *</Label><Input placeholder="Vaše jméno..." value={resolveData.jmeno} onChange={e => setResolveData(prev => ({...prev, jmeno: e.target.value}))} className="h-9" /></div>
                                               </div>
                                               <div className="space-y-1.5 mt-2">
                                                 <Label className="text-xs font-bold text-slate-700">Poznámka k odstranění (volitelné)</Label>
                                                 <Textarea placeholder="Stručně popište, jak byla závada odstraněna..." value={resolveData.poznamka} onChange={e => setResolveData(prev => ({...prev, poznamka: e.target.value}))} className="h-16 text-xs bg-slate-50" />
                                               </div>
                                               <div className="space-y-1.5">
                                                  <Label className="text-xs font-bold text-slate-700 flex items-center gap-1"><Camera className="h-3 w-3"/> Fotografie důkazu (volitelné)</Label>
                                                  <Input type="file" accept="image/*" multiple onChange={async (e) => {
                                                      const files = Array.from(e.target.files || []);
                                                      if (files.length === 0) return;
                                                      const newPhotos: string[] = [];
                                                      for (const file of files) {
                                                        const compressed = await compressImage(file);
                                                        newPhotos.push(compressed);
                                                      }
                                                      setResolveData(prev => ({...prev, foto: [...prev.foto, ...newPhotos]}));
                                                  }} className="text-xs h-9 cursor-pointer" />
                                                  {resolveData.foto.length > 0 && (
                                                    <div className="flex flex-wrap gap-2 mt-3 p-2 bg-slate-50 rounded border border-dashed">
                                                      {resolveData.foto.map((f, i) => (
                                                        <div key={i} className="relative group">
                                                           <img src={f} className="h-14 w-14 object-cover rounded shadow-sm" />
                                                           <button onClick={() => setResolveData(prev => ({...prev, foto: prev.foto.filter((_, idx) => idx !== i)}))} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow"><X className="h-3 w-3" /></button>
                                                        </div>
                                                      ))}
                                                    </div>
                                                  )}
                                               </div>
                                               <div className="flex items-center gap-2 pt-2 border-t">
                                                 <Button size="sm" onClick={() => handleConfirmResolve(bodId)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-9">Odeslat ke kontrole</Button>
                                                 <Button size="sm" variant="ghost" onClick={() => setResolvingBod(null)} className="h-9 text-slate-500 hover:text-slate-900">Zrušit</Button>
                                               </div>
                                            </div>
                                          ) : (
                                            <Button onClick={() => { setResolvingBod(bodId); setResolveData({ datum: new Date().toISOString().split('T')[0], jmeno: '', poznamka: '', foto: [] }); }} size="sm" className="bg-white text-blue-700 border border-blue-200 hover:bg-blue-50 hover:text-blue-800 shadow-sm self-start font-bold h-9 px-4">
                                               Začít hlásit odstranění
                                            </Button>
                                          )
                                        )}
                                      </div>
                                    )}

                                    {isAdmin && isResolvedByClient && (
                                      <div className="flex flex-col gap-3 text-sm p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 mt-4 shadow-inner">
                                        <div className="flex items-center gap-2 font-bold text-emerald-800">
                                          <CheckCircle2 className="h-5 w-5 shrink-0" />
                                          <span>Zpráva klienta: Závada nahlášena jako vyřešená</span>
                                        </div>
                                        <div className="bg-white/80 p-3 rounded-md flex flex-col gap-1.5 border border-emerald-100 shadow-sm">
                                          <div className="flex justify-between items-center border-b border-emerald-100 pb-2 mb-1">
                                            <div><span className="text-[10px] uppercase font-bold text-emerald-600/70 block">Osoba hlásící nápravu</span><p className="font-bold">{kb.jmenoVyresitele || 'Neuvedeno'}</p></div>
                                            <div className="text-right"><span className="text-[10px] uppercase font-bold text-emerald-600/70 block">Datum řešení</span><p className="font-bold">{kb.datumVyreseniKlientem ? new Date(kb.datumVyreseniKlientem).toLocaleDateString('cs-CZ') : '-'}</p></div>
                                          </div>
                                          {kb.poznamkaKlienta && (
                                            <div>
                                              <span className="text-[10px] uppercase font-bold text-emerald-600/70 block mb-0.5">Komentář klienta</span>
                                              <p className="font-medium text-slate-800 whitespace-pre-wrap">{kb.poznamkaKlienta}</p>
                                            </div>
                                          )}
                                          
                                          {kb.fotoVyreseni && kb.fotoVyreseni.length > 0 && (
                                             <div className="mt-3">
                                               <span className="text-[10px] uppercase font-bold text-emerald-600/70 block mb-2">Přiložené fotodůkazy</span>
                                               <div className="flex flex-wrap gap-4">
                                                 {kb.fotoVyreseni.map((f: string, i: number) => (
                                                   <div 
                                                     key={`kli-web2-${i}`} 
                                                     onClick={() => setFullscreenImage(f)} 
                                                     className="cursor-zoom-in inline-block relative group"
                                                   >
                                                     <img src={f} alt="Důkaz" className="h-32 w-32 sm:h-40 sm:w-40 object-cover rounded-lg border border-emerald-300 shadow-sm group-hover:scale-105 transition-transform" />
                                                     <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center pointer-events-none">
                                                        <Camera className="text-white h-6 w-6 drop-shadow-md" />
                                                     </div>
                                                   </div>
                                                 ))}
                                               </div>
                                             </div>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="border-none shadow-sm bg-white">
              <CardHeader><CardTitle className="text-sm uppercase tracking-wider text-muted-foreground font-bold">Detaily kontroly</CardTitle></CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="flex gap-3"><Building className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" /><div><span className="text-xs text-muted-foreground block">Klient</span><p className="font-bold">{klient?.nazev || 'Neznámý'}</p></div></div>
                <div className="flex gap-3"><MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs text-muted-foreground block">Pracoviště</span>
                    <p className="font-bold">{pracovisteList.map(p => p.nazev).join(', ') || 'Neznámé'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
