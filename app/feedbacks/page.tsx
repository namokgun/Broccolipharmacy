"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/app/lib/supabase";

export default function FeedbacksCalendarPage() {
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [currentDate, setCurrentDate] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<"month" | "week">("month");
  const [dayDetailDate, setDayDetailDate] = useState<string | null>(null);

  useEffect(() => {
    setCurrentDate(new Date());
    fetchFeedbacks();
  }, []);

  const fetchFeedbacks = async () => {
    const { data } = await supabase.from("consultations").select("*, patients(name)").not("feedback_days", "is", null);
    if (data) {
      const processed = data.map((c: any) => {
        const createdDate = new Date(c.created_at);
        const targetDate = new Date(createdDate.getFullYear(), createdDate.getMonth(), createdDate.getDate() + c.feedback_days);
        const dateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
        return { ...c, target_date: dateStr };
      });
      setFeedbacks(processed);
    }
  };

  if (!currentDate) return <div className="flex h-40 items-center justify-center bg-slate-50 text-slate-400">피드백 캘린더 로딩 중...</div>;

  const year = currentDate.getFullYear(); const month = currentDate.getMonth(); const day = currentDate.getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay(); const daysInMonth = new Date(year, month + 1, 0).getDate();
  const handlePrev = () => setCurrentDate(viewMode === "month" ? new Date(year, month - 1, 1) : new Date(year, month, day - 7));
  const handleNext = () => setCurrentDate(viewMode === "month" ? new Date(year, month + 1, 1) : new Date(year, month, day + 7));
  const handleToday = () => setCurrentDate(new Date());

  return (
    <div className="w-full space-y-6 flex flex-col relative">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 truncate">
          📌 자동 피드백 캘린더 ({year}년 {month + 1}월)
        </h1>
        <div className="flex items-center bg-white border border-slate-200/80 rounded-xl p-1 shadow-sm">
          <button onClick={handlePrev} className="px-3 py-1 hover:bg-slate-100 rounded-lg text-xs font-bold text-slate-600 transition">&lt;</button>
          <button onClick={handleToday} className="px-3 py-1 hover:bg-slate-100 rounded-lg text-xs font-bold text-slate-800 transition">오늘</button>
          <button onClick={handleNext} className="px-3 py-1 hover:bg-slate-100 rounded-lg text-xs font-bold text-slate-600 transition">&gt;</button>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 p-4 md:p-6">
        <div className="flex flex-col">
          <div className="grid grid-cols-7 text-center text-[11px] md:text-xs font-bold text-slate-400 mb-3 pb-3 border-b border-slate-100">
            <span className="text-red-500">일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span className="text-blue-500">토</span>
          </div>
          <div className="grid grid-cols-7 text-center gap-1.5">
            {Array.from({ length: firstDayOfMonth }).map((_, i) => <div key={`empty-${i}`} className="min-h-[90px] md:min-h-[120px] bg-slate-50/30 rounded-2xl" />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const d = i + 1;
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
              const dayFeedbacks = feedbacks.filter(f => f.target_date === dateStr);
              const isToday = d === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();
              const MAX_VISIBLE = 2; const visibleFeedbacks = dayFeedbacks.slice(0, MAX_VISIBLE); const hiddenCount = dayFeedbacks.length - MAX_VISIBLE;

              return (
                <div key={`day-${d}`} className={`min-h-[90px] md:min-h-[120px] rounded-2xl p-1.5 md:p-2.5 border flex flex-col items-start ${isToday ? "bg-purple-50/40 border-purple-400 shadow-sm" : "bg-white border-slate-100"}`}>
                  <span className={`text-[10px] md:text-xs font-bold mb-1 w-5 h-5 md:w-6 md:h-6 flex items-center justify-center rounded-full ${isToday ? "bg-purple-600 text-white" : "text-slate-700"}`}>{d}</span>
                  <div className="w-full space-y-1 text-left flex-1">
                    {visibleFeedbacks.map((f, idx) => (
                      <div key={idx} className="text-[10px] md:text-[11px] px-2 py-1 rounded-lg truncate bg-purple-50 text-purple-900 border border-purple-200 font-semibold shadow-xs">
                        {f.patients?.name} / {f.prescription}
                      </div>
                    ))}
                    {hiddenCount > 0 && <div onClick={() => setDayDetailDate(dateStr)} className="text-[10px] md:text-xs font-semibold text-slate-500 hover:text-slate-800 transition px-1 pt-0.5 cursor-pointer">및 {hiddenCount}개...</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {dayDetailDate && (
        <div className="fixed inset-0 z-[60] bg-transparent flex items-center justify-center p-4 backdrop-blur-[2px]" onClick={() => setDayDetailDate(null)}>
          <div className="bg-[#2a2a2c] text-white rounded-2xl shadow-2xl border border-slate-700 max-w-sm w-full p-5 animate-in fade-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-3">
              <h3 className="font-semibold text-lg">{parseInt(dayDetailDate.split('-')[2])}일 피드백 목록</h3>
              <button onClick={() => setDayDetailDate(null)} className="w-7 h-7 rounded-full bg-slate-700/50 flex items-center justify-center text-sm font-bold transition hover:bg-slate-600">✕</button>
            </div>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {feedbacks.filter(f => f.target_date === dayDetailDate).map((f) => (
                <div key={f.id} className="p-3 bg-white/10 rounded-xl space-y-1.5">
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-purple-300 text-base">{f.patients?.name} 환자</span>
                    <span className="text-xs text-slate-400 bg-black/20 px-2 py-0.5 rounded-md">({f.feedback_days}일 후 모니터링)</span>
                  </div>
                  <p className="text-sm font-medium"><span className="text-slate-400">처방:</span> {f.prescription || "없음"}</p>
                  <p className="text-sm font-medium"><span className="text-slate-400">모니터링:</span> {f.monitoring_content || "내용 없음"}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}