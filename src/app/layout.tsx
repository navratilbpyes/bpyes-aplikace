'use client';

import { DataProvider, useData, auth } from "@/components/data-provider";
import { useState } from "react";
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { 
  LayoutDashboard, 
  Building2, 
  ClipboardList, 
  PlusCircle, 
  Settings, 
  LogOut, 
  Loader2,
  Lock,
  User as UserIcon
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import "@/app/globals.css";

// Vnitřní komponenta rozvržení, která má přístup k přihlášenému uživateli
function AppLayoutContent({ children }: { children: React.ReactNode }) {
  const { user, userProfile, authLoading, logout } = useData();
  const pathname = usePathname();
  const { toast } = useToast();

  // Formulářový stav pro klasické přihlášení e-mailem
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast({ title: "Přihlášení úspěšné", description: "Vítejte v systému BPyes AuditFlow." });
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
    } catch (error) {
      console.error(error);
    }
  };

  // 1. Obrazovka načítání systému
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center space-y-4">
        <Loader2 className="h-10 w-10 text-blue-600 animate-spin" />
        <p className="text-sm font-medium text-slate-600">Zabezpečené spouštění systému...</p>
      </div>
    );
  }

  // 2. Obrazovka přihlášení (Pokud uživatel není přihlášen)
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
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="jmeno@firma.cz" 
                  required 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Přihlašovací heslo</Label>
                <Input 
                  id="password" 
                  type="password" 
                  placeholder="••••••••" 
                  required 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full h-11 bg-slate-900 hover:bg-slate-800 font-bold" disabled={loginLoading}>
                {loginLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Přihlásit se údaji
              </Button>
            </form>

            <div className="relative flex py-2 items-center text-xs text-muted-foreground uppercase">
              <div className="flex-grow border-t"></div>
              <span className="mx-3 shrink-0">Nebo firemní přístup</span>
              <div className="flex-grow border-t"></div>
            </div>

            <Button variant="outline" className="w-full h-11 font-bold border-slate-200" onClick={handleGoogleLogin}>
              <img src="https://www.google.com/favicon.ico" alt="Google" className="h-4 w-4 mr-2" />
              Ověřit přes Google Workspace
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isAdmin = userProfile.role === 'admin';

  // 3. Hlavní rozhraní přihlášené aplikace (S úpravami pro PDF tisk)
  return (
    <div className="min-h-screen bg-slate-50 flex print:bg-white print:block">
      
      {/* Levý navigační panel - ZMIZÍ PŘI TISKU (print:hidden) */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col justify-between shrink-0 border-r border-slate-800 print:hidden">
        <div className="p-6 space-y-8">
          <div>
            <h2 className="text-white text-xl font-black tracking-tight">BPyes</h2>
            <p className="text-[10px] uppercase tracking-wider font-bold text-blue-500">
              {isAdmin ? "Administrátor systému" : "Klientský portál"}
            </p>
          </div>

          <nav className="space-y-1">
            <Link 
              href="/" 
              className={`flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-lg transition-colors ${pathname === '/' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 hover:text-white'}`}
            >
              <LayoutDashboard className="h-4 w-4" /> Přehled reportů
            </Link>

            {isAdmin && (
              <>
                <Link 
                  href="/klienti" 
                  className={`flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-lg transition-colors ${pathname.startsWith('/klienti') ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 hover:text-white'}`}
                >
                  <Building2 className="h-4 w-4" /> Správa klientů
                </Link>
                <Link 
                  href="/zaznamy" 
                  className={`flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-lg transition-colors ${pathname.startsWith('/zaznamy') && pathname !== '/nova-kontrola' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 hover:text-white'}`}
                >
                  <ClipboardList className="h-4 w-4" /> Všechny audity
                </Link>
                <Link 
                  href="/nova-kontrola" 
                  className={`flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-lg transition-colors ${pathname === '/nova-kontrola' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 hover:text-white'}`}
                >
                  <PlusCircle className="h-4 w-4" /> Nová kontrola
                </Link>
                <Link 
                  href="/nastaveni" 
                  className={`flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-lg transition-colors ${pathname === '/nastaveni' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 hover:text-white'}`}
                >
                  <Settings className="h-4 w-4" /> Nastavení auditora
                </Link>
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
          <Button 
            variant="ghost" 
            className="w-full justify-start text-slate-400 hover:text-red-400 hover:bg-red-500/10 h-10 text-xs font-bold"
            onClick={logout}
          >
            <LogOut className="mr-2 h-4 w-4" /> Odhlásit se z cloudu
          </Button>
        </div>
      </aside>

      {/* Hlavní pracovní plocha - MĚNÍ SE CHOVÁNÍ SCROLLOVÁNÍ PRO TISK */}
      <main className="flex-1 overflow-y-auto print:overflow-visible print:w-full print:block">
        {children}
      </main>
    </div>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs">
      <body>
        <DataProvider>
          <AppLayoutContent>{children}</AppLayoutContent>
        </DataProvider>
      </body>
    </html>
  );
}
