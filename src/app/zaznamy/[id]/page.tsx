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

  const uniquePositionsInRecord = useMemo(() => {
    if (!record?.zavady) return [];
    const positions = record.zavady.map((z: any) => z.odpovednaOsoba).filter(Boolean);
    return Array.from(new Set(positions)) as string[];
  }, [record]);

  const filteredZavady = useMemo(() => {
    if (!record?.zavady) return [];
    return record.zavady.filter((z: any) => {
      if (filterPosition !== "all" && z.odpovednaOsoba !== filterPosition) return false;
      return true;
    });
  }, [record, filterPosition]);

  const filteredDoporuceni = useMemo(() => {
    if (!record?.kontrolniBody) return [];
    return record.kontrolniBody.filter((kb: any) => kb.showDoporuceni && kb.doporuceni && kb.doporuceni.trim() !== "");
  }, [record]);

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
        margin:       [12, 12, 15, 12],
        filename:     pdfFileName,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 4, useCORS: true, logging: false, windowWidth: 800 },
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

      <Card className="border-blue-100 bg-blue-50/20">
        <CardHeader className="py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div><CardTitle className="text-sm font-bold flex items-center gap-2 text-blue-900"><FileText className="h-4 w-4" /> Manažerský dispečink</CardTitle><CardDescription className="text-xs">Filtry ovlivňují i tištěné PDF.</CardDescription></div>
          <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-md border shadow-sm w-full md:w-64">
              <span className="text-xs font-bold text-muted-foreground shrink-0">Pozice:</span>
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
              <label id="onlyDefects" className="text-xs font-bold text-slate-700 cursor-pointer select-none">Pouze neshody a závady</label>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Webový náhled aplikace */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card className="border-none shadow-sm">
            <CardHeader><CardTitle className="text-lg">Zjištěné závady a neshody ({filteredZavady.length})</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {filteredZavady.map((z: any) => (
                <div key={z.id} className="p-4 border rounded-xl space-y-3 bg-white shadow-sm">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex items-center gap-2"><span className="font-mono bg-red-100 text-red-800 text-xs font-bold h-6 w-6 rounded-full flex items-center justify-center shrink-0">{z.bodKontroly || '*'}</span><h4 className="font-bold text-[15px]">{z.popis}</h4></div>
                    <span className={cn("text-[10px] font-bold uppercase px-2 py-0.5 rounded border shrink-0", z.stavOdstraneni === 'odstranena' ? "bg-green-50 text-green-700 border-green-200" : "bg-amber-50 text-amber-700 border-amber-200")}>{z.stavOdstraneni === 'odstranena' ? 'Odstraněno' : 'Otevřeno'}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-muted/30 p-3 rounded-lg border">
                    <div><span className="text-muted-foreground block mb-0.5">Návrh opatření:</span><p className="font-medium">{z.navrhOpatreni}</p></div>
                    {z.lokalizace && <div><span className="text-muted-foreground block mb-0.5">Místo zjištění:</span><p className="font-medium text-blue-900">{z.lokalizace}</p></div>}
                    <div><span className="text-muted-foreground block mb-0.5">Termín odstranění:</span><p className="font-medium">{z.terminOdstraneni ? new Date(z.terminOdstraneni).toLocaleDateString('cs-CZ') : 'Neurčeno'}</p></div>
                    <div><span className="text-muted-foreground block mb-0.5">Odpovědná pracovní pozice:</span><p className="font-bold text-black">{z.odpovednaOsoba || 'Neuvedena'}</p></div>
                  </div>
                  {z.foto && <img src={z.foto} alt="Důkaz" className="h-32 w-auto object-cover rounded-lg border mt-2 shadow-inner" />}
                </div>
              ))}
              {filteredZavady.length === 0 && <p className="text-muted-foreground italic text-center py-12">Žádné neshody k zobrazení.</p>}
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
      {/* FINÁLNÍ BEZPEČNÁ PDF ŠABLONA (Pevný viewport, font Arial, fixní texty) */}
      {/* ========================================================================= */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '800px', height: 0, overflow: 'hidden', zIndex: -1000 }}>
        <div id="pdf-export-container" className="bg-white text-black" style={{ width: '800px', fontFamily: 'Arial, sans-serif', padding: '15px' }}>
          
          {/* ÚVODNÍ STRANA PROTOKOLU */}
          <div style={{ minHeight: '1020px', position: 'relative', boxSizing: 'border-box' }}>
            <table style={{ width: '100%', borderBottom: '2px solid #000', paddingBottom: '15px', marginBottom: '30px' }}>
              <tbody>
                <tr>
                  <td style={{ textAlign: 'left' }}>
                    <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b', letterSpacing: '2px', display: 'block', textTransform: 'uppercase' }}>BEZPEČNOST PRÁCE & POŽÁRNÍ OCHRANA</span>
                    <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#1e293b' }}>Profesionální auditorské a kontrolní systémy</span>
                  </td>
                  <td style={{ textAlign: 'right', width: '150px' }}>
                    <div style={{ border: '3px solid #000', padding: '5px 10px', textAlign: 'center', fontWeight: 'black', fontSize: '24px', fontFamily: 'Arial Black, sans-serif' }}>
                      BP<span style={{ fontSize: '16px', fontWeight: 'bold' }}>yes</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>

            <div style={{ margin: '40px 0' }}>
              <h1 style={{ fontSize: '22px', fontWeight: '900', lineHeight: '1.3', borderLeft: '5px solid #000', paddingLeft: '15px', textTransform: 'uppercase', color: '#000' }}>
                {getFullInspectionTitle(record.typKontroly)}
              </h1>
              <div style={{ marginTop: '15px', fontSize: '12px', fontFamily: 'monospace', backgroundColor: '#f1f5f9', padding: '6px 12px', display: 'inline-block', border: '1px solid #cbd5e1', borderRadius: '4px' }}>
                ČÍSLO ZPRÁVY: {record.cislo} | REVIZE: R{record.revize || 0}
              </div>
            </div>

            <table style={{ width: '100%', borderTop: '1px solid #000', borderBottom: '1px solid #000', padding: '20px 0', margin: '40px 0', backgroundColor: '#f8fafc' }}>
              <tbody>
                <tr>
                  <td style={{ width: '50%', verticalAlign: 'top', paddingRight: '20px', fontSize: '11px', lineHeight: '1.5' }}>
                    <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '5px' }}>Zpracovatel / Poskytovatel:</span>
                    <strong style={{ fontSize: '14px', color: '#000', display: 'block', marginBottom: '2px' }}>BPyes s.r.o.</strong>
                    <span>Specializovaný poskytovatel služeb v oblasti rizik BOZP a PO</span><br />
                    <strong>IČO: 04399421</strong><br />
                    <span>E-mail: navratil@bpyes.cz | Web: www.bpyes.cz</span>
                  </td>
                  <td style={{ width: '50%', verticalAlign: 'top', paddingLeft: '20px', fontSize: '11px', lineHeight: '1.5', borderLeft: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '5px' }}>Kontrolovaný subjekt / Klient:</span>
                    <strong style={{ fontSize: '14px', color: '#000', display: 'block', marginBottom: '2px' }}>{klient?.nazev || 'Neznámý subjekt'}</strong>
                    <span>IČO: {klient?.ico || 'Neuvedeno'}</span><br />
                    <strong style={{ color: '#0f172a', display: 'block', marginTop: '5px' }}>Místo prověrky: {pracoviste?.nazev || 'Celý areál'}</strong>
                    <span style={{ color: '#475569' }}>{pracoviste?.adresa || ''}</span>
                  </td>
                </tr>
              </tbody>
            </table>

            <div style={{ border: '2px solid #000', padding: '15px', borderRadius: '6px', backgroundColor: '#f8fafc', margin: '40px 0' }}>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 'bold', color: '#0f172a', display: 'block', marginBottom: '4px' }}>Prohlášení a konstatování o seznámení:</span>
              <p style={{ fontSize: '11px', color: '#334155', margin: 0, textAlign: 'justify', lineHeight: '1.5' }}>
                Kontrolovaný subjekt / zástupce klienta svým níže uvedeným podpisem stvrzuje, že byl v plném rozsahu, prokazatelně a jasně seznámen se všemi zjištěnými legislativními nedostatky, systémovými neshodami a doporučeními, která jsou detailně specifikována uvnitř této auditní zprávy. Souhlasí s navrženými nápravnými opatřeními a zavazuje se k jejich vyřešení a odstranění v definovaných zákonných či dohodnutých termínech.
              </p>
            </div>

            <table style={{ width: '100%', marginTop: '80px', borderTop: '1px solid #cbd5e1', paddingTop: '30px' }}>
              <tbody>
                <tr>
                  <td style={{ width: '50%', paddingRight: '30px', textAlign: 'center' }}>
                    <div style={{ borderBottom: '1px solid #000', width: '80%', margin: '0 auto 15px auto', height: '40px' }}></div>
                    <strong style={{ fontSize: '11px', textTransform: 'uppercase', display: 'block' }}>Provedl (Za BPyes):</strong>
                    <span style={{ fontSize: '10px', color: '#64748b' }}>Oprávněný specialista BOZP a PO</span><br />
                    <span style={{ fontSize: '9px', color: '#94a3b8' }}>Dne: {record.datum ? new Date(record.datum).toLocaleDateString('cs-CZ') : ''}</span>
                  </td>
                  <td style={{ width: '50%', paddingLeft: '30px', textAlign: 'center' }}>
                    <div style={{ borderBottom: '1px solid #000', width: '80%', margin: '0 auto 15px auto', height: '40px' }}></div>
                    <strong style={{ fontSize: '11px', textTransform: 'uppercase', display: 'block' }}>Zástupce klienta / subjektu:</strong>
                    <span style={{ fontSize: '10px', color: '#64748b' }}>Odpovědná osoba seznámená s reportem</span><br />
                    <span style={{ fontSize: '9px', color: '#94a3b8' }}>Podpis / Razítko převzetí</span>
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
                    <span style={{ fontSize: '9px', fontWeight: 'bold' }}>NESHODY (N)</span>
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
              <table style={{ width: '100%', textLeft: 'left', fontSize: '11px', borderCollapse: 'collapse', border: '1px solid #e2e8f0' }}>
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
                    <tr><td colSpan={2} style={{ padding: '10px', textStyle: 'italic', color: '#64748b', textAlign: 'center' }}>Nebyly zapsány žádné osoby.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ pageBreakBefore: 'always' }}></div>

          {/* SEKCE 2: REGISTR ZJIŠTĚNÝCH NEDOSTATKŮ (Kompaktní design) */}
          <div style={{ padding: '10px 0' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase', borderBottom: '2px solid #000', paddingBottom: '5px', marginBottom: '20px', color: '#000' }}>
              2. Registr zjištěných nedostatků a nápravných opatření
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {filteredZavady.map((z: any) => (
                <div key={z.id} style={{ border: '1px solid #cbd5e1', borderRadius: '4px', padding: '10px', backgroundColor: '#fff', pageBreakInside: 'avoid' }}>
                  
                  {/* Horní úzká lišta indexu */}
                  <table style={{ width: '100%', borderBottom: '1px solid #f1f5f9', paddingBottom: '4px', marginBottom: '6px' }}>
                    <tbody>
                      <tr>
                        <td style={{ textAlign: 'left', fontSize: '11px', fontWeight: 'bold', color: '#000' }}>
                          <span style={{ color: '#991b1b', marginRight: '6px' }}>[{z.bodKontroly || '*'}]</span> NESHODA V KONTROLNÍM BODU
                        </td>
                        <td style={{ textAlign: 'right', fontSize: '9px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' }}>
                          {z.zavaznost === 'critical' ? '🔴 KRITICKÁ' : z.zavaznost === 'high' ? '🟠 VYSOKÁ' : '🟡 STŘEDNÍ'} PRIORITY
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Obsah - Popis neshody */}
                  <div style={{ fontSize: '11px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '9px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase', display: 'block' }}>Popis zjištěné závady:</span>
                    <strong style={{ color: '#0f172a' }}>{z.popis}</strong>
                  </div>

                  {/* Detaily a řešení */}
                  <table style={{ width: '100%', fontSize: '10px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '3px', marginBottom: '6px', borderCollapse: 'collapse' }}>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '5px', width: '60%', verticalAlign: 'top', borderRight: '1px solid #e2e8f0' }}>
                          <span style={{ fontSize: '8px', color: '#64748b', fontWeight: 'bold', display: 'block', textTransform: 'uppercase' }}>Návrh opatření:</span>
                          <span style={{ color: '#334155' }}>{z.navrhOpatreni}</span>
                        </td>
                        <td style={{ padding: '5px', width: '40%', verticalAlign: 'top' }}>
                          <span style={{ fontSize: '8px', color: '#64748b', fontWeight: 'bold', display: 'block', textTransform: 'uppercase' }}>Místo zjištění:</span>
                          <strong style={{ color: '#1e3a8a' }}>{z.lokalizace || 'Areál společnosti'}</strong>
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Spodní řádek odpovědnosti a termínu */}
                  <table style={{ width: '100%', fontSize: '10px' }}>
                    <tbody>
                      <tr>
                        <td style={{ width: '33%' }}>
                          <span style={{ fontSize: '8px', color: '#94a3b8', display: 'block' }}>Termín nápravy:</span>
                          <strong style={{ fontFamily: 'monospace' }}>{z.terminOdstraneni ? new Date(z.terminOdstraneni).toLocaleDateString('cs-CZ') : 'Neurčeno'}</strong>
                        </td>
                        <td style={{ width: '33%' }}>
                          <span style={{ fontSize: '8px', color: '#94a3b8', display: 'block' }}>Odpovědná pozice:</span>
                          <strong style={{ textTransform: 'uppercase' }}>{z.odpovednaOsoba || 'Neuvedena'}</strong>
                        </td>
                        <td style={{ width: '33%', textAlign: 'right' }}>
                          <span style={{ fontSize: '8px', color: '#94a3b8', display: 'block' }}>Stav řešení:</span>
                          <strong style={{ color: z.stavOdstraneni === 'odstranena' ? '#166534' : '#991b1b' }}>
                            {z.stavOdstraneni === 'odstranena' ? '✅ ODSTRANĚNO' : '❌ NEVYŘEŠENO'}
                          </strong>
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Kompaktní zobrazení fotografie */}
                  {z.foto && (
                    <div style={{ marginTop: '8px', borderTop: '1px dashed #cbd5e1', paddingTop: '6px' }}>
                      <span style={{ fontSize: '8px', color: '#94a3b8', display: 'block', marginBottom: '3px' }}>Fotodokumentace:</span>
                      <img src={z.foto} alt="Důkaz neshody" style={{ maxHeight: '140px', width: 'auto', borderRadius: '3px', border: '1px solid #cbd5e1' }} />
                    </div>
                  )}
                </div>
              ))}

              {filteredZavady.length === 0 && (
                <p style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic', textAlign: 'center', padding: '30px', border: '1px dashed #cbd5e1', borderRadius: '4px' }}>
                  Nebyly nalezeny žádné neshody.
                </p>
              )}
            </div>
          </div>

          {/* SEKCE 3: DOPORUČENÍ */}
          {filteredDoporuceni.length > 0 && (
            <>
              <div style={{ pageBreakBefore: 'always' }}></div>
              <div style={{ padding: '10px 0' }}>
                <h2 style={{ fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase', borderBottom: '2px solid #000', paddingBottom: '5px', marginBottom: '20px', color: '#1e3a8a' }}>
                  3. Doporučení pro zvýšení úrovně bezpečnosti
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {filteredDoporuceni.map((kb: any) => (
                    <div key={kb.bod} style={{ padding: '8px 12px', border: '1px solid #bfdbfe', backgroundColor: '#eff6ff', borderRadius: '4px', fontSize: '11px', pageBreakInside: 'avoid' }}>
                      <strong style={{ color: '#1e40af', display: 'block', marginBottom: '2px' }}>Kontrolní bod č. {kb.bod}</strong>
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
