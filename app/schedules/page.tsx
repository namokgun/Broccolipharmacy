"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/app/lib/supabase";

const THEMES: Record<string, { bg: string, text: string, ring: string, label: string }> = {
  blue: { bg: "bg-blue-500", text: "text-white", ring: "ring-blue-400", label: "블루" },
  emerald: { bg: "bg-emerald-500", text: "text-white", ring: "ring-emerald-400", label: "그린" },
  purple: { bg: "bg-purple-500", text: "text-white", ring: "ring-purple-400", label: "퍼플" },
  amber: { bg: "bg-amber-500", text: "text-white", ring: "ring-amber-400", label: "오렌지" },
  rose: { bg: "bg-rose-500", text: "text-white", ring: "ring-rose-400", label: "핑크" },
};

const THEME_CLASSES: Record<string, { bg: string, text: string }> = {
  blue: { bg: "bg-blue-50 border-blue-200", text: "text-blue-900" },
  emerald: { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-900" },
  purple: { bg: "bg-purple-50 border-purple-200", text: "text-purple-900" },
  amber: { bg: "bg-amber-50 border-amber-200", text: "text-amber-900" },
  rose: { bg: "bg-rose-50 border-rose-200", text: "text-rose-900" },
};

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [consultations, setConsultations] = useState<any[]>([]); 
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [currentDate, setCurrentDate] = useState<Date | null>(null);
  
  const [selectedDetailSchedule, setSelectedDetailSchedule] = useState<any | null>(null);
  const [selectedDetailFeedback, setSelectedDetailFeedback] = useState<any | null>(null); 
  const [selectedDetailConsultation, setSelectedDetailConsultation] = useState<any | null>(null); 
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null); 
  const [dayDetailDate, setDayDetailDate] = useState<string | null>(null); 
  const [dayDetailType, setDayDetailType] = useState<"consult" | "feedback">("consult");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("14:00");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [theme, setTheme] = useState("blue");

  useEffect(() => {
    setCurrentDate(new Date());
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    // 1. 일반 일정 데이터 로드
    const { data: sData } = await supabase.from("schedules").select("*").order("schedule_date", { ascending: true }).order("time", { ascending: true });
    if (sData) setSchedules(sData);

    // 2. 상담 및 피드백 대상 데이터 로드
    const { data: cData } = await supabase.from("consultations").select("*, patients(name, phone, custom_id)").order("created_at", { ascending: false });
    
    if (cData) {
      const withSignedUrls = await Promise.all(
        cData.map(async (c) => {
          if (c.image_urls && Array.isArray(c.image_urls) && c.image_urls.length > 0) {
            const signedUrls = await Promise.all(
              c.image_urls.map(async (path: string) => {
                if (path.startsWith('http')) return path;
                const { data: signedData } = await supabase.storage.from('consultation-images').createSignedUrl(path, 60 * 60);
                return signedData?.signedUrl || '';
              })
            );
            return { ...c, display_image_urls: signedUrls.filter(Boolean) };
          }
          return { ...c, display_image_urls: [] };
        })
      );
      setConsultations(withSignedUrls);

      // 3. 기존 피드백 캘린더 target_date 연산 로직 그대로 적용
      const feedbackFiltered = withSignedUrls
        .filter((c: any) => c.feedback_days !== null && c.feedback_days !== undefined && c.feedback_days > 0)
        .map((c: any) => {
          const createdDate = new Date(c.consultation_date || c.created_at);
          const targetDate = new Date(createdDate.getFullYear(), createdDate.getMonth(), createdDate.getDate() + c.feedback_days);
          const dateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
          return { ...c, target_date: dateStr };
        });
      setFeedbacks(feedbackFiltered);
    }
  };

  // 🟢 기존 피드백 토글 및 저장 로직 그대로 적용
  const handleToggleFeedbackComplete = async (e: any, consultationId: string, currentStatus: boolean) => {
    if (e) e.stopPropagation();
    const newStatus = !currentStatus;

    const { error } = await supabase
      .from("consultations")
      .update({ is_feedback_completed: newStatus })
      .eq("id", consultationId);

    if (error) {
      alert("상태 변경 실패: " + error.message);
    } else {
      setFeedbacks(prev => prev.map(f => f.id === consultationId ? { ...f, is_feedback_completed: newStatus } : f));
      setConsultations(prev => prev.map(c => c.id === consultationId ? { ...c, is_feedback_completed: newStatus } : c));
      
      if (selectedDetailFeedback && selectedDetailFeedback.id === consultationId) {
        setSelectedDetailFeedback((prev: any) => ({ ...prev, is_feedback_completed: newStatus }));
      }
    }
  };

  const handleSubmitSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleDate || !title) return alert("날짜와 일정 제목을 입력해주세요.");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return alert("로그인 정보가 없습니다.");

    const payload = { schedule_date: scheduleDate, time: scheduleTime, title, content, theme, user_id: user.id };

    if (editingId) {
      const { error } = await supabase.from("schedules").update(payload).eq("id", editingId);
      if (error) alert("수정 실패: " + error.message);
      else { closeModal(); fetchAllData(); }
    } else {
      const { error } = await supabase.from("schedules").insert([payload]);
      if (error) alert("일정 등록 실패: " + error.message);
      else { closeModal(); fetchAllData(); }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    await supabase.from("schedules").delete().eq("id", id);
    closeModal(); 
    setSelectedDetailSchedule(null);
    fetchAllData();
  };

  const closeModal = () => { setIsModalOpen(false); setEditingId(null); setTitle(""); setContent(""); setTheme("blue"); setScheduleTime("14:00"); };

  const handleDateDoubleClick = (dateStr: string) => { 
    setEditingId(null); setScheduleDate(dateStr); setScheduleTime("14:00"); setTitle(""); setContent(""); setTheme("blue"); setIsModalOpen(true); 
  };

  const formatName = (p: any) => p?.custom_id ? `${p.name} (${p.custom_id})` : p?.name;

  const formatSummaryText = (count: number, totalAmount: number) => {
    if (count <= 0) return null;
    if (totalAmount <= 0) return `${count}건`;
    const amountText = totalAmount >= 10000 
      ? `${(totalAmount / 10000).toFixed(0)}만` 
      : `${totalAmount.toLocaleString()}원`;
    return `${count}건 / ${amountText}`;
  };

  if (!currentDate) return <div className="flex h-40 items-center justify-center text-slate-400">캘린더 로딩 중...</div>;

  const year = currentDate.getFullYear(); 
  const month = currentDate.getMonth(); 
  const handlePrev = () => setCurrentDate(new Date(year, month - 1, 1));
  const handleNext = () => setCurrentDate(new Date(year, month + 1, 1));
  const handleToday = () => setCurrentDate(new Date());
  const firstDayOfMonth = new Date(year, month, 1).getDay(); 
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  return (
    <div className="w-full h-[calc(100vh-80px)] flex flex-col space-y-3 overflow-hidden pb-4">
      {/* 상단 헤더 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 flex-shrink-0">
        <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-slate-900">
          📅 캘린더 센터 ({year}년 {month + 1}월)
        </h1>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-2xs">
            <button onClick={handlePrev} className="px-3 py-1 hover:bg-slate-100 rounded-lg text-xs font-bold text-slate-600 transition">&lt;</button>
            <button onClick={handleToday} className="px-3 py-1 hover:bg-slate-100 rounded-lg text-xs font-bold text-slate-800 transition">오늘</button>
            <button onClick={handleNext} className="px-3 py-1 hover:bg-slate-100 rounded-lg text-xs font-bold text-slate-600 transition">&gt;</button>
          </div>
          <button onClick={() => { setEditingId(null); setScheduleDate(new Date().toISOString().split('T')[0]); setScheduleTime("14:00"); setTitle(""); setContent(""); setTheme("blue"); setIsModalOpen(true); }} className="px-3.5 py-2 bg-teal-900 hover:bg-teal-800 text-white font-semibold rounded-xl transition text-xs shadow-sm">
            + 새로운 이벤트
          </button>
        </div>
      </div>

      {/* 좌우 1:1 두 개의 달력 병렬 배치 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 flex-1 min-h-0 overflow-y-auto pr-1">
        
        {/* 1. 좌측: 상담 및 약국 일정 캘린더 */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 flex flex-col p-3 md:p-4">
          <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-100 flex-shrink-0">
            <h2 className="text-sm font-extrabold text-teal-950 flex items-center gap-1.5">
              <span>🩺</span> 상담 및 약국 일정
            </h2>
            <span className="text-[10px] text-slate-400 font-semibold">내방 상담 / 일정 등록</span>
          </div>

          <div className="grid grid-cols-7 text-center text-[10px] font-bold text-slate-400 mb-1.5 pb-1 border-b border-slate-100 flex-shrink-0">
            <span className="text-red-500">일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span className="text-blue-500">토</span>
          </div>

          <div className="grid grid-cols-7 text-center gap-1 flex-1 min-h-0 overflow-y-auto">
            {Array.from({ length: firstDayOfMonth }).map((_, i) => <div key={`empty-left-${i}`} className="bg-slate-50/20 rounded-xl" />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const d = i + 1; 
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
              
              const daySchedules = schedules.filter(s => s.schedule_date === dateStr);
              const dayConsultations = consultations.filter(c => (c.consultation_date || c.created_at.split('T')[0]) === dateStr);
              const totalAmount = dayConsultations.reduce((sum, c) => sum + (c.amount || 0), 0);

              const allDayItems = [
                ...dayConsultations.map(c => ({ type: 'consultation', data: c })),
                ...daySchedules.map(s => ({ type: 'schedule', data: s }))
              ];

              const isToday = d === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();
              const MAX_VISIBLE = 2; 
              const visibleItems = allDayItems.slice(0, MAX_VISIBLE); 
              const hiddenCount = allDayItems.length - MAX_VISIBLE;

              const summaryText = formatSummaryText(dayConsultations.length, totalAmount);

              return (
                <div key={`day-left-${d}`} onDoubleClick={() => handleDateDoubleClick(dateStr)} className={`rounded-xl p-1.5 border transition flex flex-col items-start cursor-pointer hover:border-teal-400 overflow-hidden select-none min-h-[72px] ${isToday ? "bg-teal-50/40 border-teal-500 shadow-2xs" : "bg-white border-slate-100 hover:bg-slate-50/50"}`}>
                  <div className="flex justify-between items-start w-full mb-0.5">
                    <span className={`text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full flex-shrink-0 ${isToday ? "bg-teal-900 text-white" : "text-slate-700"}`}>{d}</span>
                    {summaryText && (
                      <div className="text-[8px] font-bold text-teal-700 text-right leading-none truncate pl-1">
                        {summaryText}
                      </div>
                    )}
                  </div>

                  <div className="w-full space-y-0.5 text-left flex-1">
                    {visibleItems.map((item, idx) => {
                      if (item.type === 'consultation') {
                        const c = item.data;
                        return (
                          <div key={`c-${c.id || idx}`} onClick={(e) => { e.stopPropagation(); setSelectedDetailConsultation(c); }} className="text-[9px] px-1.5 py-0.5 rounded truncate flex items-center justify-between transition cursor-pointer font-bold border bg-teal-50 border-teal-200 text-teal-900 hover:bg-teal-100">
                            <span className="truncate">🩺 {formatName(c.patients)}</span>
                          </div>
                        );
                      } else {
                        const s = item.data;
                        const tc = THEME_CLASSES[s.theme || "blue"] || THEME_CLASSES.blue;
                        return (
                          <div key={`s-${s.id || idx}`} onClick={(e) => { e.stopPropagation(); setSelectedDetailSchedule(s); }} className={`text-[9px] px-1.5 py-0.5 rounded truncate flex items-center justify-between transition cursor-pointer font-semibold border hover:opacity-80 ${tc.bg} ${tc.text}`}>
                            <span className="truncate">{s.title}</span>
                          </div>
                        );
                      }
                    })}

                    {hiddenCount > 0 && (
                      <div onClick={(e) => { e.stopPropagation(); setDayDetailType("consult"); setDayDetailDate(dateStr); }} className="text-[8px] font-semibold text-slate-500 hover:text-slate-800 transition px-0.5 cursor-pointer">
                        +{hiddenCount}개 더보기
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. 우측: 기존 피드백 모니터링 캘린더 (원본 시스템 구조 반영) */}
        <div className="bg-white rounded-3xl shadow-sm border border-purple-200/80 flex flex-col p-3 md:p-4">
          <div className="flex justify-between items-center mb-2 pb-2 border-b border-purple-100 flex-shrink-0">
            <h2 className="text-sm font-extrabold text-purple-950 flex items-center gap-1.5">
              <span>📌</span> 피드백 모니터링 캘린더
            </h2>
            <span className="text-[10px] text-purple-500 font-semibold">피드백 도달 예정일</span>
          </div>

          <div className="grid grid-cols-7 text-center text-[10px] font-bold text-slate-400 mb-1.5 pb-1 border-b border-slate-100 flex-shrink-0">
            <span className="text-red-500">일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span className="text-blue-500">토</span>
          </div>

          <div className="grid grid-cols-7 text-center gap-1 flex-1 min-h-0 overflow-y-auto">
            {Array.from({ length: firstDayOfMonth }).map((_, i) => <div key={`empty-right-${i}`} className="bg-purple-50/20 rounded-xl" />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const d = i + 1; 
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
              
              const dayFeedbacks = feedbacks.filter(f => f.target_date === dateStr);
              const isToday = d === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();
              const MAX_VISIBLE = 2; 
              const visibleFeedbacks = dayFeedbacks.slice(0, MAX_VISIBLE); 
              const hiddenCount = dayFeedbacks.length - MAX_VISIBLE;

              return (
                <div key={`day-right-${d}`} className={`rounded-xl p-1.5 border transition flex flex-col items-start cursor-pointer hover:border-purple-400 overflow-hidden select-none min-h-[72px] ${isToday ? "bg-purple-50/40 border-purple-500 shadow-2xs" : "bg-white border-slate-100 hover:bg-purple-50/20"}`}>
                  <div className="flex justify-between items-start w-full mb-0.5">
                    <span className={`text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full flex-shrink-0 ${isToday ? "bg-purple-900 text-white" : "text-slate-700"}`}>{d}</span>
                    {dayFeedbacks.length > 0 && (
                      <span className="text-[8px] font-bold text-purple-700 bg-purple-100 px-1 rounded-md">
                        {dayFeedbacks.length}건
                      </span>
                    )}
                  </div>

                  <div className="w-full space-y-0.5 text-left flex-1">
                    {visibleFeedbacks.map((f, idx) => {
                      const isCompleted = f.is_feedback_completed;
                      return (
                        <div 
                          key={idx} 
                          onClick={(e) => { e.stopPropagation(); setSelectedDetailFeedback(f); }}
                          className={`text-[9px] px-1.5 py-0.5 rounded truncate font-semibold cursor-pointer transition border shadow-2xs ${
                            isCompleted 
                              ? "bg-slate-100 border-slate-300 text-slate-400 line-through" 
                              : "bg-purple-50 text-purple-900 border-purple-200 hover:bg-purple-100"
                          }`}
                        >
                          📌 {formatName(f.patients)} / {f.prescription}
                        </div>
                      );
                    })}

                    {hiddenCount > 0 && (
                      <div onClick={(e) => { e.stopPropagation(); setDayDetailType("feedback"); setDayDetailDate(dateStr); }} className="text-[8px] font-semibold text-purple-600 hover:text-purple-900 transition px-0.5 cursor-pointer">
                        +{hiddenCount}개 더보기
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* 날짜별 전체 항목 보기 모달 */}
      {dayDetailDate && (
        <div onClick={() => setDayDetailDate(null)} className="fixed inset-0 z-[90] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer">
          <div className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-2xl border border-slate-200 flex flex-col cursor-default max-h-[80vh]" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b pb-2 mb-3">
              <h3 className="text-base font-bold text-slate-900">
                {dayDetailType === "consult" ? "📅" : "📌"} {dayDetailDate} {dayDetailType === "consult" ? "상담/일정 목록" : "피드백 목록"}
              </h3>
              <button onClick={() => setDayDetailDate(null)} className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-200">✕</button>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {dayDetailType === "consult" ? (
                (() => {
                  const daySchedules = schedules.filter(s => s.schedule_date === dayDetailDate);
                  const dayConsultations = consultations.filter(c => (c.consultation_date || c.created_at.split('T')[0]) === dayDetailDate);
                  const allDayItems = [
                    ...dayConsultations.map(c => ({ type: 'consultation', data: c })),
                    ...daySchedules.map(s => ({ type: 'schedule', data: s }))
                  ];

                  return allDayItems.map((item, idx) => {
                    if (item.type === 'consultation') {
                      const c = item.data;
                      return (
                        <div 
                          key={`c-${c.id || idx}`} 
                          onClick={() => { setDayDetailDate(null); setSelectedDetailConsultation(c); }} 
                          className="px-2.5 py-2 rounded-xl flex items-center justify-between transition cursor-pointer font-bold border bg-teal-50 border-teal-200 text-teal-900 hover:bg-teal-100 shadow-xs text-xs"
                        >
                          <span className="whitespace-pre-line leading-tight">🩺 {formatName(c.patients)}<br/>{c.prescription || "처방없음"}</span>
                        </div>
                      );
                    } else {
                      const s = item.data;
                      const tc = THEME_CLASSES[s.theme || "blue"] || THEME_CLASSES.blue;
                      return (
                        <div 
                          key={`s-${s.id || idx}`} 
                          onClick={() => { setDayDetailDate(null); setSelectedDetailSchedule(s); }} 
                          className={`px-2.5 py-2 rounded-xl flex items-center justify-between transition cursor-pointer font-semibold border hover:opacity-80 shadow-xs text-xs ${tc.bg} ${tc.text}`}
                        >
                          <span className="truncate">{s.title}</span>
                        </div>
                      );
                    }
                  });
                })()
              ) : (
                feedbacks.filter(f => f.target_date === dayDetailDate).map((f, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => { setDayDetailDate(null); setSelectedDetailFeedback(f); }}
                    className={`px-3 py-2.5 rounded-xl flex items-center justify-between transition cursor-pointer font-bold border text-xs shadow-xs ${
                      f.is_feedback_completed ? "bg-slate-100 border-slate-300 text-slate-400 line-through" : "bg-purple-50 border-purple-200 text-purple-900 hover:bg-purple-100"
                    }`}
                  >
                    <span className="truncate">{formatName(f.patients)} / {f.prescription}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 피드백 전용 상세 모달 (기존 피드백 모니터링 시스템 동일 구조) */}
      {selectedDetailFeedback && (
        <div className="fixed inset-0 z-[110] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSelectedDetailFeedback(null)}>
          <div className="bg-white w-full max-w-md p-6 rounded-3xl shadow-2xl border border-slate-100 flex flex-col space-y-4 cursor-default" onClick={e => e.stopPropagation()}>
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
              <div className="p-3.5 bg-purple-50/50 rounded-xl border border-purple-100"><span className="text-xs text-purple-700 font-bold block mb-1">모니터링 체크사항 (추후관리)</span><p className="font-bold text-purple-950 whitespace-pre-line">{selectedDetailFeedback.follow_up || "내용 없음"}</p></div>
            </div>

            <button onClick={() => setSelectedDetailFeedback(null)} className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition">확인 완료</button>
          </div>
        </div>
      )}

      {/* 일반 일정 상세 모달 */}
      {selectedDetailSchedule && (
        <div className="fixed inset-0 z-[70] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSelectedDetailSchedule(null)}>
          <div className="bg-white w-full max-w-sm p-5 rounded-3xl shadow-2xl border border-slate-100" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4 border-b pb-3">
              <div className="flex items-center gap-2">
                <span className={`w-3.5 h-3.5 rounded-full ${THEMES[selectedDetailSchedule.theme || "blue"].bg}`}></span>
                <h3 className="font-bold text-base text-slate-900">{selectedDetailSchedule.title}</h3>
              </div>
              <button onClick={() => setSelectedDetailSchedule(null)} className="text-slate-400 bg-slate-100 w-7 h-7 rounded-full flex justify-center items-center font-bold">✕</button>
            </div>
            <div className="space-y-3 mb-5 text-xs">
              <div><span className="text-[10px] text-slate-400 font-bold block mb-1">일시</span><p className="font-semibold text-slate-800">{selectedDetailSchedule.schedule_date} ({selectedDetailSchedule.time || "종일"})</p></div>
              <div><span className="text-[10px] text-slate-400 font-bold block mb-1">메모</span><p className="font-medium text-slate-700 bg-slate-50 p-2.5 rounded-xl border">{selectedDetailSchedule.content || "메모 없음"}</p></div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => handleDelete(selectedDetailSchedule.id)} className="px-4 py-2 bg-red-50 text-red-600 rounded-xl text-xs font-bold">삭제</button>
              <button onClick={(e) => { e.stopPropagation(); setEditingId(selectedDetailSchedule.id); setScheduleDate(selectedDetailSchedule.schedule_date); setScheduleTime(selectedDetailSchedule.time || "14:00"); setTitle(selectedDetailSchedule.title || ""); setContent(selectedDetailSchedule.content || ""); setTheme(selectedDetailSchedule.theme || "blue"); setIsModalOpen(true); setSelectedDetailSchedule(null); }} className="flex-1 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold">수정하기</button>
            </div>
          </div>
        </div>
      )}

      {/* 상담 상세 모달 */}
      {selectedDetailConsultation && (
        <div onClick={() => setSelectedDetailConsultation(null)} className="fixed inset-0 z-[110] bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer">
          <div className="bg-white w-full max-w-xl max-h-[85vh] rounded-3xl p-5 shadow-2xl border border-slate-200 flex flex-col space-y-3 cursor-default" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b pb-2">
              <div>
                <h3 className="text-base font-bold text-slate-900">📄 상담 상세 내역</h3>
                <p className="text-[11px] text-slate-500">
                  환자: <strong className="text-slate-800">{formatName(selectedDetailConsultation.patients)}</strong> | 
                  내방일: {selectedDetailConsultation.consultation_date || selectedDetailConsultation.created_at.split('T')[0]}
                </p>
              </div>
              <button onClick={() => setSelectedDetailConsultation(null)} className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-200">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 text-xs">
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-x-4 text-xs font-bold text-slate-800 mb-1">
                  {selectedDetailConsultation.symptoms && <div><span className="text-slate-400 text-[10px] mr-1">주호소</span>{selectedDetailConsultation.symptoms}</div>}
                  {selectedDetailConsultation.prescription && <div className="text-teal-700"><span className="text-teal-400 text-[10px] mr-1">처방</span>{selectedDetailConsultation.prescription}</div>}
                  {selectedDetailConsultation.amount && <div className="text-purple-700"><span className="text-purple-400 text-[10px] mr-1">결제액</span>{selectedDetailConsultation.amount.toLocaleString()}원</div>}
                </div>

                {selectedDetailConsultation.symptom_detail && (
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-[11px] text-slate-700 whitespace-pre-line leading-relaxed">
                    <strong className="text-slate-900 block mb-0.5 text-[10px]">증상 상세</strong>
                    {selectedDetailConsultation.symptom_detail}
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-2">
                  {selectedDetailConsultation.consult_memo && (
                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-[11px] text-slate-700 whitespace-pre-line leading-relaxed">
                      <strong className="text-slate-900 block mb-0.5 text-[10px]">코멘트</strong>
                      {selectedDetailConsultation.consult_memo}
                    </div>
                  )}
                  {selectedDetailConsultation.follow_up && (
                    <div className="p-2.5 bg-purple-50/60 rounded-xl border border-purple-200/60 text-[11px] text-purple-900 whitespace-pre-line leading-relaxed">
                      <strong className="text-purple-800 block mb-0.5 text-[10px]">추후관리</strong>
                      {selectedDetailConsultation.follow_up}
                    </div>
                  )}
                </div>

                {selectedDetailConsultation.display_image_urls && selectedDetailConsultation.display_image_urls.length > 0 && (
                  <div className="pt-1">
                    <span className="text-[10px] font-bold text-slate-500 block mb-1">첨부된 사진 ({selectedDetailConsultation.display_image_urls.length}장)</span>
                    <div className="flex flex-row flex-wrap gap-2 overflow-x-auto">
                      {selectedDetailConsultation.display_image_urls.map((imgUrl: string, imgIdx: number) => (
                        <div key={imgIdx} className="relative w-20 h-20 border border-slate-200 rounded-lg overflow-hidden bg-white shadow-2xs cursor-pointer flex items-center justify-center flex-shrink-0 group" onClick={() => setPreviewImageUrl(imgUrl)}>
                          <img src={imgUrl} className="max-w-full max-h-full object-contain group-hover:scale-105 transition rounded-md" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t">
              <button onClick={() => setSelectedDetailConsultation(null)} className="w-full py-2.5 bg-slate-900 text-white rounded-xl font-bold text-xs hover:bg-slate-800 transition">확인 완료</button>
            </div>
          </div>
        </div>
      )}

      {/* 이미지 확대 라이트박스 */}
      {previewImageUrl && (
        <div onClick={() => setPreviewImageUrl(null)} className="fixed inset-0 z-[120] bg-slate-950/80 flex items-center justify-center p-4 cursor-pointer">
          <img src={previewImageUrl} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
          <button onClick={() => setPreviewImageUrl(null)} className="absolute top-4 right-4 text-white bg-slate-800 w-10 h-10 rounded-full font-bold">✕</button>
        </div>
      )}

      {/* 이벤트 등록/수정 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-[80] p-4">
          <div className="bg-white w-full max-w-md p-5 rounded-3xl shadow-2xl border border-slate-100">
            <div className="flex justify-between items-center mb-4 border-b pb-2">
              <h3 className="text-base font-bold text-slate-900">{editingId ? "✏️ 이벤트 편집" : "📅 새로운 이벤트"}</h3>
              <button onClick={closeModal} className="font-bold w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center">✕</button>
            </div>
            <form onSubmit={handleSubmitSchedule} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div><label className="block text-[10px] font-bold text-slate-400 mb-1">날짜</label><input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} className="w-full p-2 bg-slate-50 border rounded-lg font-semibold" required /></div>
                <div><label className="block text-[10px] font-bold text-slate-400 mb-1">시간</label><input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} className="w-full p-2 bg-slate-50 border rounded-lg font-semibold" required /></div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1">제목</label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full p-2 bg-slate-50 border rounded-lg font-semibold text-slate-900" required />
              </div>
              <div><label className="block text-[10px] font-bold text-slate-400 mb-1.5">테마</label><div className="flex gap-2">{Object.entries(THEMES).map(([key, value]) => (<button key={key} type="button" onClick={() => setTheme(key)} className={`w-7 h-7 rounded-full ${value.bg} ${theme === key ? "ring-2 ring-offset-2 ring-teal-500 scale-110" : "opacity-70"}`}></button>))}</div></div>
              <div><label className="block text-[10px] font-bold text-slate-400 mb-1">메모</label><textarea value={content} onChange={(e) => setContent(e.target.value)} className="w-full p-2 bg-slate-50 border rounded-lg font-semibold text-slate-900" rows={2} /></div>
              
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={closeModal} className="flex-1 py-2 bg-slate-200 text-slate-700 hover:bg-slate-300 font-bold rounded-lg transition">취소</button>
                <button type="submit" className="flex-1 py-2 bg-teal-900 hover:bg-teal-800 text-white font-bold rounded-lg shadow-sm transition">{editingId ? "수정 저장" : "추가"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}