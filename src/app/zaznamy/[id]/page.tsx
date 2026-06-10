'use client';

import { useData } from "@/components/data-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useState, useMemo, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  ChevronLeft, 
  Printer, 
  Building, 
  MapPin, 
  FileText,
  Loader2,
  Edit,
  Users
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/app/lib/utils";
import { 
  Document, 
  Page, 
  Text, 
  View, 
  StyleSheet, 
  Font, 
  PDFDownloadLink, 
  Image as PdfImage 
} from '@react-pdf/renderer';

// Registrace fontu pro správné zobrazení české diakritiky
Font.register({
  family: 'Roboto',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/roboto/v27/KFOmCnqEu92Fr1Me5WZLCzYlKw.ttf', fontWeight: 400 },
    { src: 'https://fonts.gstatic.com/s/roboto/v27/KFOlCnqEu92Fr1MmWUlvAx05IsDqlA.ttf', fontWeight: 700 }
  ]
});

// Styly pro naše nové nativní PDF
const styles = StyleSheet.create({
  page: { padding: '20mm', fontFamily: 'Roboto', fontSize: 10, color: '#334155' },
  header: { flexDirection: 'row', justifyContent: 'space-between', borderBottom: '1 solid #000', paddingBottom: 5, marginBottom: 20 },
  headerText: { fontSize: 8, color: '#64748b', textTransform: 'uppercase', fontWeight: 700 },
  footer: { position: 'absolute', bottom: '10mm', left: '20mm', right: '20mm', flexDirection: 'row', justifyContent: 'space-between', fontSize: 8, color: '#64748b' },
  h1: { fontSize: 18, fontWeight: 700, color: '#000', textTransform: 'uppercase', marginBottom: 10, borderLeft: '4 solid #000', paddingLeft: 10 },
  h2: { fontSize: 12, fontWeight: 700, color: '#000', textTransform: 'uppercase', borderBottom: '1 solid #000', paddingBottom: 4, marginBottom: 15, marginTop: 20 },
  box: { border: '1 solid #cbd5e1', padding: 12, borderRadius: 4, marginBottom: 10, backgroundColor: '#f8fafc' },
  boxTitle: { fontSize: 8, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 },
  textBold: { fontWeight: 700, color: '#000', fontSize: 12 },
  textDark: { color: '#0f172a', fontWeight: 700 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  statBoxContainer: { flexDirection: 'row', marginBottom: 20 },
  statBox: { flex: 1, border: '1 solid #cbd5e1', padding: 10, alignItems: 'center' },
  statNumber: { fontSize: 16, fontWeight: 700, color: '#000', marginBottom: 2 },
  statLabel: { fontSize: 7, fontWeight: 700, textTransform: 'uppercase', color: '#64748b' },
  tableHeader: { backgroundColor: '#f1f5f9', borderBottom: '1 solid #cbd5e1', flexDirection: 'row', padding: 6 },
  tableRow: { borderBottom: '1 solid #e2e8f0', flexDirection: 'row', padding: 6 },
  col1: { flex: 1, borderRight: '1 solid #cbd5e1', paddingRight: 6 },
  col2: { flex: 1, paddingLeft: 6 },
  defectCard: { border: '1 solid #cbd5e1', borderRadius: 4, padding: 10, marginBottom: 10, backgroundColor: '#fff' },
  defectHeader: { flexDirection: 'row', justifyContent: 'space-between', borderBottom: '1 solid #f1f5f9', paddingBottom: 4, marginBottom: 6 },
  badgeN: { color: '#991b1b', fontWeight: 700, fontSize: 8 },
  badgeV: { color: '#166534', fontWeight: 700, fontSize: 8 },
  defectInfoBox: { flexDirection: 'row', backgroundColor: '#f8fafc', border: '1 solid #e2e8f0', padding: 6 },
  image: { marginTop: 10, objectFit: 'contain', maxHeight: 150 }
});

// Nativní PDF komponenta
const AuditPDF = ({ record, klient, pracovisteList, stats, filteredKontrolniBody, onlyDefects, pdfFileName, getFullInspectionTitle }: any) => (
  <Document>
    <Page size="A4" style={styles.page}>
      
      {/* Opakující se Záhlaví */}
      <View style={styles.header} fixed>
        <Text style={styles.headerText}>BPyes s.r.o.</Text>
      </View>

      <Text style={styles.h1}>{getFullInspectionTitle(record.typKontroly)}</Text>
      <Text style={{ fontSize: 9, backgroundColor: '#f1f5f9', padding: 4, alignSelf: 'flex-start', marginBottom: 20 }}>
        ČÍSLO ZPRÁVY: {record.cislo} | REVIZE: R{record.revize || 0}
      </Text>

      <View style={styles.box}>
        <Text style={styles.boxTitle}>Zpracovatel / Poskytovatel:</Text>
        <Text style={styles.textBold}>BPyes s.r.o.</Text>
        <Text>IČO: 04399421 | E-mail: navratil@bpyes.cz</Text>
      </View>

      <View style={styles.box}>
        <Text style={styles.boxTitle}>Kontrolovaný subjekt / Klient:</Text>
        <Text style={styles.textBold}>{klient?.nazev || 'Neznámý subjekt'}</Text>
        <Text>IČO: {klient?.ico || 'Neuvedeno'}</Text>
        <Text style={{ marginTop: 6, fontWeight: 700 }}>Místo prověrky: {pracovisteList.map((p:any) => p.nazev).join(', ') || 'Celý areál'}</Text>
        <Text>{pracovisteList.map((p:any) => p.adresa).join(', ') || ''}</Text>
      </View>

      <View style={{ ...styles.box, border: '2 solid #000' }}>
        <Text style={{ ...styles.boxTitle, color: '#000' }}>Prohlášení a konstatování o seznámení:</Text>
        <Text style={{ lineHeight: 1.4 }}>
          Kontrolovaný subjekt / zástupce klienta svým podpisem stvrzuje, že byl v plném rozsahu seznámen se všemi zjištěnými nedostatky specifikovanými uvnitř této zprávy. Souhlasí s navrženými opatřeními a zavazuje se k jejich odstranění.
        </Text>
      </View>

      <Text style={styles.h2} break>1. Shrnutí a statistiky</Text>
      <View style={styles.statBoxContainer}>
        <View style={styles.statBox}><Text style={styles.statNumber}>{stats.total}</Text><Text style={styles.statLabel}>CELKEM BODŮ</Text></View>
        <View style={{ ...styles.statBox, backgroundColor: '#f0fdf4' }}><Text style={{ ...styles.statNumber, color: '#166534' }}>{stats.V}</Text><Text style={{ ...styles.statLabel, color: '#166534' }}>VYHOVUJE</Text></View>
        <View style={{ ...styles.statBox, backgroundColor: '#fef2f2' }}><Text style={{ ...styles.statNumber, color: '#991b1b' }}>{stats.N}</Text><Text style={{ ...styles.statLabel, color: '#991b1b' }}>NESHODY (N)</Text></View>
        <View style={styles.statBox}><Text style={styles.statNumber}>{stats.NK + stats.NA}</Text><Text style={styles.statLabel}>NEHODNOCENO</Text></View>
      </View>

      {record.poznamka && (
        <View style={{ marginBottom: 20 }}>
          <Text style={styles.boxTitle}>Závěrečné vyhodnocení:</Text>
          <Text style={{ padding: 10, backgroundColor: '#f8fafc', border: '1 solid #e2e8f0', fontStyle: 'italic' }}>{record.poznamka}</Text>
        </View>
      )}

      <Text style={styles.boxTitle}>Zúčastněné osoby:</Text>
      <View style={{ border: '1 solid #cbd5e1', marginBottom: 20 }}>
        <View style={styles.tableHeader}>
          <Text style={{ ...styles.col1, fontSize: 8, fontWeight: 700 }}>JMÉNO A PŘÍJMENÍ</Text>
          <Text style={{ ...styles.col2, fontSize: 8, fontWeight: 700 }}>POZICE</Text>
        </View>
        {record?.ucastnici?.length > 0 ? record.ucastnici.map((u:any, i:number) => (
          <View key={i} style={styles.tableRow}>
            <Text style={{ ...styles.col1, fontWeight: 700 }}>{u.jmeno}</Text>
            <Text style={styles.col2}>{u.pozice}</Text>
          </View>
        )) : <View style={styles.tableRow}><Text style={{ padding: 4, fontStyle: 'italic' }}>Neuvedeny žádné osoby.</Text></View>}
      </View>

      <Text style={styles.h2} break>2. {onlyDefects ? "Registr zjištěných nedostatků" : "Kompletní auditní protokol"}</Text>
      
      {filteredKontrolniBody.map((kb: any) => {
        const isDefect = kb.hodnoceni === 'N';
        return (
          <View key={kb.id || kb.bod} style={styles.defectCard} wrap={false}>
            <View style={styles.defectHeader}>
              <Text style={{ fontWeight: 700, fontSize: 9 }}>[{kb.bod}] <Text style={{ color: '#64748b' }}>KAPITOLA: {kb.sekce || 'OSTATNÍ'}</Text></Text>
              <Text style={isDefect ? styles.badgeN : styles.badgeV}>{isDefect ? '❌ NESHODA' : (kb.hodnoceni === 'V' ? '✅ VYHOVUJE' : '– NEHODNOCENO')}</Text>
            </View>
            <Text style={styles.boxTitle}>KONTROLOVANÝ BOD / OTÁZKA:</Text>
            <Text style={{ fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>{kb.otazka || kb.popis}</Text>
            
            {isDefect && (
              <View style={styles.defectInfoBox}>
                <View style={styles.col1}>
                  <Text style={styles.boxTitle}>NÁVRH OPATŘENÍ:</Text>
                  <Text>{kb.navrhOpatreni || 'Není definováno'}</Text>
                </View>
                <View style={styles.col2}>
                  <Text style={styles.boxTitle}>LOKALIZACE A TERMÍN:</Text>
                  <Text style={{ fontWeight: 700, color: '#1e3a8a', marginBottom: 2 }}>{kb.lokalizace || 'Objekt společnosti'}</Text>
                  <Text>Termín: {kb.terminOdstraneni ? new Date(kb.terminOdstraneni).toLocaleDateString('cs-CZ') : 'Neurčeno'}</Text>
                  <Text>Pozice: {kb.odpovednaOsoba || 'Neuvedena'}</Text>
                </View>
              </View>
            )}
            {kb.foto && <PdfImage src={kb.foto} style={styles.image} />}
          </View>
        );
      })}

      {/* Opakující se Zápatí */}
      <View style={styles.footer} fixed>
        <Text>{pdfFileName}</Text>
        <Text render={({ pageNumber, totalPages }) => `Strana ${pageNumber} z ${totalPages}`} />
      </View>

    </Page>
  </Document>
);

export default function RecordDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { zaznamy, klienti } = useData();

  const [isClient, setIsClient] = useState(false);
  useEffect(() => { setIsClient(true); }, []);

  const record = useMemo(() => zaznamy.find(z => z.id === params.id), [zaznamy, params.id]);
  const klient = useMemo(() => klienti.find(k => k.id === record?.klientId), [klienti, record]);
  
  const pracovisteList = useMemo(() => {
    if (!klient || !record) return [];
    const prac = klient.pracoviste || [];
    if (record.pracovisteIds && Array.isArray(record.pracovisteIds)) return prac.filter(p => record.pracovisteIds.includes(p.id));
    if (record.pracovisteId) { const oldPrac = prac.find(p => p.id === record.pracovisteId); return oldPrac ? [oldPrac] : []; }
    return [];
  }, [klient, record]);

  const [filterPosition, setFilterPosition] = useState<string>("all");
  const [onlyDefects, setOnlyDefects] = useState<boolean>(false);

  const allSectionsInRecord = useMemo(() => {
    const sections = new Set<string>();
    if (record?.kontrolniBody) record.kontrolniBody.forEach((kb: any) => { if (kb.sekce) sections.add(kb.sekce); });
    return Array.from(sections) as string[];
  }, [record]);

  const [visibleSections, setVisibleSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    if (record?.kontrolniBody) record.kontrolniBody.forEach((kb: any) => { if (kb.sekce) initial[kb.sekce] = true; });
    return initial;
  }, [record]);

  const toggleSection = (sectionName: string) => setVisibleSections(prev => ({ ...prev, [sectionName]: !prev[sectionName] }));

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
          {isClient && (
            <PDFDownloadLink
              document={<AuditPDF record={record} klient={klient} pracovisteList={pracovisteList} stats={stats} filteredKontrolniBody={filteredKontrolniBody} onlyDefects={onlyDefects} pdfFileName={pdfFileName} getFullInspectionTitle={getFullInspectionTitle} />}
              fileName={pdfFileName}
              className={cn("inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-11 px-4 py-2 shadow-sm font-bold bg-blue-600 hover:bg-blue-700 text-white")}
            >
              {({ loading }) => loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generuji PDF...</> : <><Printer className="h-4 w-4 mr-2" /> Stáhnout PDF report</>}
            </PDFDownloadLink>
          )}
          <Button variant="secondary" className="h-11 shadow-sm" onClick={() => toast({ title: "Připravuje se", description: "Funkce editace záznamu bude zprovozněna." })}>
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
    </div>
  );
}
