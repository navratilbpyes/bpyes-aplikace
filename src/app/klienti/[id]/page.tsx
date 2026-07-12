'use client';

import { useData } from "@/components/data-provider";
import { db, auth } from "@/components/data-provider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { doc, setDoc } from "firebase/firestore";
import { adresaZAres } from "@/lib/kontroly";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  Building2, 
  MapPin, 
  User, 
  Mail, 
  Phone, 
  Plus, 
  ChevronLeft, 
  RefreshCw,
  MoreVertical,
  ClipboardList,
  Eye,
  Briefcase,
  Edit2,
  KeyRound,
  Loader2,
  Send,
  CheckCircle2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { cn } from "@/app/lib/utils";

export default function ClientDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { klienti, zaznamy, setKlienti } = useData();
  const { toast } = useToast();
  const [isAresLoading, setIsAresLoading] = useState(false);

  // Vytvoření klientského přístupu
  const [showPristupModal, setShowPristupModal] = useState(false);
  const [pristupEmail, setPristupEmail] = useState('');
  const [vytvarimPristup, setVytvarimPristup] = useState(false);

  // Stav pristupu kontaktnich osob
  // mapa email(lowercase) -> 'nastaveno' | 'pozvano' (ucet existuje, heslo jeste ne)
  const [pristupy, setPristupy] = useState<Record<string, 'nastaveno' | 'pozvano'>>({});
  const [nacitamPristupy, setNacitamPristupy] = useState(false);
  const [odesilamEmail, setOdesilamEmail] = useState<string | null>(null); // email prave odesilany
  const [odesilamVsem, setOdesilamVsem] = useState(false);

  // nacte, kdo uz ma pristup (po nacteni klienta)
  const nacistPristupy = async (klientId: string) => {
    setNacitamPristupy(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/pristupy-klienta?klientId=${encodeURIComponent(klientId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        const mapa: Record<string, 'nastaveno' | 'pozvano'> = {};
        for (const p of data.pristupy as { email: string; hesloNastaveno: boolean }[]) {
          mapa[p.email] = p.hesloNastaveno ? 'nastaveno' : 'pozvano';
        }
        setPristupy(mapa);
      }
    } catch (e) {
      console.error('Nacteni pristupu:', e);
    } finally {
      setNacitamPristupy(false);
    }
  };

  // posle pristup jedne osobe; vraci true pri uspechu
  const poslatPristupOsobe = async (email: string): Promise<boolean> => {
    const klientAkt = klienti.find((k) => k.id === id);
    if (!klientAkt) return false;
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/vytvorit-klienta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email, klientId: klientAkt.id, klientNazev: klientAkt.nazev }),
      });
      const data = await res.json();
      if (data.success) {
        setPristupy((p) => ({ ...p, [email.toLowerCase()]: 'pozvano' }));
        return true;
      }
      // 409 = uz existuje: taky oznacime jako pozvano, at to sedi
      if (res.status === 409) {
        setPristupy((p) => ({ ...p, [email.toLowerCase()]: p[email.toLowerCase()] || 'pozvano' }));
      }
      toast({ title: `Přístup: ${email}`, description: data.error || 'Nepodařilo se.', variant: 'destructive' });
      return false;
    } catch {
      toast({ title: 'Chyba sítě', description: `Nepodařilo se odeslat na ${email}.`, variant: 'destructive' });
      return false;
    }
  };

  const poslatJedne = async (email: string) => {
    setOdesilamEmail(email);
    const ok = await poslatPristupOsobe(email);
    if (ok) toast({ title: 'Přístup odeslán', description: `Pozvánka byla odeslána na ${email}.` });
    setOdesilamEmail(null);
  };

  const poslatVsem = async () => {
    const klientAkt = klienti.find((k) => k.id === id);
    if (!klientAkt) return;
    // kontakty s emailem, ktere jeste nemaji pristup
    const cile = (klientAkt.kontakty || [])
      .filter((k: any) => k.email?.includes('@'))
      .map((k: any) => k.email.trim())
      .filter((e: string) => !pristupy[e.toLowerCase()]);

    if (cile.length === 0) {
      toast({ title: 'Nic k odeslání', description: 'Všechny kontaktní osoby s e-mailem už mají přístup.' });
      return;
    }
    setOdesilamVsem(true);
    let uspesne = 0;
    for (const email of cile) {
      const ok = await poslatPristupOsobe(email);
      if (ok) uspesne++;
    }
    setOdesilamVsem(false);
    toast({
      title: 'Hromadné pozvánky odeslány',
      description: `Odesláno ${uspesne} z ${cile.length} pozvánek.`,
    });
  };

  const otevritPristup = () => {
    if (!klient) return;
    // Předvyplníme hlavní kontakt, jinak první s e-mailem.
    const kontakty = (klient.kontakty || []).filter((k: any) => k.email?.includes('@'));
    const hlavni = kontakty.find((k: any) => k.hlavni) || kontakty[0];
    setPristupEmail(hlavni?.email || '');
    setShowPristupModal(true);
  };

  const vytvoritPristup = async () => {
    if (!klient) return;
    const email = pristupEmail.trim();
    if (!email.includes('@')) {
      toast({ title: 'Neplatný e-mail', description: 'Zadejte platnou e-mailovou adresu.', variant: 'destructive' });
      return;
    }

    setVytvarimPristup(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/vytvorit-klienta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email, klientId: klient.id, klientNazev: klient.nazev }),
      });
      const data = await res.json();

      if (data.success) {
        toast({ title: 'Přístup vytvořen', description: data.zprava });
        setShowPristupModal(false);
      } else {
        toast({ title: 'Nepodařilo se vytvořit přístup', description: data.error, variant: 'destructive' });
      }
    } catch (e) {
      console.error('Vytvoření přístupu:', e);
      toast({ title: 'Chyba sítě', description: 'Nepodařilo se spojit se serverem.', variant: 'destructive' });
    } finally {
      setVytvarimPristup(false);
    }
  };

  const klient = klienti.find(k => k.id === id);
  const clientRecords = zaznamy.filter(z => z.klientId === id);

  // po nacteni klienta stahni stav pristupu jeho kontaktnich osob
  useEffect(() => {
    if (klient?.id) nacistPristupy(klient.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [klient?.id]);

  if (!klient) {
    return <div className="p-8">Klient nenalezen.</div>;
  }

  const handleNacistZAres = async () => {
    const cleanIco = (klient.ico || '').replace(/\s/g, '');
    if (!cleanIco) {
      toast({ title: "Chybí IČO", description: "Bez IČO nelze data z registru načíst.", variant: "destructive" });
      return;
    }

    setIsAresLoading(true);
    try {
      const response = await fetch(`https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${cleanIco}`);
      if (!response.ok) throw new Error("Subjekt nenalezen");

      const data = await response.json();
      const adresa = adresaZAres(data);

      const aktualizovano = {
        ...klient,
        nazev: data.obchodniJmeno || klient.nazev,
        dic: data.dic || klient.dic || '',
        sidlo: adresa.sidlo || klient.sidlo || '',
        psc: adresa.psc || klient.psc || '',
        mesto: adresa.mesto || klient.mesto,
      };

      await setDoc(doc(db, 'klienti', klient.id), aktualizovano);
      if (setKlienti) setKlienti((prev: any[]) => prev.map(k => k.id === klient.id ? aktualizovano : k));

      toast({ title: "Načteno z ARES", description: "Údaje klienta byly aktualizovány ze státního registru." });
    } catch (err) {
      console.error('ARES:', err);
      toast({ title: "Načtení se nezdařilo", description: "Subjekt s tímto IČO nebyl v registru ARES nalezen.", variant: "destructive" });
    } finally {
      setIsAresLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{klient.nazev}</h1>
            <p className="text-muted-foreground">Detail klienta a správa pracovišť</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleNacistZAres} disabled={isAresLoading}>
            <RefreshCw className={cn("mr-2 h-4 w-4", isAresLoading && "animate-spin")} />
            Načíst z ARES
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/klienti/${klient.id}/edit`}>
              <Edit2 className="mr-2 h-4 w-4" />
              Upravit
            </Link>
          </Button>
          <Button variant="outline" onClick={otevritPristup}>
            <KeyRound className="mr-2 h-4 w-4" />
            Vytvořit přístup
          </Button>
          <Button asChild>
            <Link href={`/nova-kontrola?klient=${klient.id}`}>
              <Plus className="mr-2 h-4 w-4" />
              Nová kontrola
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Info */}
        <div className="space-y-6">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Základní údaje</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs uppercase">Název / IČO</Label>
                  <p className="font-semibold">{klient.nazev}</p>
                  <p className="text-sm font-mono">{klient.ico} {klient.dic && `/ ${klient.dic}`}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs uppercase">Sídlo</Label>
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 mt-1 text-muted-foreground" />
                    <div>
                      <p>{klient.sidlo || klient.mesto || 'Sídlo neuvedeno'}</p>
                      {klient.psc && <p>{klient.psc} {klient.mesto}</p>}
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs uppercase">
                    Hlavní kontakt
                  </Label>
                  {(() => {
                    const vsechny = (klient.kontakty || []).filter((k: any) => k.jmeno?.trim());
                    // Hlavních kontaktů může být víc (např. dva jednatelé).
                    // Když žádný není označen, ukážeme první zadaný.
                    const oznaceni = vsechny.filter((k: any) => k.hlavni);
                    const hlavni = oznaceni.length > 0 ? oznaceni : vsechny.slice(0, 1);

                    if (hlavni.length === 0) {
                      return (
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Neuvedeno</span>
                        </div>
                      );
                    }

                    const ostatnich = vsechny.length - hlavni.length;

                    return (
                      <div className="space-y-3">
                        {hlavni.map((kontakt: any, i: number) => (
                          <div key={kontakt.id || i} className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span>
                                {kontakt.jmeno}
                                {kontakt.funkce && <span className="text-muted-foreground"> · {kontakt.funkce}</span>}
                              </span>
                            </div>
                            {kontakt.email && (
                              <div className="flex items-center gap-2">
                                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                                <a href={`mailto:${kontakt.email}`} className="text-blue-600 hover:underline break-all">{kontakt.email}</a>
                              </div>
                            )}
                            {kontakt.telefon && (
                              <div className="flex items-center gap-2">
                                <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                                <a href={`tel:${kontakt.telefon.replace(/\s/g, '')}`} className="hover:underline">{kontakt.telefon}</a>
                              </div>
                            )}
                          </div>
                        ))}
                        {ostatnich > 0 && (
                          <span className="text-[11px] text-muted-foreground block">
                            + {ostatnich} další kontakt{ostatnich === 1 ? '' : ostatnich < 5 ? 'y' : 'ů'}
                          </span>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Tabs */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="pracoviste" className="space-y-6">
            <TabsList className="w-full justify-start h-auto p-1 bg-secondary">
              <TabsTrigger value="pracoviste" className="px-6 py-2">Pracoviště</TabsTrigger>
              <TabsTrigger value="osoby" className="px-6 py-2">Kontaktní osoby</TabsTrigger>
              <TabsTrigger value="pozice" className="px-6 py-2">Odpovědné osoby</TabsTrigger>
              <TabsTrigger value="zaznamy" className="px-6 py-2">Záznamy kontrol</TabsTrigger>
            </TabsList>

            <TabsContent value="pracoviste" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold">Seznam pracovišť ({klient.pracoviste?.length || 0})</h3>
                <Button size="sm" variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  Přidat pracoviště
                </Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Bezpečný přístup přes || [] k poli pracoviště */}
                {(klient.pracoviste || []).map((p: any) => (
                  <Card key={p.id} className="border-none shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-base">{p.nazev}</CardTitle>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </div>
                      <CardDescription>{p.adresa || p.mesto || 'Adresa nezadána'}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {/* Bezpečný přístup k historickým "prostorům" */}
                        {(p.prostory || []).map((area: string) => (
                          <Badge key={area} variant="secondary" className="font-normal">{area}</Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="osoby" className="space-y-4">
              {(() => {
                const osoby = (klient.kontakty || []).filter((k: any) => k.jmeno?.trim());
                return (
                  <>
                    <div className="flex justify-between items-center">
                      <h3 className="font-bold">Kontaktní osoby ({osoby.length})</h3>
                      <div className="flex gap-2">
                        {osoby.some((k: any) => k.email?.includes('@')) && (
                          <Button
                            size="sm"
                            onClick={poslatVsem}
                            disabled={odesilamVsem || nacitamPristupy}
                          >
                            {odesilamVsem ? (
                              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Odesílám…</>
                            ) : (
                              <><Send className="mr-2 h-4 w-4" /> Poslat přístup všem</>
                            )}
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => router.push(`/klienti/${klient.id}/edit`)}>
                          <Plus className="mr-2 h-4 w-4" />
                          Přidat osobu
                        </Button>
                      </div>
                    </div>

                    {osoby.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground text-sm border border-dashed rounded-lg">
                        Zatím nejsou zadány žádné kontaktní osoby.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-4">
                        {osoby.map((o: any) => (
                          <Card key={o.id || o.jmeno} className="border-none shadow-sm">
                            <CardContent className="flex items-center justify-between p-6">
                              <div className="flex items-center gap-4">
                                <div className="h-10 w-10 rounded-full bg-primary/5 flex items-center justify-center shrink-0">
                                  <User className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-bold">{o.jmeno}</p>
                                    {o.hlavni && (
                                      <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded bg-[hsl(var(--stav-vyhovuje))]/10 text-[hsl(var(--stav-vyhovuje))]">
                                        Hlavní
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-sm text-muted-foreground">{o.funkce}</p>
                                </div>
                              </div>
                              <div className="flex gap-8">
                                {o.email && (
                                  <div className="hidden md:flex flex-col">
                                    <span className="text-[10px] uppercase text-muted-foreground font-bold">Email</span>
                                    <a href={`mailto:${o.email}`} className="text-sm text-blue-600 hover:underline">{o.email}</a>
                                  </div>
                                )}
                                {o.telefon && (
                                  <div className="hidden md:flex flex-col">
                                    <span className="text-[10px] uppercase text-muted-foreground font-bold">Telefon</span>
                                    <a href={`tel:${o.telefon.replace(/\s/g, '')}`} className="text-sm hover:underline">{o.telefon}</a>
                                  </div>
                                )}
                                {/* Stav pristupu + tlacitko */}
                                <div className="flex items-center min-w-[150px] justify-end">
                                  {!o.email?.includes('@') ? (
                                    <span className="text-xs text-muted-foreground italic">bez e-mailu</span>
                                  ) : pristupy[o.email.toLowerCase()] === 'nastaveno' ? (
                                    <span className="inline-flex items-center gap-1 text-xs font-bold text-[hsl(var(--stav-vyhovuje))]">
                                      <CheckCircle2 className="h-4 w-4" /> Má přístup
                                    </span>
                                  ) : pristupy[o.email.toLowerCase()] === 'pozvano' ? (
                                    <div className="flex flex-col items-end gap-1">
                                      <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600">
                                        <Mail className="h-4 w-4" /> Pozvánka odeslána
                                      </span>
                                      <button
                                        onClick={() => poslatJedne(o.email.trim())}
                                        disabled={odesilamEmail === o.email.trim()}
                                        className="text-[11px] text-blue-600 hover:underline disabled:opacity-50"
                                      >
                                        {odesilamEmail === o.email.trim() ? 'Odesílám…' : 'Poslat znovu'}
                                      </button>
                                    </div>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => poslatJedne(o.email.trim())}
                                      disabled={odesilamEmail === o.email.trim() || nacitamPristupy}
                                    >
                                      {odesilamEmail === o.email.trim() ? (
                                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Odesílám…</>
                                      ) : (
                                        <><Send className="mr-2 h-4 w-4" /> Poslat přístup</>
                                      )}
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}
            </TabsContent>

            <TabsContent value="pozice" className="space-y-4">
              {(() => {
                // Odpovědné osoby jsou pracovní pozice, ne konkrétní lidé.
                // Slouží k přiřazení, kdo má odstranit zjištěný nedostatek.
                const pozice = (klient.pozice || []).filter((p: any) => p.nazev?.trim());
                return (
                  <>
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="font-bold">Odpovědné osoby ({pozice.length})</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Pracovní pozice, kterým lze přiřadit odstranění nedostatku.
                        </p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => router.push(`/klienti/${klient.id}/edit`)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Přidat pozici
                      </Button>
                    </div>

                    {pozice.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground text-sm border border-dashed rounded-lg">
                        Zatím nejsou zadány žádné odpovědné osoby.
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {pozice.map((p: any) => (
                          <div
                            key={p.id || p.nazev}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-white text-sm"
                          >
                            <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="font-medium">{p.nazev}</span>
                            {p.isFixed && (
                              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                pevná
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}
            </TabsContent>

            <TabsContent value="zaznamy" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold">Historie kontrol ({clientRecords.length})</h3>
              </div>

              <Card className="border-none shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-secondary/50 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-6 py-4">Číslo</th>
                        <th className="px-6 py-4">Typ</th>
                        <th className="px-6 py-4">Datum</th>
                        <th className="px-6 py-4">Závady</th>
                        <th className="px-6 py-4">Stav</th>
                        <th className="px-6 py-4"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {clientRecords.map(z => (
                        <tr key={z.id} className="hover:bg-muted/30">
                          <td className="px-6 py-4 font-mono font-medium">{z.cislo}</td>
                          <td className="px-6 py-4">
                            <Badge variant="outline">{z.typKontroly}</Badge>
                          </td>
                          <td className="px-6 py-4">{z.datum ? new Date(z.datum).toLocaleDateString('cs-CZ') : '-'}</td>
                          <td className="px-6 py-4">
                            {/* Bezpečný přístup k závadám */}
                            <span className={(z.zavady?.length || 0) > 0 ? "text-red-600 font-bold" : "text-green-600 font-bold"}>
                              {z.zavady?.length || 0}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <Badge variant={z.stav === 'otevreny' ? 'destructive' : 'secondary'}>{z.stav === 'otevreny' ? 'V řešení' : 'Uzavřeno'}</Badge>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <Button variant="ghost" size="icon" asChild>
                              <Link href={`/zaznamy/${z.id}`}>
                                <Eye className="h-4 w-4" />
                              </Link>
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {clientRecords.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                            Pro tohoto klienta zatím nebyla provedena žádná kontrola.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <Dialog open={showPristupModal} onOpenChange={(o) => !o && setShowPristupModal(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vytvořit přístup pro {klient.nazev}</DialogTitle>
            <DialogDescription>
              Klientovi vznikne účet a přijde mu e-mail s odkazem pro nastavení hesla.
              Heslo neuvidíte vy ani nikdo jiný.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <Label className="text-xs font-bold">E-mail klienta</Label>
            <Input
              type="email"
              value={pristupEmail}
              onChange={(e) => setPristupEmail(e.target.value)}
              placeholder="jan.novak@firma.cz"
              disabled={vytvarimPristup}
            />
            <p className="text-[11px] text-muted-foreground">
              Na tuto adresu se klient bude přihlašovat. Uvidí pouze záznamy této firmy.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPristupModal(false)} disabled={vytvarimPristup}>
              Zrušit
            </Button>
            <Button onClick={vytvoritPristup} disabled={vytvarimPristup || !pristupEmail.trim()}>
              {vytvarimPristup ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Vytvářím…</>
              ) : (
                'Vytvořit a odeslat pozvánku'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
