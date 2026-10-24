"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

const THEMES: Record<string, { bg: string, text: string, hover: string, label: string }> = {
  blue: { bg: "bg-blue-100 border-blue-300", text: "text-blue-900", hover: "hover:bg-blue-200", label: "블루" },
  emerald: { bg: "bg-emerald-100 border-emerald-300", text: "text-emerald-900", hover: "hover:bg-emerald-200", label: "그린" },
  purple: { bg: "bg-purple-100 border-purple-300", text: "text-purple-900", hover: "hover:bg-purple-200", label: "퍼플" },
  amber: { bg: "bg-amber-100 border-amber-300", text: "text-amber-900", hover: "hover:bg-amber-200", label: "오렌지" },
  rose: { bg: "bg-rose-100 border-rose-300", text: "text-rose-900", hover: "hover:bg-rose-200", label: "핑크" },
};

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<"month" | "week" | "day">("month");
  const [currentDate, setCurrentDate] = useState<Date | null>(null);

  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("10:00");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [theme, setTheme] = useState("blue");

  const fetchSchedules = async () => {
    const { data } = await supabase
      .from("schedules")
      .select("*")
      .order("schedule_date", { ascending: true });
    if (data) setSchedules(data);
  };

  useEffect(() => {
    setCurrentDate(new Date());
    fetchSchedules();
    
    // 📱 모바일 화면(768px 미만)일 경우 기본 뷰를 주간(week)으로 자동 설정
    if (window.innerWidth < 768) {
      setViewMode("week");
    }
  }, []);

  const handleSubmitSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleDate || !title) return alert("날짜와 일정 제목을 입력해주세요.");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return alert("로그인 정보가 없습니다.");

    const payload = {
      schedule_date: scheduleDate,
      time: scheduleTime,
      title,
      content,
      theme,
      user_id: user.id
    };

    if (editingId) {
      const { error } = await supabase.from("schedules").update(payload).eq("id", editingId);
      if (error) alert("수정 실패: " + error.message);
      else { closeModal(); fetchSchedules(); }
    } else {
      const { error } = await supabase.from("schedules").insert([payload]);
      if (error) alert("일정 등록 실패: " + error.message);
      else { closeModal(); fetchSchedules(); }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("정말 이 일정을 삭제하시겠습니까?")) return;
    const { error } = await supabase.from("schedules").delete().eq("id", id);
    if (error) alert("삭제 실패: " + error.message);
    else { closeModal(); fetchSchedules(); }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setTitle("");
    setContent("");
    setTheme("blue");
    setScheduleTime("10:00");
  };

  const handleDateDoubleClick = (dateStr: string) => {
    setEditingId(null);
    setScheduleDate(dateStr);
    setScheduleTime("10:00");
    setTitle("");
    setContent("");
    setTheme("blue");
    setIsModalOpen(true);
  };

  const handleScheduleClick = (e: React.MouseEvent, s: any) => {
    e.stopPropagation();
    setSelectedScheduleId(s.id);
  };

  const handleScheduleDoubleClick = (e: React.MouseEvent, s: any) => {
    e.stopPropagation();
    setEditingId(s.id);
    setScheduleDate(s.schedule_date);
    setScheduleTime(s.time || "10:00");
    setTitle(s.title || "");
    setContent(s.content || "");
    setTheme(s.theme || "blue");
    setIsModalOpen(true);
  };

  if (!currentDate) return <div className="flex h-40 items-center justify-center bg-slate-50 text-slate-400">캘린더 로딩 중...</div>;

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const day = currentDate.getDate();

  const handlePrev = () => {
    if (viewMode === "month") setCurrentDate(new Date(year, month - 1, 1));
    else if (viewMode === "week") setCurrentDate(new Date(year, month, day - 7));
    else setCurrentDate(new Date(year, month, day - 1));
  };

  const handleNext = () => {
    if (viewMode === "month") setCurrentDate(new Date(year, month + 1, 1));
    else if (viewMode === "week") setCurrentDate(new Date(year, month, day + 7));
    else setCurrentDate(new Date(year, month, day + 1));
  };

  const handleToday = () => setCurrentDate(new Date());

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  return (
    <div className="w-full space-y-6 flex flex-col">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 truncate">
            {viewMode === "month" && `${year}년 ${month + 1}월`}
            {viewMode === "week" && `${year}년 ${month + 1}월 (주간)`}
            {viewMode === "day" && `${year}년 ${month + 1}월 ${day}일`}
          </h1>
          <div className="flex items-center bg-white border border-slate-200/80 rounded-xl p-1 shadow-xs">
            <button onClick={handlePrev} className="px-3 py-1 hover:bg-slate-100 rounded-lg text-xs font-bold text-slate-600 transition">&lt;</button>
            <button onClick={handleToday} className="px-3 py-1 hover:bg-slate-100 rounded-lg text-xs font-bold text-slate-800 transition">오늘</button>
            <button onClick={handleNext} className="px-3 py-1 hover:bg-slate-100 rounded-lg text-xs font-bold text-slate-600 transition">&gt;</button>
          </div>
        </div>

        <div className="flex items-center justify-between md:justify-end gap-3">
          <div className="flex bg-slate-200/80 p-1 rounded-xl text-xs font-bold text-slate-600">
            <button onClick={() => setViewMode("month")} className={`px-3 md:px-4 py-1.5 rounded-lg transition ${viewMode === "month" ? "bg-white text-slate-900 shadow-xs" : "hover:text-slate-900"}`}>월간</button>
            <button onClick={() => setViewMode("week")} className={`px-3 md:px-4 py-1.5 rounded-lg transition ${viewMode === "week" ? "bg-white text-slate-900 shadow-xs" : "hover:text-slate-900"}`}>주간</button>
            <button onClick={() => setViewMode("day")} className={`px-3 md:px-4 py-1.5 rounded-lg transition ${viewMode === "day" ? "bg-white text-slate-900 shadow-xs" : "hover:text-slate-900"}`}>일간</button>
          </div>

          <button
            onClick={() => {
              setEditingId(null);
              setScheduleDate(new Date().toISOString().split('T')[0]);
              setTitle("");
              setContent("");
              setTheme("blue");
              setIsModalOpen(true);
            }}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition text-xs md:text-sm shadow-sm flex items-center gap-1.5 whitespace-nowrap"
          >
            <span>+</span> 새로운 이벤트
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-xs border border-slate-200/80 flex flex-col overflow-hidden p-4 md:p-6">
        {viewMode === "month" && (
          <div className="flex flex-col">
            <div className="grid grid-cols-7 text-center text-[11px] md:text-xs font-bold text-slate-400 mb-3 pb-3 border-b border-slate-100">
              <span className="text-red-500">일</span>
              <span>월</span>
              <span>화</span>
              <span>수</span>
              <span>목</span>
              <span>금</span>
              <span className="text-blue-500">토</span>
            </div>
            <div className="grid grid-cols-7 text-center gap-1">
              {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                <div key={`empty-${i}`} className="min-h-[80px] md:min-h-[110px] bg-slate-50/20 rounded-xl" />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const d = i + 1;
                const formattedMonth = String(month + 1).padStart(2, '0');
                const formattedDay = String(d).padStart(2, '0');
                const dateStr = `${year}-${formattedMonth}-${formattedDay}`;
                
                const daySchedules = schedules.filter(s => s.schedule_date === dateStr);
                const isToday = d === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();

                return (
                  <div 
                    key={`day-${d}`}
                    onDoubleClick={() => handleDateDoubleClick(dateStr)}
                    className={`min-h-[80px] md:min-h-[110px] rounded-xl md:rounded-2xl p-1.5 md:p-2.5 border transition flex flex-col items-start cursor-pointer hover:border-blue-400 overflow-hidden select-none ${
                      isToday ? "bg-blue-50/40 border-blue-400 shadow-xs" : "bg-white border-slate-100 hover:bg-slate-50/50"
                    }`}
                  >
                    <span className={`text-[10px] md:text-xs font-bold mb-1 md:mb-2 w-5 h-5 md:w-6 md:h-6 flex items-center justify-center rounded-full ${isToday ? "bg-blue-600 text-white shadow-xs" : "text-slate-700"}`}>
                      {d}
                    </span>
                    <div className="w-full space-y-1 text-left overflow-y-auto max-h-[50px] md:max-h-[75px] scrollbar-none">
                      {daySchedules.map((s, idx) => {
                        const t = THEMES[s.theme || "blue"] || THEMES.blue;
                        const isSelected = selectedScheduleId === s.id;

                        return (
                          <div 
                            key={idx} 
                            onClick={(e) => handleScheduleClick(e, s)}
                            onDoubleClick={(e) => handleScheduleDoubleClick(e, s)}
                            className={`text-[10px] md:text-[11px] px-1.5 md:px-2.5 py-0.5 md:py-1 rounded-lg truncate flex items-center justify-between transition cursor-pointer font-semibold border ${t.bg} ${t.text} ${
                              isSelected ? "ring-2 ring-blue-600 shadow-sm font-bold scale-[1.02]" : "opacity-80 hover:opacity-100"
                            }`}
                            title="한 번 클릭: 선택 / 두 번 클릭: 수정"
                          >
                            <span className="truncate">
                              {s.title}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {viewMode === "week" && (
          <div className="flex flex-col">
            <div className="text-xs md:text-sm font-bold text-slate-700 mb-4">
              🗓️ 이번 주 타임라인 (일정을 터치 또는 클릭하여 선택하고, 더블클릭하면 수정할 수 있습니다)
            </div>
            <div className="space-y-3">
              {Array.from({ length: 7 }).map((_, i) => {
                const targetDate = new Date(year, month, day - currentDate.getDay() + i);
                const dateStr = targetDate.toISOString().split('T')[0];
                const daySchedules = schedules.filter(s => s.schedule_date === dateStr);

                return (
                  <div 
                    key={i} 
                    onDoubleClick={() => handleDateDoubleClick(dateStr)}
                    className="flex flex-col md:flex-row border border-slate-100 rounded-2xl p-4 bg-slate-50/40 items-start gap-3 md:gap-4 cursor-pointer hover:border-blue-300 transition"
                  >
                    <div className="w-full md:w-32 font-bold text-xs md:text-sm text-slate-800 border-b md:border-b-0 md:border-r border-slate-200/80 pb-2 md:pb-0 md:pr-4">
                      {targetDate.toLocaleDateString('ko-KR', { weekday: 'short', month: 'long', day: 'numeric' })}
                    </div>
                    <div className="flex-1 space-y-2 w-full">
                      {daySchedules.length === 0 ? (
                        <span className="text-xs text-slate-400">등록된 일정이 없습니다.</span>
                      ) : (
                        daySchedules.map((s, idx) => {
                          const t = THEMES[s.theme || "blue"] || THEMES.blue;
                          const isSelected = selectedScheduleId === s.id;

                          return (
                            <div 
                              key={idx} 
                              onClick={(e) => handleScheduleClick(e, s)}
                              onDoubleClick={(e) => handleScheduleDoubleClick(e, s)}
                              className={`flex flex-col md:flex-row justify-between items-start md:items-center p-3 rounded-2xl border transition cursor-pointer gap-2 ${t.bg} ${t.text} ${
                                isSelected ? "ring-2 ring-blue-600 shadow-sm scale-[1.01]" : "opacity-90"
                              }`}
                            >
                              <div>
                                <span className="text-[11px] font-bold bg-white/60 px-2.5 py-1 rounded-xl mr-3">{s.time || "종일"}</span>
                                <span className="font-bold text-sm">{s.title}</span>
                                {s.content && <p className="text-xs opacity-75 mt-0.5">{s.content}</p>}
                              </div>
                              <span className="text-[11px] font-semibold opacity-70">더블클릭하여 수정</span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {viewMode === "day" && (
          <div className="flex flex-col">
            <div className="text-xs md:text-sm font-bold text-slate-700 mb-4">
              📅 {year}년 {month + 1}월 {day}일 상세 일정 타임라인
            </div>
            <div className="space-y-3">
              {(() => {
                const formattedMonth = String(month + 1).padStart(2, '0');
                const formattedDay = String(day).padStart(2, '0');
                const dateStr = `${year}-${formattedMonth}-${formattedDay}`;
                const daySchedules = schedules.filter(s => s.schedule_date === dateStr);

                if (daySchedules.length === 0) {
                  return <p className="text-center text-slate-400 py-12 text-sm">오늘 등록된 일정이 없습니다. 빈 곳을 더블클릭해 일정을 추가해보세요!</p>;
                }

                return daySchedules.map((s, idx) => {
                  const t = THEMES[s.theme || "blue"] || THEMES.blue;
                  const isSelected = selectedScheduleId === s.id;

                  return (
                    <div 
                      key={idx} 
                      onClick={(e) => handleScheduleClick(e, s)}
                      onDoubleClick={(e) => handleScheduleDoubleClick(e, s)}
                      className={`p-4 rounded-2xl border flex flex-col md:flex-row items-start md:items-center justify-between transition cursor-pointer gap-2 ${t.bg} ${t.text} ${
                        isSelected ? "ring-2 ring-blue-600 shadow-sm scale-[1.01]" : "opacity-90"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold bg-white/70 px-3 py-1 rounded-xl shadow-xs">{s.time || "종일"}</span>
                        <div>
                          <h4 className="font-bold text-sm md:text-base">{s.title}</h4>
                          {s.content && <p className="text-xs opacity-75 mt-1">{s.content}</p>}
                        </div>
                      </div>
                      <span className="text-[11px] font-semibold px-3 py-1 bg-white/60 rounded-xl self-end md:self-auto">더블클릭하여 수정</span>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-md p-6 rounded-3xl shadow-2xl border border-slate-100">
            <div className="flex justify-between items-center mb-5 border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900">
                {editingId ? "✏️ 이벤트 편집" : "📅 새로운 이벤트"}
              </h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-700 font-bold w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center transition">✕</button>
            </div>

            <form onSubmit={handleSubmitSchedule} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">날짜</label>
                  <input
                    type="date"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">시간</label>
                  <input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">제목</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="예: 홍길동 환자 상담 예약"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">이벤트 테마</label>
                <div className="flex gap-3">
                  {Object.entries(THEMES).map(([key, value]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setTheme(key)}
                      className={`w-9 h-9 rounded-full transition flex items-center justify-center font-bold text-xs border-2 ${value.bg} ${value.text} ${
                        theme === key ? "ring-2 ring-offset-2 ring-blue-600 scale-110" : "opacity-70 hover:opacity-100"
                      }`}
                      title={value.label}
                    >
                      {theme === key ? "✓" : ""}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">메모</label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  rows={2}
                  placeholder="특이사항 메모..."
                />
              </div>

              <div className="flex gap-2 pt-3 items-center">
                {editingId && (
                  <button
                    type="button"
                    onClick={() => handleDelete(editingId)}
                    className="py-3 px-4 bg-red-50 text-red-600 font-bold rounded-xl hover:bg-red-100 transition text-sm"
                  >
                    삭제
                  </button>
                )}
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition text-sm"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition text-sm shadow-sm"
                >
                  {editingId ? "수정 내용 저장하기" : "이벤트 추가"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}