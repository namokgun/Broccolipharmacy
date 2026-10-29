"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

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
  const [consultations, setConsultations] = useState<any[]>([]); // 🟢 상담 데이터 상태 추가
  const [currentDate, setCurrentDate] = useState<Date | null>(null);
  
  const [selectedDetailSchedule, setSelectedDetailSchedule] = useState<any | null>(null);
  const [selectedDetailConsultation, setSelectedDetailConsultation] = useState<any | null>(null); // 🟢 상담 상세 모달 상태
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null); // 🟢 상담 사진 확대 상태

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("14:00");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [theme, setTheme] = useState("blue");
  const [dayDetailDate, setDayDetailDate] = useState<string | null>(null);

  // 🟢 일정 + 상담 데이터 모두 불러오기
  const fetchData = async () => {
    // 1. 일반 일정 불러오기
    const { data: sData } = await supabase.from("schedules").select("*").order("schedule_date", { ascending: true }).order("time", { ascending: true });
    if (sData) setSchedules(sData);

    // 2. 상담 기록 불러오기 (환자 정보 포함)
    const { data: cData } = await supabase.from("consultations").select("*, patients(name)").order("created_at", { ascending: false });
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
    }
  };

  useEffect(() => {
    setCurrentDate(new Date());
    fetchData(); // 🟢 fetchData로 통합 호출
  }, []);

  const handleSubmitSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleDate || !title) return alert("날짜와 일정 제목을 입력해주세요.");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return alert("로그인 정보가 없습니다.");

    const payload = { schedule_date: scheduleDate, time: scheduleTime, title, content, theme, user_id: user.id };

    if (editingId) {
      const { error } = await supabase.from("schedules").update(payload).eq("id", editingId);
      if (error) alert("수정 실패: " + error.message);
      else { closeModal(); fetchData(); }
    } else {
      const { error } = await supabase.from("schedules").insert([payload]);
      if (error) alert("일정 등록 실패: " + error.message);
      else { closeModal(); fetchData(); }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    await supabase.from("schedules").delete().eq("id", id);
    closeModal(); 
    setSelectedDetailSchedule(null);
    fetchData();
  };

  const closeModal = () => { setIsModalOpen(false); setEditingId(null); setTitle(""); setContent(""); setTheme("blue"); setScheduleTime("14:00"); };
  
  const handleScheduleClick = (e: React.MouseEvent, item: any) => { 
    e.stopPropagation(); 
    if (item.type === 'consultation') {
      setSelectedDetailConsultation(item.data); // 🟢 상담 기록 클릭 시
    } else {
      setSelectedDetailSchedule(item.data);     // 🟢 일반 일정 클릭 시
    }
  };
  
  const handleScheduleDoubleClick = (e: React.MouseEvent, s: any) => { 
    if(e?.stopPropagation) e.stopPropagation(); 
    setEditingId(s.id); 
    setScheduleDate(s.schedule_date); 
    setScheduleTime(s.time || "14:00"); 
    setTitle(s.title || ""); 
    setContent(s.content || ""); 
    setTheme(s.theme || "blue"); 
    setIsModalOpen(true); 
    setSelectedDetailSchedule(null);
  };

  const handleDateDoubleClick = (dateStr: string) => { 
    setEditingId(null); setScheduleDate(dateStr); setScheduleTime("14:00"); setTitle(""); setContent(""); setTheme("blue"); setIsModalOpen(true); 
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
    <div className="w-full h-[calc(100vh-80px)] flex flex-col space-y-4 overflow-hidden">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 flex-shrink-0">
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">
          📅 일정 캘린더 ({year}년 {month + 1}월)
        </h1>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-2xs">
            <button onClick={handlePrev} className="px-3 py-1 hover:bg-slate-100 rounded-lg text-xs font-bold text-slate-600 transition">&lt;</button>
            <button onClick={handleToday} className="px-3 py-1 hover:bg-slate-100 rounded-lg text-xs font-bold text-slate-800 transition">오늘</button>
            <button onClick={handleNext} className="px-3 py-1 hover:bg-slate-100 rounded-lg text-xs font-bold text-slate-600 transition">&gt;</button>
          </div>
          <button onClick={() => { setEditingId(null); setScheduleDate(new Date().toISOString().split('T')[0]); setScheduleTime("14:00"); setTitle(""); setContent(""); setTheme("blue"); setIsModalOpen(true); }} className="px-4 py-2 bg-teal-900 hover:bg-teal-800 text-white font-semibold rounded-xl transition text-xs md:text-sm shadow-sm">
            + 새로운 이벤트
          </button>
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
            
            // 🟢 일반 일정 데이터 필터링
            const daySchedules = schedules.filter(s => s.schedule_date === dateStr);
            // 🟢 상담 데이터 필터링
            const dayConsultations = consultations.filter(c => (c.consultation_date || c.created_at.split('T')[0]) === dateStr);
            
            // 두 항목을 하나의 배열로 합침
            const allDayItems = [
              ...dayConsultations.map(c => ({ type: 'consultation', data: c })),
              ...daySchedules.map(s => ({ type: 'schedule', data: s }))
            ];

            const isToday = d === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();
            const MAX_VISIBLE = 3; // 상담 기록까지 표시해야 하니 3개로 늘림
            const visibleItems = allDayItems.slice(0, MAX_VISIBLE); 
            const hiddenCount = allDayItems.length - MAX_VISIBLE;

            return (
              <div key={`day-${d}`} onDoubleClick={() => handleDateDoubleClick(dateStr)} className={`rounded-2xl p-2 border transition flex flex-col items-start cursor-pointer hover:border-teal-400 overflow-hidden select-none ${isToday ? "bg-teal-50/40 border-teal-500 shadow-2xs" : "bg-white border-slate-100 hover:bg-slate-50/50"}`}>
                <span className={`text-[10px] md:text-xs font-bold mb-1 w-5 h-5 flex items-center justify-center rounded-full ${isToday ? "bg-teal-900 text-white" : "text-slate-700"}`}>{d}</span>
                <div className="w-full space-y-1 text-left flex-1">
                  {visibleItems.map((item, idx) => {
                    if (item.type === 'consultation') {
                      // 🟢 상담 내역 렌더링 스타일 (환자명 - 처방)
                      const c = item.data;
                      const titleStr = `${c.patients?.name || "알수없음"} - ${c.prescription || "처방없음"}`;
                      return (
                        <div key={`c-${c.id || idx}`} onClick={(e) => handleScheduleClick(e, item)} className="text-[10px] md:text-[11px] px-2 py-0.5 rounded-lg truncate flex items-center justify-between transition cursor-pointer font-bold border bg-teal-50 border-teal-200 text-teal-900">
                          <span className="truncate">🩺 {titleStr}</span>
                        </div>
                      );
                    } else {
                      // 일반 일정 렌더링 스타일
                      const s = item.data;
                      const tc = THEME_CLASSES[s.theme || "blue"] || THEME_CLASSES.blue;
                      return (
                        <div key={`s-${s.id || idx}`} onClick={(e) => handleScheduleClick(e, item)} className={`text-[10px] md:text-[11px] px-2 py-0.5 rounded-lg truncate flex items-center justify-between transition cursor-pointer font-semibold border ${tc.bg} ${tc.text}`}>
                          <span className="truncate">{s.title}</span>
                        </div>
                      );
                    }
                  })}
                  {hiddenCount > 0 && <div onClick={(e) => { e.stopPropagation(); setDayDetailDate(dateStr); }} className="text-[10px] font-semibold text-slate-500 hover:text-slate-800 transition px-1">및 {hiddenCount}개...</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 🟢 기존 일반 일정 상세 모달 */}
      {selectedDetailSchedule && (
        <div className="fixed inset-0 z-[70] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSelectedDetailSchedule(null)}>
          <div className="bg-white w-full max-w-sm p-6 rounded-3xl shadow-2xl border border-slate-100" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-5 border-b pb-4">
              <div className="flex items-center gap-3">
                <span className={`w-3.5 h-3.5 rounded-full ${THEMES[selectedDetailSchedule.theme || "blue"].bg}`}></span>
                <h3 className="font-bold text-lg text-slate-900">{selectedDetailSchedule.title}</h3>
              </div>
              <button onClick={() => setSelectedDetailSchedule(null)} className="text-slate-400 bg-slate-100 w-7 h-7 rounded-full flex justify-center items-center font-bold">✕</button>
            </div>
            <div className="space-y-4 mb-6 text-sm">
              <div><span className="text-xs text-slate-400 font-bold block mb-1">일시</span><p className="font-semibold text-slate-800">{selectedDetailSchedule.schedule_date} ({selectedDetailSchedule.time || "종일"})</p></div>
              <div><span className="text-xs text-slate-400 font-bold block mb-1">메모</span><p className="font-medium text-slate-700 bg-slate-50 p-3 rounded-xl border">{selectedDetailSchedule.content || "메모 없음"}</p></div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => handleDelete(selectedDetailSchedule.id)} className="px-4 py-2.5 bg-red-50 text-red-600 rounded-xl text-sm font-bold">삭제</button>
              <button onClick={(e) => handleScheduleDoubleClick(e, selectedDetailSchedule)} className="flex-1 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold">수정하기</button>
            </div>
          </div>
        </div>
      )}

      {/* 🟢 자동 연동된 상담 기록 상세 보기 모달 */}
      {selectedDetailConsultation && (
        <div onClick={() => setSelectedDetailConsultation(null)} className="fixed inset-0 z-[110] bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer">
          <div className="bg-white w-full max-w-3xl max-h-[85vh] rounded-3xl p-6 shadow-2xl border border-slate-200 flex flex-col space-y-4 cursor-default" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">📄 상담 상세 내역</h3>
                <p className="text-xs text-slate-500">
                  환자: <strong className="text-slate-800">{selectedDetailConsultation.patients?.name || "알수없음"}</strong> | 
                  내방일: {selectedDetailConsultation.consultation_date || selectedDetailConsultation.created_at.split('T')[0]}
                </p>
              </div>
              <button onClick={() => setSelectedDetailConsultation(null)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-200">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row gap-4 items-start">
                  
                  {/* 텍스트 영역 */}
                  <div className="flex-1 space-y-2 min-w-0 w-full">
                    <div className="flex flex-wrap gap-x-4 text-sm font-bold text-slate-800 mb-2">
                      {selectedDetailConsultation.symptoms && <div>{selectedDetailConsultation.symptoms}</div>}
                      {selectedDetailConsultation.prescription && <div className="text-teal-700">{selectedDetailConsultation.prescription}</div>}
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
                        <strong className="text-purple-800 block mb-1">추후관리:</strong>
                        {selectedDetailConsultation.follow_up}
                      </div>
                    )}
                  </div>

                  {/* 사진 영역 */}
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

      {/* 🟢 사진 확대 라이트박스 */}
      {previewImageUrl && (
        <div onClick={() => setPreviewImageUrl(null)} className="fixed inset-0 z-[120] bg-slate-950/80 flex items-center justify-center p-4 cursor-pointer">
          <img src={previewImageUrl} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
          <button onClick={() => setPreviewImageUrl(null)} className="absolute top-4 right-4 text-white bg-slate-800 w-10 h-10 rounded-full font-bold">✕</button>
        </div>
      )}

      {/* 이벤트 추가/수정 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-[80] p-4">
          <div className="bg-white w-full max-w-md p-6 rounded-3xl shadow-2xl border border-slate-100">
            <div className="flex justify-between items-center mb-5 border-b pb-3">
              <h3 className="text-lg font-bold text-slate-900">{editingId ? "✏️ 이벤트 편집" : "📅 새로운 이벤트"}</h3>
              <button onClick={closeModal} className="font-bold w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">✕</button>
            </div>
            <form onSubmit={handleSubmitSchedule} className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-bold text-slate-400 mb-1">날짜</label><input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} className="w-full p-2.5 bg-slate-50 border rounded-xl font-semibold" required /></div>
                <div><label className="block text-xs font-bold text-slate-400 mb-1">시간</label><input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} className="w-full p-2.5 bg-slate-50 border rounded-xl font-semibold" required /></div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">제목</label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full p-2.5 bg-slate-50 border rounded-xl font-semibold text-slate-900" required />
              </div>
              <div><label className="block text-xs font-bold text-slate-400 mb-2">테마</label><div className="flex gap-3">{Object.entries(THEMES).map(([key, value]) => (<button key={key} type="button" onClick={() => setTheme(key)} className={`w-8 h-8 rounded-full ${value.bg} ${theme === key ? "ring-2 ring-offset-2 ring-teal-500 scale-110" : "opacity-70"}`}></button>))}</div></div>
              <div><label className="block text-xs font-bold text-slate-400 mb-1">메모</label><textarea value={content} onChange={(e) => setContent(e.target.value)} className="w-full p-2.5 bg-slate-50 border rounded-xl font-semibold text-slate-900" rows={2} /></div>
              
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={closeModal} className="flex-1 py-2.5 bg-slate-200 text-slate-700 hover:bg-slate-300 font-bold rounded-xl transition">취소</button>
                <button type="submit" className="flex-1 py-2.5 bg-teal-900 hover:bg-teal-800 text-white font-bold rounded-xl shadow-sm transition">{editingId ? "수정 저장" : "추가"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}