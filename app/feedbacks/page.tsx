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

  const handleToggleFeedbackComplete = async (e: any, consultationId: string, currentStatus: boolean) => {
    e.stopPropagation();
    const newStatus = !currentStatus;

    const { error } = await supabase
      .from("consultations")
      .update({ is_feedback_completed: newStatus })
      .eq("id", consultationId);

    if (error) {
      alert("상태 변경 실패: " + error.message);
    } else {
      setFeedbacks(prev => prev.map(f => f.id === consultationId ? { ...f, is_feedback_completed: newStatus } : f));
      if (selectedDetailFeedback && selectedDetailFeedback.id === consultationId) {
        setSelectedDetailFeedback((prev: any) => ({ ...prev, is_feedback_completed: newStatus }));
      }
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
                  {visibleFeedbacks.map((f, idx) => {
                    const isCompleted = f.is_feedback_completed;
                    return (
                      <div 
                        key={idx} 
                        onClick={(e) => { e.stopPropagation(); setSelectedDetailFeedback(f); }}
                        className={`text-[10px] md:text-[11px] px-2 py-0.5 rounded-lg truncate font-semibold cursor-pointer transition border shadow-2xs ${
                          isCompleted 
                            ? "bg-slate-100 border-slate-300 text-slate-400 line-through" 
                            : "bg-purple-50 text-purple-900 border-purple-200 hover:bg-purple-100 animate-pulse"
                        }`}
                      >
                        {formatName(f.patients)} / {f.prescription}
                      </div>
                    );
                  })}
                  {hiddenCount > 0 && <div onClick={() => setDayDetailDate(dateStr)} className="text-[10px] font-semibold text-slate-500 hover:text-slate-800 transition px-1 cursor-pointer">및 {hiddenCount}개...</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {dayDetailDate && (
        <div onClick={() => setDayDetailDate(null)} className="fixed inset-0 z-[90] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-slate-200 flex flex-col cursor-default max-h-[80vh]" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <h3 className="text-lg font-bold text-slate-900">📌 {dayDetailDate} 피드백 목록</h3>
              <button onClick={() => setDayDetailDate(null)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-200">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {feedbacks.filter(f => f.target_date === dayDetailDate).map((f, idx) => (
                <div 
                  key={idx} 
                  onClick={() => { setDayDetailDate(null); setSelectedDetailFeedback(f); }}
                  className={`px-3 py-3 rounded-xl flex items-center justify-between transition cursor-pointer font-bold border shadow-xs ${
                    f.is_feedback_completed ? "bg-slate-100 border-slate-300 text-slate-400 line-through" : "bg-purple-50 border-purple-200 text-purple-900 hover:bg-purple-100"
                  }`}
                >
                  <span className="truncate">{formatName(f.patients)} / {f.prescription}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {selectedDetailFeedback && (
        <div className="fixed inset-0 z-[70] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSelectedDetailFeedback(null)}>
          <div className="bg-white w-full max-w-md p-6 rounded-3xl shadow-2xl border border-slate-100 flex flex-col space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start border-b pb-4">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full bg-purple-500"></span>
                <h3 className="font-bold text-xl text-slate-900">피드백 모니터링</h3>
              </div>
              <button onClick={() => setSelectedDetailFeedback(null)} className="text-slate-400 bg-slate-100 w-8 h-8 rounded-full flex justify-center items-center font-bold">✕</button>
            </div>

            <div className="bg-purple-50/60 border border-purple-200 p-3 rounded-2xl flex items-center justify-between">
              <span className="text-xs font-bold text-purple-900">🔔 피드백 확인 상태</span>
              <label className="flex items-center gap-2 cursor-pointer bg-white px-4 py-2 rounded-xl border border-purple-300 shadow-2xs">
                <input 
                  type="checkbox" 
                  checked={selectedDetailFeedback.is_feedback_completed || false}
                  onChange={(e) => handleToggleFeedbackComplete(e, selectedDetailFeedback.id, selectedDetailFeedback.is_feedback_completed)}
                  className="w-4 h-4 accent-purple-800 cursor-pointer"
                />
                <span className={`text-xs font-extrabold ${selectedDetailFeedback.is_feedback_completed ? "text-slate-400 line-through" : "text-purple-900"}`}>
                  {selectedDetailFeedback.is_feedback_completed ? "확인 완료됨" : "확인 필요 (체크하여 완료)"}
                </span>
              </label>
            </div>

            <div className="space-y-3 text-sm">
              <div className="p-3.5 bg-slate-50 rounded-xl border"><span className="text-xs text-slate-400 font-bold block mb-1">환자명</span><p className="font-bold text-slate-900">{formatName(selectedDetailFeedback.patients)} ({selectedDetailFeedback.patients?.phone || "연락처 없음"})</p></div>
              <div className="p-3.5 bg-teal-50/50 rounded-xl border border-teal-100"><span className="text-xs text-teal-700 font-bold block mb-1">처방 내용</span><p className="font-bold text-teal-950">{selectedDetailFeedback.prescription || "없음"}</p></div>
              {/* 🟢 모니터링 체크사항 자리에 상담 작성 시의 추후관리(follow_up) 내용이 출력되도록 수정 */}
              <div className="p-3.5 bg-purple-50/50 rounded-xl border border-purple-100"><span className="text-xs text-purple-700 font-bold block mb-1">모니터링 체크사항 (추후관리)</span><p className="font-bold text-purple-950 whitespace-pre-line">{selectedDetailFeedback.follow_up || "내용 없음"}</p></div>
            </div>

            <button onClick={() => setSelectedDetailFeedback(null)} className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition">확인 완료</button>
          </div>
        </div>
      )}
    </div>
  );
}