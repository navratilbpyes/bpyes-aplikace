'use client';

import { DataProvider, useData, auth } from "@/components/data-provider";
import { useState } from "react";
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { 
  LayoutDashboard, 
  Building2, 
  ClipboardList,
  BookMarked,
  CalendarClock,
  PlusCircle, 
  Settings, 
  LogOut, 
  Loader2,
  Lock,
  User as UserIcon,
  Menu,
  X
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/app/lib/utils";
import "@/app/globals.css";

function AppLayoutContent({ children }: { children: React.ReactNode }) {
  const { user, userProfile, authLoading, logout } = useData();
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  
  // Stav pro zobrazení mobilního menu
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast({ title: "Přihlášení úspěšné", description: "Vítejte v systému BPyes AuditFlow." });
      router.replace("/"); // po prihlaseni vzdy na Prehled, ne na posledni stranku
    } catch (error: any) {
      toast({ 
        title: "Chyba přihlášení", 
        description: "Nesprávný e-mail nebo heslo. Zkontrolujte prosím údaje.", 
        variant: "destructive" 
      });
    } finally {
      setLoginLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      toast({ title: "Přihlášení úspěšné", description: "Byl jste ověřen prostřednictvím Google účtu." });
      router.replace("/"); // po prihlaseni vzdy na Prehled
    } catch (error) {
      console.error(error);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center space-y-4">
        <Loader2 className="h-10 w-10 text-blue-600 animate-spin" />
        <p className="text-sm font-medium text-slate-600">Zabezpečené spouštění systému...</p>
      </div>
    );
  }

  // Verejne stranky, ktere se zobrazi i bez prihlaseni (napr. nastaveni hesla z pozvanky)
  const verejneStranky = ['/nastavit-heslo'];
  if (verejneStranky.some((p) => pathname.startsWith(p))) {
    return <>{children}</>;
  }

  if (!user || !userProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-white/95 backdrop-blur shadow-2xl border-none">
          <CardHeader className="space-y-2 text-center">
            <div className="mx-auto h-12 w-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 mb-2">
              <Lock className="h-6 w-6" />
            </div>
            <CardTitle className="text-2xl font-black tracking-tight">BPyes AuditFlow</CardTitle>
            <CardDescription>Vstup do klientského portálu a správy auditů.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mailová adresa</Label>
                <Input id="email" type="email" placeholder="jmeno@firma.cz" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Přihlašovací heslo</Label>
                <Input id="password" type="password" placeholder="••••••••" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button type="submit" className="w-full h-11 bg-slate-900 hover:bg-slate-800 font-bold" disabled={loginLoading}>
                {loginLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Přihlásit se údaji
              </Button>
            </form>
            <div className="relative flex py-2 items-center text-xs text-muted-foreground uppercase">
              <div className="flex-grow border-t"></div><span className="mx-3 shrink-0">Nebo firemní přístup</span><div className="flex-grow border-t"></div>
            </div>
            <Button variant="outline" className="w-full h-11 font-bold border-slate-200" onClick={handleGoogleLogin}>
              <img src="https://www.google.com/favicon.ico" alt="Google" className="h-4 w-4 mr-2" /> Ověřit přes Google Workspace
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isAdmin = userProfile.role === 'admin';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row print:bg-white print:block">
      
      {/* HLAVIČKA POUZE PRO MOBILY */}
      <div className="md:hidden flex items-center justify-between bg-slate-900 h-16 px-4 text-white print:hidden z-40 shrink-0 shadow-md">
        <div className="flex items-center gap-2">
          <span className="font-black text-xl tracking-tight">BPyes AuditFlow</span>
          <span className="text-[10px] uppercase font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">{isAdmin ? "Admin" : "Klient"}</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="text-white hover:bg-slate-800">
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </Button>
      </div>

      {/* LEVÝ NAVIGAČNÍ PANEL (Desktop i Mobilní vysouvací verze) */}
      <aside className={cn(
        "w-64 bg-slate-900 text-slate-300 flex flex-col justify-between border-r border-slate-800 print:hidden shrink-0",
        "fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 shadow-2xl md:shadow-none",
        mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 space-y-6">
          <div className="hidden md:block">
            <h2 className="text-white text-2xl font-black tracking-tight">BPyes AuditFlow</h2>
            <p className="text-[10px] uppercase tracking-wider font-bold text-blue-500 mt-0.5">
              {isAdmin ? "Administrátor systému" : "Klientský portál"}
            </p>
          </div>
          
          <div className="md:hidden flex justify-between items-center pb-2 border-b border-slate-800">
            <span className="text-xs uppercase font-bold text-slate-400 tracking-wider">Navigace</span>
            <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(false)} className="h-8 w-8 text-slate-400 hover:text-white"><X className="h-5 w-5" /></Button>
          </div>

          <nav className="space-y-1">
            
            {/* TLAČÍTKO NOVÁ KONTROLA NENÍ ZAMÍCHANÉ V MENU, JE VÝRAZNÉ A NAHOŘE */}
            {isAdmin && (
              <div className="mb-6 space-y-4">
                <Button asChild className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-11 justify-start px-4 shadow-sm border border-blue-500/50">
                  <Link href="/nova-kontrola" onClick={() => setMobileMenuOpen(false)}>
                    <PlusCircle className="mr-3 h-5 w-5" /> Nová kontrola
                  </Link>
                </Button>
                <div className="border-b border-slate-800/80"></div>
              </div>
            )}

            <Link href="/" onClick={() => setMobileMenuOpen(false)} className={cn("flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-lg transition-colors", pathname === '/' ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/50 hover:text-white')}>
              <LayoutDashboard className="h-4 w-4" /> Přehled
            </Link>

            {isAdmin && (
              <>
                <Link href="/zaznamy" onClick={() => setMobileMenuOpen(false)} className={cn("flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-lg transition-colors", pathname.startsWith('/zaznamy') && pathname !== '/nova-kontrola' ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/50 hover:text-white')}>
                  <ClipboardList className="h-4 w-4" /> Reporty
                </Link>
                <Link href="/klienti" onClick={() => setMobileMenuOpen(false)} className={cn("flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-lg transition-colors", pathname.startsWith('/klienti') ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/50 hover:text-white')}>
                  <Building2 className="h-4 w-4" /> Klienti
                </Link>

                <Link href="/ciselniky" onClick={() => setMobileMenuOpen(false)} className={cn("flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-lg transition-colors", pathname.startsWith('/ciselniky') ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/50 hover:text-white')}>
                  <BookMarked className="h-4 w-4" /> Číselníky
                </Link>

                <Link href="/plan" onClick={() => setMobileMenuOpen(false)} className={cn("flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-lg transition-colors", pathname.startsWith('/plan') ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/50 hover:text-white')}>
                  <CalendarClock className="h-4 w-4" /> Časový plán
                </Link>
                
                <div className="pt-4 mt-4 border-t border-slate-800/80">
                  <Link href="/nastaveni" onClick={() => setMobileMenuOpen(false)} className={cn("flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-lg transition-colors text-slate-400 hover:text-slate-300", pathname === '/nastaveni' ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/50')}>
                    <Settings className="h-4 w-4" /> Nastavení auditora
                  </Link>
                </div>
              </>
            )}
          </nav>
        </div>

        <div className="p-4 border-t border-slate-800 bg-slate-950/40 space-y-3">
          <div className="flex items-center gap-2.5 px-2 py-1">
            <div className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-300">
              <UserIcon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-white truncate">{user.email}</p>
              <p className="text-[10px] text-slate-500 truncate">ID: {userProfile.klientId || "Interní"}</p>
            </div>
          </div>
          <Button variant="ghost" className="w-full justify-start text-slate-400 hover:text-red-400 hover:bg-red-500/10 h-10 text-xs font-bold" onClick={logout}>
            <LogOut className="mr-2 h-4 w-4" /> Odhlásit se z cloudu
          </Button>
        </div>
      </aside>

      {/* Překryvné černé pozadí pro mobil při otevřeném menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 md:hidden animate-in fade-in" onClick={() => setMobileMenuOpen(false)}></div>
      )}

      {/* HLAVNÍ PRACOVNÍ PLOCHA */}
      <main className="flex-1 overflow-y-auto print:overflow-visible print:w-full print:block">
        {children}
      </main>
    </div>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Chivo:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <style>{`
          :root {
            --font-chivo: 'Chivo';
            --font-mono: 'JetBrains Mono';
          }
        `}</style>
      </head>
      <body>
        <DataProvider>
          <AppLayoutContent>{children}</AppLayoutContent>
        </DataProvider>
      </body>
    </html>
  );
}
