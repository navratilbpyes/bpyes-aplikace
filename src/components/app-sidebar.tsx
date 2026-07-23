
'use client';

import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  PlusCircle, 
  Settings,
  ShieldCheck
  BookMarked
  } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from "@/components/ui/sidebar";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { title: "Přehled", url: "/", icon: LayoutDashboard },
  { title: "Klienti", url: "/klienti", icon: Users },
  { title: "Záznamy", url: "/zaznamy", icon: FileText },
  { title: "Nová kontrola", url: "/nova-kontrola", icon: PlusCircle },
  { title: "Číselníky", url: "/ciselniky", icon: BookMarked },
  { title: "Nastavení", url: "/nastaveni", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar variant="sidebar" className="border-r bg-white hidden md:flex">
      <SidebarHeader className="p-6">
        <div className="flex flex-col gap-0.5">
          <span className="text-2xl font-bold tracking-tight text-primary">BPyes</span>
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">s.r.o.</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="px-4 text-[10px] font-bold uppercase text-muted-foreground/60 tracking-wider">Navigace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="px-2 pt-2">
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={pathname === item.url} tooltip={item.title}>
                    <Link href={item.url} className="flex items-center gap-3 py-6 px-4">
                      <item.icon className="h-5 w-5" />
                      <span className="font-medium text-[15px]">{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <div className="mt-auto p-6 border-t">
        <div className="flex items-center gap-3 text-accent">
          <ShieldCheck className="h-5 w-5" />
          <span className="text-xs font-bold uppercase tracking-wider">BOZP & PO Certifikace</span>
        </div>
      </div>
    </Sidebar>
  );
}
