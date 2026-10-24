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
      <body className="h-full w-full bg-slate-50 text-slate-900 flex flex-col md:flex-row m-0 p-0 overflow-x-hidden">
        {/* 네비게이션 영역 */}
        <Sidebar />
        
        {/* PC에서는 사이드바 공간(md:pl-64)을 확보하고, 본문 전체에 균일한 여백 적용 */}
        <div className="flex-1 flex flex-col min-w-0 w-full md:pl-64">
          <main className="flex-1 w-full min-h-screen pt-16 pb-24 md:py-8 md:px-8 px-3 bg-slate-50">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}