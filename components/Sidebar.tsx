"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import { useEffect, useState } from "react";

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [currentHash, setCurrentHash] = useState("");

  useEffect(() => {
    setCurrentHash(window.location.hash);
    const handleHashChange = () => setCurrentHash(window.location.hash);
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const isConsultPage = pathname === "/consultations";
  const isWriteActive = isConsultPage && currentHash !== "#history";
  const isHistoryActive = isConsultPage && currentHash === "#history";

  const handleNavClick = (hash: string) => {
    setCurrentHash(hash);
    if (pathname === "/consultations") {
      window.location.hash = hash;
      window.dispatchEvent(new Event("hashchange"));
    }
  };

  return (
    <>
      {/* 💻 PC 전용 왼쪽 슬림 고정 사이드바 */}
      <aside className="hidden md:flex fixed top-0 left-0 h-screen w-56 flex-col bg-white border-r border-slate-100 shadow-xs z-30">
        <div className="p-5 border-b border-slate-100 flex items-center gap-2.5">
          <Image 
            src="/logo.png" 
            alt="브로콜리약국 로고" 
            width={32} 
            height={32} 
            className="object-contain rounded-lg"
          />
          <div>
            <div className="font-extrabold text-base text-slate-900 leading-tight">
              브로콜리약국
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">운영중</p>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto text-xs">
          {/* 1. 대시보드 */}
          <Link 
            href="/" 
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition font-semibold ${
              pathname === "/" ? "bg-teal-900 text-white shadow-xs" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <span>📊</span> 대시보드
          </Link>

          {/* 2. 환자 목록 */}
          <Link 
            href="/patients" 
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition font-semibold ${
              pathname === "/patients" ? "bg-teal-900 text-white shadow-xs" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <span>👥</span> 환자 목록
          </Link>

          {/* 3. 새 상담 기록 */}
          <Link 
            href="/consultations" 
            onClick={() => handleNavClick("")}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition font-semibold ${
              isWriteActive ? "bg-teal-900 text-white shadow-xs" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <span>📝</span> 새 상담 기록
          </Link>
          
          {/* 4. 기록 조회 */}
          <Link 
            href="/consultations#history" 
            onClick={() => handleNavClick("#history")}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition font-semibold ${
              isHistoryActive ? "bg-teal-900 text-white shadow-xs" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <span>📂</span> 기록 조회
          </Link>

          {/* 5. 상담 캘린더 */}
          <Link 
            href="/schedules" 
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition font-semibold ${
              pathname === "/schedules" || pathname === "/calendar" ? "bg-teal-900 text-white shadow-xs" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <span>📅</span> 상담 캘린더
          </Link>

          {/* 6. 통계 분석 */}
          <Link 
            href="/stats" 
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition font-semibold ${
              pathname === "/stats" ? "bg-teal-900 text-white shadow-xs" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <span>📈</span> 통계 분석
          </Link>
        </nav>

        <div className="p-3 border-t border-slate-100">
          <button onClick={handleLogout} className="w-full text-left px-3 py-2.5 text-red-500 hover:bg-red-50 rounded-xl font-semibold transition text-xs">
            🚪 로그아웃
          </button>
        </div>
      </aside>

      {/* 📱 모바일 전용 상단 고정 헤더 */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 flex items-center justify-between bg-white border-b border-slate-100 px-4 z-50 shadow-sm">
        <div className="flex items-center gap-2">
          <Image src="/logo.png" alt="로고" width={28} height={28} className="object-contain rounded-md" />
          <span className="font-bold text-slate-900 text-sm">브로콜리약국</span>
        </div>
        <button onClick={handleLogout} className="text-xs text-red-500 font-semibold px-2 py-1 bg-red-50 rounded-lg">
          로그아웃
        </button>
      </div>

      {/* 📱 모바일 전용 하단 고정 탭 바 */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-slate-200 z-50 flex justify-around items-center px-1 shadow-lg">
        <Link 
          href="/" 
          className={`flex flex-col items-center flex-1 py-1 text-[10px] font-medium transition ${
            pathname === "/" ? "text-teal-900 font-bold" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <span className="text-lg mb-0.5">📊</span>
          <span>대시보드</span>
        </Link>

        <Link 
          href="/patients" 
          className={`flex flex-col items-center flex-1 py-1 text-[10px] font-medium transition ${
            pathname === "/patients" ? "text-teal-900 font-bold" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <span className="text-lg mb-0.5">👥</span>
          <span>환자</span>
        </Link>

        <Link 
          href="/consultations" 
          onClick={() => handleNavClick("")}
          className={`flex flex-col items-center flex-1 py-1 text-[10px] font-medium transition ${
            isWriteActive ? "text-teal-900 font-bold" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <span className="text-lg mb-0.5">📝</span>
          <span>상담등록</span>
        </Link>

        <Link 
          href="/consultations#history" 
          onClick={() => handleNavClick("#history")}
          className={`flex flex-col items-center flex-1 py-1 text-[10px] font-medium transition ${
            isHistoryActive ? "text-teal-900 font-bold" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <span className="text-lg mb-0.5">📂</span>
          <span>기록조회</span>
        </Link>

        <Link 
          href="/schedules" 
          className={`flex flex-col items-center flex-1 py-1 text-[10px] font-medium transition ${
            pathname === "/schedules" || pathname === "/calendar" ? "text-teal-900 font-bold" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <span className="text-lg mb-0.5">📅</span>
          <span>캘린더</span>
        </Link>

        <Link 
          href="/stats" 
          className={`flex flex-col items-center flex-1 py-1 text-[10px] font-medium transition ${
            pathname === "/stats" ? "text-teal-900 font-bold" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <span className="text-lg mb-0.5">📈</span>
          <span>통계</span>
        </Link>
      </nav>
    </>
  );
}