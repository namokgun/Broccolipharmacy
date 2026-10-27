"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/app/lib/supabase";

export default function FeedbacksCalendarPage() {
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [currentDate, setCurrentDate] = useState<Date | null>(null);
  
  const [dayDetailDate, setDayDetailDate] = useState<string | null>(null);
  const [selectedDetailFeedback, setSelectedDetailFeedback] = useState<any | null>(null);

  useEffect(() => {
    setCurrentDate(new Date());
    fetchFeedbacks();
  }, []);

  const fetchFeedbacks = async () => {
    const { data } = await supabase.from("consultations").select("*, patients(name, phone, custom_id)").not("feedback_days", "is", null);
    if (data) {
      const processed = data.map((c: any) => {
        const createdDate = new Date(c.consultation_date || c.created_at);
        const targetDate = new Date(createdDate.getFullYear(), createdDate.getMonth(), createdDate.getDate() + c.feedback_days);
        const dateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
        return { ...c, target_date: dateStr };
      });
      setFeedbacks(processed);
    }
  };

  if (!currentDate) return <div className="flex h-40 items-center justify-center text-slate-400">피드백 캘린더 로딩 중...</div>;

  const year = currentDate.getFullYear(); 
  const month = currentDate.getMonth(); 
  const handlePrev = () => setCurrentDate(new Date(year, month - 1, 1));
  const handleNext = () => setCurrentDate(new Date(year, month + 1, 1));
  const handleToday = () => setCurrentDate(new Date());
  const firstDayOfMonth = new Date(year, month, 1).getDay(); 
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const formatName = (p: any) => p?.custom_id ? `${p.name} (${p.custom_id})` : p?.name;

  return (
    <div className="w-full h-[calc(100vh-80px)] flex flex-col space-y-4 overflow-hidden">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 flex-shrink-0">
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">
          📌 피드백 모니터링 캘린더 ({year}년 {month + 1}월)
        </h1>
        <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-2xs">
          <button onClick={handlePrev} className="px-3 py-1 hover:bg-slate-100 rounded-lg text-xs font-bold text-slate-600 transition">&lt;</button>
          <button onClick={handleToday} className="px-3 py-1 hover:bg-slate-100 rounded-lg text-xs font-bold text-slate-800 transition">오늘</button>
          <button onClick={handleNext} className="px-3 py-1 hover:bg-slate-100 rounded-lg text-xs font-bold text-slate-600 transition">&gt;</button>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 flex flex-col flex-1 overflow-hidden p-4 md:p-6">
        <div className="grid grid-cols-7 text-center text-xs font-bold text-slate-400 mb-2 pb-2 border-b border-slate-100 flex-shrink-0">
          <span className="text-red-500">일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span className="text-blue-500">토</span>
        </div>
        <div className="grid grid-cols-7 text-center gap-1.5 flex-1 min-h-0 overflow-y-auto">
          {Array.from({ length: firstDayOfMonth }).map((_, i) => <div key={`empty-${i}`} className="bg-slate-50/20 rounded-2xl" />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const d = i + 1;
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const dayFeedbacks = feedbacks.filter(f => f.target_date === dateStr);
            const isToday = d === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();
            const MAX_VISIBLE = 2; 
            const visibleFeedbacks = dayFeedbacks.slice(0, MAX_VISIBLE); 
            const hiddenCount = dayFeedbacks.length - MAX_VISIBLE;

            return (
              <div key={`day-${d}`} className={`rounded-2xl p-2 border flex flex-col items-start ${isToday ? "bg-purple-50/40 border-purple-500 shadow-2xs" : "bg-white border-slate-100"}`}>
                <span className={`text-[10px] md:text-xs font-bold mb-1 w-5 h-5 flex items-center justify-center rounded-full ${isToday ? "bg-purple-700 text-white" : "text-slate-700"}`}>{d}</span>
                <div className="w-full space-y-1 text-left flex-1">
                  {visibleFeedbacks.map((f, idx) => (
                    <div 
                      key={idx} 
                      onClick={(e) => { e.stopPropagation(); setSelectedDetailFeedback(f); }}
                      className="text-[10px] md:text-[11px] px-2 py-0.5 rounded-lg truncate bg-purple-50 text-purple-900 border border-purple-200 font-semibold cursor-pointer hover:bg-purple-100 transition"
                    >
                      {formatName(f.patients)} / {f.prescription}
                    </div>
                  ))}
                  {hiddenCount > 0 && <div onClick={() => setDayDetailDate(dateStr)} className="text-[10px] font-semibold text-slate-500 hover:text-slate-800 transition px-1">및 {hiddenCount}개...</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 팝업 모달들 (기존 동일 유지) */}
      {selectedDetailFeedback && (
        <div className="fixed inset-0 z-[70] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSelectedDetailFeedback(null)}>
          <div className="bg-white w-full max-w-md p-6 rounded-3xl shadow-2xl border border-slate-100" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-5 border-b pb-4">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full bg-purple-500"></span>
                <h3 className="font-bold text-xl text-slate-900">피드백 모니터링</h3>
              </div>
              <button onClick={() => setSelectedDetailFeedback(null)} className="text-slate-400 bg-slate-100 w-8 h-8 rounded-full flex justify-center items-center font-bold">✕</button>
            </div>
            <div className="space-y-4 mb-6 text-sm">
              <div className="p-3.5 bg-slate-50 rounded-xl border"><span className="text-xs text-slate-400 font-bold block mb-1">환자명</span><p className="font-bold text-slate-900">{formatName(selectedDetailFeedback.patients)} ({selectedDetailFeedback.patients?.phone || "연락처 없음"})</p></div>
              <div className="p-3.5 bg-teal-50/50 rounded-xl border border-teal-100"><span className="text-xs text-teal-700 font-bold block mb-1">처방 내용</span><p className="font-bold text-teal-950">{selectedDetailFeedback.prescription || "없음"}</p></div>
              <div className="p-3.5 bg-purple-50/50 rounded-xl border border-purple-100"><span className="text-xs text-purple-700 font-bold block mb-1">모니터링 체크사항</span><p className="font-bold text-purple-950">{selectedDetailFeedback.monitoring_content || "내용 없음"}</p></div>
            </div>
            <button onClick={() => setSelectedDetailFeedback(null)} className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold text-sm">확인 완료</button>
          </div>
        </div>
      )}
    </div>
  );
}