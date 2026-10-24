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
  }, []);

  const fetchData = async () => {
    const { data: pData } = await supabase.from("patients").select("*").order("name");
    if (pData) setPatients(pData);

    const { data: sData } = await supabase.from("schedules").select("*").order("schedule_date");
    if (sData) setSchedules(sData);

    const { data: cData } = await supabase
      .from("consultations")
      .select("*, patients(name, gender, birth_year)")
      .order("created_at", { ascending: false });
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

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const handlePrev = () => {
    if (viewMode === "month") setCurrentDate(new Date(year, month - 1, 1));
    else setCurrentDate(new Date(year, month, day - 7));
  };

  const handleNext = () => {
    if (viewMode === "month") setCurrentDate(new Date(year, month + 1, 1));
    else setCurrentDate(new Date(year, month, day + 7));
  };

  const handleToday = () => setCurrentDate(new Date());

  return (
    <div className="w-full space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">📊 대시보드</h1>

      {/* 상단 통계 요약 카드 (등록된 일정 제외) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">총 등록 환자</p>
            <h3 className="text-2xl font-bold text-slate-900">{patients.length} 명</h3>
          </div>
          <div className="w-12 h-12 bg-teal-50 text-teal-800 rounded-2xl flex items-center justify-center font-bold text-lg">👥</div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">총 상담 기록</p>
            <h3 className="text-2xl font-bold text-slate-900">{consultations.length} 건</h3>
          </div>
          <div className="w-12 h-12 bg-blue-50 text-blue-800 rounded-2xl flex items-center justify-center font-bold text-lg">📝</div>
        </div>
      </div>

      {/* 대시보드 캘린더 영역 */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-slate-900 whitespace-nowrap">
              {viewMode === "month" ? `${year}년 ${month + 1}월 캘린더` : `${year}년 ${month + 1}월 주간 타임라인`}
            </h2>
            <div className="flex items-center bg-slate-100 rounded-xl p-1">
              <button onClick={handlePrev} className="px-2.5 py-1 hover:bg-white rounded-lg text-xs font-bold text-slate-600 transition">&lt;</button>
              <button onClick={handleToday} className="px-2.5 py-1 hover:bg-white rounded-lg text-xs font-bold text-slate-800 transition">오늘</button>
              <button onClick={handleNext} className="px-2.5 py-1 hover:bg-white rounded-lg text-xs font-bold text-slate-600 transition">&gt;</button>
            </div>
          </div>

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

        {viewMode === "month" ? (
          <div className="flex flex-col pt-2">
            <div className="grid grid-cols-7 text-center text-xs font-bold text-slate-400 mb-3 pb-3 border-b border-slate-100">
              <span className="text-red-500">일</span>
              <span>월</span>
              <span>화</span>
              <span>수</span>
              <span>목</span>
              <span>금</span>
              <span className="text-blue-500">토</span>
            </div>
            <div className="grid grid-cols-7 text-center gap-1.5">
              {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                <div key={`empty-${i}`} className="min-h-[90px] bg-slate-50/20 rounded-xl" />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const d = i + 1;
                const formattedMonth = String(month + 1).padStart(2, '0');
                const formattedDay = String(d).padStart(2, '0');
                const dateStr = `${year}-${formattedMonth}-${formattedDay}`;
                
                const daySchedules = schedules.filter(s => s.schedule_date === dateStr);
                const isToday = d === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();

                return (
                  <div 
                    key={`day-${d}`}
                    className={`min-h-[90px] rounded-2xl p-2 border transition flex flex-col items-start overflow-hidden ${
                      isToday ? "bg-blue-50/40 border-blue-400 shadow-xs" : "bg-white border-slate-100"
                    }`}
                  >
                    <span className={`text-xs font-bold mb-1 w-6 h-6 flex items-center justify-center rounded-full ${isToday ? "bg-blue-600 text-white shadow-xs" : "text-slate-700"}`}>
                      {d}
                    </span>
                    <div className="w-full space-y-1 text-left overflow-y-auto max-h-[60px] scrollbar-none">
                      {daySchedules.map((s, idx) => (
                        <div 
                          key={idx} 
                          className="text-[10px] px-2 py-0.5 rounded-md truncate font-semibold bg-blue-100 text-blue-900 border border-blue-300"
                        >
                          {s.title}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
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
        )}
      </div>

      {/* 환자 목록 영역 (원래 레이아웃 복구) */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <h2 className="text-lg font-bold text-slate-900">환자 목록</h2>
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
            <p className="col-span-full text-center text-slate-400 py-6 text-sm">등록된 환자가 없습니다.</p>
          ) : (
            filteredPatients.map((p) => (
              <div key={p.id} className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl flex flex-col justify-between gap-2">
                <div className="flex items-center justify-between gap-2">
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
    </div>
  );
}