"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/app/lib/supabase";

export default function DashboardPage() {
  const [patients, setPatients] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [consultations, setConsultations] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"month" | "week">("month");
  const [currentDate, setCurrentDate] = useState<Date | null>(null);

  useEffect(() => {
    setCurrentDate(new Date());
    fetchData();

    // 📱 모바일 화면(768px 미만)일 경우 대시보드 캘린더도 주간 뷰로 자동 설정
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setViewMode("week");
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const fetchData = async () => {
    const { data: pData } = await supabase.from("patients").select("*").order("name");
    if (pData) setPatients(pData);

    const { data: sData } = await supabase.from("schedules").select("*").order("schedule_date");
    if (sData) setSchedules(sData);

    const { data: cData } = await supabase
      .from("consultations")
      .select("*, patients(name)")
      .order("created_at", { ascending: false })
      .limit(5);
    if (cData) setConsultations(cData);
  };

  const filteredPatients = patients.filter(p =>
    p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.phone?.includes(searchTerm)
  );

  if (!currentDate) return <div className="p-8 text-center text-slate-400">대시보드 로딩 중...</div>;

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const day = currentDate.getDate();

  return (
    <div className="w-full space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">📊 대시보드 및 복약 관리</h1>

      {/* 환자 간편 조회 및 복약 관리 섹션 */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <h2 className="text-lg font-bold text-slate-900">환자 간편 조회 및 복약 관리</h2>
          <input
            type="text"
            placeholder="환자 이름 또는 연락처 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full md:w-80 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPatients.length === 0 ? (
            <p className="col-span-full text-center text-slate-400 py-6 text-sm">등록된 환자가 없거나 검색 결과가 없습니다.</p>
          ) : (
            filteredPatients.map((p) => (
              <div key={p.id} className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2">
                <div className="flex items-center justify-between gap-2">
                  {/* 🟢 환자 이름 두 줄 꺾임 방지 (whitespace-nowrap) */}
                  <span className="font-bold text-base text-slate-900 whitespace-nowrap">
                    {p.name}
                  </span>
                  <span className="text-xs text-slate-500 bg-white px-2.5 py-0.5 rounded-full border border-slate-200 whitespace-nowrap">
                    {p.gender || "남"} / {p.birth_year || "-"}년생
                  </span>
                </div>
                <p className="text-xs text-slate-600">연락처: {p.phone || "번호 없음"}</p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 대시보드 캘린더 (모바일 자동 주간 뷰 지원) */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold text-slate-900 whitespace-nowrap">
            {viewMode === "month" ? `${year}년 ${month + 1}월 캘린더` : `${year}년 ${month + 1}월 주간 타임라인`}
          </h2>
          <div className="flex bg-slate-200/80 p-1 rounded-xl text-xs font-bold text-slate-600">
            <button
              onClick={() => setViewMode("month")}
              className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap ${viewMode === "month" ? "bg-white text-slate-900 shadow-xs" : ""}`}
            >
              월간
            </button>
            <button
              onClick={() => setViewMode("week")}
              className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap ${viewMode === "week" ? "bg-white text-slate-900 shadow-xs" : ""}`}
            >
              주간
            </button>
          </div>
        </div>

        {viewMode === "week" ? (
          <div className="space-y-3">
            {Array.from({ length: 7 }).map((_, i) => {
              const targetDate = new Date(year, month, day - currentDate.getDay() + i);
              const dateStr = targetDate.toISOString().split('T')[0];
              const daySchedules = schedules.filter(s => s.schedule_date === dateStr);

              return (
                <div key={i} className="flex flex-col md:flex-row border border-slate-100 rounded-2xl p-4 bg-slate-50/40 items-start gap-3">
                  <div className="w-full md:w-32 font-bold text-xs md:text-sm text-slate-800 border-b md:border-b-0 md:border-r border-slate-200/80 pb-2 md:pb-0 md:pr-4 whitespace-nowrap">
                    {targetDate.toLocaleDateString('ko-KR', { weekday: 'short', month: 'long', day: 'numeric' })}
                  </div>
                  <div className="flex-1 space-y-2 w-full">
                    {daySchedules.length === 0 ? (
                      <span className="text-xs text-slate-400">등록된 일정이 없습니다.</span>
                    ) : (
                      daySchedules.map((s, idx) => (
                        <div key={idx} className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-sm font-semibold flex justify-between items-center gap-2">
                          <span className="truncate">{s.title}</span>
                          <span className="text-xs bg-white/70 px-2 py-0.5 rounded-md whitespace-nowrap">{s.time || "종일"}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-slate-500 py-4 text-center">월간 뷰 모드입니다. (모바일 접속 시 자동으로 주간 뷰로 전환됩니다.)</p>
        )}
      </div>
    </div>
  );
}