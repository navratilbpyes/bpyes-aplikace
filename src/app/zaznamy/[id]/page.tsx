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
  FileText,
  Loader2,
  Edit,
  Users
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
  
  const pracovisteList = useMemo(() => {
    if (!klient || !record) return [];
    const prac = klient.pracoviste || [];
    
    if (record.pracovisteIds && Array.isArray(record.pracovisteIds)) {
      return prac.filter(p => record.pracovisteIds.includes(p.id));
    }
    
    if (record.pracovisteId) {
      const oldPrac = prac.find(p => p.id === record.pracovisteId);
      return oldPrac ? [oldPrac] : [];
    }

    return [];
  }, [klient, record]);

  const [filterPosition, setFilterPosition] = useState<string>("all");
  const [onlyDefects, setOnlyDefects] = useState<boolean>(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailText, setEmailText] = useState("");

  const allSectionsInRecord = useMemo(() => {
    const sections = new Set<string>();
    if (record?.kontrolniBody) {
      record.kontrolniBody.forEach((kb: any) => {
        if (kb.sekce) sections.add(kb.sekce);
      });
    }
    return Array.from(sections) as string[];
  }, [record]);

  const [visibleSections, setVisibleSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    if (record?.kontrolniBody) {
      record.kontrolniBody.forEach((kb: any) => {
        if (kb.sekce) initial[kb.sekce] = true;
      });
    }
    return initial;
  }, [record]);

  const toggleSection = (sectionName: string) => {
    setVisibleSections(prev => ({ ...prev, [sectionName]: !prev[sectionName] }));
  };

  const uniquePositionsInRecord = useMemo(() => {
    if (!record?.kontrolniBody) return [];
    const positions = record.kontrolniBody
      .filter((kb: any) => kb.hodnoceni === 'N' && kb.odpovednaOsoba)
      .map((kb: any) => kb.odpovednaOsoba);
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
    const cleanKlient = (klient.nazev || "Neznamy").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9\s]/g, "").trim();
    const cleanDate = (record.datum || "").replace(/-/g, "");
    const cleanType = record.typKontroly || "KONTROLA";
    const rev = record.revize !== undefined ? `R${record.revize}` : "R0";
    const positionSuffix = filterPosition !== "all" ? `_${filterPosition.replace(/\s+/g, "")}` : "";
    const safeCislo = (record.cislo || "zaznam").replace(/\//g, "-");
    return `${safeCislo}_${cleanType}_${cleanKlient}_${cleanDate}_${rev}${positionSuffix}.pdf`;
  }, [record, klient, filterPosition]);

  const getFullInspectionTitle = (type: string) => {
    switch (type) {
      case "BOZPaPO": return "PROVĚRKA BOZP A PREVENTIVNÍ POŽÁRNÍ PROHLÍDKA, KONTROLA DOKUMENTACE POŽÁRNÍ OCHRANY";
      case "PBOZP": return "PROVĚRKA BOZP";
      case "PPP": return "PREVENTIVNÍ POŽÁRNÍ PROHLÍDKA";
      default: return "ZPRÁVA Z KONTROLY BOZP A PO";
    }
  };

  const handleDownloadPDF = async () => {
    setIsGeneratingPDF(true);
    toast({ title: "Připravuji PDF", description: "Dokument se generuje a číslují se stránky..." });

    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const element = document.getElementById('pdf-export-container');
      const wrapper = document.getElementById('pdf-wrapper');

      if (wrapper) {
        wrapper.style.left = '0px';
        wrapper.style.top = '0px';
        wrapper.style.zIndex = '-9999';
      }

      await new Promise(resolve => setTimeout(resolve, 300));

      const opt = {
        margin:       [20, 15, 20, 15], 
        filename:     pdfFileName,
        image:        { type: 'jpeg', quality: 1 },
        html2canvas:  { 
          scale: 2, 
          useCORS: true, 
          logging: false,
          windowWidth: 794,
          width: 794
        },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak:    { mode: ['css', 'legacy'], avoid: '.avoid-break' }
      };

      await html2pdf()
        .set(opt)
        .from(element)
        .toPdf()
        .get('pdf')
        .then((pdf: any) => {
          const totalPages = pdf.internal.getNumberOfPages();
          
          for (let i = 1; i <= totalPages; i++) {
            pdf.setPage(i);
            pdf.setFontSize(8);
            pdf.setTextColor(150);

            // ZÁHLAVÍ - čistě a jednoduše
            pdf.text('BPyes s.r.o.', 15, 12);

            // ZÁPATÍ
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            
            pdf.text(pdfFileName, 15, pageHeight - 12);
            
            const pageString = `Strana ${i} z ${totalPages}`;
            const textWidth = pdf.getTextWidth(pageString);
            pdf.text(pageString, pageWidth - 15 - textWidth, pageHeight - 12);
          }
        })
        .save();

      toast({ title: "Úspěch", description: "PDF bylo úspěšně staženo." });
    } catch (error) {
      console.error("Chyba PDF:", error);
      toast({ title: "Chyba generování", description: "Nastala chyba při vytváření PDF.", variant: "destructive" });
    } finally {
      const wrapper = document.getElementById('pdf-wrapper');
      if (wrapper) {
        wrapper.style.left = '-9999px';
      }
      setIsGeneratingPDF(false);
    }
  };

  if (!record) {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-muted-foreground italic">Záznam nebyl v databázi nalezen.</p>
        <Button onClick={() => router.push("/")}><ChevronLeft className="mr-2 h-4 w-4" /> Návrat na přehled</Button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8 pb-24 relative overflow-hidden">
      
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
          <Button variant="secondary" className="h-11 shadow-sm" onClick={() => toast({ title: "Připravuje se", description: "Funkce editace záznamu bude zprovozněna v další fázi." })}>
            <Edit className="h-4 w-4 mr-2" /> Upravit záznam
          </Button>
        </div>
      </div>

      <Card className="border-blue-100 bg-blue-50/20">
        <CardHeader className="py-4 space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-3">
            <div>
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-blue-900"><FileText className="h-4 w-4" /> Manažerský dispečink pro exporty</CardTitle>
              <CardDescription className="text-xs">Nastavené filtry a skryté sekce se okamžitě přenesou i do tištěného PDF reportu.</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              {uniquePositionsInRecord.length > 0 && (
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
              )}
              <div className="flex items-center space-x-2 bg-white px-3 py-2 rounded-md border shadow-sm h-10">
                <Checkbox id="onlyDefects" checked={onlyDefects} onCheckedChange={(checked) => setOnlyDefects(!!checked)} />
                <label htmlFor="onlyDefects" className="text-xs font-bold text-slate-700 cursor-pointer select-none">Pouze neshody a závady</label>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">Zahrnout kapitoly auditu do protokolu:</span>
            <div className="flex flex-wrap gap-2 pt-1">
              {allSectionsInRecord.map(sec => (
                <div key={sec} className={cn("flex items-center space-x-2 border px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-colors cursor-pointer select-none", visibleSections[sec] !== false ? "bg-white border-blue-200 text-blue-900" : "bg-slate-100 text-slate-400 border-slate-200 line-through")} onClick={() => toggleSection(sec)}>
                  <Checkbox id={`sec-${sec}`} checked={visibleSections[sec] !== false} className="pointer-events-none" />
                  <span>{sec}</span>
                </div>
              ))}
              {allSectionsInRecord.length === 0 && <span className="text-xs text-muted-foreground italic">Tato kontrola neobsahuje uložené informace o sekcích.</span>}
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card className="border-none shadow-sm">
            <CardHeader><CardTitle className="text-lg">{onlyDefects ? "Registr zjištěných neshod a závad" : "Kompletní protokol prověrky"} ({filteredKontrolniBody.length})</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {filteredKontrolniBody.map((kb: any) => {
                const isDefect = kb.hodnoceni === 'N';
                return (
                  <div key={kb.id || kb.bod} className={cn("p-4 border rounded-xl space-y-3 transition-colors", isDefect ? "bg-white border-slate-200 shadow-sm" : "bg-slate-50/40 border-slate-100 text-slate-600")}>
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex items-center gap-2">
                        <span className={cn("font-mono text-xs font-bold h-6 w-6 rounded-md flex items-center justify-center shrink-0", isDefect ? "bg-red-100 text-red-800" : kb.hodnoceni === 'V' ? "bg-green-100 text-green-800" : "bg-slate-200 text-slate-600")}>
                          {kb.bod}
                        </span>
                        <div>
                          <h4 className="font-bold text-[14px] leading-tight">{kb.otazka || kb.popis || 'Bez popisu'}</h4>
                          <span className="text-[10px] text-muted-foreground font-bold uppercase">{kb.sekce || 'Ostatní'}</span>
                        </div>
                      </div>
                      <span className={cn("text-[10px] font-bold uppercase px-2 py-0.5 rounded border shrink-0", isDefect ? "bg-amber-50 text-amber-700 border-amber-200" : kb.hodnoceni === 'V' ? "bg-green-50 text-green-700 border-green-200" : "bg-slate-100 text-slate-600 border-slate-200")}>
                        {isDefect ? 'Neshoda' : kb.hodnoceni === 'V' ? 'Vyhovuje' : 'Nehodnoceno'}
                      </span>
                    </div>

                    {isDefect && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-muted/30 p-3 rounded-lg border">
                        <div><span className="text-muted-foreground block mb-0.5">Návrh opatření:</span><p className="font-medium text-slate-900">{kb.navrhOpatreni || 'Není definováno'}</p></div>
                        <div><span className="text-muted-foreground block mb-0.5">Místo zjištění:</span><p className="font-bold text-blue-900">{kb.lokalizace || 'Celé pracoviště'}</p></div>
                        <div><span className="text-muted-foreground block mb-0.5">Termín odstranění:</span><p className="font-medium">{kb.terminOdstraneni ? new Date(kb.terminOdstraneni).toLocaleDateString('cs-CZ') : 'Neurčeno'}</p></div>
                        <div><span className="text-muted-foreground block mb-0.5">Odpovědná pozice:</span><p className="font-bold text-black">{kb.odpovednaOsoba || 'Neuvedena'}</p></div>
                      </div>
                    )}
                    {kb.foto && <img src={kb.foto} alt="Důkaz" className="h-32 w-auto object-cover rounded-lg border mt-2" />}
                  </div>
                );
              })}
              {filteredKontrolniBody.length === 0 && <p className="text-muted-foreground italic text-center py-12">Žádné body k zobrazení pro zvolené nastavení.</p>}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-none shadow-sm bg-white">
            <CardHeader><CardTitle className="text-sm uppercase tracking-wider text-muted-foreground font-bold">Detaily kontroly</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex gap-3"><Building className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" /><div><span className="text-xs text-muted-foreground block">Klient</span><p className="font-bold">{klient?.nazev || 'Neznámý'}</p><p className="text-xs text-muted-foreground">IČO: {klient?.ico || ''}</p></div></div>
              <div className="flex gap-3"><MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs text-muted-foreground block">Pracoviště</span>
                  <p className="font-bold">{pracovisteList.map(p => p.nazev).join(', ') || 'Neznámé'}</p>
                  <p className="text-xs text-muted-foreground">{pracovisteList.map(p => p.adresa).join(', ') || ''}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-white">
            <CardHeader><CardTitle className="text-sm uppercase tracking-wider text-muted-foreground font-bold flex items-center gap-2"><Users className="h-4 w-4 text-slate-500" /> Zúčastněné osoby</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {record?.ucastnici && record.ucastnici.length > 0 ? (
                record.ucastnici.map((u: any, i: number) => (
                  <div key={i} className="border-b pb-2 last:border-0 last:pb-0">
                    <p className="font-bold text-slate-900">{u.jmeno || 'Neuvedeno'}</p>
                    <p className="text-xs text-muted-foreground">{u.pozice || 'Bez specifické pozice'}</p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground italic">Nebyly zapsány žádné osoby.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div id="pdf-wrapper" style={{ position: 'absolute', left: '-9999px', top: '0px', width: '794px', zIndex: -1000 }}>
        <div id="pdf-export-container" style={{ width: '794px', backgroundColor: '#ffffff', color: '#000000', padding: '0px', boxSizing: 'border-box', fontFamily: 'Arial, sans-serif', wordBreak: 'break-word' }}>
          
          <div style={{ boxSizing: 'border-box', paddingBottom: '20px' }}>
            <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', borderBottom: '2px solid #000', paddingBottom: '12px', marginBottom: '25px' }}>
              <tbody>
                <tr>
                  <td style={{ textAlign: 'left', verticalAlign: 'middle', padding: '5px 0' }}>
                    <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b', letterSpacing: '2px', display: 'block', textTransform: 'uppercase' }}>BEZPEČNOST PRÁCE & POŽÁRNÍ OCHRANA</span>
                    <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#1e293b' }}>Profesionální auditorské a kontrolní systémy</span>
                  </td>
                  <td style={{ textAlign: 'right', verticalAlign: 'middle', width: '160px', padding: '5px 0' }}>
                    <img src="/logo.png" alt="Logo" style={{ maxHeight: '42px', maxWidth: '100%', objectFit: 'contain' }} />
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

            <div style={{ border: '1px solid #cbd5e1', padding: '15px', marginBottom: '12px', backgroundColor: '#f8fafc', borderRadius: '4px' }}>
              <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '5px' }}>Zpracovatel / Poskytovatel:</span>
              <strong style={{ fontSize: '14px', color: '#000', display: 'block', marginBottom: '2px' }}>BPyes s.r.o.</strong>
              <span style={{ fontSize: '11px', color: '#334155' }}>Specializovaný poskytovatel služeb v oblasti rizik BOZP a PO | <strong>IČO: 04399421</strong> | E-mail: navratil@bpyes.cz</span>
            </div>

            <div style={{ border: '1px solid #cbd5e1', padding: '15px', marginBottom: '30px', backgroundColor: '#f8fafc', borderRadius: '4px' }}>
              <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '5px' }}>Kontrolovaný subjekt / Klient:</span>
              <strong style={{ fontSize: '14px', color: '#000', display: 'block', marginBottom: '2px' }}>{klient?.nazev || 'Neznámý subjekt'}</strong>
              <span style={{ fontSize: '11px', color: '#334155', display: 'block', marginBottom: '6px' }}>IČO: {klient?.ico || 'Neuvedeno'}</span>
              <strong style={{ fontSize: '11px', color: '#0f172a' }}>Místo prověrky: {pracovisteList.map(p => p.nazev).join(', ') || 'Celý areál'}</strong><br />
              <span style={{ fontSize: '11px', color: '#475569' }}>{pracovisteList.map(p => p.adresa).join(', ') || ''}</span>
            </div>

            <div style={{ border: '2px solid #000', padding: '12px', borderRadius: '6px', backgroundColor: '#f8fafc', margin: '30px 0' }}>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 'bold', color: '#0f172a', display: 'block', marginBottom: '4px' }}>Prohlášení a konstatování o seznámení:</span>
              <p style={{ fontSize: '11px', color: '#334155', margin: 0, textAlign: 'justify', lineHeight: '1.5' }}>
                Kontrolovaný subjekt / zástupce klienta svým níže uvedeným podpisem stvrzuje, že byl v plném rozsahu, prokazatelně a jasně seznámen se všemi zjištěnými legislativními nedostatky, systémovými neshodami a doporučeními, která jsou detailně specifikována uvnitř této auditní zprávy. Souhlasí s navrženými nápravnými opatřeními a zavazuje se k jejich vyřešení a odstranění v definovaných zákonných či dohodnutých termínech.
              </p>
            </div>

            <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', marginTop: '60px' }}>
              <tbody>
                <tr>
                  <td style={{ width: '45%', textAlign: 'center', verticalAlign: 'top' }}>
                    <div style={{ borderBottom: '1px solid #000', width: '90%', margin: '0 auto 12px auto', height: '25px' }}></div>
                    <strong style={{ fontSize: '11px', textTransform: 'uppercase', display: 'block', color: '#000' }}>Provedl (Za BPyes):</strong>
                    <span style={{ fontSize: '10px', color: '#64748b', display: 'block', marginTop: '2px' }}>Specialista BOZP a PO</span>
                  </td>
                  <td style={{ width: '10%' }}></td>
                  <td style={{ width: '45%', textAlign: 'center', verticalAlign: 'top' }}>
                    <div style={{ borderBottom: '1px solid #000', width: '90%', margin: '0 auto 12px auto', height: '25px' }}></div>
                    <strong style={{ fontSize: '11px', textTransform: 'uppercase', display: 'block', color: '#000' }}>Zástupce klienta / subjektu:</strong>
                    <span style={{ fontSize: '10px', color: '#64748b', display: 'block', marginTop: '2px' }}>Osoba seznámená s reportem</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ pageBreakBefore: 'always', height: '1px', clear: 'both' }}></div>

          <div style={{ padding: '10px 0' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase', borderBottom: '2px solid #000', paddingBottom: '5px', marginBottom: '20px', color: '#000' }}>
              1. Shrnutí a statistiky
            </h2>
            <table style={{ width: '100%', tableLayout: 'fixed', textAlign: 'center', borderCollapse: 'collapse', marginBottom: '25px' }}>
              <tbody>
                <tr>
                  <td style={{ width: '25%', padding: '10px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc' }}>
                    <strong style={{ fontSize: '18px', display: 'block', color: '#000' }}>{stats.total}</strong><span style={{ fontSize: '9px', fontWeight: 'bold', color: '#475569' }}>CELKEM BODŮ</span>
                  </td>
                  <td style={{ width: '25%', padding: '10px', border: '1px solid #cbd5e1', backgroundColor: '#f0fdf4', color: '#166534' }}>
                    <strong style={{ fontSize: '18px', display: 'block' }}>{stats.V}</strong><span style={{ fontSize: '9px', fontWeight: 'bold' }}>VYHOVUJE</span>
                  </td>
                  <td style={{ width: '25%', padding: '10px', border: '1px solid #cbd5e1', backgroundColor: '#fef2f2', color: '#991b1b' }}>
                    <strong style={{ fontSize: '18px', display: 'block' }}>{stats.N}</strong><span style={{ fontSize: '9px', fontWeight: 'bold', color: '#991b1b' }}>NESHODY (N)</span>
                  </td>
                  <td style={{ width: '25%', padding: '10px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', color: '#64748b' }}>
                    <strong style={{ fontSize: '18px', display: 'block' }}>{stats.NK + stats.NA}</strong><span style={{ fontSize: '9px', fontWeight: 'bold' }}>NEHODNOCENO</span>
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

            <div className="avoid-break" style={{ marginTop: '25px', pageBreakInside: 'avoid' }}>
              <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Zúčastněné osoby:</span>
              <table style={{ width: '100%', tableLayout: 'fixed', fontSize: '11px', borderCollapse: 'collapse', border: '1px solid #cbd5e1' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                    <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 'bold', borderRight: '1px solid #cbd5e1', width: '50%' }}>Jméno a příjmení</th>
                    <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 'bold', width: '50%' }}>Pracovní pozice / Vztah k subjektu</th>
                  </tr>
                </thead>
                <tbody>
                  {record?.ucastnici && record.ucastnici.length > 0 ? (
                    record.ucastnici.map((u: any, i: number) => (
                      <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '6px 10px', fontWeight: 'medium', borderRight: '1px solid #cbd5e1', wordWrap: 'break-word' }}>{u.jmeno || 'Neuvedeno'}</td>
                        <td style={{ padding: '6px 10px', color: '#475569', wordWrap: 'break-word' }}>{u.pozice || 'Bez zařazení'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={2} style={{ padding: '10px', fontStyle: 'italic', color: '#64748b', textAlign: 'center' }}>Nebyly zapsány žádné osoby.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ pageBreakBefore: 'always', height: '1px', clear: 'both' }}></div>

          <div style={{ padding: '10px 0' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase', borderBottom: '2px solid #000', paddingBottom: '5px', marginBottom: '20px', color: '#000' }}>
              2. {onlyDefects ? "Registr zjištěných nedostatků a nápravných opatření" : "Kompletní auditní protokol zjištění"}
            </h2>
            {/* OPRAVA BLOKU ZÁVAD: Žádný flexbox, pouze čisté HTML bloky */}
            <div style={{ display: 'block' }}>
              {filteredKontrolniBody.map((kb: any) => {
                const isDefect = kb.hodnoceni === 'N';
                return (
                  <div key={kb.id || kb.bod} className="avoid-break" style={{ marginBottom: '12px', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '10px', backgroundColor: '#fff', pageBreakInside: 'avoid', display: 'block' }}>
                    <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', borderBottom: '1px solid #f1f5f9', paddingBottom: '4px', marginBottom: '6px' }}>
                      <tbody>
                        <tr>
                          <td style={{ textAlign: 'left', fontSize: '11px', fontWeight: 'bold', color: '#000' }}>
                            <span style={{ color: isDefect ? '#991b1b' : '#166534', marginRight: '6px' }}>[{kb.bod}]</span> KAPITOLA: <span style={{ textTransform: 'uppercase', color: '#475569', fontSize: '10px' }}>{kb.sekce || 'Ostatní'}</span>
                          </td>
                          <td style={{ textAlign: 'right', fontSize: '9px', fontWeight: 'bold', color: isDefect ? '#991b1b' : '#166534' }}>
                            {isDefect ? '❌ NESHODA' : kb.hodnoceni === 'V' ? '✅ VYHOVUJE' : '– NEHODNOCENO'}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    <div style={{ fontSize: '11px', marginBottom: '6px' }}>
                      <span style={{ fontSize: '8px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase', display: 'block' }}>Kontrolovaný bod / Otázka:</span>
                      <strong style={{ color: '#0f172a' }}>{kb.otazka || kb.popis || 'Bez popisu'}</strong>
                    </div>
                    {isDefect && (
                      <table style={{ width: '100%', tableLayout: 'fixed', fontSize: '10px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', marginBottom: '6px', borderCollapse: 'collapse' }}>
                        <tbody>
                          <tr>
                            <td style={{ padding: '6px', width: '55%', verticalAlign: 'top', borderRight: '1px solid #e2e8f0' }}>
                              <span style={{ fontSize: '8px', color: '#64748b', fontWeight: 'bold', display: 'block', textTransform: 'uppercase' }}>Návrh opatření:</span>
                              <span style={{ color: '#334155', display: 'block', marginTop: '2px' }}>{kb.navrhOpatreni || 'Není definováno'}</span>
                            </td>
                            <td style={{ padding: '6px', width: '45%', verticalAlign: 'top' }}>
                              <span style={{ fontSize: '8px', color: '#64748b', fontWeight: 'bold', display: 'block', textTransform: 'uppercase' }}>Lokalizace a termín:</span>
                              <strong style={{ color: '#1e3a8a', display: 'block', marginTop: '2px' }}>{kb.lokalizace || 'Objekt společnosti'}</strong>
                              <span style={{ display: 'block', marginTop: '4px' }}>Termín: {kb.terminOdstraneni ? new Date(kb.terminOdstraneni).toLocaleDateString('cs-CZ') : 'Neurčeno'}</span>
                              <span style={{ display: 'block', marginTop: '2px' }}>Pozice: {kb.odpovednaOsoba || 'Neuvedena'}</span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    )}
                    {kb.foto && (
                      <div style={{ marginTop: '6px' }}>
                        <img src={kb.foto} alt="Důkaz" style={{ maxHeight: '130px', width: 'auto', borderRadius: '3px', border: '1px solid #cbd5e1' }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
