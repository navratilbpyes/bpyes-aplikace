
'use client';

import { LayoutDashboard, Users, FileText, PlusCircle, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const items = [
  { title: "Přehled", url: "/", icon: LayoutDashboard },
  { title: "Klienti", url: "/klienti", icon: Users },
  { title: "Nová", url: "/nova-kontrola", icon: PlusCircle },
  { title: "Záznamy", url: "/zaznamy", icon: FileText },
  { title: "Číselníky", url: "/ciselniky", icon: BookMarked },
  { title: "Nastavení", url: "/nastaveni", icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t flex md:hidden z-50 items-center justify-around px-2">
      {items.map((item) => (
        <Link 
          key={item.title} 
          href={item.url} 
          className={cn(
            "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors",
            pathname === item.url ? "text-primary font-semibold" : "text-muted-foreground"
          )}
        >
          <item.icon className={cn("h-5 w-5", pathname === item.url && "scale-110")} />
          <span className="text-[10px]">{item.title}</span>
        </Link>
      ))}
    </nav>
  );
}
