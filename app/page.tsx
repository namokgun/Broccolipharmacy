"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/app/lib/supabase";
import Link from "next/link";

export default function DashboardPage() {
  const [patients, setPatients] = useState<any[]>([]);
  const [consultations, setConsultations] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [currentDate, setCurrentDate] = useState<Date | null>(null);

  const [selectedDetailConsultation, setSelectedDetailConsultation] = useState<any | null>(null);
  const [dayDetailDate, setDayDetailDate] = useState<string | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

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
      const processed = await Promise.all(
        cData.map(async (c: any) => {
          const baseDate = new Date(c.consultation_date || c.created_at);
          const feedbackDays = c.feedback_days ? parseInt(c.feedback_days) : 0;
          
          const targetDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + feedbackDays);
          const dateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
          
          const consultDateStr = c.consultation_date || c.created_at?.split('T')[0];

          let display_image_urls = [];
          if (c.image_urls && Array.isArray(c.image_urls) && c.image_urls.length > 0) {
            const signedUrls = await Promise.all(
              c.image_urls.map(async (path: string) => {
                if (path.startsWith('http')) return path;
                const { data: signedData } = await supabase.storage.from('consultation-images').createSignedUrl(path, 60 * 60);
                return signedData?.signedUrl || '';
              })
            );
            display_image_urls = signedUrls.filter(Boolean);
          }

          return { ...c, target_date: dateStr, consult_date_str: consultDateStr, display_image_urls };
        })
      );
      setConsultations(processed);
    }
  };

  const toggleFeedbackComplete = async (e: React.MouseEvent, consultationId: string, currentState: boolean) => {
    e.stopPropagation();
    const newState = !currentState;
    const { error } = await supabase
      .from("consultations")
      .update({ is_feedback_completed: newState })
      .eq("id", consultationId);

    if (!error) {
      setConsultations(prev =>
        prev.map(item => item.id === consultationId ? { ...item, is_feedback_completed: newState } : item)
      );
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
      <div className="flex justify-between items-center bg-white px-5 py-2.5 rounded-2xl shadow-xs border border-slate-100">
        <h1 className="text-base font-extrabold text-slate-900">📊 대시보드</h1>
        <span className="text-[11px] font-semibold text-slate-500">
          {currentYear}년 {currentMonth + 1}월 {currentDay}일 현황
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white p-3.5 rounded-2xl shadow-xs border border-slate-100 flex flex-col justify-between">
          <span className="text-[11px] font-bold text-slate-400">전체 고객 수</span>
          <div className="mt-1">
            <span className="text-xl font-extrabold text-slate-900">{patients.length}명</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl shadow-xs border border-slate-100 flex flex-col justify-between">
          <span className="text-[11px] font-bold text-slate-400">이번 달 상담 건수</span>
          <div className="mt-1">
            <span className="text-xl font-extrabold text-slate-900">{thisMonthConsultations.length}건</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl shadow-xs border border-slate-100 flex flex-col justify-between">
          <span className="text-[11px] font-bold text-slate-400">오늘 피드백 대상</span>
          <div className="mt-1">
            <span className="text-xl font-extrabold text-purple-700">{todayFeedbacks.length}명</span>
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
              const dayFeedbacks = consultations.filter(f => f.target_date === dateStr && f.consult_date_str !== dateStr);

              const allItems = [
                ...daySchedules.map(s => ({ type: 'schedule', data: s, title: s.title, style: "bg-teal-100 text-teal-900 border border-teal-200" })),
                ...dayConsultations.map(c => ({ type: 'consultation', data: c, title: `🩺 ${formatName(c.patients)}`, style: "bg-emerald-100 text-emerald-900 border border-emerald-200" })),
                ...dayFeedbacks.map(f => ({ 
                  type: 'feedback',
                  data: f,
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
                  className="rounded-xl p-1 border transition flex flex-col items-center justify-start overflow-hidden select-none bg-white border-slate-100 hover:bg-slate-50 cursor-pointer"
                  onClick={() => setDayDetailDate(dateStr)}
                >
                  <span className={`text-[10px] font-bold mb-0.5 w-4.5 h-4.5 flex items-center justify-center rounded-full ${
                    isToday ? "bg-teal-900 text-white shadow-xs" : "text-slate-700"
                  }`}>
                    {d}
                  </span>
                  
                  <div className="w-full space-y-0.5">
                    {visibleItems.map((item, idx) => (
                      <div 
                        key={idx} 
                        className={`text-[8.5px] px-1 py-0.2 rounded truncate font-bold ${item.style}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (item.type === 'consultation' || item.type === 'feedback') setSelectedDetailConsultation(item.data);
                          else setDayDetailDate(dateStr);
                        }}
                      >
                        {item.title}
                      </div>
                    ))}
                    {hiddenCount > 0 && (
                      <div className="text-[8px] font-bold text-slate-400 hover:text-slate-800">
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
                  <div 
                    key={idx} 
                    onClick={() => setSelectedDetailConsultation(f)}
                    className="p-3 bg-purple-50/50 border border-purple-200/80 rounded-xl flex items-center justify-between cursor-pointer hover:bg-purple-50 transition"
                  >
                    <div>
                      <span className="text-[11px] font-bold text-purple-700 block mb-0.5">{formatName(f.patients)}</span>
                      <p className="text-xs font-extrabold text-slate-900">처방: {f.prescription || "없음"}</p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => toggleFeedbackComplete(e, f.id, f.is_feedback_completed)}
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition ${
                        f.is_feedback_completed ? "bg-slate-200 text-slate-600 hover:bg-slate-300" : "bg-purple-600 text-white hover:bg-purple-700"
                      }`}
                    >
                      {f.is_feedback_completed ? "완료됨" : "확인 필요"}
                    </button>
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
                  <tr key={c.id || idx} className="hover:bg-slate-50/85 transition">
                    <td className="p-2.5 font-semibold text-slate-700 whitespace-nowrap">{c.consultation_date || c.created_at?.split('T')[0]}</td>
                    <td 
                      className="p-2.5 font-bold text-slate-900 whitespace-nowrap cursor-pointer hover:text-teal-700 underline decoration-slate-300" 
                      onDoubleClick={() => setSelectedDetailConsultation(c)}
                    >
                      {formatName(c.patients)}
                    </td>
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

      {/* 날짜별 일정 전체 보기 모달 (상담은 초록색, 피드백은 보라색으로 색상 분리) */}
      {dayDetailDate && (
        <div onClick={() => setDayDetailDate(null)} className="fixed inset-0 z-[90] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-slate-200 flex flex-col cursor-default max-h-[80vh]" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <h3 className="text-lg font-bold text-slate-900">📅 {dayDetailDate} 일정 전체</h3>
              <button onClick={() => setDayDetailDate(null)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-200">✕</button>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {(() => {
                const daySchedules = schedules.filter(s => s.schedule_date === dayDetailDate);
                const dayConsultations = consultations.filter(c => c.consult_date_str === dayDetailDate);
                const dayFeedbacks = consultations.filter(f => f.target_date === dayDetailDate && f.consult_date_str !== dayDetailDate);

                const allDayItems = [
                  ...daySchedules.map(s => ({ type: 'schedule', data: s })),
                  ...dayConsultations.map(c => ({ type: 'consultation', data: c })),
                  ...dayFeedbacks.map(f => ({ type: 'feedback', data: f }))
                ];

                if (allDayItems.length === 0) {
                  return <div className="text-center py-12 text-slate-400 text-xs">등록된 일정이 없습니다.</div>;
                }

                return allDayItems.map((item, idx) => {
                  if (item.type === 'consultation') {
                    const c = item.data;
                    return (
                      <div 
                        key={`c-${c.id || idx}`} 
                        onClick={() => { setDayDetailDate(null); setSelectedDetailConsultation(c); }} 
                        className="px-3 py-3 rounded-xl flex items-center justify-between transition cursor-pointer font-bold border bg-emerald-50 border-emerald-200 text-emerald-900 hover:bg-emerald-100 shadow-2xs"
                      >
                        <span className="whitespace-pre-line text-xs">🩺 상담: {formatName(c.patients)} - {c.prescription || "처방없음"}</span>
                      </div>
                    );
                  } else if (item.type === 'feedback') {
                    const f = item.data;
                    return (
                      <div 
                        key={`f-${f.id || idx}`} 
                        onClick={() => { setDayDetailDate(null); setSelectedDetailConsultation(f); }} 
                        className={`px-3 py-3 rounded-xl flex items-center justify-between transition cursor-pointer font-bold border shadow-2xs text-xs ${
                          f.is_feedback_completed ? "bg-slate-100 border-slate-200 text-slate-400 line-through" : "bg-purple-50 border-purple-200 text-purple-900 hover:bg-purple-100"
                        }`}
                      >
                        <span className="whitespace-pre-line">📌 피드백: {formatName(f.patients)} - {f.prescription || "처방없음"}</span>
                      </div>
                    );
                  } else {
                    const s = item.data;
                    return (
                      <div 
                        key={`s-${s.id || idx}`} 
                        className="px-3 py-3 rounded-xl flex items-center justify-between transition font-semibold border bg-teal-50 border-teal-200 text-teal-900 shadow-2xs text-xs"
                      >
                        <span className="truncate">📅 일정: {s.title}</span>
                      </div>
                    );
                  }
                });
              })()}
            </div>
          </div>
        </div>
      )}

      {selectedDetailConsultation && (
        <div onClick={() => setSelectedDetailConsultation(null)} className="fixed inset-0 z-[110] bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer">
          <div className="bg-white w-full max-w-3xl max-h-[85vh] rounded-3xl p-6 shadow-2xl border border-slate-200 flex flex-col space-y-4 cursor-default" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">📄 상담 상세 내역</h3>
                <p className="text-xs text-slate-500">
                  환자: <strong className="text-slate-800">{formatName(selectedDetailConsultation.patients)}</strong> | 
                  내방일: {selectedDetailConsultation.consultation_date || selectedDetailConsultation.created_at?.split('T')[0]}
                </p>
              </div>
              <button onClick={() => setSelectedDetailConsultation(null)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-200">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-3">
                <div className="flex flex-col sm:flex-row gap-4 items-start">
                  <div className="flex-1 space-y-2 min-w-0 w-full">
                    <div className="flex flex-wrap gap-x-4 text-sm font-bold text-slate-800 mb-2">
                      {selectedDetailConsultation.symptoms && <div>증상: {selectedDetailConsultation.symptoms}</div>}
                      {selectedDetailConsultation.prescription && <div className="text-teal-700">처방: {selectedDetailConsultation.prescription}</div>}
                    </div>
                    {selectedDetailConsultation.symptom_detail && (
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-700 whitespace-pre-line leading-relaxed">
                        <strong className="text-slate-900 block mb-1">증상 상세:</strong>
                        {selectedDetailConsultation.symptom_detail}
                      </div>
                    )}
                    {selectedDetailConsultation.consult_memo && (
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-700 whitespace-pre-line leading-relaxed">
                        <strong className="text-slate-900 block mb-1">코멘트:</strong>
                        {selectedDetailConsultation.consult_memo}
                      </div>
                    )}
                    {selectedDetailConsultation.follow_up && (
                      <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-200/60 text-xs text-purple-900 whitespace-pre-line leading-relaxed">
                        <strong className="text-purple-800 block mb-1">모니터링 체크사항:</strong>
                        {selectedDetailConsultation.follow_up}
                      </div>
                    )}
                  </div>

                  {selectedDetailConsultation.display_image_urls && selectedDetailConsultation.display_image_urls.length > 0 && (
                    <div className="w-full sm:w-auto sm:max-w-[180px] flex flex-row sm:flex-col flex-wrap gap-2 overflow-x-auto sm:overflow-visible pb-2 sm:pb-0 flex-shrink-0">
                      {selectedDetailConsultation.display_image_urls.map((imgUrl: string, imgIdx: number) => (
                        <div 
                          key={imgIdx} 
                          className="relative w-24 h-24 sm:w-32 sm:h-32 border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs cursor-pointer flex items-center justify-center flex-shrink-0 group"
                          onClick={() => setPreviewImageUrl(imgUrl)}
                        >
                          <img src={imgUrl} className="max-w-full max-h-full object-contain group-hover:scale-105 transition rounded-lg" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t">
              <button onClick={() => setSelectedDetailConsultation(null)} className="px-5 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800">확인 완료</button>
            </div>
          </div>
        </div>
      )}

      {previewImageUrl && (
        <div onClick={() => setPreviewImageUrl(null)} className="fixed inset-0 z-[120] bg-slate-950/80 flex items-center justify-center p-4 cursor-pointer">
          <img src={previewImageUrl} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
          <button onClick={() => setPreviewImageUrl(null)} className="absolute top-4 right-4 text-white bg-slate-800 w-10 h-10 rounded-full font-bold">✕</button>
        </div>
      )}
    </div>
  );
}