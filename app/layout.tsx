import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

const inter = Inter({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "브로콜리약국 CRM",
  description: "브로콜리약국 고객 및 상담 관리 시스템",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${inter.className} h-full antialiased w-full overflow-x-hidden`}>
      <body className="min-h-screen w-full bg-slate-50 text-slate-900 flex flex-col md:flex-row overflow-x-hidden">
        {/* 공통 사이드바 (PC 왼쪽 고정 / 모바일 상하단바 포함) */}
        <Sidebar />
        
        {/* 본문 영역: PC에서는 왼쪽 여백(md:pl-64)을 줘서 사이드바랑 안 겹치게 함 */}
        <div className="flex-1 flex flex-col min-w-0 w-full md:pl-64">
          <main className="flex-1 p-4 md:p-8 pt-20 pb-24 md:pt-8 md:pb-8 w-full">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}