
import type {Metadata} from 'next';
import './globals.css';
import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { BottomNav } from "@/components/bottom-nav"
import { Toaster } from "@/components/ui/toaster"
import { DataProvider } from '@/components/data-provider';

export const metadata: Metadata = {
  title: 'BPyes AuditFlow - BOZP a PO Software',
  description: 'Profesionální software pro audity BOZP a PO',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="cs">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased min-h-screen bg-background text-foreground">
        <DataProvider>
          <SidebarProvider defaultOpen={true}>
            <div className="flex min-h-screen w-full">
              <AppSidebar />
              <main className="flex-1 pb-20 md:pb-0 overflow-x-hidden">
                {children}
              </main>
              <BottomNav />
            </div>
            <Toaster />
          </SidebarProvider>
        </DataProvider>
      </body>
    </html>
  );
}
