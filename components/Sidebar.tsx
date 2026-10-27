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
      {/* 💻 PC 전용 왼쪽 고정 사이드바 */}
      <aside className="hidden md:flex fixed top-0 left-0 h-screen w-64 flex-col bg-white border-r border-slate-100 shadow-sm z-30">
        <div className="p-6 border-b border-slate-100 flex items-center gap-3">
          <Image src="/logo.png" alt="브로콜리약국 로고" width={36} height={36} className="object-contain rounded-lg" />
          <div>
            <div className="font-bold text-lg text-slate-900 leading-tight">브로콜리약국</div>
            <p className="text-xs text-slate-400 mt-0.5">운영중</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-6 overflow-y-auto text-sm">
          <div>
            <p className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">메인</p>
            <Link href="/" className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition font-medium ${pathname === "/" ? "bg-teal-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"}`}>
              <span>📊</span> 대시보드
            </Link>
          </div>

          <div>
            <p className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">상담 케어</p>
            <div className="space-y-1">
              <Link href="/consultations" onClick={() => handleNavClick("")} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition font-medium ${isWriteActive ? "bg-teal-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"}`}>
                <span>📝</span> 상담작성
              </Link>
              <Link href="/consultations#history" onClick={() => handleNavClick("#history")} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition font-medium ${isHistoryActive ? "bg-teal-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"}`}>
                <span>📂</span> 기록 조회
              </Link>
            </div>
          </div>

          <div>
            <p className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">일정 관리</p>
            <div className="space-y-1">
              <Link href="/schedules" className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition font-medium ${pathname === "/schedules" ? "bg-teal-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"}`}>
                <span>📅</span> 일정 캘린더
              </Link>
              <Link href="/feedbacks" className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition font-medium ${pathname === "/feedbacks" ? "bg-teal-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"}`}>
                <span>📌</span> 피드백 모니터링
              </Link>
            </div>
          </div>

          {/* 🟢 경영관리 섹션 추가 */}
          <div>
            <p className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">경영 관리</p>
            <Link href="/management" className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition font-medium ${pathname === "/management" ? "bg-teal-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"}`}>
              <span>📈</span> 일별관리
            </Link>
          </div>

          <div>
            <p className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">환자 관리</p>
            <Link href="/patients" className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition font-medium ${pathname === "/patients" ? "bg-teal-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"}`}>
              <span>👥</span> 환자 목록
            </Link>
          </div>
        </nav>

        <div className="p-4 border-t border-slate-100">
          <button onClick={handleLogout} className="w-full text-left px-3 py-2.5 text-red-500 hover:bg-red-50 rounded-xl font-medium transition text-sm">
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
        <button onClick={handleLogout} className="text-xs text-red-500 font-semibold px-2 py-1 bg-red-50 rounded-lg">로그아웃</button>
      </div>

      {/* 📱 모바일 전용 하단 고정 탭 바 */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-slate-200 z-50 flex justify-around items-center px-1 shadow-lg">
        <Link href="/" className={`flex flex-col items-center flex-1 py-1 text-[10px] font-medium transition ${pathname === "/" ? "text-teal-900 font-bold" : "text-slate-500"}`}>
          <span className="text-base mb-0.5">📊</span>대시보드
        </Link>
        <Link href="/consultations" onClick={() => handleNavClick("")} className={`flex flex-col items-center flex-1 py-1 text-[10px] font-medium transition ${isWriteActive ? "text-teal-900 font-bold" : "text-slate-500"}`}>
          <span className="text-base mb-0.5">📝</span>상담작성
        </Link>
        <Link href="/schedules" className={`flex flex-col items-center flex-1 py-1 text-[10px] font-medium transition ${pathname === "/schedules" ? "text-teal-900 font-bold" : "text-slate-500"}`}>
          <span className="text-base mb-0.5">📅</span>일정
        </Link>
        <Link href="/management" className={`flex flex-col items-center flex-1 py-1 text-[10px] font-medium transition ${pathname === "/management" ? "text-teal-900 font-bold" : "text-slate-500"}`}>
          <span className="text-base mb-0.5">📈</span>경영
        </Link>
        <Link href="/patients" className={`flex flex-col items-center flex-1 py-1 text-[10px] font-medium transition ${pathname === "/patients" ? "text-teal-900 font-bold" : "text-slate-500"}`}>
          <span className="text-base mb-0.5">👥</span>환자
        </Link>
      </nav>
    </>
  );
}