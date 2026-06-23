'use client';

import { useData } from "@/components/data-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  ChevronLeft, 
  Printer, 
  Building, 
  MapPin, 
  FileText,
  Loader2,
  Edit,
  Users,
  ChevronDown,
  CheckCircle2,
  Clock
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/app/lib/utils";

const TEXTS_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRiXWE13sHgXwCiFobHGpI3zvKR8nIOnzLtLxWdK7kyn2c4BhZDOwOf5ulUycMyfF1xJXonFSTG88JS/pub?gid=1978510431&single=true&output=csv";

const defaultTexts = {
  hlavicka_line1: "BEZPEČNOST PRÁCE & POŽÁRNÍ OCHRANA",
  hlavicka_line2: "Profesionální auditorské a kontrolní sysémy",
  nadpis_zpracovatel: "Zpracovatel / Poskytovatel:",
  nazev_spolecnosti: "BPyes s.r.o.",
  udaje_spolecnosti: "Specializovaný poskytovatel služeb v oblasti rizik BOZP a PO | IČO: 04399421 | E-mail: navratil@bpyes.cz",
  nadpis_klient: "Kontrolovaný subjekt / Klient:",
  nadpis_misto: "Místo prověrky:",
  nadpis_prohlaseni: "Prohlášení a konstatování o seznámení:",
  text_prohlaseni: "Kontrolovaný subjekt / zástupce klienta svým níže uvedeným podpisem stvrzuje, že byl v plném rozsahu, prokazatelně a jasně seznámen se všemi zjištěnými legislativními nedostatky, systémovými neshodami a doporučeními, která jsou detailně specifikována uvnitř této auditní zprávy. Souhlasí s navrženými nápravnými opatřeními a zavazuje se k jejich vyřešení a odstranění v definovaných zákonných či dohodnutých termínech.",
  titulek_provedl: "Provedl (Za BPyes):",
  podtitulek_provedl: "Specialista BOZP a PO",
  titulek_zastupce: "Zástupce klienta / subjektu:",
  podtitulek_zastupce: "Osoba seznámená s reportem",
  nadpis_statistika: "1. Shrnutí a statistiky",
  stat_celkem: "CELKEM BODŮ",
  stat_vyhovuje: "VYHOVUJE",
  stat_neshody: "NESHODY (N)",
  stat_nehodnoceno: "NEHODNOCENO",
  vyhodnoceni_specialisty: "Závěrečné vyhodnocení:",
  zucastnene_osoby: "Zúčastněné osoby:",
  tab_jmeno: "Jméno a příjmení",
  tab_pozice: "Pracovní pozice / Vztah k subjektu",
  nadpis_zavady: "2. Registr zjištěných nedostatků a nápravných opatření",
  nadpis_komplet: "2. Kompletní auditní protokol zjištění",
  karta_opatreni: "Návrh opatření:",
  karta_lokalizace: "Lokalizace:",
  karta_termin: "Termín:",
  karta_odpovednost: "Pozice:"
};

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

export default function RecordDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { zaznamy, klienti, userProfile, setZaznamy } = useData();

  const [t, setT] = useState<Record<string, string>>(defaultTexts);
  const [isLoading, setIsLoading] = useState(true);

  const isAdmin = userProfile?.role === 'admin';

  useEffect(() => {
    if (zaznamy && zaznamy.length > 0) {
      setIsLoading(false);
    }
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, [zaznamy]);

  useEffect(() => {
    fetch(TEXTS_URL)
      .then(res => res.text())
      .then(csv => {
        const rows = parseCSV(csv);
        const map: Record<string, string> = {};
        rows.forEach(r => {
          if(r[0] && r[1]) map[r[0].trim()] = r[1].trim();
        });
        setT(prev => ({ ...prev, ...map }));
      })
      .catch(console.error);
  }, []);

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
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (sec: string) => {
    setCollapsedGroups(prev => ({ ...prev, [sec]: !prev[sec] }));
  };

  // Funkce pro změnu stavu vyřešení neshody klientem
  const handleToggleResolve = async (bodId: string || number) => {
    if (!record) return;

    const updatedBody = record.kontrolniBody.map((kb: any) => {
      if ((kb.id || kb.bod) === bodId) {
        // Přepínáme příznak vyresenoKlienetem
        const currentStatus = !!kb.vyresenoKlientem;
        return { ...kb, vyresenoKlientem: !currentStatus };
      }
      return kb;
    });

    try {
      setZaznamy((prev: any[]) => prev.map(z => z.id === record.id ? { ...z, kontrolniBody: updatedBody } : z));
      toast({
        title: "Stav aktualizován",
        description: "Změna nápravného opatření byla bezpečně uložena do cloudu.",
      });
    } catch (e) {
      toast({
        title: "Chyba uložení",
        description: "Nepodařilo se synchronizovat stav s databází.",
        variant: "destructive"
      });
    }
  };

  const allSectionsInRecord = useMemo(() => {
    const sections = new Set<string>();
    if (record?.kontrolniBody) {
      record.kontrolniBody.forEach((kb: any) => {
        if (kb.sekce) sections.add(kb.sekce);
      });
    }
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

  const toggleSection = (sectionName: string) => {
    setVisibleSections(prev => ({ ...prev, [sectionName]: prev[sectionName] === false }));
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

  const groupedKontrolniBody = useMemo(() => {
    const groups: { sekce: string; items: any[] }[] = [];
    const secMap = new Map<string, number>();

    filteredKontrolniBody.forEach((kb: any) => {
      const sec = kb.sekce || "Ostatní";
      if (!secMap.has(sec)) {
        secMap.set(sec, groups.length);
        groups.push({ sekce: sec, items: [] });
      }
      groups[secMap.get(sec)!].items.push(kb);
    });
    return groups;
  }, [filteredKontrolniBody]);

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

  if (!record) {
    if (isLoading) {
      return (
        <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-4">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-muted-foreground text-sm font-medium">Načítám data z cloudu...</p>
        </div>
      );
    }
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
            <Button variant="ghost" size="sm" className="p-0 h-auto text-muted-foreground hover:bg-transparent" onClick={() => router.push("/")}><ChevronLeft className="h-4 w-4" /> Zpět na seznam</Button>
            <span className="text-xs font-bold uppercase tracking-wider text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-200">{record.stav === 'uzavreny' ? 'Uzavřený report' : 'Koncept'}</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{record.cislo} <span className="text-muted-foreground font-normal text-xl">R{record.revize || 0}</span></h1>
          <p className="text-sm text-muted-foreground">Provedeno dne {record.datum ? new Date(record.datum).toLocaleDateString('cs-CZ') : 'Neuvedeno'}</p>
        </div>
        
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <Button variant="default" className="h-11 shadow-sm font-bold bg-blue-600 hover:bg-blue-700 text-white" disabled={isGeneratingPDF}>
            <Printer className="h-4 w-4 mr-2" /> Stáhnout PDF report
          </Button>
          {isAdmin && (
            <Button variant="secondary" className="h-11 shadow-sm" onClick={() => toast({ title: "Připravuje se", description: "Editace bude přístupná v další verzi." })}>
              <Edit className="h-4 w-4 mr-2" /> Upravit záznam
            </Button>
          )}
        </div>
      </div>

      {/* Dispečink filtrů */}
      <Card className="border-blue-100 bg-blue-50/20">
        <CardHeader className="py-4 space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-3">
            <div>
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-blue-900"><FileText className="h-4 w-4" /> Manažerský dispečink</CardTitle>
              <CardDescription className="text-xs">Filtrujte kapitoly a odpovědnosti v reálném čase.</CardDescription>
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
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">Zahrnout kapitoly auditu:</span>
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card className="border-none shadow-sm">
            <CardHeader><CardTitle className="text-lg">{onlyDefects ? t.nadpis_zavady : t.nadpis_komplet} ({filteredKontrolniBody.length})</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              {groupedKontrolniBody.map((group) => {
                const { sekce, items } = group;
                const isCollapsed = collapsedGroups[sekce];
                
                const groupStats = {
                  V: items.filter(i => i.hodnoceni === 'V').length,
                  N: items.filter(i => i.hodnoceni === 'N').length,
                  NA: items.filter(i => i.hodnoceni === 'NA' || i.hodnoceni === 'NK').length,
                };

                return (
                  <div key={sekce} className="space-y-3">
                    <div onClick={() => toggleGroup(sekce)} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors gap-3 sm:gap-0">
                      <h3 className="font-bold text-slate-800 text-sm uppercase">{sekce}</h3>
                      <div className="flex items-center gap-4">
                        <div className="flex gap-2 text-[10px] font-bold uppercase tracking-wider">
                          {groupStats.V > 0 && <span className="text-green-700 bg-green-100 px-2 py-0.5 rounded">{t.stat_vyhovuje}: {groupStats.V}</span>}
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
                                  <span className={cn("font-mono text-xs font-bold h-6 w-6 rounded-md flex items-center justify-center shrink-0", isDefect ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800")}>
                                    {kb.bod}
                                  </span>
                                  <div>
                                    <h4 className="font-bold text-[14px] leading-tight text-slate-900">{kb.otazka || kb.popis}</h4>
                                    <span className="text-[10px] text-muted-foreground font-bold uppercase">{kb.sekce || 'Ostatní'}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {isDefect && isResolvedByClient && (
                                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                                      <Clock className="h-3 w-3" /> Vyřešeno klientem
                                    </span>
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
                                    <div><span className="text-muted-foreground block mb-0.5">{t.nadpis_misto}</span><p className="font-bold text-blue-900">{kb.lokalizace || 'Místo kontroly'}</p></div>
                                    <div><span className="text-muted-foreground block mb-0.5">{t.karta_termin}</span><p className="font-medium">{kb.terminOdstraneni ? new Date(kb.terminOdstraneni).toLocaleDateString('cs-CZ') : 'Neurčeno'}</p></div>
                                    <div><span className="text-muted-foreground block mb-0.5">{t.karta_odpovednost}</span><p className="font-bold text-black">{kb.odpovednaOsoba || 'Neuvedena'}</p></div>
                                  </div>

                                  {/* INTERAKTIVNÍ ROZHRANÍ PRO KLIENTA */}
                                  {!isAdmin && (
                                    <div className="flex items-center justify-between p-2.5 rounded-lg border border-dashed bg-blue-50/30 border-blue-200">
                                      <div className="space-y-0.5">
                                        <p className="text-xs font-bold text-slate-800">Odstranili jste tento nedostatek?</p>
                                        <p className="text-[11px] text-muted-foreground">Označte bod jako splněný pro revizi specialistou BOZP.</p>
                                      </div>
                                      <Button 
                                        type="button" 
                                        size="sm" 
                                        variant={isResolvedByClient ? "outline" : "default"}
                                        className={cn("h-8 font-bold text-xs shadow-sm transition-all", !isResolvedByClient && "bg-blue-600 hover:bg-blue-700 text-white")}
                                        onClick={() => handleToggleResolve(bodId)}
                                      >
                                        {isResolvedByClient ? "Zrušit potvrzení" : "Označit za vyřešené"}
                                      </Button>
                                    </div>
                                  )}

                                  {/* POHLED PRO AUDITORA (Indikace práce klienta) */}
                                  {isAdmin && isResolvedByClient && (
                                    <div className="flex items-center gap-2 text-xs font-semibold p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800">
                                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                                      <span>Klient nahlásil vyřešení této závady. Zkontrolujte stav při příští fyzické prověrce.</span>
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

        {/* Postranní lišta */}
        <div className="space-y-6">
          <Card className="border-none shadow-sm bg-white">
            <CardHeader><CardTitle className="text-sm uppercase tracking-wider text-muted-foreground font-bold">Detaily kontroly</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex gap-3"><Building className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" /><div><span className="text-xs text-muted-foreground block">Klient</span><p className="font-bold">{klient?.nazev || 'Kovárna Novák s.r.o.'}</p></div></div>
              <div className="flex gap-3"><MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs text-muted-foreground block">Pracoviště</span>
                  <p className="font-bold">{pracovisteList.map(p => p.nazev).join(', ') || 'Hlavní provozovna'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
