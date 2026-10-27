"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/app/lib/supabase";

export default function ManagementDailyPage() {
  const [consultations, setConsultations] = useState<any[]>([]);
  const [currentDate, setCurrentDate] = useState<Date | null>(null);
  const [selectedDayConsults, setSelectedDayConsults] = useState<{ dateStr: string; items: any[] } | null>(null);

  useEffect(() => {
    setCurrentDate(new Date());
    fetchConsultations();
  }, []);

  const fetchConsultations = async () => {
    const { data } = await supabase.from("consultations").select("*, patients(name, phone)").order("consultation_date", { ascending: false });
    if (data) setConsultations(data);
  };

  if (!currentDate) return <div className="flex h-40 items-center justify-center text-slate-400">경영 캘린더 로딩 중...</div>;

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const handlePrev = () => setCurrentDate(new Date(year, month - 1, 1));
  const handleNext = () => setCurrentDate(new Date(year, month + 1, 1));
  const handleToday = () => setCurrentDate(new Date());

  return (
    <div className="w-full space-y-6 flex flex-col">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900">
          📈 일별 경영 관리 ({year}년 {month + 1}월)
        </h1>
        <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
          <button onClick={handlePrev} className="px-3 py-1 hover:bg-slate-100 rounded-lg text-xs font-bold text-slate-600 transition">&lt;</button>
          <button onClick={handleToday} className="px-3 py-1 hover:bg-slate-100 rounded-lg text-xs font-bold text-slate-800 transition">오늘</button>
          <button onClick={handleNext} className="px-3 py-1 hover:bg-slate-100 rounded-lg text-xs font-bold text-slate-600 transition">&gt;</button>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 p-4 md:p-6">
        <div className="grid grid-cols-7 text-center text-xs font-bold text-slate-400 mb-3 pb-3 border-b border-slate-100">
          <span className="text-red-500">일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span className="text-blue-500">토</span>
        </div>
        <div className="grid grid-cols-7 text-center gap-2">
          {Array.from({ length: firstDayOfMonth }).map((_, i) => <div key={`empty-${i}`} className="min-h-[110px] bg-slate-50/20 rounded-2xl" />)}
          
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const d = i + 1;
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const dayItems = consultations.filter(c => (c.consultation_date || c.created_at.split('T')[0]) === dateStr);
            const totalSales = dayItems.reduce((sum, c) => sum + (c.amount || 0), 0);
            const isToday = d === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();

            return (
              <div 
                key={`day-${d}`} 
                onClick={() => dayItems.length > 0 && setSelectedDayConsults({ dateStr, items: dayItems })}
                className={`min-h-[110px] rounded-2xl p-2.5 border flex flex-col justify-between transition ${dayItems.length > 0 ? "cursor-pointer hover:border-teal-400 hover:shadow-sm bg-teal-50/20" : "bg-white"} ${isToday ? "border-teal-500 bg-teal-50/40" : "border-slate-100"}`}
              >
                <div className="flex justify-between items-center w-full">
                  <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${isToday ? "bg-teal-900 text-white" : "text-slate-700"}`}>{d}</span>
                  {dayItems.length > 0 && (
                    <span className="text-[10px] bg-teal-100 text-teal-800 px-1.5 py-0.5 rounded-md font-bold">상담 {dayItems.length}건</span>
                  )}
                </div>

                <div className="w-full text-center my-auto">
                  {totalSales > 0 ? (
                    <div className="text-xs md:text-sm font-extrabold text-purple-800">
                      {totalSales.toLocaleString()}원
                    </div>
                  ) : (
                    <span className="text-[11px] text-slate-300">-</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 날짜별 상세 상담 및 매출 내역 팝업 */}
      {selectedDayConsults && (
        <div onClick={() => setSelectedDayConsults(null)} className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4 cursor-default" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold text-slate-900">📅 {selectedDayConsults.dateStr} 경영 상세 내역</h3>
              <button onClick={() => setSelectedDayConsults(null)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-200">✕</button>
            </div>
            
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {selectedDayConsults.items.map((item, idx) => (
                <div key={idx} className="p-3.5 bg-slate-50 border rounded-2xl flex justify-between items-center">
                  <div>
                    <span className="font-bold text-slate-900 text-base">{item.patients?.name || "환자"}</span>
                    <p className="text-xs text-slate-600 mt-0.5"><span className="font-semibold text-teal-800">처방:</span> {item.prescription || "미기재"}</p>
                  </div>
                  <div className="text-right">
                    <span className="font-extrabold text-purple-900 text-base">{item.amount ? `${item.amount.toLocaleString()}원` : "금액 없음"}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center pt-3 border-t">
              <span className="text-xs font-bold text-slate-500">총 합계 매출</span>
              <span className="text-lg font-extrabold text-teal-900">
                {selectedDayConsults.items.reduce((sum, i) => sum + (i.amount || 0), 0).toLocaleString()}원
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}