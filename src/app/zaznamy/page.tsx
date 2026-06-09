'use client';

import { useData } from "@/components/data-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useState, useMemo, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  ChevronLeft, 
  Printer, 
  Mail, 
  AlertTriangle, 
  Calendar, 
  Building, 
  MapPin, 
  Clock, 
  CheckCircle,
  Eye,
  FileText
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

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

  const pdfFileName = useMemo(() => {
    if (!record || !klient) return "export.pdf";
    const cleanKlient = klient.nazev.replace(/[^a-zA-Z0-9\s]/g, "").trim();
    const cleanDate = (record.datum || "").replace(/-/g, "");
    const cleanType = record.typKontroly || "KONTROLA";
    const rev = record.revize !== undefined ? `R${record.revize}` : "R0";
    const positionSuffix = filterPosition !== "all" ? `_${filterPosition.replace(/\s+/g, "")}` : "";
    
    return `${record.cislo.replace(/\//g, "-")}_${cleanType}_${cleanKlient}_${cleanDate}_${rev}${positionSuffix}`;
  }, [record, klient, filterPosition]);

  useEffect(() => {
    if (record) {
      document.title = pdfFileName;
    }
    return () => {
      document.title = "BPyes — Auditní systém";
    };
  }, [pdfFileName, record]);

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
      case "BOZPaPO":
        return "PROVĚRKA BOZP A PREVENTIVNÍ POŽÁRNÍ PROHLÍDKA, KONTROLA DOKUMENTACE POŽÁRNÍ OCHRANY";
      case "PBOZP":
        return "PROVĚRKA BOZP";
      case "PPP":
        return "PREVENTIVNÍ POŽÁRNÍ PROHLÍDKA";
      default:
        return "ZPRÁVA Z KONTROLY BOZP A PO";
    }
  };

  const handleSendEmail = () => {
    toast({
      title: "E-mail odeslán",
      description: `Report byl úspěšně vygenerován a odeslán na adresu ${emailTo || "technika"}.`,
    });
    setShowEmailModal(false);
  };

  const triggerEmailModal = () => {
    setEmailTo(filterPosition !== "all" ? `udrzba@${klient?.nazev.toLowerCase().replace(/[^a-z]/g, "") || "firma"}.cz` : "");
    setEmailText(`Dobrý den,\n\nv příloze Vám zasílám vygenerovaný přehled zjištěných neshod a opatření z prověrky BOZP a PO konané dne ${new Date(record.datum).toLocaleDateString('cs-CZ')}.\n\n` + 
      (filterPosition !== "all" ? `Tento výpis obsahuje výhradně úkoly určené pro pracovní pozici: ${filterPosition}.\n\n` : "") +
      `Prosím o zajištění nápravy v uvedených termínech.\n\nS pozdravem,\nTým BPyes`);
    setShowEmailModal(true);
  };

  // Vylepšená, robustní funkce pro vyvolání tisku s nepatrným zpožděním pro stabilizaci DOMu
  const handlePrint = () => {
    try {
      setTimeout(() => {
        window.print();
      }, 150);
    } catch (error) {
      console.error("Došlo k chybě při pokusu o tisk:", error);
      toast({
        title: "Chyba tisku",
        description: "Váš prohlížeč zablokoval tiskové okno. Ujistěte se, že aplikaci nemáte otevřenou jen v náhledu.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8 pb-24 relative">
      
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 animate-in fade-in">
          <Card className="w-full max-w-lg shadow-2xl">
            <CardHeader>
              <CardTitle>Odeslat report e-mailem</CardTitle>
              <CardDescription>
                Distribuce vygenerovaného PDF {filterPosition !== "all" ? `pro pozici: ${filterPosition}` : "celkového reportu"}.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>E-mail příjemce</Label>
                <Input type="email" placeholder="např. udrzba@firma.cz" value={emailTo} onChange={(e) => setEmailTo(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Předmět e-mailu</Label>
                <Input readOnly value={`BPyes Auditní zpráva: ${record.cislo} ${filterPosition !== "all" ? `(${filterPosition})` : ""}`} className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>Text zprávy</Label>
                <Textarea rows={7} value={emailText} onChange={(e) => setEmailText(e.target.value)} />
              </div>
            </CardContent>
            <div className="p-4 border-t flex justify-end gap-2 bg-muted/20">
              <Button variant="outline" onClick={() => setShowEmailModal(false)}>Zrušit</Button>
              <Button onClick={handleSendEmail}><Mail className="h-4 w-4 mr-2" /> Odeslat report</Button>
            </div>
          </Card>
        </div>
      )}

      <style jsx global>{`
        @media print {
          body {
            background: #fff !important;
            color: #000 !important;
            font-size: 11pt !important;
          }
          .print-hidden, nav, header, footer, button, .no-print {
            display: none !important;
          }
          .print-page {
            display: block !important;
            page-break-before: always !important;
          }
          .print-cover {
            display: block !important;
            min-height: 100vh;
            page-break-after: always !important;
          }
          .defect-card {
            page-break-inside: avoid !important;
            border: 1px solid #ccc !important;
            margin-bottom: 15px !important;
            padding: 15px !important;
          }
          table {
            page-break-inside: auto;
          }
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
        }
      `}</style>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-6 print-hidden">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="p-0 h-auto text-muted-foreground" onClick={() => router.push("/")}>
              <ChevronLeft className="h-4 w-4" /> Zpět na seznam
            </Button>
            <span className="text-xs font-bold uppercase tracking-wider text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-200">
              {record.stav === 'uzavreny' ? 'Uzavřený report' : 'Koncept'}
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{record.cislo} <span className="text-muted-foreground font-normal text-xl">R{record.revize || 0}</span></h1>
          <p className="text-sm text-muted-foreground">Provedeno dne {new Date(record.datum).toLocaleDateString('cs-CZ')}</p>
        </div>

        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <Button variant="outline" className="h-11 shadow-sm" onClick={handlePrint} type="button">
            <Printer className="h-4 w-4 mr-2" /> Tisk PDF reportu
          </Button>
          <Button variant="outline" className="h-11 shadow-sm" onClick={triggerEmailModal} type="button">
            <Mail className="h-4 w-4 mr-2" /> Distribuce e-mailem
          </Button>
          <Button className="h-11 shadow-sm" onClick={() => toast({ title: "Informace", description: "Stránka úpravy (Možnost A) bude nasazena v další fází vývoje." })} type="button">
            Upravit záznam
          </Button>
        </div>
      </div>

      <Card className="print-hidden border-blue-100 bg-blue-50/20">
        <CardHeader className="py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-blue-900">
              <FileText className="h-4 w-4" /> Manažerský dispečink pro exporty a údržbu
            </CardTitle>
            <CardDescription className="text-xs">Vyfiltrujte si data na obrazovce. Výsledný tisk PDF se filtru plně přizpůsobí.</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-md border shadow-sm w-full md:w-64">
              <span className="text-xs font-bold text-muted-foreground shrink-0">Pozice:</span>
              <Select value={filterPosition} onValueChange={setFilterPosition}>
                <SelectTrigger className="h-7 border-none p-0 focus:ring-0 shadow-none text-xs font-bold">
                  <SelectValue placeholder="Filtrovat pozici" />
                </SelectTrigger>
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 print-hidden">
        <div className="md:col-span-2 space-y-6">
          <Card className="border-none shadow-sm">
            <CardHeader><CardTitle className="text-lg">Zjištěné závady, neshody a doporučení ({filteredZavady.length})</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {filteredZavady.map((z: any) => (
                <div key={z.id} className="p-4 border rounded-xl space-y-3 bg-white shadow-sm hover:border-amber-200 transition-colors">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono bg-red-100 text-red-800 text-xs font-bold h-6 w-6 rounded-full flex items-center justify-center shrink-0">
                        {z.bodKontroly || '*'}
                      </span>
                      <h4 className="font-bold text-[15px]">{z.popis}</h4>
                    </div>
                    <span className={cn(
                      "text-[10px] font-bold uppercase px-2 py-0.5 rounded border shrink-0",
                      z.stavOdstraneni === 'odstranena' ? "bg-green-50 text-green-700 border-green-200" : "bg-amber-50 text-amber-700 border-amber-200"
                    )}>
                      {z.stavOdstraneni === 'odstranena' ? 'Odstraněno' : 'Otevřeno'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-muted/30 p-3 rounded-lg border">
                    <div><span className="text-muted-foreground block mb-0.5">Návrh opatření:</span><p className="font-medium">{z.navrhOpatreni}</p></div>
                    {z.lokalizace && <div><span className="text-muted-foreground block mb-0.5">Místo zjištění:</span><p className="font-medium text-blue-900">{z.lokalizace}</p></div>}
                    <div><span className="text-muted-foreground block mb-0.5">Termín odstranění:</span><p className="font-medium">{new Date(z.terminOdstraneni).toLocaleDateString('cs-CZ')}</p></div>
                    <div><span className="text-muted-foreground block mb-0.5">Odpovědná pracovní pozice:</span><p className="font-bold text-black">{z.odpovednaOsoba || 'Neuvedena'}</p></div>
                  </div>

                  {z.foto && <img src={z.foto} alt="Důkaz" className="h-32 w-auto object-cover rounded-lg border mt-2 shadow-inner" />}
                </div>
              ))}

              {filteredZavady.length === 0 && (
                <p className="text-muted-foreground italic text-center py-12">Pro zvolenou pozici nebyly nalezeny žádné neshody.</p>
              )}
            </CardContent>
          </Card>

          {!onlyDefects && filteredDoporuceni.length > 0 && (
            <Card className="border-none shadow-sm border-l-4 border-l-blue-500 bg-blue-50/10">
              <CardHeader><CardTitle className="text-lg text-blue-900">Doporučení k vyhovujícím bodům ({filteredDoporuceni.length})</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {filteredDoporuceni.map((kb: any) => (
                  <div key={kb.bod} className="p-3 bg-white border border-blue-100 rounded-lg text-sm space-y-1">
                    <p className="font-bold text-blue-900">Bod {kb.bod}.</p>
                    <p className="text-muted-foreground italic">"{kb.doporuceni}"</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card className="border-none shadow-sm bg-white">
            <CardHeader><CardTitle className="text-sm uppercase tracking-wider text-muted-foreground font-bold">Detaily kontroly</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex gap-3"><Building className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" /><div><span className="text-xs text-muted-foreground block">Klient</span><p className="font-bold">{klient?.nazev}</p><p className="text-xs text-muted-foreground">IČO: {klient?.ico}</p></div></div>
              <div className="flex gap-3"><MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" /><div><span className="text-xs text-muted-foreground block">Pracoviště / Lokace</span><p className="font-bold">{pracoviste?.nazev}</p><p className="text-xs text-muted-foreground">{pracoviste?.adresa}</p></div></div>
              <div className="flex gap-3"><Clock className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" /><div><span className="text-xs text-muted-foreground block">Vytvořeno v systému</span><p className="font-medium">{new Date(record.createdAt).toLocaleString('cs-CZ')}</p></div></div>
              {record.poznamka && (
                <div className="pt-3 border-t bg-amber-50/40 p-3 rounded-lg border border-amber-100"><span className="text-xs font-bold text-amber-900 block mb-1">Závěrečné hodnocení:</span><p className="text-xs text-amber-950 italic">{record.poznamka}</p></div>
              )}
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader><CardTitle className="text-sm uppercase tracking-wider text-muted-foreground font-bold">Účastníci prověrky</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {record.ucastnici?.map((u: any, i: number) => (
                <div key={i} className="flex items-center gap-2 bg-muted/40 p-2 rounded-md border text-xs">
                  <UserIcon className="h-3 w-3 text-muted-foreground" />
                  <div><p className="font-bold">{u.jmeno || 'Neuvedeno'}</p><p className="text-[10px] text-muted-foreground">{u.pozice || 'Bez pozice'}</p></div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="hidden print:block font-sans text-black">
        <div className="print-cover flex flex-col justify-between" style={{ minHeight: '270mm', padding: '10mm 5mm 15mm 5mm' }}>
          <div className="flex justify-between items-start border-b-2 border-black pb-6">
            <div>
              <span className="text-xs uppercase font-bold text-slate-500 tracking-widest block">BEZPEČNOST PRÁCE & POŽÁRNÍ OCHRANA</span>
              <span className="text-sm font-semibold tracking-wide text-slate-800">Profesionální auditorské a kontrolní systémy</span>
            </div>
            <svg width="140" height="90" viewBox="0 0 140 90" className="shrink-0">
              <path d="M 10 50 A 55 50 0 0 1 125 55" fill="none" stroke="black" strokeWidth="6" strokeLinecap="round"/>
              <text x="15" y="62" fontFamily="Arial Black, Impact, sans-serif" fontSize="36" fontWeight="900" fill="black">BP</text>
              <text x="70" y="72" fontFamily="Arial, sans-serif" fontSize="20" fontWeight="bold" fill="black">yes</text>
              <path d="M 68 78 A 30 15 0 0 0 135 68" fill="none" stroke="black" strokeWidth="3" strokeLinecap="round"/>
            </svg>
          </div>

          <div className="my-12 space-y-4">
            <h1 className="text-2xl font-black tracking-tight leading-tight border-l-4 border-black pl-4">
              {getFullInspectionTitle(record.typKontroly)}
            </h1>
            <div className="text-md font-mono bg-slate-100 p-2 inline-block rounded border">
              ČÍSLO ZPRÁVY: {record.cislo} | REVIZE: R{record.revize || 0}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 border-t border-b border-black py-8 my-6 bg-slate-50/50">
            <div className="space-y-2">
              <span className="text-xs uppercase font-bold text-slate-500 tracking-wider block">Zpracovatel / Poskytovatel:</span>
              <p className="text-base font-black">BPyes s.r.o.</p>
              <p className="text-xs text-slate-700">Specializovaný poskytovatel služeb v oblasti rizik BOZP a PO</p>
              <p className="text-xs text-slate-700">IČO: 87654321</p>
              <p className="text-xs text-slate-700">E-mail: info@bpyes.cz | Web: www.bpyes.cz</p>
            </div>
            <div className="space-y-2">
              <span className="text-xs uppercase font-bold text-slate-500 tracking-wider block">Kontrolovaný subjekt / Klient:</span>
              <p className="text-base font-black">{klient?.nazev}</p>
              <p className="text-xs text-slate-700">IČO: {klient?.ico || 'Neuvedeno'}</p>
              <p className="text-xs font-bold text-slate-900">Místo prověrky: {pracoviste?.nazev}</p>
              <p className="text-xs text-slate-600">{pracoviste?.adresa}</p>
            </div>
          </div>

          <div className="p-4 border-2 border-black rounded-lg bg-slate-50 my-6">
            <span className="text-xs uppercase font-bold tracking-wider text-slate-900 block mb-1">Prohlášení a konstatování o seznámení:</span>
            <p className="text-xs text-slate-800 leading-relaxed text-justify">
              Kontrolovaný subjekt / zástupce klienta svým níže uvedeným podpisem stvrzuje, že byl v plném rozsahu, prokazatelně a jasně seznámen se všemi zjištěnými legislativními nedostatky, systémovými neshodami a doporučeními, která jsou detailně specifikována uvnitř této auditní zprávy. Souhlasí s navrženými nápravnými opatřeními a zavazuje se k jejich vyřešení a odstranění v definovaných zákonných či dohodnutých termínech.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-12 pt-12 mt-12 border-t border-slate-300">
            <div className="space-y-12">
              <div className="border-b border-black w-full h-12"></div>
              <div className="text-center">
                <p className="font-bold text-sm uppercase">Provedl (Za BPyes):</p>
                <p className="text-xs text-slate-500">Oprávněný specialista BOZP a PO</p>
                <p className="text-[10px] text-slate-400">Dne: {new Date(record.datum).toLocaleDateString('cs-CZ')}</p>
              </div>
            </div>
            <div className="space-y-12">
              <div className="border-b border-black w-full h-12"></div>
              <div className="text-center">
                <p className="font-bold text-sm uppercase">Zástupce klienta / subjektu:</p>
                <p className="text-xs text-slate-500">Odpovědná osoba seznámená s reportem</p>
                <p className="text-[10px] text-slate-400">Podpis / Razítko převzetí</p>
              </div>
            </div>
          </div>
        </div>

        <div className="print-page py-6 space-y-6" style={{ padding: '10mm 5mm' }}>
          <h2 className="text-lg font-bold uppercase border-b-2 border-black pb-2 tracking-wide">1. Manažerské shrnutí a statistiky</h2>
          
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <div className="p-3 border bg-slate-50 font-bold"><span className="text-xl block font-black">{totalPoints}</span>CELKEM BODŮ</div>
            <div className="p-3 border border-green-300 bg-green-50 text-green-900 font-bold"><span className="text-xl block font-black">{stats.V}</span>VYHOVUJE</div>
            <div className="p-3 border border-red-300 bg-red-50 text-red-900 font-bold"><span className="text-xl block font-black">{stats.N}</span>NESHODY (N)</div>
            <div className="p-3 border bg-slate-50 text-slate-700 font-bold"><span className="text-xl block font-black">{stats.NK + stats.data?.NA || stats.NK}</span>NEKONTROLOVÁNO</div>
          </div>

          <div className="space-y-2 pt-4">
            <h3 className="text-sm font-bold uppercase text-slate-700">Závěrečné vyhodnocení specialisty:</h3>
            <div className="p-4 border bg-slate-50/50 rounded-lg text-sm text-justify italic leading-relaxed">
              {record.poznamka || "Při prověrce nebylo vloženo žádné doprovodné textové hodnocení."}
            </div>
          </div>

          <div className="space-y-2 pt-4">
            <h3 className="text-sm font-bold uppercase text-slate-700">Účastníci prověrky uvedení v protokolu:</h3>
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-t"><th className="p-2 font-bold">Jméno a příjmení</th><th className="p-2 font-bold">Pracovní pozice / Vztah k subjektu</th></tr>
              </thead>
              <tbody>
                {record.ucastnici?.map((u: any, i: number) => (
                  <tr key={i} className="border-b">
                    <td className="p-2 font-medium">{u.jmeno || 'Neuvedeno'}</td>
                    <td className="p-2">{u.pozice || 'Bez zařazení'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="print-page py-6 space-y-6" style={{ padding: '10mm 5mm' }}>
          <h2 className="text-lg font-bold uppercase border-b-2 border-black pb-2 tracking-wide flex justify-between items-center">
            <span>2. Registr zjištěných nedostatků a nápravných opatření</span>
            {filterPosition !== "all" && <span className="text-xs font-normal lowercase bg-slate-100 px-2 py-1 rounded border">Filtr pozice: {filterPosition}</span>}
          </h2>

          <div className="space-y-4">
            {filteredZavady.map((z: any) => (
              <div key={z.id} className="defect-card rounded-lg bg-white">
                <div className="flex justify-between items-start border-b pb-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold bg-black text-white text-xs h-5 w-5 rounded-full flex items-center justify-center">
                      {z.bodKontroly || '*'}
                    </span>
                    <span className="text-xs uppercase tracking-wider font-bold text-slate-500">Neshoda v kontrolním bodu</span>
                  </div>
                  
                  {z.zavaznost && (
                    <span className="text-[9px] font-bold uppercase border px-2 py-0.5 rounded bg-slate-50">
                      Priorita: {z.zavaznost === 'critical' ? 'KRITICKÁ' : z.zavaznost === 'high' ? 'VYSOKÁ' : 'STŘEDNÍ'}
                    </span>
                  )}
                </div>

                <div className="space-y-3 text-sm">
                  <div>
                    <span className="text-xs text-slate-500 uppercase font-bold block">Popis zjištěné závady:</span>
                    <p className="font-bold text-slate-900">{z.popis}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded border text-xs">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-bold block mb-0.5">Návrh legislativního opatření:</span>
                      <p className="font-medium text-slate-800">{z.navrhOpatreni}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-bold block mb-0.5">Lokalizace / Přesné místo:</span>
                      <p className="font-bold text-blue-950">{z.lokalizace || 'Celá společnost / společnost'}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-1 text-xs">
                    <div><span className="text-[10px] text-slate-400 block">Zákonný termín:</span><p className="font-mono font-bold">{new Date(z.terminOdstraneni).toLocaleDateString('cs-CZ')}</p></div>
                    <div><span className="text-[10px] text-slate-400 block">Odpovědná pozice:</span><p className="font-bold uppercase text-slate-900">{z.odpovednaOsoba || 'Neuvedena'}</p></div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Stav řešení:</span>
                      <p className="font-bold text-slate-800">{z.stavOdstraneni === 'odstranena' ? '✅ ODSTRANĚNO' : '❌ NEVYŘEŠENO'}</p>
                    </div>
                  </div>

                  {z.foto && (
                    <div className="pt-2">
                      <span className="text-[10px] text-slate-400 block mb-1">Průkazná fotodokumentace:</span>
                      <img src={z.foto} alt="Důkaz z prověrky" className="h-44 w-auto object-cover rounded border border-slate-300" />
                    </div>
                  )}
                </div>
              </div>
            ))}

            {filteredZavady.length === 0 && (
              <p className="text-sm text-slate-500 italic text-center py-12 border rounded-lg border-dashed">
                V této vyfiltrované sekci nebyly pro danou pozici zjištěny žádné legislativní neshody.
              </p>
            )}
          </div>
        </div>

        {filteredDoporuceni.length > 0 && (
          <div className="print-page py-6 space-y-6" style={{ padding: '10mm 5mm' }}>
            <h2 className="text-lg font-bold uppercase border-b-2 border-black pb-2 tracking-wide text-blue-900">
              3. Doporučení pro zvýšení celkové úrovně bezpečnosti (Vyhovující body)
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Následující body byly při prověrce vyhodnoceny jako legislativně vyhovující, specialisté BPyes však doporučují provést níže uvedené úpravy pro dosažení vyšší štábní kultury a eliminace budoucích rizik.
            </p>

            <div className="space-y-3">
              {filteredDoporuceni.map((kb: any) => (
                <div key={kb.bod} className="p-3 border border-blue-200 bg-blue-50/20 rounded-md text-xs space-y-1">
                  <p className="font-bold text-blue-900">Kontrolní bod č. {kb.bod}</p>
                  <p className="text-slate-800 italic">"{kb.doporuceni}"</p>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
