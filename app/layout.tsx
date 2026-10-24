import type { Metadata } from "next";
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${inter.className} h-full antialiased`}>
      <body className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
        {/* 공통 사이드바 (내부에 PC 고정 사이드바 및 모바일 상하단바 포함) */}
        <Sidebar />
        
        {/* 본문 영역: PC에서는 왼쪽 여백(md:pl-64)을 줘서 겹침 방지 */}
        <main className="flex-1 md:pl-64 pt-4 pb-24 md:py-6 px-4 md:px-8">
          {children}
        </main>
      </body>
    </html>
  );
}