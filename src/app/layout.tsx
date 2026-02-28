import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Sidebar } from "@/components/Sidebar";
import { Providers } from "@/components/Providers";
import { VisitorStats } from "@/components/ui/VisitorStats";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "台股診斷",
  description: "AI 智慧台股診斷儀表板",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} dark overflow-x-hidden bg-neutral-950 antialiased`}>
        <Providers>
          <div className="min-h-screen flex flex-col lg:flex-row">
            <Sidebar />
            <div className="flex-1 flex flex-col min-h-screen">
              <main className="flex-1 overflow-x-hidden lg:ml-64">{children}</main>
              <footer className="lg:hidden border-t border-neutral-800/50 bg-neutral-950 p-4 flex justify-center">
                <VisitorStats />
              </footer>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
