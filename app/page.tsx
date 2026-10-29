"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/app/lib/supabase";
import Link from "next/link";

export default function DashboardPage() {
  const [patients, setPatients] = useState<any[]>([]);
  const [consultations, setConsultations] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentDate, setCurrentDate] = useState<Date | null>(null);

  useEffect(() => {
    setCurrentDate(new Date());
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: pData } = await supabase.from("patients").select("*").order("name");
    if (pData) setPatients(pData);

    // 🟢 상담 기록과 환자 정보를 함께 불러온 뒤, 피드백 예정일(target_date)을 계산하여 심어줍니다.
    const { data: cData } = await supabase
      .from("consultations")
      .select("*, patients(name, phone, custom_id, gender, birth_year)")
      .order("created_at", { ascending: false });

    if (cData) {
      const processed = cData.map((c: any) => {
        const baseDate = new Date(c.consultation_date || c.created_at);
        const feedbackDays = c.feedback_days ? parseInt(c.feedback_days) : 0;
        
        // 피드백 예정일 계산 (상담일 + 피드백일)
        const targetDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + feedbackDays);
        const dateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
        
        return { ...c, target_date: dateStr };
      });
      setConsultations(processed);
    }
  };

  if (!currentDate) return <div className="p-8 text-center text-slate-400">대시보드 로딩 중...</div>;

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const day = currentDate.getDate();

  // 이번 달 매출 및 일평균 매출 계산 로직
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  const currentDay = currentDate.getDate();

  const thisMonthConsultations = consultations.filter(c => {
    const dateStr = c.consultation_date || c.created_at?.split('T')[0];
    if (!dateStr) return false;
    const [y, m] = dateStr.split('-').map(Number);
    return y === currentYear && m === (currentMonth + 1);
  });

  const thisMonthSales = thisMonthConsultations.reduce((sum, c) => sum + (c.amount || 0), 0);
  const daysElapsed = Math.max(1, currentDay);
  const dailyAverageSales = Math.round(thisMonthSales / daysElapsed);

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const handlePrev = () => setCurrentDate(new Date(year, month - 1, 1));
  const handleNext = () => setCurrentDate(new Date(year, month + 1, 1));
  const handleToday = () => setCurrentDate(new Date());

  const filteredPatients = patients.filter(p =>
    p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.phone?.includes(searchTerm)
  );

  // 오늘 날짜 스트링 (YYYY-MM-DD)
  const todayStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
  
  // 오늘 완료해야 할 피드백 목록 필터링
  const todayFeedbacks = consultations.filter(c => c.target_date === todayStr);

  const formatName = (p: any) => p?.custom_id ? `${p.name} (${p.custom_id})` : p?.name;

  return (
    <div className="w-full space-y-6 pb-12">
      <div className="flex justify-between items-center border-b pb-4">
        <h1 className="text-2xl font-bold text-slate-900">📊 대시보드</h1>
        <p className="text-xs text-slate-500 font-semibold">{currentYear}년 {currentMonth + 1}월 현황</p>
      </div>

      {/* 상단 핵심 지표: 이번달 매출 / 일평균매출 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-teal-900 to-teal-800 text-white p-6 rounded-3xl shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-xs font-bold text-teal-300 uppercase tracking-wider mb-2">이번 달 총 매출</p>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mt-1">
              {thisMonthSales.toLocaleString()} <span className="text-xl font-medium">원</span>
            </h2>
          </div>
          <div className="mt-4 pt-3 border-t border-teal-800/60 flex justify-between items-center text-xs text-teal-200">
            <span>이번 달 상담 건수: {thisMonthConsultations.length}건</span>
            <span>실시간 집계</span>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-900 to-purple-800 text-white p-6 rounded-3xl shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-xs font-bold text-purple-300 uppercase tracking-wider mb-2">이번 달 일평균 매출</p>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mt-1">
              {dailyAverageSales.toLocaleString()} <span className="text-xl font-medium">원</span>
            </h2>
          </div>
          <div className="mt-4 pt-3 border-t border-purple-800/60 flex justify-between items-center text-xs text-purple-200">
            <span>산출 기준: 이달 1일 ~ 오늘 ({currentDay}일간)</span>
            <span>자동 계산</span>
          </div>
        </div>
      </div>

      {/* 상단 통계 요약 카드 (환자수, 상담기록수) */}
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

      {/* 🟢 좌우 2분할 레이아웃 (좌측: 반으로 줄인 피드백 캘린더, 우측: 오늘 할 일 / 피드백 요약) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* 좌측: 반으로 밀어버린 미니 캘린더 (lg:col-span-6) */}
        <div className="lg:col-span-6 bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col h-[520px]">
          <div className="flex justify-between items-center mb-4 flex-shrink-0">
            <h2 className="text-base font-extrabold text-slate-900">
              📅 피드백 미니 캘린더 ({year}년 {month + 1}월)
            </h2>
            <div className="flex items-center bg-slate-100 rounded-xl p-1">
              <button onClick={handlePrev} className="px-2.5 py-1 hover:bg-white rounded-lg text-xs font-bold text-slate-600 transition">&lt;</button>
              <button onClick={handleToday} className="px-2.5 py-1 hover:bg-white rounded-lg text-xs font-bold text-slate-800 transition">오늘</button>
              <button onClick={handleNext} className="px-2.5 py-1 hover:bg-white rounded-lg text-xs font-bold text-slate-600 transition">&gt;</button>
            </div>
          </div>

          <div className="grid grid-cols-7 text-center text-[11px] font-bold text-slate-400 mb-3 pb-2 border-b border-slate-100 flex-shrink-0">
            <span className="text-red-500">일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span className="text-blue-500">토</span>
          </div>

          <div className="grid grid-cols-7 text-center gap-1.5 flex-1 overflow-y-auto">
            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <div key={`empty-${i}`} className="bg-slate-50/20 rounded-xl" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const d = i + 1;
              const formattedMonth = String(month + 1).padStart(2, '0');
              const formattedDay = String(d).padStart(2, '0');
              const dateStr = `${year}-${formattedMonth}-${formattedDay}`;
              
              const dayFeedbacks = consultations.filter(f => f.target_date === dateStr);
              const isToday = dateStr === todayStr;

              return (
                <div 
                  key={`day-${d}`}
                  className={`rounded-2xl p-1.5 border transition flex flex-col items-center justify-start overflow-hidden select-none ${
                    isToday ? "bg-purple-50 border-purple-400 shadow-xs" : "bg-white border-slate-100"
                  }`}
                >
                  <span className={`text-[11px] font-bold mb-1 w-5 h-5 flex items-center justify-center rounded-full ${
                    isToday ? "bg-purple-700 text-white shadow-xs" : "text-slate-700"
                  }`}>
                    {d}
                  </span>
                  
                  {dayFeedbacks.length > 0 && (
                    <div className="w-full space-y-0.5">
                      <div className={`text-[9px] px-1 py-0.5 rounded truncate font-bold ${
                        dayFeedbacks.some(f => f.is_feedback_completed) 
                          ? "bg-slate-100 text-slate-400 line-through" 
                          : "bg-purple-100 text-purple-900"
                      }`}>
                        {formatName(dayFeedbacks[0].patients)} 외
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 우측 공간: 오늘 해야 할 피드백 요약 리스트 */}
        <div className="lg:col-span-6 bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between h-[520px]">
          <div>
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <h2 className="text-base font-extrabold text-slate-900">📌 오늘 완료해야 할 피드백</h2>
              <span className="text-xs font-bold bg-purple-100 text-purple-900 px-2.5 py-1 rounded-full">
                {todayFeedbacks.length}건
              </span>
            </div>

            <div className="space-y-3 overflow-y-auto max-h-[380px] pr-1">
              {todayFeedbacks.length === 0 ? (
                <div className="text-center py-20 text-slate-400 text-sm font-semibold">
                  오늘 예정된 피드백이 없습니다. 🎉
                </div>
              ) : (
                todayFeedbacks.map((f, idx) => (
                  <div key={idx} className="p-3.5 bg-purple-50/50 border border-purple-200 rounded-2xl flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-purple-700 block mb-0.5">{formatName(f.patients)}</span>
                      <p className="text-sm font-extrabold text-slate-900">처방: {f.prescription || "없음"}</p>
                    </div>
                    <span className={`text-xs font-bold px-3 py-1.5 rounded-xl ${
                      f.is_feedback_completed ? "bg-slate-200 text-slate-600" : "bg-purple-600 text-white"
                    }`}>
                      {f.is_feedback_completed ? "완료됨" : "확인 필요"}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-3 border-t text-right">
            <Link href="/consultations" className="text-xs font-bold text-teal-900 hover:underline">
              상담 기록 및 등록 바로가기 →
            </Link>
          </div>
        </div>

      </div>

      {/* 환자 목록 영역 */}
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