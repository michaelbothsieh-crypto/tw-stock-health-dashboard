import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Sidebar } from "@/components/Sidebar";
import { Providers } from "@/components/Providers";
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
  title: "台股健康儀表板",
  description: "AI 智慧台股健康儀表板",
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
          <div className="min-h-screen">
            <Sidebar />
            <main className="min-h-screen overflow-x-hidden lg:ml-64">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
