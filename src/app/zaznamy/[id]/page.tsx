'use client';

import { parseCSV, celaAdresa, prijemciKlienta } from "@/lib/kontroly";
import { nactiCsv } from "@/lib/csv-cache";
import { compressImage, FOTO_NEDOSTATKU } from "@/lib/obrazky";
import { stav, paskaPro, STAVY } from "@/lib/stavy";
import { useData, db, auth } from "@/components/data-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  ChevronLeft, Printer, Building, MapPin, FileText,
  Loader2, Edit, ChevronDown, CheckCircle2, Clock, X, Camera,
  Trash2, Send
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

  // Stavy pro bezpečné odesílání e-mailu bez prompt() window
  const [showEmailModal, setShowEmailModal] = useState(false);
  // Výběr příjemců reportu – klíče jsou e-maily kontaktů.
  const [vybraniPrijemci, setVybraniPrijemci] = useState<Record<string, boolean>>({});
  const [dalsiEmail, setDalsiEmail] = useState("");
  const [isSendingEmail, setIsSendingEmail] = useState(false);

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
    const controller = new AbortController();

    nactiCsv(TEXTS_URL, controller.signal)
      .then(({ csv }) => {
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
      })
      .catch((e) => { if (!controller.signal.aborted) console.error('Texty protokolu:', e); });

    return () => controller.abort();
  }, []);

  const record = useMemo(() => zaznamy.find((z: any) => z.id === params.id), [zaznamy, params.id]);

  // Protokol je dokument k datu: přednostně čteme snímek klienta uložený při vytvoření
  // záznamu. Pozdější změna názvu/adresy klienta nesmí zpětně měnit vydaný protokol.
  // Fallback na aktuálního klienta jen pro záznamy bez snímku.
  const aktualniKlient = useMemo(() => klienti.find((k: any) => k.id === record?.klientId), [klienti, record]);
  const klient = useMemo(() => record?.klientSnapshot || aktualniKlient, [record, aktualniKlient]);

  const pracovisteList = useMemo(() => {
    if (!record) return [];

    // Snímek už obsahuje jen pracoviště zvolená při kontrole – nefiltrujeme znovu.
    if (record.klientSnapshot?.pracoviste) {
      return record.klientSnapshot.pracoviste.map((p: any) => ({
        ...p,
        fullDisplay: `${p.nazev}${p.adresa ? ', ' + p.adresa : ''}${p.mesto ? ', ' + p.mesto : ''}`
      }));
    }

    if (!aktualniKlient) return [];
    const prac = aktualniKlient.pracoviste || [];
    // Záznamy nesou pouze pracovisteIds (množné). Starší jednotné pole neexistuje.
    const filtered = Array.isArray(record.pracovisteIds)
      ? prac.filter((p: any) => record.pracovisteIds.includes(p.id))
      : [];
    return filtered.map((p: any) => ({
      ...p,
      fullDisplay: `${p.nazev}${p.adresa ? ', ' + p.adresa : ''}${p.mesto ? ', ' + p.mesto : ''}`
    }));
  }, [aktualniKlient, record]);

  // ADRESNÝ VYHLEDÁVAČ VŠECH E-MAILŮ (NEPRŮSTŘELNÝ MULTI-EMAIL)
  

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

  const handleConfirmResolve = async (bodId: string | number) => {
    if (!record) return;
    if (!resolveData.jmeno.trim()) { toast({ title: "Chybí jméno", description: "Zadejte jméno.", variant: "destructive" }); return; }
    const updatedBody = record.kontrolniBody.map((kb: any) => {
      if ((kb.id || kb.bod) === bodId) {
        return { ...kb, vyresenoKlientem: true, datumVyreseniKlientem: resolveData.datum, jmenoVyresitele: resolveData.jmeno, poznamkaKlienta: resolveData.poznamka, fotoVyreseni: resolveData.foto };
      }
      return kb;
    });
    try {
      setZaznamy((prev: any[]) => prev.map(z => z.id === record.id ? { ...z, kontrolniBody: updatedBody } : z));
      setResolvingBod(null);
      toast({ title: "Závada odstraněna" });
    } catch (e) { toast({ title: "Chyba uložení", variant: "destructive" }); }
  };

  const handleCancelResolve = async (bodId: string | number) => {
    if (!record) return;
    const updatedBody = record.kontrolniBody.map((kb: any) => {
      if ((kb.id || kb.bod) === bodId) { return { ...kb, vyresenoKlientem: false, datumVyreseniKlientem: null, jmenoVyresitele: null, poznamkaKlienta: null, fotoVyreseni: [] }; }
      return kb;
    });
    setZaznamy((prev: any[]) => prev.map(z => z.id === record.id ? { ...z, kontrolniBody: updatedBody } : z));
    toast({ title: "Zrušeno" });
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

  // Doporučení auditora – body, kde nejde o neshodu, ale o návrh na zlepšení.
  // Nedrží protokol otevřený, proto stojí ve vlastní sekci za nedostatky.
  const doporuceniList = useMemo(() => {
    if (!record?.kontrolniBody) return [];
    return record.kontrolniBody
      .filter((kb: any) => kb.showDoporuceni && kb.doporuceni?.trim())
      .map((kb: any) => ({
        bod: kb.bod,
        sekce: kb.sekce,
        otazka: kb.otazka,
        text: kb.doporuceni.trim(),
        foto: kb.doporuceniFoto || [],
      }));
  }, [record]);

  // Výsledný seznam adres: zaškrtnuté kontakty + ručně dopsaná adresa.
  const finalniPrijemci = useMemo(() => {
    const adresy = Object.entries(vybraniPrijemci)
      .filter(([, vybrano]) => vybrano)
      .map(([email]) => email);

    const rucni = dalsiEmail.trim();
    if (rucni.includes('@') && !adresy.includes(rucni)) adresy.push(rucni);

    return adresy;
  }, [vybraniPrijemci, dalsiEmail]);

  const filteredKontrolniBody = useMemo(() => {
    if (!record?.kontrolniBody) return [];
    return record.kontrolniBody.filter((kb: any) => {
      // Bod nesoucí pouze doporučení (bez hodnocení) patří do vlastní
      // sekce doporučení, ne do seznamu hodnocených bodů.
      if (!kb.hodnoceni) return false;
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

  if (!record) return isLoading ? <div className="min-h-[50vh] flex justify-center items-center"><Loader2 className="animate-spin text-blue-600 h-8 w-8" /></div> : <div className="p-8 text-center">Záznam nenalezen.</div>;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8 pb-24 relative overflow-hidden print:p-0 print:m-0 print:space-y-0 bg-slate-50 min-h-screen print:bg-white">
      
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          /* Odstraní výchozí URL a záhlaví prohlížeče nastavením marginu na nulu na samotné stránce */
          @page { 
            size: A4 portrait; 
            margin: 20mm 15mm 20mm 15mm;
          }
          body { 
            -webkit-print-color-adjust: exact !important; 
            print-color-adjust: exact !important; 
            background: white !important; 
            color: #000 !important; 
          }
          .page-break { page-break-before: always; }
          .avoid-break { page-break-inside: avoid; break-inside: avoid; }

          /* Vytvoří fixní tiskové záhlaví a zápatí na každé stránce */
          body {
            padding-top: 10mm;
          }
          
          /* Zápis čísla reportu na každou vytisknutou stránku */
          @page {
            @top-right {
              content: "Report č.: ${record.cisloKlientske || record.cislo}";
              font-family: sans-serif;
              font-size: 9px;
              color: #64748b;
            }
            @bottom-right {
              content: "Zpráva č.: ${record.cisloKlientske || record.cislo}";
              font-family: sans-serif;
              font-size: 8px;
              color: #94a3b8;
            }
          }
        }
      `}} />

      {/* MODAL MAZÁNÍ */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[200] bg-black/70 flex items-center justify-center p-4 print:hidden">
          <Card className="w-full max-w-md shadow-2xl">
            <CardHeader className="bg-red-50"><CardTitle className="text-red-700">Smazání reportu</CardTitle></CardHeader>
            <CardContent className="p-6">
              <p>Opravdu chcete nenávratně smazat tento report?</p>
              <div className="flex justify-end gap-3 mt-6">
                <Button variant="outline" onClick={() => setShowDeleteModal(false)}>Zrušit</Button>
                <Button variant="destructive" onClick={handleDeleteRecord} disabled={isDeleting}>Smazat</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* MODAL FOTKA */}
      {fullscreenImage && (
        <div className="fixed inset-0 z-[1000] bg-black/90 flex flex-col items-center justify-center p-4 print:hidden" onClick={() => setFullscreenImage(null)}>
          <div className="relative max-w-[95vw] max-h-[95vh]">
            <Button variant="ghost" size="icon" className="absolute -top-12 right-0 text-white" onClick={() => setFullscreenImage(null)}><X className="h-8 w-8" /></Button>
            <img src={fullscreenImage} alt="Zvětšená fotografie" className="max-w-full max-h-[90vh] object-contain rounded-md" onClick={(e) => e.stopPropagation()} />
          </div>
        </div>
      )}

      {/* MODÁLNÍ OKNO PRO BEZPEČNÉ ODESLÁNÍ E-MAILU Z DETAILU */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/60 z-[150] flex items-center justify-center p-4 animate-in fade-in print:hidden">
          <Card className="w-full max-w-md shadow-2xl border-blue-200">
            <CardHeader className="bg-blue-50 border-b border-blue-100 rounded-t-xl pb-4">
              <CardTitle className="text-xl font-bold flex items-center gap-2 text-blue-900">
                <Send className="h-6 w-6 text-blue-600" /> Odeslat report klientovi
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4 text-slate-700">
              <p>Přejete si odeslat e-mail s upozorněním a odkazem na klientský dispečink zprávy <strong>{record.cisloKlientske || record.cislo}</strong>?</p>

              <div className="space-y-2 pt-2">
                <Label className="text-xs font-bold text-slate-700">Příjemci:</Label>

                {prijemciKlienta(klient).length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">
                    Klient nemá u kontaktů vyplněný e-mail. Zadejte adresu ručně níže.
                  </p>
                ) : (
                  <div className="space-y-1 max-h-48 overflow-y-auto rounded-md border p-2">
                    {prijemciKlienta(klient).map((p) => (
                      <label
                        key={p.id}
                        className="flex items-start gap-2 p-2 rounded hover:bg-slate-50 cursor-pointer"
                      >
                        <Checkbox
                          className="mt-0.5"
                          checked={vybraniPrijemci[p.email] || false}
                          onCheckedChange={(v) =>
                            setVybraniPrijemci(prev => ({ ...prev, [p.email]: v === true }))
                          }
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium">{p.jmeno}</span>
                            {p.funkce && <span className="text-xs text-muted-foreground">· {p.funkce}</span>}
                            {p.hlavni && (
                              <span className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-[hsl(var(--stav-vyhovuje))]/10 text-[hsl(var(--stav-vyhovuje))]">
                                Hlavní
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground break-all">{p.email}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-700">Další adresa (nepovinné):</Label>
                <Input 
                  value={dalsiEmail} 
                  onChange={(e) => setDalsiEmail(e.target.value)}
                  placeholder="jan.novak@firma.cz"
                  className="bg-white h-10 border-slate-200 focus:border-blue-500"
                />
              </div>

              {finalniPrijemci.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Report se odešle na {finalniPrijemci.length} {finalniPrijemci.length === 1 ? 'adresu' : finalniPrijemci.length < 5 ? 'adresy' : 'adres'}.
                </p>
              )}
            </CardContent>
            <div className="p-4 border-t flex justify-end gap-2 bg-muted/20 rounded-b-xl">
              <Button variant="outline" onClick={() => setShowEmailModal(false)}>Zrušit</Button>
              <Button 
                onClick={async () => {
                  if (finalniPrijemci.length === 0) {
                    toast({ title: "Chybí příjemce", description: "Vyberte alespoň jeden kontakt nebo zadejte adresu.", variant: "destructive" });
                    return;
                  }
                  setIsSendingEmail(true);
                  try {
                    const odkaz = `${window.location.origin}/zaznamy/${record.id}`;
                    const token = await auth.currentUser?.getIdToken();
                    const response = await fetch('/api/send-email', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                      body: JSON.stringify({
                        email: finalniPrijemci,
                        jmenoKlienta: klient?.nazev || "Klient",
                        cisloZpravy: record.cisloKlientske || record.cislo,
                        odkaz: odkaz
                      })
                    });
                    const result = await response.json();
                    if (result.success) {
                      toast({ title: "E-mail úspěšně odeslán", description: finalniPrijemci.length === 1 ? `Zpráva byla zaslána na: ${finalniPrijemci[0]}` : `Zpráva byla zaslána na ${finalniPrijemci.length} adres.` });
                      setShowEmailModal(false);
                    } else {
                      toast({ title: "Chyba při odesílání", description: "E-mail se nepodařilo odeslat.", variant: "destructive" });
                    }
                  } catch (err) {
                    toast({ title: "Kritická chyba", description: "Chyba připojení k serveru.", variant: "destructive" });
                  } finally {
                    setIsSendingEmail(false);
                  }
                }} 
                disabled={isSendingEmail || finalniPrijemci.length === 0} 
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
              >
                {isSendingEmail ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />} Odeslat report
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ================================================================= */}
      {/* 1. TISKOVÁ VERZE (PDF)                                            */}
      {/* ================================================================= */}
      <div className="hidden print:block text-slate-900 w-full bg-white text-[13px]">
        
        <div className="pb-8">
          <div className="mb-8 flex justify-between items-start">
            <img src="/logo.png" onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src="/logo.svg"; }} alt="Logo" className="h-10 object-contain" />
            <div className="text-right text-[10px] text-slate-500 uppercase font-bold">AuditFlow | BPyes System</div>
          </div>

          <h1 className="text-xl font-bold uppercase text-slate-900 mb-4 leading-tight">
  {record.typKontroly === 'BOZPaPO' ? 'PROVĚRKA BOZP A PREVENTIVNÍ POŽÁRNÍ PROHLÍDKA, KONTROLA DOKUMENTACE POŽÁRNÍ OCHRANY' : 
   record.typKontroly === 'PPP' ? 'PREVENTIVNÍ POŽÁRNÍ PROHLÍDKA' : 
   record.typKontroly === 'PBOZP' ? 'PROVĚRKA BOZP PRACOVIŠTĚ' : 
   record.typKontroly === 'PBOZPS' ? 'PROVĚRKA BOZP NA STAVENIŠTI' : 
   'ZÁZNAM Z KONTROLY (VLASTNÍ ZAMĚŘENÍ)'}
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
              <p>Telefon: {auditorConfig?.telefon || '-'}</p>
            </div>
            
            <div>
              <p className="font-bold uppercase text-[11px] text-slate-500 mb-1">KONTROLOVANÝ SUBJEKT / KLIENT:</p>
              <p className="font-bold text-sm">{klient?.nazev}</p>
              
              <p>Sídlo: {celaAdresa(klient || {})}</p>
              <p>IČO: {klient?.ico || 'Neuvedeno'}</p>
              
              <div className="mt-2">
                <span className="font-bold">Místo prověrky:</span><br/>
                {pracovisteList.map((p: any) => <div key={p.id} className="text-xs leading-snug">{p.fullDisplay}</div>)}
              </div>
            </div>
          </div>

          <div className="mb-12">
            <p className="font-bold uppercase text-[11px] text-slate-500 mb-2">PROHLÁŠENÍ O SEZNÁMENÍ:</p>
            <p className="text-justify leading-relaxed italic text-slate-700">
              Kontrolovaný subjekt / zástupce klienta svým níže uvedeným podpisem stvrzuje, že byl v plném rozsahu, prokazatelně a jasně seznámen se všemi zjištěnými legislativními nedostatky, systémovými neshodami a doporučeními, která jsou detailně specifikována uvnitř této auditní zprávy. Souhlasí s navrženými nápravnými opatřeními a zavazuje se k jejich vyřešení v definovaných termínech.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-12 mt-16 pt-8">
            <div className="flex flex-col">
               <p className="font-bold uppercase text-[11px] mb-2">PROVEDL:</p>
               <div className="h-24 w-full relative mb-2">
                 {auditorConfig?.razitkoBase64 && (
                   <img src={auditorConfig.razitkoBase64} alt="Razítko" className="absolute left-0 bottom-0 h-24 w-24 object-contain mix-blend-multiply" />
                 )}
                 {auditorConfig?.podpisBase64 && (
                   <img src={auditorConfig.podpisBase64} alt="Podpis" className="absolute left-16 bottom-2 h-16 w-32 object-contain mix-blend-multiply" />
                 )}
               </div>
               <div className="border-b border-black w-full"></div>
               <div className="pt-2">
                 <p className="font-bold text-base">{auditorConfig?.titul ? auditorConfig.titul + ' ' : ''}{auditorConfig?.jmeno || 'Auditor'}</p>
                 {auditorConfig?.certifikace?.map((cert: any) => (
                   <p key={cert.id} className="text-[10px] leading-tight text-slate-600 mt-0.5">{cert.nazev}{cert.cislo ? `, ${cert.cislo}` : ''}</p>
                 ))}
               </div>
            </div>
            <div className="flex flex-col">
               <p className="font-bold uppercase text-[11px] mb-2">ZÁSTUPCE SUBJEKTU / KLIENTA:</p>
               <div className="h-24 w-full mb-2"></div>
               <div className="border-b border-black w-full"></div>
               <div className="pt-2">
                 <p className="text-xs text-slate-400 italic">Podpis a datum seznámení</p>
               </div>
            </div>
          </div>
        </div>

        <div className="page-break"></div>

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

        <div className="pt-4">
          <h2 className="text-base font-bold mb-8 uppercase border-b pb-2">2. KOMPLETNÍ AUDITNÍ PROTOKOL ZJIŠTĚNÍ</h2>
          <div className="space-y-6">
            {groupedKontrolniBody.map((group) => (
               group.items.map((kb: any) => {
                 const isDefect = kb.hodnoceni === 'N';
                 const def = stav(kb.hodnoceni);
                 return (
                   <div key={kb.id || kb.bod} className={cn("avoid-break border-b pb-6 mb-6 pl-3", paskaPro(kb.hodnoceni))}>
                     <div className="flex justify-between items-start mb-2">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter font-mono">[{kb.bod}] KAPITOLA: {group.sekce}</div>
                        <div className={cn("text-[9px] font-bold px-2 py-0.5 border rounded uppercase", def?.odznak)}>{def?.popis ?? '—'}</div>
                     </div>
                     <div className="font-bold text-slate-900 mb-3">{kb.otazka || kb.popis}</div>
                     {isDefect && (() => {
                       // Vsechny nedostatky tohoto bodu ze zavady[] (vazba pres bodKontroly).
                       // Fallback: kdyz zaznam nema provazane zavady (starsi data), pouzijeme kb.
                       const nedostatkyBodu = (record.zavady || []).filter(
                         (z: any) => String(z.bodKontroly) === String(kb.bod)
                       );
                       const seznam = nedostatkyBodu.length > 0 ? nedostatkyBodu : [{
                         popis: kb.popis, navrhOpatreni: kb.navrhOpatreni, lokalizace: kb.lokalizace,
                         terminOdstraneni: kb.terminOdstraneni, bezOdkladu: kb.bezOdkladu,
                         odpovednaOsoba: kb.odpovednaOsoba, foto: kb.foto,
                       }];
                       return (
                         <div className="space-y-3">
                           {seznam.map((z: any, zi: number) => (
                             <div key={zi} className="bg-slate-50 p-3 border rounded space-y-3">
                               {seznam.length > 1 && (
                                 <div className="text-[10px] font-bold text-red-700 uppercase tracking-tighter">Nedostatek {zi + 1} z {seznam.length}</div>
                               )}
                               {z.popis && <div className="text-[12px] font-medium text-slate-800">{z.popis}</div>}
                               <div className="grid grid-cols-2 gap-4 text-[11px]">
                                 <div><span className="text-slate-500 font-bold block">NÁVRH OPATŘENÍ:</span>{z.navrhOpatreni}</div>
                                 <div><span className="text-slate-500 font-bold block">MÍSTO:</span><span className="font-bold text-blue-800">{z.lokalizace}</span></div>
                                 <div><span className="text-slate-500 font-bold block">TERMÍN:</span>{z.bezOdkladu ? 'Bez zbytečného odkladu' : (z.terminOdstraneni ? new Date(z.terminOdstraneni).toLocaleDateString('cs-CZ') : '-')}</div>
                                 <div><span className="text-slate-500 font-bold block">ODPOVĚDNÁ POZICE:</span><span className="font-bold">{z.odpovednaOsoba}</span></div>
                               </div>
                               {z.foto && z.foto.length > 0 && (
                                 <div className="pt-2 flex flex-wrap gap-2">
                                   {z.foto.map((f: string, idx: number) => <img src={f} key={idx} className="h-40 w-40 object-cover border bg-white" />)}
                                 </div>
                               )}
                             </div>
                           ))}
                         </div>
                       );
                     })()}
                   </div>
                 )
               })
            ))}
          </div>

          {doporuceniList.length > 0 && (
            <div className="mt-10">
              <h2 className="text-base font-bold mb-6 uppercase border-b pb-2">3. DOPORUČENÍ AUDITORA</h2>
              <p className="text-[11px] text-slate-500 mb-6 leading-relaxed">
                Následující body nejsou v rozporu s právními předpisy. Jde o návrhy nad rámec povinností,
                jejichž realizace není podmínkou uzavření protokolu.
              </p>

              {doporuceniList.map((dop: any, idx: number) => (
                <div key={dop.bod} className="avoid-break mb-6 pb-6 border-b last:border-b-0 pl-3 paska paska-D">
                  <div className="flex justify-between items-start mb-2">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter font-mono">
                      [{dop.bod}] {dop.sekce ? `KAPITOLA: ${dop.sekce}` : ''}
                    </div>
                    <div className="text-[9px] font-bold px-2 py-0.5 border rounded uppercase text-[hsl(var(--stav-doporuceni))] border-[hsl(var(--stav-doporuceni))]/30">
                      Doporučení {idx + 1}
                    </div>
                  </div>

                  {dop.otazka && <p className="font-bold text-[13px] mb-2">{dop.otazka}</p>}
                  <p className="text-[12px] leading-relaxed whitespace-pre-wrap">{dop.text}</p>

                  {dop.foto.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {dop.foto.map((f: string, i: number) => (
                        <img key={i} src={f} alt={`Doporučení ${idx + 1}`} className="h-32 w-auto object-cover rounded border border-slate-200" />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ================================================================= */}
      {/* 2. WEBOVÁ VERZE (INTERAKTIVNÍ DASHBOARD)                          */}
      {/* ================================================================= */}
      <div className="print:hidden space-y-8">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="space-y-2">
            <Button variant="ghost" size="sm" className="p-0 h-auto text-muted-foreground hover:bg-transparent hover:text-slate-900 -ml-2" onClick={() => router.push("/")}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Zpět na přehled
            </Button>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">{record.cisloKlientske || record.cislo}</h1>
              <span className={cn("text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border", record.stav === 'uzavreny' ? "text-green-700 bg-green-50 border-green-200" : "text-amber-700 bg-amber-50 border-amber-200")}>
                {record.stav === 'uzavreny' ? 'Uzavřeno' : 'V řešení'}
              </span>
            </div>
            <p className="text-sm text-slate-500 font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" /> Audit ze dne {record.datum ? new Date(record.datum).toLocaleDateString('cs-CZ') : '-'}
            </p>
          </div>
          
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            {/* TLAČÍTKO PRO ODESLÁNÍ E-MAILU - KLIKNUTÍM SE OTEVŘE MODAL */}
            <Button 
              onClick={() => {
                const prijemci = prijemciKlienta(klient);
                const maHlavni = prijemci.some(p => p.hlavni);
                // Předzaškrtneme hlavní kontakty. Když žádný není označen,
                // zaškrtneme všechny – aby výchozí chování zůstalo jako dřív.
                const vychozi: Record<string, boolean> = {};
                prijemci.forEach(p => { vychozi[p.email] = maHlavni ? p.hlavni : true; });
                setVybraniPrijemci(vychozi);
                setDalsiEmail("");
                setShowEmailModal(true);
              }} 
              disabled={isSendingEmail}
              variant="outline"
              className="h-11 bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 hover:text-blue-800 shadow-sm font-bold"
            >
              <Send className="h-4 w-4 mr-2" />
              Odeslat e-mail
            </Button>
            <Button className="h-11 px-6 shadow-sm font-bold bg-blue-600 hover:bg-blue-700 text-white" onClick={handlePrint} disabled={isPreparingPdf}>
              {isPreparingPdf ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Printer className="h-4 w-4 mr-2" />}
              {isPreparingPdf ? "Příprava PDF..." : "Tisk reportu"}
            </Button>
            {isAdmin && (
              <>
                <Button variant="outline" className="h-11 bg-white" onClick={() => router.push(`/upravit-zaznam/${record.id}`)}>
                  <Edit className="h-4 w-4 mr-2" /> Upravit
                </Button>
                <Button variant="outline" className="h-11 text-red-600 hover:bg-red-50 hover:text-red-700 border-red-200 bg-white" onClick={() => setShowDeleteModal(true)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>

        <Card className="border-blue-100 bg-blue-50/40 shadow-sm">
          <CardContent className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-2 text-blue-900">
              <FileText className="h-5 w-5" />
              <div>
                <h3 className="font-bold text-sm">Zobrazení protokolu</h3>
                <p className="text-xs text-blue-700/70">Upravte si výpis závad na obrazovce</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {uniquePositionsInRecord.length > 0 && (
                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border shadow-sm w-full md:w-auto">
                  <span className="text-xs font-bold text-slate-500">Pozice:</span>
                  <Select value={filterPosition} onValueChange={setFilterPosition}>
                    <SelectTrigger className="h-8 border-none p-0 focus:ring-0 shadow-none text-xs font-bold w-40"><SelectValue placeholder="Všechny pozice" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Zobrazit vše</SelectItem>
                      {uniquePositionsInRecord.map(pos => <SelectItem key={pos} value={pos}>{pos}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex items-center space-x-2 bg-white px-3 py-2 rounded-lg border shadow-sm h-11 cursor-pointer hover:bg-slate-50" onClick={() => setOnlyDefects(!onlyDefects)}>
                <Checkbox id="onlyDefects" checked={onlyDefects} onCheckedChange={(c) => setOnlyDefects(!!c)} />
                <label className="text-xs font-bold text-slate-700 cursor-pointer select-none">Pouze neshody</label>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          <div className="md:col-span-2 space-y-6">
            <h2 className="text-xl font-bold text-slate-800">{onlyDefects ? t.nadpis_zavady : t.nadpis_komplet} <span className="text-slate-400 font-normal">({filteredKontrolniBody.length})</span></h2>
            
            <div className="space-y-4">
              {groupedKontrolniBody.map((group) => {
                const { sekce, items } = group;
                const isCollapsed = collapsedGroups[sekce];
                const groupStats = { N: items.filter(i => i.hodnoceni === 'N').length };

                return (
                  <Card key={sekce} className="border-slate-200 shadow-sm overflow-hidden transition-all duration-200">
                    <div 
                      onClick={() => toggleGroup(sekce)} 
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50 border-b border-slate-100 cursor-pointer hover:bg-slate-100/70 transition-colors"
                    >
                      <h3 className="font-bold text-slate-800 text-sm uppercase">{sekce}</h3>
                      <div className="flex items-center gap-4 mt-2 sm:mt-0">
                        {groupStats.N > 0 && <span className="text-[10px] font-bold uppercase tracking-wider text-red-700 bg-red-100 px-2 py-0.5 rounded shadow-sm">Neshod: {groupStats.N}</span>}
                        <ChevronDown className={cn("h-5 w-5 text-slate-400 transition-transform", isCollapsed && "-rotate-90")} />
                      </div>
                    </div>

                    {!isCollapsed && (
                      <CardContent className="p-0 divide-y divide-slate-100">
                        {items.map((kb: any) => {
                          const isDefect = kb.hodnoceni === 'N';
                          const bodId = kb.id || kb.bod;
                          const isResolvedByClient = !!kb.vyresenoKlientem;

                          return (
                            <div key={bodId} className={cn("p-5 transition-colors", isDefect ? "bg-white" : "bg-slate-50/30")}>
                              <div className="flex justify-between items-start gap-4 mb-4">
                                <div className="flex gap-3">
                                  <span className={cn("font-mono text-xs font-bold h-7 w-7 rounded-lg flex items-center justify-center shrink-0 border", isDefect ? "bg-red-50 text-red-700 border-red-100" : "bg-green-50 text-green-700 border-green-100")}>{kb.bod}</span>
                                  <div>
                                    <h4 className={cn("font-bold text-[14px] leading-snug", isDefect ? "text-slate-900" : "text-slate-600")}>{kb.otazka || kb.popis}</h4>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {isDefect && isResolvedByClient && (
                                    <span className="text-[10px] font-bold uppercase px-2 py-1 rounded bg-blue-50 text-blue-700 border border-blue-200 shadow-sm flex items-center gap-1"><Clock className="h-3 w-3" /> Vyřešeno</span>
                                  )}
                                  <span className={cn("text-[10px] font-bold uppercase px-2 py-1 rounded shadow-sm border", isDefect ? (isResolvedByClient ? "bg-slate-50 text-slate-500 border-slate-200" : "bg-red-600 text-white border-red-700") : "bg-emerald-50 text-emerald-700 border-emerald-200")}>
                                    {isDefect ? 'Neshoda' : 'Vyhovuje'}
                                  </span>
                                </div>
                              </div>

                              {isDefect && (
                                <div className="ml-10 space-y-4">
                                  {(() => {
                                    const nedostatkyBodu = (record.zavady || []).filter(
                                      (z: any) => String(z.bodKontroly) === String(kb.bod)
                                    );
                                    const seznam = nedostatkyBodu.length > 0 ? nedostatkyBodu : [{
                                      navrhOpatreni: kb.navrhOpatreni, lokalizace: kb.lokalizace,
                                      terminOdstraneni: kb.terminOdstraneni, bezOdkladu: kb.bezOdkladu,
                                      odpovednaOsoba: kb.odpovednaOsoba, foto: kb.foto, popis: kb.popis,
                                    }];
                                    return seznam.map((z: any, zi: number) => (
                                      <div key={zi} className="space-y-3">
                                        {seznam.length > 1 && (
                                          <div className="text-[11px] font-bold text-red-700 uppercase tracking-wide">Nedostatek {zi + 1} z {seznam.length}</div>
                                        )}
                                        {z.popis && <p className="text-sm text-slate-800 font-medium">{z.popis}</p>}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50 p-4 rounded-xl border border-slate-100 shadow-sm">
                                          <div><span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-0.5">Návrh opatření</span><p className="font-medium text-slate-900 leading-relaxed">{z.navrhOpatreni || '-'}</p></div>
                                          <div><span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-0.5">Místo prověrky</span><p className="font-bold text-blue-900">{z.lokalizace || '-'}</p></div>
                                          <div><span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-0.5">Termín k odstranění</span><p className="font-medium text-slate-900">{z.bezOdkladu ? 'Bez zbytečného odkladu' : (z.terminOdstraneni ? new Date(z.terminOdstraneni).toLocaleDateString('cs-CZ') : '-')}</p></div>
                                          <div><span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-0.5">Odpovědná pozice</span><p className="font-bold text-slate-900">{z.odpovednaOsoba || '-'}</p></div>
                                        </div>
                                        {z.foto && z.foto.length > 0 && (
                                          <div>
                                            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-2">Fotodokumentace závady</span>
                                            <div className="flex flex-wrap gap-3">
                                              {z.foto.map((f: string, i: number) => (
                                                <div key={i} onClick={() => setFullscreenImage(f)} className="cursor-zoom-in relative group overflow-hidden rounded-lg border border-slate-200 shadow-sm bg-white p-1">
                                                  <img src={f} alt="Foto" className="h-24 w-24 sm:h-32 sm:w-32 object-cover rounded group-hover:scale-105 transition-transform" />
                                                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none"><Camera className="text-white h-6 w-6" /></div>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    ));
                                  })()}

                                  {!isAdmin && (
                                    <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 mt-4 shadow-sm">
                                      {isResolvedByClient ? (
                                         <div className="space-y-3 bg-white p-4 rounded-lg border border-blue-50">
                                           <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm mb-2"><CheckCircle2 className="h-5 w-5" /> Závada byla nahlášena jako odstraněná</div>
                                           <div className="grid grid-cols-2 gap-4 text-sm">
                                             <div><span className="text-xs text-slate-500 block">Nahlásil(a):</span> <span className="font-bold">{kb.jmenoVyresitele}</span></div>
                                             <div><span className="text-xs text-slate-500 block">Datum odstranění:</span> <span className="font-bold">{kb.datumVyreseniKlientem ? new Date(kb.datumVyreseniKlientem).toLocaleDateString('cs-CZ') : '-'}</span></div>
                                           </div>
                                           {kb.poznamkaKlienta && <div className="pt-2 border-t border-slate-100"><span className="text-xs text-slate-500 block mb-1">Poznámka k řešení:</span><p className="text-sm italic text-slate-700">{kb.poznamkaKlienta}</p></div>}
                                           {kb.fotoVyreseni && kb.fotoVyreseni.length > 0 && (
                                             <div className="pt-3 border-t border-slate-100 flex gap-2">
                                               {kb.fotoVyreseni.map((f: string, i: number) => (
                                                 <img key={i} src={f} onClick={() => setFullscreenImage(f)} className="h-16 w-16 object-cover rounded border cursor-zoom-in hover:opacity-80" />
                                               ))}
                                             </div>
                                           )}
                                           <Button variant="ghost" size="sm" onClick={() => handleCancelResolve(bodId)} className="text-red-600 hover:text-red-700 hover:bg-red-50 mt-2 p-0 h-auto font-bold text-xs">Vrátit závadu zpět do řešení</Button>
                                         </div>
                                      ) : (
                                        resolvingBod === bodId ? (
                                          <div className="bg-white p-4 rounded-lg border border-blue-200 shadow-lg animate-in slide-in-from-top-2">
                                            <h5 className="font-bold text-blue-900 mb-4 text-sm">Nahlášení odstranění závady</h5>
                                            <div className="space-y-4">
                                              <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1.5"><Label className="text-xs font-bold text-slate-700">Kdy bylo odstraněno?</Label><Input type="date" value={resolveData.datum} onChange={e => setResolveData(p => ({...p, datum: e.target.value}))} className="h-9" /></div>
                                                <div className="space-y-1.5"><Label className="text-xs font-bold text-slate-700">Vaše jméno</Label><Input value={resolveData.jmeno} onChange={e => setResolveData(p => ({...p, jmeno: e.target.value}))} placeholder="Jan Novák" className="h-9" /></div>
                                              </div>
                                              <div className="space-y-1.5"><Label className="text-xs font-bold text-slate-700">Doplňující komentář</Label><Textarea value={resolveData.poznamka} onChange={e => setResolveData(p => ({...p, poznamka: e.target.value}))} placeholder="Jak byla závada odstraněna..." className="min-h-[60px] text-sm" /></div>
                                              <div className="space-y-1.5">
                                                <Label className="text-xs font-bold text-slate-700 flex items-center gap-2"><Camera className="h-4 w-4 text-blue-600" /> Nahrát fotodůkaz (volitelně)</Label>
                                                <Input type="file" accept="image/*" multiple onChange={async (e) => {
                                                    const files = Array.from(e.target.files || []); if (files.length === 0) return;
                                                    const newPhotos: string[] = []; for (const f of files) newPhotos.push(await compressImage(f, FOTO_NEDOSTATKU));
                                                    setResolveData(p => ({...p, foto: [...p.foto, ...newPhotos]}));
                                                }} className="h-9 cursor-pointer text-xs" />
                                                {resolveData.foto.length > 0 && (
                                                  <div className="flex gap-2 mt-2 p-2 bg-slate-50 rounded border border-dashed">
                                                    {resolveData.foto.map((f, i) => (
                                                      <div key={i} className="relative group">
                                                         <img src={f} className="h-12 w-12 object-cover rounded shadow-sm border" />
                                                         <button onClick={() => setResolveData(p => ({...p, foto: p.foto.filter((_, idx) => idx !== i)}))} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 shadow"><X className="h-3 w-3" /></button>
                                                      </div>
                                                    ))}
                                                  </div>
                                                )}
                                              </div>
                                              <div className="flex gap-2 pt-2 border-t border-slate-100">
                                                <Button size="sm" onClick={() => handleConfirmResolve(bodId)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold">Odeslat</Button>
                                                <Button size="sm" variant="ghost" onClick={() => setResolvingBod(null)}>Zrušit</Button>
                                              </div>
                                            </div>
                                          </div>
                                        ) : (
                                          <Button onClick={() => { setResolvingBod(bodId); setResolveData({ datum: new Date().toISOString().split('T')[0], jmeno: '', poznamka: '', foto: [] }); }} size="sm" className="bg-white text-blue-700 border-blue-200 hover:bg-blue-50 font-bold shadow-sm">
                                             Odstranil(a) jsem tuto závadu
                                          </Button>
                                        )
                                      )}
                                    </div>
                                  )}

                                  {isAdmin && isResolvedByClient && (
                                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mt-4 shadow-sm">
                                       <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm mb-3"><CheckCircle2 className="h-5 w-5" /> Klient nahlásil odstranění závady</div>
                                       <div className="bg-white p-3 rounded-lg border border-emerald-100 space-y-3 text-sm">
                                          <div className="grid grid-cols-2 gap-4">
                                            <div><span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-0.5">Nahlásil</span><span className="font-bold">{kb.jmenoVyresitele}</span></div>
                                            <div><span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-0.5">Dne</span><span className="font-bold">{kb.datumVyreseniKlientem ? new Date(kb.datumVyreseniKlientem).toLocaleDateString('cs-CZ') : '-'}</span></div>
                                          </div>
                                          {kb.poznamkaKlienta && <div><span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-0.5">Komentář</span><p className="italic text-slate-700">{kb.poznamkaKlienta}</p></div>}
                                          {kb.fotoVyreseni && kb.fotoVyreseni.length > 0 && (
                                             <div className="pt-2 border-t border-slate-50 flex gap-2">
                                               {kb.fotoVyreseni.map((f: string, i: number) => (
                                                 <img key={i} src={f} onClick={() => setFullscreenImage(f)} className="h-16 w-16 object-cover rounded border cursor-zoom-in hover:opacity-80" />
                                               ))}
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
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
          
          <div className="space-y-6">
            <Card className="sticky top-6 shadow-sm border-slate-200 overflow-hidden">
              <CardHeader className="bg-slate-50/50 border-b pb-4">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800">
                  <Building className="h-4 w-4 text-blue-600" /> Detaily auditu
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-5 text-sm">
                <div>
                  <Label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-1">Klient</Label>
                  <p className="font-bold text-slate-900">{klient?.nazev || 'Neznámý'}</p>
                </div>
                <div>
                  <Label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-1">Kontrolovaná pracoviště</Label>
                  <div className="space-y-2 mt-1">
                    {pracovisteList.map((p: any) => (
                      <div key={p.id} className="flex gap-2 items-start bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <MapPin className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                        <span className="font-medium text-slate-700 leading-snug">{p.fullDisplay}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

        </div>

        {doporuceniList.length > 0 && (
          <Card className="border-[hsl(var(--stav-doporuceni))]/20 shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl font-bold text-slate-800 flex items-center gap-2">
                Doporučení auditora
                <span className="text-slate-400 font-normal">({doporuceniList.length})</span>
              </CardTitle>
              <CardDescription>
                Tyto body nejsou v rozporu s předpisy. Jde o návrhy nad rámec povinností —
                jejich realizace není podmínkou uzavření protokolu.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {doporuceniList.map((dop: any, idx: number) => (
                <div key={dop.bod} className="pl-4 py-3 paska paska-D bg-[hsl(var(--stav-doporuceni))]/5 rounded-r-lg">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="font-mono text-xs font-bold text-[hsl(var(--stav-doporuceni))]">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    {dop.otazka && <span className="font-semibold text-sm text-slate-800">{dop.otazka}</span>}
                  </div>
                  {dop.sekce && (
                    <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-2 font-mono">
                      [{dop.bod}] {dop.sekce}
                    </div>
                  )}
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{dop.text}</p>

                  {dop.foto.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {dop.foto.map((f: string, i: number) => (
                        <img key={i} src={f} alt={`Doporučení ${idx + 1}`} className="h-28 w-auto object-cover rounded border border-slate-200 shadow-sm" />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
