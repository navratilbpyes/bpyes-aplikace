'use client';

import { useData } from "@/components/data-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  ChevronLeft, 
  Printer, 
  Mail, 
  Building, 
  MapPin, 
  Clock, 
  FileText,
  Loader2
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/app/lib/utils";

export default function RecordDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { zaznamy, klienti } = useData();

  const record = useMemo(() => zaznamy.find(z => z.id === params.id), [zaznamy, params.id]);
  const klient = useMemo(() => klienti.find(k => k.id === record?.klientId), [klienti, record]);
  const pracoviste = useMemo(() => klient?.pracoviste.find(p => p.id === record?.pracovisteId), [klient, record]);

  const [filterPosition, setFilterPosition] = useState<string>("all");
  const [onlyDefects, setOnlyDefects] = useState<boolean>(true);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailText, setEmailText] = useState("");

  // Získání unikátních sekcí (kategorií) z kontrolních bodů pro dynamický filtr
  const allSectionsInRecord = useMemo(() => {
    if (!record?.kontrolniBody) return [];
    const sections = record.kontrolniBody.map((kb: any) => kb.sekce || "Ostatní").filter(Boolean);
    return Array.from(new Set(sections)) as string[];
  }, [record]);

  // Stav pro uchování zapnutých/vypnutých sekcí
  const [visibleSections, setVisibleSections] = useState<Record<string, boolean>>(() => {
    if (!record?.kontrolniBody) return {};
    const initial: Record<string, boolean> = {};
    const unique = Array.from(new Set(record.kontrolniBody.map((kb: any) => kb.sekce || "Ostatní"))) as string[];
    unique.forEach(sec => {
      initial[sec] = true;
    });
    return initial;
  }, [record]);

  const toggleSection = (sectionName: string) => {
    setVisibleSections(prev => ({
      ...prev,
      [sectionName]: !prev[sectionName]
    }));
  };

  const uniquePositionsInRecord = useMemo(() => {
    if (!record?.zavady) return [];
    const positions = record.zavady.map((z: any) => z.odpovednaOsoba).filter(Boolean);
    return Array.from(new Set(positions)) as string[];
  }, [record]);

  // Filtrované závady na základě pozice a viditelnosti sekce
  const filteredZavady = useMemo(() => {
    if (!record?.zavady) return [];
    return record.zavady.filter((z: any) => {
      if (filterPosition !== "all" && z.odpovednaOsoba !== filterPosition) return false;
      
      // Pokud je sekce dané závady skrytá uživatelem, schováme i závadu
      if (z.sekce && visibleSections[z.sekce] === false) return false;
      
      return true;
    });
  }, [record, filterPosition, visibleSections]);

  // Filtrované kontrolní body na základě viditelnosti sekce a filtru "pouze závady"
  const filteredKontrolniBody = useMemo(() => {
    if (!record?.kontrolniBody) return [];
    return record.kontrolniBody.filter((kb: any) => {
      // Skrytí celé sekce
      const sec = kb.sekce || "Ostatní";
      if (visibleSections[sec] === false) return false;

      // Filtr pouze na neshody
      if (onlyDefects && kb.hodnoceni !== 'N') return false;

      return true;
    });
  }, [record, visibleSections, onlyDefects]);

  const filteredDoporuceni = useMemo(() => {
    if (!record?.kontrolniBody) return [];
    return record.kontrolniBody.filter((kb: any) => {
      const sec = kb.sekce || "Ostatní";
      if (visibleSections[sec] === false) return false;
      return kb.showDoporuceni && kb.doporuceni && kb.doporuceni.trim() !== "";
    });
  }, [record, visibleSections]);

  const stats = useMemo(() => {
    if (!record?.kontrolniBody) return { V: 0, N: 0, NA: 0, NK: 0, total: 0 };
    return {
      V: record.kontrolniBody.filter((b: any) => b.hodnoceni === 'V').length,
      N: record.kontrolniBody.filter((b: any) => b.hodnoceni === 'N').length,
      NA: record.kontrolniBody.filter((b: any) => b.hodnoceni === 'NA').length,
      NK: record.kontrolniBody.filter((b: any) => b.hodnoceni === 'NK').length,
      total: record.kontrolniBody.length
    };
  }, [record]);

  const pdfFileName = useMemo(() => {
    if (!record || !klient) return "export.pdf";
    const cleanKlient = klient.nazev.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9\s]/g, "").trim();
    const cleanDate = (record.datum || "").replace(/-/g, "");
    const cleanType = record.typKontroly || "KONTROLA";
    const rev = record.revize !== undefined ? `R${record.revize}` : "R0";
    const positionSuffix = filterPosition !== "all" ? `_${filterPosition.replace(/\s+/g, "")}` : "";
    
    return `${record.cislo.replace(/\//g, "-")}_${cleanType}_${cleanKlient}_${cleanDate}_${rev}${positionSuffix}.pdf`;
  }, [record, klient, filterPosition]);

  if (!record) {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-muted-foreground italic">Záznam nebyl v databázi nalezen.</p>
        <Button onClick={() => router.push("/")}><ChevronLeft className="mr-2 h-4 w-4" /> Návrat na přehled</Button>
      </div>
    );
  }

  const getFullInspectionTitle = (type: string) => {
    switch (type) {
      case "BOZPaPO": return "PROVĚRKA BOZP A PREVENTIVNÍ POŽÁRNÍ PROHLÍDKA, KONTROLA DOKUMENTACE POŽÁRNÍ OCHRANY";
      case "PBOZP": return "PROVĚRKA BOZP";
      case "PPP": return "PREVENTIVNÍ POŽÁRNÍ PROHLÍDKA";
      default: return "ZPRÁVA Z KONTROLY BOZP A PO";
    }
  };

  const triggerEmailModal = () => {
    setEmailTo(filterPosition !== "all" ? `udrzba@${klient?.nazev.toLowerCase().replace(/[^a-z]/g, "") || "firma"}.cz` : "");
    setEmailText(`Dobrý den,\n\nv příloze Vám zasílám vygenerovaný přehled zjištěných neshod a opatření z prověrky BOZP a PO konané dne ${record.datum ? new Date(record.datum).toLocaleDateString('cs-CZ') : ''}.\n\n` + 
      (filterPosition !== "all" ? `Tento výpis obsahuje výhradně úkoly určené pro pracovní pozici: ${filterPosition}.\n\n` : "") +
      `Prosím o zajištění nápravy v uvedených termínech.\n\nS pozdravem,\nTým BPyes`);
    setShowEmailModal(true);
  };

  const handleSendEmail = () => {
    toast({ title: "E-mail odeslán", description: `Report byl odeslán na adresu ${emailTo || "technika"}.` });
    setShowEmailModal(false);
  };

  const handleDownloadPDF = async () => {
    setIsGeneratingPDF(true);
    toast({ title: "Připravuji PDF", description: "Dokument se generuje, čekejte prosím..." });
    
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const element = document.getElementById('pdf-export-container');
      
      const opt = {
        margin:       [12, 12, 12, 12],
        filename:     pdfFileName,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 4, useCORS: true, logging: false, windowWidth: 794 },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak:    { mode: ['css'] }
      };

      await html2pdf().set(opt).from(element).save();
      toast({ title: "Úspěch", description: "PDF bylo úspěšně staženo do vašeho počítače." });
    } catch (error) {
      console.error("Chyba PDF:", error);
      toast({ title: "Chyba generování", description: "Nastala chyba při vytváření PDF.", variant: "destructive" });
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8 pb-24 relative overflow-hidden">
      
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 animate-in fade-in">
          <Card className="w-full max-w-lg shadow-2xl">
            <CardHeader>
              <CardTitle>Odeslat report e-mailem</CardTitle>
              <CardDescription>Distribuce vygenerovaného PDF.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2"><Label>E-mail příjemce</Label><Input type="email" value={emailTo} onChange={(e) => setEmailTo(e.target.value)} /></div>
              <div className="space-y-2"><Label>Předmět e-mailu</Label><Input readOnly value={`BPyes Auditní zpráva: ${record.cislo} ${filterPosition !== "all" ? `(${filterPosition})` : ""}`} className="bg-muted" /></div>
              <div className="space-y-2"><Label>Text zprávy</Label><Textarea rows={7} value={emailText} onChange={(e) => setEmailText(e.target.value)} /></div>
            </CardContent>
            <div className="p-4 border-t flex justify-end gap-2 bg-muted/20">
              <Button variant="outline" onClick={() => setShowEmailModal(false)}>Zrušit</Button>
              <Button onClick={handleSendEmail}><Mail className="h-4 w-4 mr-2" /> Odeslat report</Button>
            </div>
          </Card>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="p-0 h-auto text-muted-foreground" onClick={() => router.push("/")}><ChevronLeft className="h-4 w-4" /> Zpět na seznam</Button>
            <span className="text-xs font-bold uppercase tracking-wider text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-200">{record.stav === 'uzavreny' ? 'Uzavřený report' : 'Koncept'}</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{record.cislo} <span className="text-muted-foreground font-normal text-xl">R{record.revize || 0}</span></h1>
          <p className="text-sm text-muted-foreground">Provedeno dne {record.datum ? new Date(record.datum).toLocaleDateString('cs-CZ') : 'Neuvedeno'}</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <Button variant="default" className="h-11 shadow-sm font-bold bg-blue-600 hover:bg-blue-700 text-white" onClick={handleDownloadPDF} disabled={isGeneratingPDF}>
            {isGeneratingPDF ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Printer className="h-4 w-4 mr-2" />} {isGeneratingPDF ? "Generuji PDF..." : "Stáhnout PDF report"}
          </Button>
          <Button variant="outline" className="h-11 shadow-sm" onClick={triggerEmailModal}><Mail className="h-4 w-4 mr-2" /> Distribuce e-mailem</Button>
          <Button variant="secondary" className="h-11 shadow-sm" onClick={() => toast({ title: "Informace", description: "Stránka úpravy bude nasazena v další fází vývoje." })}>Upravit záznam</Button>
        </div>
      </div>

      {/* MANAŽERSKÝ DISPEČINK S DYNAMICKÝMI SEKCMI */}
      <Card className="border-blue-100 bg-blue-50/20">
        <CardHeader className="py-4 space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-3">
            <div>
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-blue-900"><FileText className="h-4 w-4" /> Manažerský dispečink pro exporty</CardTitle>
              <CardDescription className="text-xs">Nastavené filtry a skryté sekce se okamžitě přenesou i do tištěného PDF reportu.</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-md border shadow-sm w-full md:w-64">
                <span className="text-xs font-bold text-muted-foreground shrink-0">Filtrovat pozici:</span>
                <Select value={filterPosition} onValueChange={setFilterPosition}>
                  <SelectTrigger className="h-7 border-none p-0 focus:ring-0 shadow-none text-xs font-bold"><SelectValue placeholder="Filtrovat pozici" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Zobrazit vše (Kompletní audit)</SelectItem>
                    {uniquePositionsInRecord.map(pos => <SelectItem key={pos} value={pos}>{pos}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2 bg-white px-3 py-2 rounded-md border shadow-sm h-10">
                <Checkbox id="onlyDefects" checked={onlyDefects} onCheckedChange={(checked) => setOnlyDefects(!!checked)} />
                <label htmlFor="onlyDefects" className="text-xs font-bold text-slate-700 cursor-pointer select-none">Pouze neshody a závady</label>
              </div>
            </div>
          </div>

          {/* NOVÁ FUNKCE: Dynamické zapínání / vypínání kapitol auditu */}
          <div className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">Zahrnout kapitoly auditu do protokolu:</span>
            <div className="flex flex-wrap gap-2 pt-1">
              {allSectionsInRecord.map(sec => (
                <div key={sec} className={cn("flex items-center space-x-2 border px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-colors cursor-pointer select-none", visibleSections[sec] !== false ? "bg-white border-blue-200 text-blue-900" : "bg-slate-100 text-slate-400 border-slate-200 line-through")} onClick={() => toggleSection(sec)}>
                  <Checkbox id={`sec-${sec}`} checked={visibleSections[sec] !== false} className="pointer-events-none" />
                  <span>{sec}</span>
                </div>
              ))}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Webový náhled aplikace na monitoru */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card className="border-none shadow-sm">
            <CardHeader><CardTitle className="text-lg">{onlyDefects ? "Registr zjištěných neshod a závad" : "Kompletní protokol prověrky"} ({filteredKontrolniBody.length})</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              
              {/* Výpis bodů na základě zapnutého filtru */}
              {filteredKontrolniBody.map((kb: any) => {
                const isDefect = kb.hodnoceni === 'N';
                return (
                  <div key={kb.id || kb.bod} className={cn("p-4 border rounded-xl space-y-3 transition-colors", isDefect ? "bg-white border-slate-200 hover:border-amber-300" : "bg-slate-50/40 border-slate-100 text-slate-700")}>
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex items-center gap-2">
                        <span className={cn("font-mono text-xs font-bold h-6 w-6 rounded-md flex items-center justify-center shrink-0", isDefect ? "bg-red-100 text-red-800" : kb.hodnoceni === 'V' ? "bg-green-100 text-green-800" : "bg-slate-200 text-slate-600")}>
                          {kb.bod}
                        </span>
                        <div>
                          <h4 className="font-bold text-[14px] leading-tight">{kb.otazka || kb.popis}</h4>
                          <span className="text-[10px] text-muted-foreground font-semibold uppercase">{kb.sekce || 'Ostatní'}</span>
                        </div>
                      </div>
                      <span className={cn("text-[10px] font-bold uppercase px-2 py-0.5 rounded border shrink-0", kb.hodnoceni === 'N' ? "bg-amber-50 text-amber-700 border-amber-200" : kb.hodnoceni === 'V' ? "bg-green-50 text-green-700 border-green-200" : "bg-slate-100 text-slate-600 border-slate-200")}>
                        {kb.hodnoceni === 'N' ? 'Neshoda' : kb.hodnoceni === 'V' ? 'Vyhovuje' : 'Nehodnoceno'}
                      </span>
                    </div>

                    {/* Pokud jde o neshodu, ukážeme detailní nápravná opatření */}
                    {isDefect && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-muted/30 p-3 rounded-lg border">
                        <div><span className="text-muted-foreground block mb-0.5">Návrh opatření:</span><p className="font-medium text-slate-900">{kb.navrhOpatreni}</p></div>
                        <div><span className="text-muted-foreground block mb-0.5">Místo zjištění:</span><p className="font-bold text-blue-900">{kb.lokalizace || 'Celé pracoviště'}</p></div>
                        <div><span className="text-muted-foreground block mb-0.5">Termín odstranění:</span><p className="font-medium">{kb.terminOdstraneni ? new Date(kb.terminOdstraneni).toLocaleDateString('cs-CZ') : 'Neurčeno'}</p></div>
                        <div><span className="text-muted-foreground block mb-0.5">Odpovědná pozice:</span><p className="font-bold text-black">{kb.odpovednaOsoba || 'Neuvedena'}</p></div>
                      </div>
                    )}

                    {kb.doporuceni && !isDefect && (
                      <p className="text-xs bg-blue-50/40 text-blue-950 p-2 border border-blue-100 rounded-md italic">Doporučení: "{kb.doporuceni}"</p>
                    )}

                    {kb.foto && <img src={kb.foto} alt="Dokumentace" className="h-32 w-auto object-cover rounded-lg border mt-2 shadow-inner" />}
                  </div>
                );
              })}
              {filteredKontrolniBody.length === 0 && <p className="text-muted-foreground italic text-center py-12">Žádné body k zobrazení pro zvolená nastavení.</p>}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-none shadow-sm bg-white">
            <CardHeader><CardTitle className="text-sm uppercase tracking-wider text-muted-foreground font-bold">Detaily kontroly</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex gap-3"><Building className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" /><div><span className="text-xs text-muted-foreground block">Klient</span><p className="font-bold">{klient?.nazev || 'Neznámý'}</p><p className="text-xs text-muted-foreground">IČO: {klient?.ico || ''}</p></div></div>
              <div className="flex gap-3"><MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" /><div><span className="text-xs text-muted-foreground block">Pracoviště</span><p className="font-bold">{pracoviste?.nazev || 'Neznámé'}</p><p className="text-xs text-muted-foreground">{pracoviste?.adresa || ''}</p></div></div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* OPRAVENÁ A STABILNÍ STRUKTURA PRO EXPORT DO PDF (Šířka 794px posunutá off-screen) */}
      {/* ========================================================================= */}
      <div style={{ position: 'absolute', left: '-9999px', top: '0px', width: '794px', overflow: 'visible', zIndex: -1000, backgroundColor: '#fff' }}>
        <div id="pdf-export-container" style={{ width: '794px', fontFamily: 'Arial, sans-serif', padding: '24px', boxSizing: 'border-box', backgroundColor: '#fff' }}>
          
          {/* ÚVODNÍ STRANA PROTOKOLU */}
          <div style={{ boxSizing: 'border-box', paddingBottom: '20px' }}>
            
            {/* HLAVIČKA S LOGEM PŘES NEPRŮSTŘELNOU TABULKU */}
            <table style={{ width: '100%', borderCollapse: 'collapse', borderBottom: '2px solid #000', paddingBottom: '12px', marginBottom: '25px' }}>
              <tbody>
                <tr>
                  <td style={{ textAlign: 'left', verticalAlign: 'middle', padding: '5px 0' }}>
                    <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b', letterSpacing: '2px', display: 'block', textTransform: 'uppercase' }}>BEZPEČNOST PRÁCE & POŽÁRNÍ OCHRANA</span>
                    <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#1e293b' }}>Profesionální auditorské a kontrolní systémy</span>
                  </td>
                  <td style={{ textAlign: 'right', verticalAlign: 'middle', width: '160px', padding: '5px 0' }}>
                    <img src="/logo.png" alt="BPyes Logo" style={{ maxHeight: '42px', width: 'auto', display: 'inline-block' }} />
                  </td>
                </tr>
              </tbody>
            </table>

            <div style={{ margin: '30px 0' }}>
              <h1 style={{ fontSize: '20px', fontWeight: '900', lineHeight: '1.3', borderLeft: '5px solid #000', paddingLeft: '15px', textTransform: 'uppercase', color: '#000', margin: 0 }}>
                {getFullInspectionTitle(record.typKontroly)}
              </h1>
              <div style={{ marginTop: '12px', fontSize: '11px', fontFamily: 'monospace', backgroundColor: '#f1f5f9', padding: '5px 10px', display: 'inline-block', border: '1px solid #cbd5e1', borderRadius: '4px' }}>
                ČÍSLO ZPRÁVY: {record.cislo} | REVIZE: R{record.revize || 0}
              </div>
            </div>

            {/* KONTROLOVANÉ SUBJEKTY PŘES NEPRŮSTŘELNOU TABULKU */}
            <table style={{ width: '100%', borderCollapse: 'collapse', borderTop: '1px solid #000', borderBottom: '1px solid #000', margin: '30px 0', backgroundColor: '#f8fafc' }}>
              <tbody>
                <tr>
                  <td style={{ width: '50%', verticalAlign: 'top', padding: '15px 15px 15px 0', fontSize: '11px', lineHeight: '1.6' }}>
                    <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '5px' }}>Zpracovatel / Poskytovatel:</span>
                    <strong style={{ fontSize: '14px', color: '#000', display: 'block', marginBottom: '2px' }}>BPyes s.r.o.</strong>
                    <span>Specializovaný poskytovatel služeb v oblasti rizik BOZP a PO</span><br />
                    <strong>IČO: 04399421</strong><br />
                    <span>E-mail: navratil@bpyes.cz | Web: www.bpyes.cz</span>
                  </td>
                  <td style={{ width: '50%', verticalAlign: 'top', padding: '15px 0 15px 15px', fontSize: '11px', lineHeight: '1.6', borderLeft: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '5px' }}>Kontrolovaný subjekt / Klient:</span>
                    <strong style={{ fontSize: '14px', color: '#000', display: 'block', marginBottom: '2px' }}>{klient?.nazev || 'Neznámý subjekt'}</strong>
                    <span>IČO: {klient?.ico || 'Neuvedeno'}</span><br />
                    <strong style={{ color: '#0f172a', display: 'block', marginTop: '8px' }}>Místo prověrky: {pracoviste?.nazev || 'Celý areál'}</strong>
                    <span style={{ color: '#475569' }}>{pracoviste?.adresa || ''}</span>
                  </td>
                </tr>
              </tbody>
            </table>

            <div style={{ border: '2px solid #000', padding: '12px', borderRadius: '6px', backgroundColor: '#f8fafc', margin: '30px 0' }}>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 'bold', color: '#0f172a', display: 'block', marginBottom: '4px' }}>Prohlášení a konstatování o seznámení:</span>
              <p style={{ fontSize: '11px', color: '#334155', margin: 0, textAlign: 'justify', lineHeight: '1.5' }}>
                Kontrolovaný subjekt / zástupce klienta svým níže uvedeným podpisem stvrzuje, že byl v plném rozsahu, prokazatelně a jasně seznámen se všemi zjištěnými legislativními nedostatky, systémovými neshodami a doporučeními, která jsou detailně specifikována uvnitř této auditní zprávy. Souhlasí s navrženými nápravnými opatřeními a zavazuje se k jejich vyřešení a odstranění v definovaných zákonných či dohodnutých termínech.
              </p>
            </div>

            {/* PODPISY PŘES NEPRŮSTŘELNOU TABULKU (Oprava zprohýbaných písmen) */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '60px' }}>
              <tbody>
                <tr>
                  <td style={{ width: '45%', textAlign: 'center', verticalAlign: 'top', paddingRight: '15px' }}>
                    <div style={{ borderBottom: '1px solid #000', width: '85%', margin: '0 auto 12px auto', height: '35px' }}></div>
                    <strong style={{ fontSize: '11px', textTransform: 'uppercase', display: 'block', color: '#000' }}>Provedl (Za BPyes):</strong>
                    <span style={{ fontSize: '10px', color: '#64748b', display: 'block', marginTop: '2px' }}>Oprávněný specialista BOZP a PO</span>
                    <span style={{ fontSize: '9px', color: '#94a3b8', display: 'block', marginTop: '2px' }}>Dne: {record.datum ? new Date(record.datum).toLocaleDateString('cs-CZ') : ''}</span>
                  </td>
                  <td style={{ width: '10%' }}></td>
                  <td style={{ width: '45%', textAlign: 'center', verticalAlign: 'top', paddingLeft: '15px' }}>
                    <div style={{ borderBottom: '1px solid #000', width: '85%', margin: '0 auto 12px auto', height: '35px' }}></div>
                    <strong style={{ fontSize: '11px', textTransform: 'uppercase', display: 'block', color: '#000' }}>Zástupce klienta / subjektu:</strong>
                    <span style={{ fontSize: '10px', color: '#64748b', display: 'block', marginTop: '2px' }}>Odpovědná osoba seznámená s reportem</span>
                    <span style={{ fontSize: '9px', color: '#94a3b8', display: 'block', marginTop: '2px' }}>Podpis / Razítko převzetí</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ pageBreakBefore: 'always' }}></div>

          {/* SEKCE 1: SHRNUTÍ A STATISTIKY */}
          <div style={{ padding: '10px 0' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase', borderBottom: '2px solid #000', paddingBottom: '5px', marginBottom: '20px', color: '#000' }}>
              1. Shrnutí a statistiky
            </h2>
            
            <table style={{ width: '100%', textAlign: 'center', borderCollapse: 'collapse', marginBottom: '25px' }}>
              <tbody>
                <tr>
                  <td style={{ width: '25%', padding: '10px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc' }}>
                    <strong style={{ fontSize: '18px', display: 'block', color: '#000' }}>{stats.total}</strong>
                    <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#475569' }}>CELKEM BODŮ</span>
                  </td>
                  <td style={{ width: '25%', padding: '10px', border: '1px solid #cbd5e1', backgroundColor: '#f0fdf4', color: '#166534' }}>
                    <strong style={{ fontSize: '18px', display: 'block' }}>{stats.V}</strong>
                    <span style={{ fontSize: '9px', fontWeight: 'bold' }}>VYHOVUJE</span>
                  </td>
                  <td style={{ width: '25%', padding: '10px', border: '1px solid #cbd5e1', backgroundColor: '#fef2f2', color: '#991b1b' }}>
                    <strong style={{ fontSize: '18px', display: 'block' }}>{stats.N}</strong>
                    <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#991b1b' }}>NESHODY (N)</span>
                  </td>
                  <td style={{ width: '25%', padding: '10px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', color: '#64748b' }}>
                    <strong style={{ fontSize: '18px', display: 'block' }}>{stats.NK + stats.NA}</strong>
                    <span style={{ fontSize: '9px', fontWeight: 'bold' }}>NEHODNOCENO</span>
                  </td>
                </tr>
              </tbody>
            </table>

            <div style={{ marginBottom: '25px' }}>
              <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Závěrečné vyhodnocení:</span>
              <div style={{ padding: '12px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', borderRadius: '4px', fontSize: '11px', fontStyle: 'italic', lineHeight: '1.5', textAlign: 'justify' }}>
                {record.poznamka || "Při prověrce nebylo vloženo žádné doprovodné textové hodnocení."}
              </div>
            </div>

            <div>
              <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Zúčastněné osoby:</span>
              <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse', border: '1px solid #e2e8f0' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 'bold', borderRight: '1px solid #e2e8f0' }}>Jméno a příjmení</th>
                    <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 'bold' }}>Pracovní pozice / Vztah k subjektu</th>
                  </tr>
                </thead>
                <tbody>
                  {record.ucastnici && record.ucastnici.length > 0 ? (
                    record.ucastnici.map((u: any, i: number) => (
                      <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '6px 10px', fontWeight: 'medium', borderRight: '1px solid #e2e8f0' }}>{u.jmeno || 'Neuvedeno'}</td>
                        <td style={{ padding: '6px 10px', color: '#475569' }}>{u.pozice || 'Bez zařazení'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={2} style={{ padding: '10px', fontStyle: 'italic', color: '#64748b', textAlign: 'center' }}>Nebyly zapsány žádné osoby.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ pageBreakBefore: 'always' }}></div>

          {/* SEKCE 2: DYNAMICKÝ PROTOKOL (Respektuje filtry závad a vypnutých sekcí) */}
          <div style={{ padding: '10px 0' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase', borderBottom: '2px solid #000', paddingBottom: '5px', marginBottom: '20px', color: '#000' }}>
              2. {onlyDefects ? "Registr zjištěných nedostatků a nápravných opatření" : "Kompletní auditní protokol zjištění"}
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filteredKontrolniBody.map((kb: any) => {
                const isDefect = kb.hodnoceni === 'N';
                return (
                  <div key={kb.id || kb.bod} style={{ border: '1px solid #cbd5e1', borderRadius: '4px', padding: '10px', backgroundColor: '#fff', pageBreakInside: 'avoid' }}>
                    
                    {/* Indexový řádek přes tabulku */}
                    <table style={{ width: '100%', borderCollapse: 'collapse', borderBottom: '1px solid #f1f5f9', paddingBottom: '4px', marginBottom: '6px' }}>
                      <tbody>
                        <tr>
                          <td style={{ textAlign: 'left', fontSize: '11px', fontWeight: 'bold', color: '#000', padding: '2px 0' }}>
                            <span style={{ color: isDefect ? '#991b1b' : '#166534', marginRight: '6px' }}>[{kb.bod}]</span> 
                            KAPITOLA: <span style={{ textTransform: 'uppercase', color: '#475569', fontSize: '10px' }}>{kb.sekce || 'Ostatní'}</span>
                          </td>
                          <td style={{ textAlign: 'right', fontSize: '9px', fontWeight: 'bold', color: isDefect ? '#991b1b' : '#166534', textTransform: 'uppercase', padding: '2px 0' }}>
                            {isDefect ? '❌ NESHODA / ZÁVADA' : kb.hodnoceni === 'V' ? '✅ VYHOVUJE' : '– NEHODNOCENO'}
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    <div style={{ fontSize: '11px', marginBottom: '6px' }}>
                      <span style={{ fontSize: '8px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase', display: 'block' }}>Kontrolovaný bod / Otázka:</span>
                      <strong style={{ color: '#0f172a' }}>{kb.otazka || kb.popis}</strong>
                    </div>

                    {/* Vnitřní specifikace závady (vygeneruje se pouze v případě neshody) */}
                    {isDefect && (
                      <>
                        <table style={{ width: '100%', fontSize: '10px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '3px', marginBottom: '6px', borderCollapse: 'collapse' }}>
                          <tbody>
                            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                              <td style={{ padding: '6px', width: '60%', verticalAlign: 'top', borderRight: '1px solid #e2e8f0' }}>
                                <span style={{ fontSize: '8px', color: '#64748b', fontWeight: 'bold', display: 'block', textTransform: 'uppercase' }}>Návrh nápravného opatření:</span>
                                <span style={{ color: '#334155', display: 'block', marginTop: '2px' }}>{kb.navrhOpatreni}</span>
                              </td>
                              <td style={{ padding: '6px', width: '40%', verticalAlign: 'top' }}>
                                <span style={{ fontSize: '8px', color: '#64748b', fontWeight: 'bold', display: 'block', textTransform: 'uppercase' }}>Přesná lokalizace:</span>
                                <strong style={{ color: '#1e3a8a', display: 'block', marginTop: '2px' }}>{kb.lokalizace || 'Objekt společnosti'}</strong>
                              </td>
                            </tr>
                          </tbody>
                        </table>

                        <table style={{ width: '100%', fontSize: '10px', borderCollapse: 'collapse' }}>
                          <tbody>
                            <tr>
                              <td style={{ width: '33%', verticalAlign: 'middle' }}>
                                <span style={{ fontSize: '8px', color: '#94a3b8', display: 'block' }}>Termín splnění:</span>
                                <strong style={{ fontFamily: 'monospace', fontSize: '10px' }}>{kb.terminOdstraneni ? new Date(kb.terminOdstraneni).toLocaleDateString('cs-CZ') : 'Neurčeno'}</strong>
                              </td>
                              <td style={{ width: '33%', verticalAlign: 'middle' }}>
                                <span style={{ fontSize: '8px', color: '#94a3b8', display: 'block' }}>Odpovědná pozice:</span>
                                <strong style={{ textTransform: 'uppercase', fontSize: '9px' }}>{kb.odpovednaOsoba || 'Neuvedena'}</strong>
                              </td>
                              <td style={{ width: '33%', textAlign: 'right', verticalAlign: 'middle' }}>
                                <span style={{ fontSize: '8px', color: '#94a3b8', display: 'block' }}>Stav závady:</span>
                                <strong style={{ color: kb.stavOdstraneni === 'odstranena' ? '#166534' : '#991b1b', fontSize: '9px' }}>
                                  {kb.stavOdstraneni === 'odstranena' ? '✅ ODSTRANĚNO' : '❌ NEVYŘEŠENO'}
                                </strong>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </>
                    )}

                    {kb.doporuceni && !isDefect && (
                      <div style={{ fontSize: '10px', padding: '6px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '3px', color: '#1e3a8a', fontStyle: 'italic' }}>
                        <strong>Doporučení auditora:</strong> "{kb.doporuceni}"
                      </div>
                    )}

                    {kb.foto && (
                      <div style={{ marginTop: '8px', borderTop: '1px dashed #cbd5e1', paddingTop: '6px' }}>
                        <span style={{ fontSize: '8px', color: '#94a3b8', display: 'block', marginBottom: '3px' }}>Důkazní fotodokumentace:</span>
                        <img src={kb.foto} alt="Důkaz" style={{ maxHeight: '130px', width: 'auto', borderRadius: '3px', border: '1px solid #cbd5e1' }} />
                      </div>
                    )}
                  </div>
                );
              })}

              {filteredKontrolniBody.length === 0 && (
                <p style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic', textAlign: 'center', padding: '30px', border: '1px dashed #cbd5e1', borderRadius: '4px' }}>
                  Pro zvolené filtry nebyly nalezeny žádné body protokolu.
                </p>
              )}
            </div>
          </div>

          {/* SEKCE 3: DOPORUČENÍ (Zobrazí se pouze pro zapnuté sekce) */}
          {filteredDoporuceni.length > 0 && (
            <>
              <div style={{ pageBreakBefore: 'always' }}></div>
              <div style={{ padding: '10px 0' }}>
                <h2 style={{ fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase', borderBottom: '2px solid #000', paddingBottom: '5px', marginBottom: '20px', color: '#1e3a8a' }}>
                  3. Doporučení pro zvýšení úrovně bezpečnosti
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {filteredDoporuceni.map((kb: any) => (
                    <div key={kb.id || kb.bod} style={{ padding: '8px 12px', border: '1px solid #bfdbfe', backgroundColor: '#eff6ff', borderRadius: '4px', fontSize: '11px', pageBreakInside: 'avoid' }}>
                      <strong style={{ color: '#1e40af', display: 'block', marginBottom: '2px' }}>Kontrolní bod č. {kb.bod} ({kb.sekce || 'Ostatní'})</strong>
                      <span style={{ color: '#1e293b', fontStyle: 'italic' }}>"{kb.doporuceni}"</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
