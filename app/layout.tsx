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
    <html lang="ko" className={`${inter.className} h-full w-full bg-slate-50 antialiased`}>
      <body className="h-full w-full bg-slate-50 text-slate-900 flex flex-col m-0 p-0 overflow-x-hidden">
        {/* 네비게이션 영역 */}
        <Sidebar />
        
        {/* 본문 영역: 모바일 좌우 패딩을 px-3으로 줄여서 좌우로 넓게 확장 */}
        <main className="flex-1 md:pl-64 w-full min-h-screen pt-16 pb-24 md:py-6 px-3 md:px-8 bg-slate-50">
          {children}
        </main>
      </body>
    </html>
  );
}