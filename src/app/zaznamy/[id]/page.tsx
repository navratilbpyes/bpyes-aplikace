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

interface AuditorConfig {
  firmaNazev?: string;
  firmaIco?: string;
  firmaAdresa?: string;
  email?: string;
  telefon?: string;
  titul?: string;
  jmeno?: string;
  certifikace?: { id: string; nazev: string; cislo: string }[];
  razitkoBase64?: string;
  podpisBase64?: string;
}

export default function RecordDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { zaznamy, klienti, userProfile, setZaznamy } = useData();

  const [t, setT] = useState<Record<string, string>>({
    nadpis_zavady: "Registr zjištěných nedostatků a nápravných opatření",
    nadpis_komplet: "Kompletní auditní protokol zjištění",
    karta_opatreni: "Návrh opatření:",
    nadpis_misto: "Místo:",
    karta_termin: "Termín:",
    karta_odpovednost: "Pozice:",
    stat_vyhovuje: "VYHOVUJE",
    stat_neshody: "NESHODY (N)"
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [isPreparingPdf, setIsPreparingPdf] = useState(false);
  const [resolvingBod, setResolvingBod] = useState<string | number | null>(null);
  const [resolveData, setResolveData] = useState({ datum: '', jmeno: '', poznamka: '', foto: [] as string[] });
  const [auditorConfig, setAuditorConfig] = useState<AuditorConfig | null>(null);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isAdmin = userProfile?.role === 'admin';

  useEffect(() => {
    const fetchAuditorConfig = async () => {
      try {
        const docRef = doc(db, "konfigurace", "auditor");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) setAuditorConfig(docSnap.data() as AuditorConfig);
      } catch (err) { console.error("Chyba DB auditor", err); }
    };
    fetchAuditorConfig();
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
            if (val.startsWith('2. ')) val = val.substring(3).trim();
            map[r[0].trim()] = val;
          }
        });
        setT(prev => ({ ...prev, ...map }));
      }).catch(console.error);
  }, []);

  const record = useMemo(() => zaznamy.find((z: any) => z.id === params.id), [zaznamy, params.id]);
  const klient = useMemo(() => klienti.find((k: any) => k.id === record?.klientId), [klienti, record]);
  
  const pracovisteList = useMemo(() => {
    if (!klient || !record) return [];
    const prac = klient.pracoviste || [];
    let filtered = [];
    if (record.pracovisteIds && Array.isArray(record.pracovisteIds)) filtered = prac.filter((p: any) => record.pracovisteIds.includes(p.id));
    else if (record.pracovisteId) filtered = prac.filter((p: any) => p.id === record.pracovisteId);
    
    return filtered.map((p: any) => ({
      ...p,
      fullDisplay: `${p.nazev}${p.adresa ? ', ' + p.adresa : ''}${p.mesto ? ', ' + p.mesto : ''}`
    }));
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
    setTimeout(() => { window.print(); setIsPreparingPdf(false); }, 500);
  };

  const handleDeleteRecord = async () => {
    if (!record) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'zaznamy', record.id));
      if (setZaznamy) setZaznamy((prev: any[]) => prev.filter(z => z.id !== record.id));
      toast({ title: "Záznam smazán" });
      router.push("/");
    } catch (error) { setIsDeleting(false); }
  };

  const filteredKontrolniBody = useMemo(() => {
    if (!record?.kontrolniBody) return [];
    return record.kontrolniBody.filter((kb: any) => {
      const sec = kb.sekce || "Ostatní";
      if (onlyDefects && kb.hodnoceni !== 'N') return false;
      if (filterPosition !== "all" && kb.hodnoceni === 'N' && kb.odpovednaOsoba !== filterPosition) return false;
      return true;
    });
  }, [record, onlyDefects, filterPosition]);

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

  if (!record) return isLoading ? <div className="min-h-[50vh] flex justify-center items-center"><Loader2 className="animate-spin" /></div> : <div className="p-8 text-center">Záznam nenalezen.</div>;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8 pb-24 relative overflow-hidden print:p-0 print:m-0 print:space-y-0">
      
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { size: A4 portrait; margin: 15mm 15mm 20mm 15mm; }
          body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; background: white !important; color: #000 !important; }
          .page-break { page-break-before: always; }
          .avoid-break { page-break-inside: avoid; break-inside: avoid; }
        }
      `}} />

      {/* ================================================================= */}
      {/* 1. TISKOVÁ VERZE                                                  */}
      {/* ================================================================= */}
      <div className="hidden print:block text-slate-900 w-full bg-white text-[13px]">
        
        <div className="pb-8">
          <div className="mb-8 flex justify-between items-start">
            <img src="/logo.png" onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src="/logo.svg"; }} alt="Logo" className="h-10 object-contain" />
            <div className="text-right text-[10px] text-slate-500 uppercase font-bold">AuditFlow | BPyes System</div>
          </div>

          <h1 className="text-xl font-bold uppercase text-slate-900 mb-4 leading-tight">
            {record.typKontroly === 'BOZPaPO' ? 'PROVĚRKA BOZP A PREVENTIVNÍ POŽÁRNÍ PROHLÍDKA, KONTROLA DOKUMENTACE POŽÁRNÍ OCHRANY' : 
             record.typKontroly === 'PPP' ? 'PREVENTIVNÍ POŽÁRNÍ PROHLÍDKA' : 'PROVĚRKA BOZP PRACOVIŠTĚ'}
          </h1>
          
          <div className="text-base font-bold mb-8 pb-4 border-b-2 border-slate-100">
            ČÍSLO ZPRÁVY: {record.cisloKlientske || record.cislo} | REVIZE: R{record.revize || 0}
          </div>

          <div className="grid grid-cols-2 gap-8 mb-10">
            <div>
              <p className="font-bold uppercase text-[11px] text-slate-500 mb-1">ZPRACOVATEL / POSKYTOVATEL:</p>
              <p className="font-bold text-sm">{auditorConfig?.firmaNazev || 'BPyes s.r.o.'}</p>
              <p>{auditorConfig?.firmaAdresa || 'Sídlo neuvedeno'}</p>
              <p>IČO: {auditorConfig?.firmaIco || '-'}</p>
              <p>E-mail: {auditorConfig?.email || '-'}</p>
            </div>
            
            <div>
              <p className="font-bold uppercase text-[11px] text-slate-500 mb-1">KONTROLOVANÝ SUBJEKT / KLIENT:</p>
              <p className="font-bold text-sm">{klient?.nazev}</p>
              
              {/* ZDE JE OPRAVA ADRESY KLIENTA */}
              <p>Sídlo: {klient?.adresa || 'Neuvedeno'}{klient?.mesto ? `, ${klient.psc || ''} ${klient.mesto}` : ''}</p>
              <p>IČO: {klient?.ico}</p>
              
              <div className="mt-2">
                <span className="font-bold">Místo prověrky:</span><br/>
                {pracovisteList.map((p: any) => <div key={p.id} className="text-xs leading-snug">{p.fullDisplay}</div>)}
              </div>
            </div>
          </div>

          <div className="mb-16">
            <p className="font-bold uppercase text-[11px] text-slate-500 mb-2">PROHLÁŠENÍ O SEZNÁMENÍ:</p>
            <p className="text-justify leading-relaxed italic text-slate-700">
              Kontrolovaný subjekt / zástupce klienta svým níže uvedeným podpisem stvrzuje, že byl v plném rozsahu, prokazatelně a jasně seznámen se všemi zjištěnými legislativními nedostatky, systémovými neshodami a doporučeními, která jsou detailně specifikována uvnitř této auditní zprávy. Souhlasí s navrženými nápravnými opatřeními a zavazuje se k jejich vyřešení v definovaných termínech.
            </p>
          </div>

          {/* PODPISOVÝ BLOK - OPRAVENÉ ROZLOŽENÍ */}
          <div className="grid grid-cols-2 gap-12 mt-20">
            <div className="relative flex flex-col">
               <p className="font-bold uppercase text-[11px] mb-2">PROVEDL (ZA {auditorConfig?.firmaNazev?.toUpperCase() || 'BPYES'}):</p>
               
               {/* Kontejner pro absolutní pozicování razítek nad čarou */}
               <div className="relative w-full">
                 <div className="absolute bottom-1 left-0 flex items-end gap-2 z-0 pointer-events-none">
                   {auditorConfig?.razitkoBase64 && (
                     <img src={auditorConfig.razitkoBase64} alt="Razítko" className="h-28 w-28 object-contain mix-blend-multiply opacity-90" />
                   )}
                   {auditorConfig?.podpisBase64 && (
                     <img src={auditorConfig.podpisBase64} alt="Podpis" className="h-16 w-32 object-contain mix-blend-multiply -ml-12 mb-2" />
                   )}
                 </div>
                 {/* Samotná čára umístěná tak, aby dělala prostor pro obrázky */}
                 <div className="border-b border-black w-full pt-20 relative z-10"></div>
               </div>
               
               {/* Text s informacemi pod čarou */}
               <div className="pt-2">
                 <p className="font-bold text-base">{auditorConfig?.titul ? auditorConfig.titul + ' ' : ''}{auditorConfig?.jmeno || 'Auditor'}</p>
                 {auditorConfig?.certifikace?.map((cert: any) => (
                   <p key={cert.id} className="text-[10px] leading-tight text-slate-600 mt-1">{cert.nazev}{cert.cislo ? `, ${cert.cislo}` : ''}</p>
                 ))}
               </div>
            </div>
            
            <div className="relative flex flex-col pt-6">
               <p className="font-bold uppercase text-[11px] mb-2">ZÁSTUPCE KLIENTA / SUBJEKTU:</p>
               <div className="border-b border-black w-full pt-14"></div>
               <p className="text-sm text-slate-400 mt-2 italic">Podpis a datum seznámení</p>
            </div>
          </div>
        </div>

        <div className="page-break"></div>

        {/* SEKCE 1: SHRNUTÍ */}
        <div className="pt-4">
          <h2 className="text-base font-bold mb-6 uppercase border-b pb-2">1. SHRNUTÍ A STATISTIKY</h2>
          <div className="grid grid-cols-4 gap-4 text-center mb-8">
            <div className="border p-3 bg-slate-50"><div className="text-xl font-bold">{stats.total}</div><div className="text-[9px] font-bold">BODY CELKEM</div></div>
            <div className="border p-3 bg-green-50"><div className="text-xl font-bold text-green-700">{stats.V}</div><div className="text-[9px] font-bold text-green-700">VYHOVUJE</div></div>
            <div className="border p-3 bg-red-50"><div className="text-xl font-bold text-red-700">{stats.N}</div><div className="text-[9px] font-bold text-red-700">NESHODY (N)</div></div>
            <div className="border p-3 bg-slate-50"><div className="text-xl font-bold text-slate-500">{stats.NA}</div><div className="text-[9px] font-bold text-slate-500">NEHODNOCENO</div></div>
          </div>
          <div className="mb-8">
            <p className="text-[11px] font-bold uppercase text-slate-500 mb-1">ZÁVĚREČNÉ VYHODNOCENÍ AUDITORA:</p>
            <div className="border p-4 bg-slate-50 italic text-slate-800 leading-relaxed whitespace-pre-wrap">{record.poznamka || "Nebyl vložen žádný text."}</div>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase text-slate-500 mb-2">SEZNAM ZÚČASTNĚNÝCH OSOB:</p>
            <table className="w-full border-collapse border text-xs">
              <thead className="bg-slate-100"><tr><th className="border p-2 text-left">Jméno a příjmení</th><th className="border p-2 text-left">Pozice / Vztah k subjektu</th></tr></thead>
              <tbody>
                {record.ucastnici?.map((u: any, i: number) => (
                  <tr key={i}><td className="border p-2 font-bold">{u.jmeno}</td><td className="border p-2">{u.pozice}</td></tr>
                )) || <tr><td colSpan={2} className="border p-2 text-center">Neuvedeno</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="page-break"></div>

        {/* SEKCE 2: PROTOKOL */}
        <div className="pt-4">
          <h2 className="text-base font-bold mb-8 uppercase border-b pb-2">2. KOMPLETNÍ AUDITNÍ PROTOKOL ZJIŠTĚNÍ</h2>
          <div className="space-y-6">
            {groupedKontrolniBody.map((group) => (
               group.items.map((kb: any) => {
                 const isDefect = kb.hodnoceni === 'N';
                 return (
                   <div key={kb.id || kb.bod} className="avoid-break border-b pb-6 mb-6">
                     <div className="flex justify-between items-start mb-2">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">[{kb.bod}] KAPITOLA: {group.sekce}</div>
                        <div className={cn("text-[9px] font-bold px-2 py-0.5 border rounded uppercase", isDefect ? "text-red-700 border-red-200 bg-red-50" : "text-green-700 border-green-200 bg-green-50")}>{isDefect ? 'Neshoda' : 'Vyhovuje'}</div>
                     </div>
                     <div className="font-bold text-slate-900 mb-3">{kb.otazka || kb.popis}</div>
                     {isDefect && (
                       <div className="bg-slate-50 p-3 border rounded space-y-3">
                         <div className="grid grid-cols-2 gap-4 text-[11px]">
                           <div><span className="text-slate-500 font-bold block">NÁVRH OPATŘENÍ:</span>{kb.navrhOpatreni}</div>
                           <div><span className="text-slate-500 font-bold block">MÍSTO:</span><span className="font-bold text-blue-800">{kb.lokalizace}</span></div>
                           <div><span className="text-slate-500 font-bold block">TERMÍN:</span>{kb.terminOdstraneni ? new Date(kb.terminOdstraneni).toLocaleDateString('cs-CZ') : '-'}</div>
                           <div><span className="text-slate-500 font-bold block">ODPOVĚDNÁ POZICE:</span><span className="font-bold">{kb.odpovednaOsoba}</span></div>
                         </div>
                         {kb.foto && kb.foto.length > 0 && (
                           <div className="pt-2 flex flex-wrap gap-2">
                             {kb.foto.map((f: string, idx: number) => <img src={f} key={idx} className="h-40 w-40 object-cover border" />)}
                           </div>
                         )}
                       </div>
                     )}
                   </div>
                 )
               })
            ))}
          </div>
        </div>
      </div>

      {/* WEBOVÁ VERZE */}
      <div className="print:hidden space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-6">
          <div className="space-y-1">
            <Button variant="ghost" size="sm" className="p-0 h-auto text-muted-foreground" onClick={() => router.push("/")}><ChevronLeft className="h-4 w-4" /> Zpět</Button>
            <h1 className="text-3xl font-bold">{record.cisloKlientske || record.cislo}</h1>
            <p className="text-sm text-muted-foreground">Audit ze dne {record.datum ? new Date(record.datum).toLocaleDateString('cs-CZ') : '-'}</p>
          </div>
          <div className="flex gap-2">
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={handlePrint} disabled={isPreparingPdf}>
              {isPreparingPdf ? <Loader2 className="animate-spin mr-2" /> : <Printer className="mr-2" />} Tisk PDF
            </Button>
            {isAdmin && <Button variant="outline" className="text-red-500" onClick={() => setShowDeleteModal(true)}><Trash2 className="h-4 w-4" /></Button>}
          </div>
        </div>
      </div>
    </div>
  );
}
