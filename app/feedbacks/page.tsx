"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/app/lib/supabase";

export default function FeedbacksCalendarPage() {
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [currentDate, setCurrentDate] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<"month" | "week">("month");
  
  const [dayDetailDate, setDayDetailDate] = useState<string | null>(null);
  
  // 🟢 개별 피드백 상세 보기용 상태 추가
  const [selectedDetailFeedback, setSelectedDetailFeedback] = useState<any | null>(null);

  useEffect(() => {
    setCurrentDate(new Date());
    fetchFeedbacks();
  }, []);

  const fetchFeedbacks = async () => {
    const { data } = await supabase.from("consultations").select("*, patients(name, phone)").not("feedback_days", "is", null);
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
                      <div 
                        key={idx} 
                        onClick={(e) => { e.stopPropagation(); setSelectedDetailFeedback(f); }}
                        className="text-[10px] md:text-[11px] px-2 py-1 rounded-lg truncate bg-purple-50 text-purple-900 border border-purple-200 font-semibold shadow-xs cursor-pointer hover:bg-purple-100 hover:scale-[1.02] transition"
                        title="클릭하여 모니터링 상세 보기"
                      >
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

      {/* 애플 감성 하루 전체 피드백 목록 모달 */}
      {dayDetailDate && (
        <div className="fixed inset-0 z-[60] bg-transparent flex items-center justify-center p-4 backdrop-blur-[2px]" onClick={() => setDayDetailDate(null)}>
          <div className="bg-[#2a2a2c] text-white rounded-2xl shadow-2xl border border-slate-700 max-w-sm w-full p-5 animate-in fade-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-3">
              <h3 className="font-semibold text-lg">{parseInt(dayDetailDate.split('-')[2])}일 피드백 목록</h3>
              <button onClick={() => setDayDetailDate(null)} className="w-7 h-7 rounded-full bg-slate-700/50 flex items-center justify-center text-sm font-bold transition hover:bg-slate-600">✕</button>
            </div>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1 scrollbar-none">
              {feedbacks.filter(f => f.target_date === dayDetailDate).map((f) => (
                <div 
                  key={f.id} 
                  onClick={() => { setDayDetailDate(null); setSelectedDetailFeedback(f); }}
                  className="p-3 bg-white/10 rounded-xl space-y-1.5 cursor-pointer hover:bg-white/20 transition"
                >
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-purple-300 text-base">{f.patients?.name} 환자</span>
                    <span className="text-[10px] text-slate-400 bg-black/30 px-2 py-0.5 rounded-md font-semibold">상세보기 〉</span>
                  </div>
                  <p className="text-sm font-medium truncate"><span className="text-slate-400">처방:</span> {f.prescription || "없음"}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 🟢 개별 피드백 상세 보기 모달 */}
      {selectedDetailFeedback && (
        <div className="fixed inset-0 z-[70] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSelectedDetailFeedback(null)}>
          <div className="bg-white w-full max-w-md p-6 sm:p-8 rounded-3xl shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            
            <div className="flex justify-between items-start mb-6 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-3.5 h-3.5 rounded-full bg-purple-500 shadow-sm"></span>
                  <h3 className="font-bold text-xl text-slate-900 leading-tight">피드백 모니터링</h3>
                </div>
                <p className="text-xs text-slate-400 pl-5">{selectedDetailFeedback.target_date} (상담 {selectedDetailFeedback.feedback_days}일 후)</p>
              </div>
              <button onClick={() => setSelectedDetailFeedback(null)} className="text-slate-400 hover:text-slate-600 bg-slate-100 w-8 h-8 rounded-full flex justify-center items-center font-bold transition">✕</button>
            </div>
            
            <div className="space-y-6 mb-8">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div>
                  <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-1">환자 정보</p>
                  <p className="text-base font-bold text-slate-900">{selectedDetailFeedback.patients?.name} 환자</p>
                </div>
                <span className="text-xs font-semibold text-slate-500 bg-white px-3 py-1 rounded-xl shadow-xs border border-slate-200">
                  {selectedDetailFeedback.patients?.phone || "연락처 없음"}
                </span>
              </div>
              
              <div>
                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-1.5 pl-1">처방 내용</p>
                <div className="bg-teal-50/50 p-4 rounded-2xl border border-teal-100">
                  <p className="text-sm font-bold text-teal-900 whitespace-pre-line leading-relaxed">
                    {selectedDetailFeedback.prescription || "기재된 처방이 없습니다."}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-1.5 pl-1">모니터링 체크사항</p>
                <div className="bg-purple-50/50 p-4 rounded-2xl border border-purple-100">
                  <p className="text-sm font-bold text-purple-900 whitespace-pre-line leading-relaxed">
                    {selectedDetailFeedback.monitoring_content || "기재된 모니터링 내용이 없습니다."}
                  </p>
                </div>
              </div>

              {selectedDetailFeedback.consult_memo && (
                <div>
                  <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-1.5 pl-1">상담 특이사항 메모</p>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-xs font-medium text-slate-700 whitespace-pre-line leading-relaxed">
                      {selectedDetailFeedback.consult_memo}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button 
                onClick={() => setSelectedDetailFeedback(null)} 
                className="flex-1 px-4 py-3 bg-slate-900 text-white rounded-2xl text-sm font-bold hover:bg-slate-800 transition shadow-sm"
              >
                확인 완료
              </button>
            </div>
            
          </div>
        </div>
      )}
    </div>
  );
}