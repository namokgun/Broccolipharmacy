"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/app/lib/supabase";
import Link from "next/link";

export default function DashboardPage() {
  const [patients, setPatients] = useState<any[]>([]);
  const [consultations, setConsultations] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [currentDate, setCurrentDate] = useState<Date | null>(null);

  useEffect(() => {
    setCurrentDate(new Date());
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: pData } = await supabase.from("patients").select("*").order("name");
    if (pData) setPatients(pData);

    const { data: sData } = await supabase.from("schedules").select("*");
    if (sData) setSchedules(sData);

    const { data: cData } = await supabase
      .from("consultations")
      .select("*, patients(name, phone, custom_id, gender, birth_year)")
      .order("created_at", { ascending: false });

    if (cData) {
      const processed = cData.map((c: any) => {
        const baseDate = new Date(c.consultation_date || c.created_at);
        const feedbackDays = c.feedback_days ? parseInt(c.feedback_days) : 0;
        
        const targetDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + feedbackDays);
        const dateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
        
        const consultDateStr = c.consultation_date || c.created_at?.split('T')[0];

        return { ...c, target_date: dateStr, consult_date_str: consultDateStr };
      });
      setConsultations(processed);
    }
  };

  if (!currentDate) return <div className="p-8 text-center text-slate-400 text-xs">대시보드 로딩 중...</div>;

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  const currentDay = new Date().getDate();

  const thisMonthConsultations = consultations.filter(c => {
    const dateStr = c.consult_date_str;
    if (!dateStr) return false;
    const [y, m] = dateStr.split('-').map(Number);
    return y === currentYear && m === (currentMonth + 1);
  });

  const thisMonthSales = thisMonthConsultations.reduce((sum, c) => sum + (c.amount || 0), 0);
  
  const isCurrentMonthView = year === currentYear && month === currentMonth;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const divisorDays = isCurrentMonthView ? Math.max(1, currentDay) : daysInMonth;
  const dailyAverageSales = Math.round(thisMonthSales / divisorDays);

  const firstDayOfMonth = new Date(year, month, 1).getDay();

  const handlePrev = () => setCurrentDate(new Date(year, month - 1, 1));
  const handleNext = () => setCurrentDate(new Date(year, month + 1, 1));
  const handleToday = () => setCurrentDate(new Date());

  const todayStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
  const todayFeedbacks = consultations.filter(c => c.target_date === todayStr);

  const formatName = (p: any) => p?.custom_id ? `${p.name} (${p.custom_id})` : p?.name;

  return (
    <div className="w-full space-y-4 pb-8 max-w-[1400px] mx-auto">
      {/* 상단 간결한 인사말 및 날짜 */}
      <div className="flex justify-between items-center bg-white px-5 py-3 rounded-2xl shadow-xs border border-slate-100">
        <div>
          <h1 className="text-lg font-extrabold text-slate-900">👋 안녕하세요, 원장님!</h1>
          <p className="text-[11px] text-slate-500">오늘도 환자 건강을 위한 소중한 상담이 기다리고 있어요.</p>
        </div>
        <span className="text-xs font-bold bg-teal-50 text-teal-800 px-3 py-1 rounded-full">
          {currentYear}년 {currentMonth + 1}월 {currentDay}일 현황
        </span>
      </div>

      {/* 📊 상단 핵심 지표 요약 카드 (5개 1행 컴팩트 배치) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white p-3.5 rounded-2xl shadow-xs border border-slate-100 flex flex-col justify-between">
          <span className="text-[11px] font-bold text-slate-400">전체 고객 수</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-extrabold text-slate-900">{patients.length}명</span>
            <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded">등록완료</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl shadow-xs border border-slate-100 flex flex-col justify-between">
          <span className="text-[11px] font-bold text-slate-400">이번 달 상담 건수</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-extrabold text-slate-900">{thisMonthConsultations.length}건</span>
            <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">진행중</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl shadow-xs border border-slate-100 flex flex-col justify-between">
          <span className="text-[11px] font-bold text-slate-400">오늘 피드백 대상</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-extrabold text-purple-700">{todayFeedbacks.length}명</span>
            <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded">확인필요</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl shadow-xs border border-slate-100 flex flex-col justify-between">
          <span className="text-[11px] font-bold text-slate-400">이번 달 총 매출</span>
          <span className="text-lg font-extrabold text-teal-900 mt-1 truncate" title={`${thisMonthSales.toLocaleString()}원`}>
            {thisMonthSales.toLocaleString()}원
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl shadow-xs border border-slate-100 flex flex-col justify-between col-span-2 md:col-span-1">
          <span className="text-[11px] font-bold text-slate-400">이번 달 일평균 매출</span>
          <span className="text-lg font-extrabold text-purple-900 mt-1 truncate" title={`${dailyAverageSales.toLocaleString()}원`}>
            {dailyAverageSales.toLocaleString()}원
          </span>
        </div>
      </div>

      {/* 📅 중단 영역: 캘린더 & 오늘 피드백 대상 (높이 최적화) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        
        {/* 좌측: 미니 캘린더 */}
        <div className="lg:col-span-6 bg-white p-4.5 rounded-2xl shadow-xs border border-slate-100 flex flex-col h-[380px]">
          <div className="flex justify-between items-center mb-2.5 flex-shrink-0">
            <h2 className="text-sm font-extrabold text-slate-900">
              📅 캘린더 ({year}년 {month + 1}월)
            </h2>
            <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
              <button onClick={handlePrev} className="px-2 py-0.5 hover:bg-white rounded text-[11px] font-bold text-slate-600 transition">&lt;</button>
              <button onClick={handleToday} className="px-2 py-0.5 hover:bg-white rounded text-[11px] font-bold text-slate-800 transition">오늘</button>
              <button onClick={handleNext} className="px-2 py-0.5 hover:bg-white rounded text-[11px] font-bold text-slate-600 transition">&gt;</button>
            </div>
          </div>

          <div className="grid grid-cols-7 text-center text-[10px] font-bold text-slate-400 mb-2 pb-1.5 border-b border-slate-100 flex-shrink-0">
            <span className="text-red-500">일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span className="text-blue-500">토</span>
          </div>

          <div className="grid grid-cols-7 text-center gap-1 flex-1 overflow-y-auto">
            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <div key={`empty-${i}`} className="bg-slate-50/20 rounded-lg" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const d = i + 1;
              const formattedMonth = String(month + 1).padStart(2, '0');
              const formattedDay = String(d).padStart(2, '0');
              const dateStr = `${year}-${formattedMonth}-${formattedDay}`;
              
              const daySchedules = schedules.filter(s => s.schedule_date === dateStr);
              const dayConsultations = consultations.filter(c => c.consult_date_str === dateStr);
              const dayFeedbacks = consultations.filter(f => f.target_date === dateStr);

              const allItems = [
                ...daySchedules.map(s => ({ title: s.title, style: "bg-teal-100 text-teal-900 border border-teal-200" })),
                ...dayConsultations.map(c => ({ title: `🩺 ${formatName(c.patients)}`, style: "bg-emerald-100 text-emerald-900 border border-emerald-200" })),
                ...dayFeedbacks.map(f => ({ 
                  title: `📌 ${formatName(f.patients)}`, 
                  style: f.is_feedback_completed ? "bg-slate-100 text-slate-400 line-through" : "bg-purple-100 text-purple-900 border border-purple-200" 
                }))
              ];

              const MAX_VISIBLE = 2;
              const visibleItems = allItems.slice(0, MAX_VISIBLE);
              const hiddenCount = allItems.length - MAX_VISIBLE;
              const isToday = dateStr === todayStr;

              return (
                <div 
                  key={`day-${d}`}
                  className={`rounded-xl p-1 border transition flex flex-col items-center justify-start overflow-hidden select-none ${
                    isToday ? "bg-teal-50 border-teal-400 shadow-xs" : "bg-white border-slate-100"
                  }`}
                >
                  <span className={`text-[10px] font-bold mb-0.5 w-4.5 h-4.5 flex items-center justify-center rounded-full ${
                    isToday ? "bg-teal-900 text-white shadow-xs" : "text-slate-700"
                  }`}>
                    {d}
                  </span>
                  
                  <div className="w-full space-y-0.5">
                    {visibleItems.map((item, idx) => (
                      <div key={idx} className={`text-[8.5px] px-1 py-0.2 rounded truncate font-bold ${item.style}`}>
                        {item.title}
                      </div>
                    ))}
                    {hiddenCount > 0 && (
                      <div className="text-[8px] font-bold text-slate-400">
                        외 {hiddenCount}개
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 우측: 오늘 완료해야 할 피드백 */}
        <div className="lg:col-span-6 bg-white p-4.5 rounded-2xl shadow-xs border border-slate-100 flex flex-col justify-between h-[380px]">
          <div>
            <div className="flex justify-between items-center border-b pb-2.5 mb-3">
              <h2 className="text-sm font-extrabold text-slate-900">📌 오늘 완료해야 할 피드백</h2>
              <span className="text-[11px] font-bold bg-purple-100 text-purple-900 px-2 py-0.5 rounded-full">
                {todayFeedbacks.length}건
              </span>
            </div>

            <div className="space-y-2 overflow-y-auto max-h-[270px] pr-1">
              {todayFeedbacks.length === 0 ? (
                <div className="text-center py-16 text-slate-400 text-xs font-semibold">
                  오늘 예정된 피드백이 없습니다. 🎉
                </div>
              ) : (
                todayFeedbacks.map((f, idx) => (
                  <div key={idx} className="p-3 bg-purple-50/50 border border-purple-200/80 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-bold text-purple-700 block mb-0.5">{formatName(f.patients)}</span>
                      <p className="text-xs font-extrabold text-slate-900">처방: {f.prescription || "없음"}</p>
                    </div>
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg ${
                      f.is_feedback_completed ? "bg-slate-200 text-slate-600" : "bg-purple-600 text-white"
                    }`}>
                      {f.is_feedback_completed ? "완료됨" : "확인 필요"}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-2 border-t text-right">
            <Link href="/feedbacks" className="text-[11px] font-bold text-purple-900 hover:underline">
              피드백 캘린더 크게보기 →
            </Link>
          </div>
        </div>

      </div>

      {/* 📝 하단 영역: 최근 상담 기록 요약 테이블 (콤팩트) */}
      <div className="bg-white p-4.5 rounded-2xl shadow-xs border border-slate-100 space-y-3">
        <div className="flex justify-between items-center border-b pb-2.5">
          <h2 className="text-sm font-extrabold text-slate-900">📄 최근 상담 기록 (최신 4건)</h2>
          <Link href="/consultations#history" className="text-[11px] font-bold text-teal-800 hover:underline">
            더보기 →
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b">
              <tr>
                <th className="p-2.5 font-bold">상담일</th>
                <th className="p-2.5 font-bold">환자명</th>
                <th className="p-2.5 font-bold">주요 증상</th>
                <th className="p-2.5 font-bold">추천 처방</th>
                <th className="p-2.5 font-bold text-right">금액</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {consultations.slice(0, 4).length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-6 text-slate-400">등록된 상담 기록이 없습니다.</td>
                </tr>
              ) : (
                consultations.slice(0, 4).map((c, idx) => (
                  <tr key={c.id || idx} className="hover:bg-slate-50/80 transition">
                    <td className="p-2.5 font-semibold text-slate-700 whitespace-nowrap">{c.consultation_date || c.created_at?.split('T')[0]}</td>
                    <td className="p-2.5 font-bold text-slate-900 whitespace-nowrap">{formatName(c.patients)}</td>
                    <td className="p-2.5 text-slate-600 truncate max-w-[220px]" title={c.symptoms}>{c.symptoms || "-"}</td>
                    <td className="p-2.5 font-semibold text-teal-800 truncate max-w-[160px]" title={c.prescription}>{c.prescription || "-"}</td>
                    <td className="p-2.5 font-bold text-purple-800 text-right whitespace-nowrap">{c.amount ? `${c.amount.toLocaleString()}원` : "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}