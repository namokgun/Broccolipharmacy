"use client";

import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";

const THEMES: Record<string, { bg: string, text: string }> = {
  blue: { bg: "bg-blue-100 border-blue-300", text: "text-blue-900" },
  emerald: { bg: "bg-emerald-100 border-emerald-300", text: "text-emerald-900" },
  purple: { bg: "bg-purple-100 border-purple-300", text: "text-purple-900" },
  amber: { bg: "bg-amber-100 border-amber-300", text: "text-amber-900" },
  rose: { bg: "bg-rose-100 border-rose-300", text: "text-rose-900" },
};

export default function Home() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({ patients: 0, consultations: 0 });
  const [patients, setPatients] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  const [currentDate, setCurrentDate] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<"month" | "week" | "day">("month");
  
  const [schedules, setSchedules] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [daySchedules, setDaySchedules] = useState<any[]>([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/login");
        return;
      }
      setIsLoading(false);
      setCurrentDate(new Date());

      const { count: pCount } = await supabase.from("patients").select("*", { count: "exact", head: true });
      const { count: cCount } = await supabase.from("consultations").select("*", { count: "exact", head: true });
      setStats({ patients: pCount || 0, consultations: cCount || 0 });

      const { data: pData } = await supabase.from("patients").select("*").order("created_at", { ascending: false }).limit(5);
      if (pData) setPatients(pData);

      const { data: sData } = await supabase.from("schedules").select("*");
      if (sData) setSchedules(sData);
    };
    fetchDashboardData();
  }, [router]);

  if (!currentDate) return <div className="flex h-screen items-center justify-center bg-slate-50 text-slate-400">대시보드 로딩 중...</div>;

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const day = currentDate.getDate();

  const handlePrev = () => {
    if (viewMode === "month") setCurrentDate(new Date(year, month - 1, 1));
    else if (viewMode === "week") setCurrentDate(new Date(year, month, day - 7));
    else setCurrentDate(new Date(year, month, day - 1));
  };

  const handleNext = () => {
    if (viewMode === "month") setCurrentDate(new Date(year, month + 1, 1));
    else if (viewMode === "week") setCurrentDate(new Date(year, month, day + 7));
    else setCurrentDate(new Date(year, month, day + 1));
  };

  const handleToday = () => setCurrentDate(new Date());

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const handleDateClick = (clickedDay: number) => {
    const formattedMonth = String(month + 1).padStart(2, '0');
    const formattedDay = String(clickedDay).padStart(2, '0');
    const dateStr = `${year}-${formattedMonth}-${formattedDay}`;
    
    setSelectedDate(dateStr);
    const matched = schedules.filter(s => s.schedule_date === dateStr);
    setDaySchedules(matched);
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-800">
      <Sidebar />

      <main className="flex-1 p-8 overflow-y-auto">
        <div className="mb-8">
          <div className="relative max-w-2xl">
            <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">🔍</span>
            <input
              type="text"
              placeholder="환자명, 전화번호, 처방전 번호 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
            />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-full text-xs font-semibold flex items-center gap-1.5 w-fit">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> 실시간 진료 연동 정상
            </span>
            <span className="text-xs text-slate-400">브로콜리약국 케어데스크</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">약국 종합 대시보드</h1>
          <p className="text-sm text-slate-500 mt-1">
            오늘도 환자분들의 건강한 일상을 든든하게 케어하세요.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white px-6 py-4 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">전체 상담기록</p>
              <h3 className="text-3xl font-bold text-slate-900 mt-1">{stats.consultations} <span className="text-sm font-normal text-slate-400">건</span></h3>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl text-lg">📋</div>
          </div>

          <div className="bg-white px-6 py-4 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">등록 환자 수</p>
              <h3 className="text-3xl font-bold text-teal-800 mt-1">{stats.patients} <span className="text-sm font-normal text-slate-400">명</span></h3>
            </div>
            <div className="p-3 bg-teal-50 text-teal-700 rounded-xl text-lg">👥</div>
          </div>
        </div>

        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <span>📅</span> 
                {viewMode === "month" && `${year}년 ${month + 1}월`}
                {viewMode === "week" && `${year}년 ${month + 1}월 (주간 타임라인)`}
                {viewMode === "day" && `${year}년 ${month + 1}월 ${day}일`}
              </h3>
              <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl p-1 shadow-sm">
                <button onClick={handlePrev} className="px-3 py-1 hover:bg-white rounded-lg text-xs font-bold text-slate-600 transition">&lt;</button>
                <button onClick={handleToday} className="px-3 py-1 hover:bg-white rounded-lg text-xs font-bold text-slate-800 transition">오늘</button>
                <button onClick={handleNext} className="px-3 py-1 hover:bg-white rounded-lg text-xs font-bold text-slate-600 transition">&gt;</button>
              </div>
            </div>

            <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-600">
              <button 
                onClick={() => setViewMode("month")} 
                className={`px-4 py-1.5 rounded-lg transition ${viewMode === "month" ? "bg-teal-900 text-white shadow-sm" : "hover:text-slate-900"}`}
              >
                월간
              </button>
              <button 
                onClick={() => setViewMode("week")} 
                className={`px-4 py-1.5 rounded-lg transition ${viewMode === "week" ? "bg-teal-900 text-white shadow-sm" : "hover:text-slate-900"}`}
              >
                주간
              </button>
              <button 
                onClick={() => setViewMode("day")} 
                className={`px-4 py-1.5 rounded-lg transition ${viewMode === "day" ? "bg-teal-900 text-white shadow-sm" : "hover:text-slate-900"}`}
              >
                일간
              </button>
            </div>
          </div>

          {viewMode === "month" && (
            <div>
              <div className="grid grid-cols-7 text-center text-sm font-bold text-slate-400 mb-4 pb-2 border-b border-slate-100">
                <span className="text-red-500">일요일</span>
                <span>월요일</span>
                <span>화요일</span>
                <span>수요일</span>
                <span>목요일</span>
                <span>금요일</span>
                <span className="text-blue-500">토요일</span>
              </div>

              <div className="grid grid-cols-7 text-center gap-2">
                {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                  <div key={`empty-${i}`} className="h-24" />
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const d = i + 1;
                  const formattedMonth = String(month + 1).padStart(2, '0');
                  const formattedDay = String(d).padStart(2, '0');
                  const dateStr = `${year}-${formattedMonth}-${formattedDay}`;
                  
                  const daySchedulesList = schedules.filter(s => s.schedule_date === dateStr);
                  const isToday = d === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();

                  return (
                    <div 
                      key={`day-${d}`}
                      onClick={() => handleDateClick(d)}
                      className={`h-24 rounded-2xl font-medium transition flex flex-col items-start p-3 border cursor-pointer overflow-hidden ${
                        isToday 
                          ? "bg-teal-50 border-teal-500 text-teal-900 font-bold shadow-sm" 
                          : "bg-slate-50/50 border-slate-100 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <div className="flex justify-between w-full items-center mb-1">
                        <span className={`text-sm ${isToday ? "text-teal-900 font-bold" : "text-slate-900 font-semibold"}`}>{d}</span>
                        {isToday && <span className="text-[10px] bg-teal-900 text-white px-1.5 py-0.5 rounded">오늘</span>}
                      </div>
                      <div className="w-full space-y-1 text-left overflow-y-auto">
                        {daySchedulesList.map((s, idx) => {
                          const t = THEMES[s.theme || "blue"] || THEMES.blue;
                          return (
                            <div key={idx} className={`text-[11px] px-1.5 py-0.5 rounded truncate font-normal border ${t.bg} ${t.text}`}>
                              • {s.time ? `${s.time} ` : ''}{s.title}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {viewMode === "week" && (
            <div className="space-y-3">
              {Array.from({ length: 7 }).map((_, i) => {
                const targetDate = new Date(year, month, day - currentDate.getDay() + i);
                const dateStr = targetDate.toISOString().split('T')[0];
                const daySchedulesList = schedules.filter(s => s.schedule_date === dateStr);

                return (
                  <div key={i} className="flex border border-slate-100 rounded-2xl p-4 bg-slate-50/50 items-start gap-4">
                    <div className="w-32 font-bold text-sm text-slate-800 border-r border-slate-200 pr-4">
                      {targetDate.toLocaleDateString('ko-KR', { weekday: 'short', month: 'long', day: 'numeric' })}
                    </div>
                    <div className="flex-1 space-y-2">
                      {daySchedulesList.length === 0 ? (
                        <span className="text-xs text-slate-400">등록된 일정이 없습니다.</span>
                      ) : (
                        daySchedulesList.map((s, idx) => {
                          const t = THEMES[s.theme || "blue"] || THEMES.blue;
                          return (
                            <div key={idx} className={`flex justify-between items-center p-3 rounded-xl border ${t.bg} ${t.text} shadow-sm`}>
                              <div>
                                <span className="text-xs font-bold bg-white/70 px-2 py-0.5 rounded-md mr-2">{s.time || "종일"}</span>
                                <span className="font-bold text-sm">{s.title}</span>
                                {s.content && <p className="text-xs opacity-80 mt-0.5">{s.content}</p>}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {viewMode === "day" && (
            <div className="space-y-3">
              {(() => {
                const formattedMonth = String(month + 1).padStart(2, '0');
                const formattedDay = String(day).padStart(2, '0');
                const dateStr = `${year}-${formattedMonth}-${formattedDay}`;
                const daySchedulesList = schedules.filter(s => s.schedule_date === dateStr);

                if (daySchedulesList.length === 0) {
                  return <p className="text-center text-slate-400 py-12 text-sm">오늘 등록된 일정이 없습니다.</p>;
                }

                return daySchedulesList.map((s, idx) => {
                  const t = THEMES[s.theme || "blue"] || THEMES.blue;
                  return (
                    <div key={idx} className={`p-4 rounded-2xl border flex items-center justify-between ${t.bg} ${t.text} shadow-sm`}>
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-bold bg-white/85 px-3 py-1.5 rounded-xl">{s.time || "종일"}</span>
                        <div>
                          <h4 className="font-bold text-base">{s.title}</h4>
                          {s.content && <p className="text-xs opacity-80 mt-1">{s.content}</p>}
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>

        {selectedDate && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white w-full max-w-lg p-6 rounded-2xl shadow-lg border border-slate-100">
              <div className="flex justify-between items-center mb-4 border-b pb-3">
                <h3 className="text-lg font-bold text-slate-900">📅 {selectedDate} 일정</h3>
                <button 
                  onClick={() => setSelectedDate(null)}
                  className="text-slate-400 hover:text-slate-700 text-sm font-bold"
                >
                  ✕ 닫기
                </button>
              </div>

              <div className="space-y-3 max-h-60 overflow-y-auto mb-4">
                {daySchedules.length === 0 ? (
                  <p className="text-center text-slate-400 py-6 text-sm">등록된 일정이 없습니다.</p>
                ) : (
                  daySchedules.map((s, idx) => {
                    const t = THEMES[s.theme || "blue"] || THEMES.blue;
                    return (
                      <div key={idx} className={`p-3 rounded-xl border ${t.bg} ${t.text}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold bg-white/70 px-2 py-0.5 rounded">{s.time || "종일"}</span>
                          <h4 className="font-bold text-sm">{s.title}</h4>
                        </div>
                        {s.content && <p className="text-xs opacity-80">{s.content}</p>}
                      </div>
                    );
                  })
                )}
              </div>

              <div className="flex justify-end">
                <Link 
                  href="/schedules" 
                  className="px-4 py-2 bg-teal-900 text-white text-xs font-bold rounded-xl hover:bg-teal-800 transition"
                >
                  일정 관리 페이지로 이동 &rarr;
                </Link>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span>🩺</span> 환자 간편 조회 및 복약 관리
            </h2>
            <Link href="/patients" className="text-sm font-medium text-teal-700 hover:underline">
              전체보기 &rarr;
            </Link>
          </div>

          <div className="flex gap-2 mb-6">
            <button onClick={() => setActiveTab("all")} className={`px-4 py-2 rounded-xl text-sm font-medium transition ${activeTab === 'all' ? 'bg-teal-900 text-white' : 'bg-slate-100 text-slate-600'}`}>
              전체 ({stats.patients})
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-400 uppercase text-xs">
                <tr>
                  <th className="p-4 font-semibold rounded-l-xl">환자명</th>
                  <th className="p-4 font-semibold">연락처</th>
                  <th className="p-4 font-semibold rounded-r-xl">등록일자</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {patients.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-8 text-center text-slate-400">
                      등록된 환자가 없습니다. 좌측 메뉴에서 환자를 등록해 주세요!
                    </td>
                  </tr>
                ) : (
                  patients.map((p, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition">
                      <td className="p-4 font-semibold text-slate-900 flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-teal-50 text-teal-800 flex items-center justify-center text-xs font-bold">
                          {p.name[0]}
                        </span>
                        {p.name}
                      </td>
                      <td className="p-4 text-slate-600">{p.phone || "-"}</td>
                      <td className="p-4 text-slate-500">{new Date(p.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}