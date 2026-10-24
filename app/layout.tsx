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
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${inter.className} h-full antialiased w-full overflow-x-hidden`}>
      <body className="min-h-screen w-full bg-slate-50 text-slate-900 flex flex-col md:flex-row overflow-x-hidden">
        {/* 모바일에서는 상단 헤더, PC에서는 왼쪽 사이드바 */}
        <Sidebar />
        
        {/* 본문 및 모바일 하단 바를 포함하는 영역 */}
        <div className="flex-1 flex flex-col min-w-0 w-full md:pl-64">
          <main className="flex-1 p-4 md:p-8 w-full">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}