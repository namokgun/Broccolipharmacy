import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/AppShell";

const inter = Inter({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "브로콜리약국 CRM",
  description: "브로콜리약국 고객 및 상담 관리 시스템",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${inter.className} h-full w-full bg-slate-50 antialiased`}>
      <body className="h-full w-full bg-slate-50 text-slate-900 flex flex-col md:flex-row m-0 p-0 overflow-x-hidden">
        <AppShell>
          {children}
        </AppShell>
      </body>
    </html>
  );
}