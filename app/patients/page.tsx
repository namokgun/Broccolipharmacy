"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/app/lib/supabase";

const CONSTITUTION_OPTIONS = ["선택 안함", "태양인", "태음인", "소양인", "소음인", "강아지", "고양이"];

const getTagColor = (tag: string) => {
  const colors = [
    "bg-red-100 text-red-800 border-red-200", 
    "bg-orange-100 text-orange-800 border-orange-200", 
    "bg-amber-100 text-amber-800 border-amber-200", 
    "bg-green-100 text-green-800 border-green-200", 
    "bg-emerald-100 text-emerald-800 border-emerald-200", 
    "bg-blue-100 text-blue-800 border-blue-200", 
    "bg-indigo-100 text-indigo-800 border-indigo-200", 
    "bg-purple-100 text-purple-800 border-purple-200", 
    "bg-pink-100 text-pink-800 border-pink-200",
    "bg-rose-100 text-rose-800 border-rose-200"
  ];
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

export default function PatientsPage() {
  const [patients, setPatients] = useState<any[]>([]);
  const [consultations, setConsultations] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);
  const [sortConfig, setSortConfig] = useState({ key: "name", direction: "asc" });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPatientId, setEditingPatientId] = useState<string | null>(null);

  const [historyModalPatient, setHistoryModalPatient] = useState<any | null>(null);
  const [photosModalPatient, setPhotosModalPatient] = useState<any | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  // 폼 필드
  const [name, setName] = useState("");
  const [customId, setCustomId] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [gender, setGender] = useState("남");
  const [birthYear, setBirthYear] = useState("");
  const [bodyType, setBodyType] = useState("선택 안함");
  const [tagsInput, setTagsInput] = useState("");
  const [memo, setMemo] = useState("");

  // 🟢 빌드 에러 방지를 위해 날짜 계산을 상태값으로 처리
  const [activeCount, setActiveCount] = useState(0);

  useEffect(() => {
    fetchData();
  }, []);

  // 🟢 상담 데이터가 바뀔 때 안전하게 활성 고객 수 계산
  useEffect(() => {
    if (consultations.length > 0) {
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      const activePatientIds = new Set(
        consultations
          .filter(c => new Date(c.consultation_date || c.created_at) >= threeMonthsAgo)
          .map(c => c.patient_id)
      );
      setActiveCount(activePatientIds.size);
    } else {
      setActiveCount(0);
    }
  }, [consultations]);

  const fetchData = async () => {
    const { data: pData } = await supabase.from("patients").select("*").order("name");
    if (pData) {
      setPatients(pData);
      if (pData.length > 0 && !selectedPatient) {
        setSelectedPatient(pData[0]);
      }
    }

    const { data: cData } = await supabase.from("consultations").select("*").order("created_at", { ascending: false });
    if (cData) {
      const withSignedUrls = await Promise.all(
        cData.map(async (c) => {
          if (c.image_urls && c.image_urls.length > 0) {
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

  const getPatientStats = (patientId: string) => {
    const pConsults = consultations
      .filter(c => c.patient_id === patientId)
      .sort((a, b) => {
        const dateA = new Date(a.consultation_date || a.created_at).getTime();
        const dateB = new Date(b.consultation_date || b.created_at).getTime();
        return dateB - dateA; 
      });

    const count = pConsults.length;
    const totalAmount = pConsults.reduce((sum, c) => sum + (c.amount || 0), 0);
    
    const lastDate = count > 0 ? (pConsults[0].consultation_date || pConsults[0].created_at.split('T')[0]) : "-";
    const lastPrescription = count > 0 ? (pConsults[0].prescription || "-") : "-";
    
    return { count, totalAmount, lastDate, lastPrescription, pConsults };
  };

  const totalPatientsCount = patients.length;

  const patientConsultCounts: Record<string, number> = {};
  consultations.forEach(c => {
    if (c.patient_id) {
      patientConsultCounts[c.patient_id] = (patientConsultCounts[c.patient_id] || 0) + 1;
    }
  });
  const returningCount = Object.values(patientConsultCounts).filter(cnt => cnt >= 2).length;

  const handleOpenRegister = () => {
    setEditingPatientId(null);
    setName(""); setCustomId(""); setPhone(""); setAddress(""); setGender("남"); setBirthYear(""); setBodyType("선택 안함");
    setTagsInput(""); setMemo("");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (p: any) => {
    setEditingPatientId(p.id);
    setName(p.name || "");
    setCustomId(p.custom_id || "");
    setPhone(p.phone || "");
    setAddress(p.address || "");
    setGender(p.gender || "남");
    setBirthYear(p.birth_year ? p.birth_year.toString() : "");
    setBodyType(p.body_type || "선택 안함");
    setTagsInput(p.tags && Array.isArray(p.tags) ? p.tags.join(", ") : "");
    setMemo(p.memo || "");
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return alert("환자 이름을 입력해주세요.");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return alert("로그인 정보가 없습니다.");

    const tagsArray = tagsInput
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    const payload = {
      name, custom_id: customId, phone, address, gender,
      birth_year: birthYear ? parseInt(birthYear) : null,
      body_type: bodyType === "선택 안함" ? null : bodyType,
      tags: tagsArray, 
      memo,
      user_id: user.id
    };

    if (editingPatientId) {
      const { error } = await supabase.from("patients").update(payload).eq("id", editingPatientId);
      if (error) alert("수정 실패: " + error.message);
      else { alert("환자 정보가 수정되었습니다."); setIsModalOpen(false); fetchData(); }
    } else {
      const { error } = await supabase.from("patients").insert([payload]);
      if (error) alert("등록 실패: " + error.message);
      else { alert("새 환자가 등록되었습니다."); setIsModalOpen(false); fetchData(); }
    }
  };

  const handleDeletePatient = async (id: string) => {
    if (!confirm("정말 이 환자를 삭제하시겠습니까?")) return;
    const { error } = await supabase.from("patients").delete().eq("id", id);
    if (error) alert("삭제 실패: " + error.message);
    else { alert("삭제되었습니다."); setSelectedPatient(null); fetchData(); }
  };

  const enrichedPatients = patients.map(p => {
    const stats = getPatientStats(p.id);
    const created_at_date = p.created_at ? p.created_at.split('T')[0] : "-";
    return { ...p, ...stats, created_at_date };
  });

  const filteredPatients = enrichedPatients.filter(p => {
    const term = searchTerm.toLowerCase();
    const matchNameOrId = p.name?.toLowerCase().includes(term) || p.custom_id?.toLowerCase().includes(term) || p.phone?.includes(term);
    const matchTag = p.tags?.some((t: string) => t.toLowerCase().includes(term));
    const matchAddress = p.address?.toLowerCase().includes(term);
    return matchNameOrId || matchTag || matchAddress;
  });

  const sortedPatients = [...filteredPatients].sort((a, b) => {
    let valA = a[sortConfig.key];
    let valB = b[sortConfig.key];
    if (valA === undefined || valA === null) valA = "";
    if (valB === undefined || valB === null) valB = "";
    if (typeof valA === "string" && typeof valB === "string") {
      return sortConfig.direction === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }
    return sortConfig.direction === "asc" ? valA - valB : valB - valA;
  });

  const selectedPatientStats = selectedPatient ? getPatientStats(selectedPatient.id) : { count: 0, totalAmount: 0, lastDate: "-", lastPrescription: "-", pConsults: [] };
  const selectedPatientAllPhotos = selectedPatient 
    ? consultations.filter(c => c.patient_id === selectedPatient.id).flatMap(c => (c.display_image_urls || []).map((url: string) => ({ url, date: c.consultation_date || c.created_at.split('T')[0], symptoms: c.symptoms })))
    : [];

  return (
    <div className="w-full h-[calc(100vh-80px)] flex flex-col space-y-4 overflow-hidden max-w-[1700px] mx-auto pb-4">
      
      {/* 상단 헤더 영역 */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white px-6 py-4 rounded-2xl shadow-sm border border-slate-200 gap-3 flex-shrink-0">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">고객 관리</h1>
          <p className="text-xs font-semibold text-slate-500 mt-0.5">고객 정보를 한눈에 확인하고, 상담 이력을 관리할 수 있습니다.</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <input 
            type="text" 
            placeholder="이름, 번호, 주소, 태그 검색..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            className="flex-1 md:w-72 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-teal-700 transition"
          />
          <button onClick={handleOpenRegister} className="px-4 py-2 bg-teal-900 hover:bg-teal-800 text-white rounded-xl font-semibold text-xs transition shadow-sm whitespace-nowrap">
            + 신규 고객 등록
          </button>
        </div>
      </div>

      {/* 상단 통계 요약 카드 3개 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-shrink-0">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 block mb-1">전체 고객 수</span>
            <div className="text-2xl font-extrabold text-slate-900">{totalPatientsCount} <span className="text-xs font-bold text-slate-500">명</span></div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-800 flex items-center justify-center font-bold text-lg">👥</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 block mb-1">활성 고객 수 (최근 3개월)</span>
            <div className="text-2xl font-extrabold text-slate-900">{activeCount} <span className="text-xs font-bold text-slate-500">명</span></div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center font-bold text-lg">🟢</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 block mb-1">재방문 고객 수 (2회 이상)</span>
            <div className="text-2xl font-extrabold text-slate-900">{returningCount} <span className="text-xs font-bold text-slate-500">명</span></div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-800 flex items-center justify-center font-bold text-lg">⭐</div>
        </div>
      </div>

      {/* 좌우 분할 레이아웃 (좌측 리스트, 우측 상세) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0">
        
        {/* 좌측: 고객 목록 창 (col-span-7) */}
        <div className="lg:col-span-7 bg-white rounded-3xl shadow-sm border border-slate-200 flex flex-col overflow-hidden p-4">
          <div className="text-[11px] font-bold text-slate-400 mb-2 px-1 flex-shrink-0">
            고객 목록 <span className="text-slate-900 font-extrabold">총 {sortedPatients.length}명</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
            {sortedPatients.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-xs">등록된 고객이 없습니다.</div>
            ) : (
              sortedPatients.map((p) => {
                const isSelected = selectedPatient?.id === p.id;
                const ageText = p.birth_year ? `${new Date().getFullYear() - p.birth_year + 1}세` : "-";

                return (
                  <div 
                    key={p.id} 
                    onClick={() => setSelectedPatient(p)}
                    className={`p-3 rounded-2xl border transition cursor-pointer flex items-center justify-between gap-3 text-xs ${
                      isSelected 
                        ? "bg-teal-50/70 border-teal-600 shadow-2xs" 
                        : "bg-white border-slate-100 hover:bg-slate-50/80"
                    }`}
                  >
                    {/* 이름 및 연락처 (1줄 배치) */}
                    <div className="flex items-center gap-3 flex-shrink-0 w-40 whitespace-nowrap">
                      <span className="font-extrabold text-slate-900 truncate" title={p.name}>{p.name}</span>
                      <span className="text-slate-500 text-[11px]">{p.phone || "연락처 없음"}</span>
                    </div>

                    {/* 연령, 성별, 체질, 최근방문, 상담횟수, 태그 */}
                    <div className="flex-1 flex items-center gap-2 truncate text-[11px]">
                      <span className="text-slate-600 font-semibold">{ageText} / {p.gender || "-"}</span>
                      {p.body_type && p.body_type !== "선택 안함" && (
                        <span className="bg-teal-50 text-teal-800 px-2 py-0.5 rounded-md font-bold whitespace-nowrap">
                          {p.body_type}
                        </span>
                      )}
                      <span className="text-slate-500 whitespace-nowrap">{p.lastDate}</span>
                      <span className="text-slate-700 font-bold whitespace-nowrap">{p.count}회</span>
                      
                      {/* 메모 자리에는 태그 표시 */}
                      <div className="flex flex-wrap gap-1 truncate">
                        {p.tags && p.tags.map((tag: string, idx: number) => (
                          <span key={idx} className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border whitespace-nowrap ${getTagColor(tag)}`}>{tag}</span>
                        ))}
                      </div>
                    </div>

                    <div className="text-slate-300 font-bold flex-shrink-0">›</div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 우측: 선택된 고객 상세 정보 창 (col-span-5) */}
        <div className="lg:col-span-5 bg-white rounded-3xl shadow-sm border border-slate-200 flex flex-col overflow-hidden p-5">
          {selectedPatient ? (
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              
              {/* 고객 요약 카드 */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <span>👤</span> {selectedPatient.name} {selectedPatient.custom_id ? `(${selectedPatient.custom_id})` : ""}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    연락처: <span className="font-semibold text-slate-700">{selectedPatient.phone || "정보 없음"}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleOpenEdit(selectedPatient)} className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold text-xs transition">
                    수정
                  </button>
                  <button onClick={() => handleDeletePatient(selectedPatient.id)} className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-bold text-xs transition">
                    삭제
                  </button>
                </div>
              </div>

              {/* 기본 정보 배지들 */}
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 block mb-1">체질</span>
                  <span className="font-extrabold text-teal-900">{selectedPatient.body_type && selectedPatient.body_type !== "선택 안함" ? selectedPatient.body_type : "-"}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 block mb-1">최근 상담일</span>
                  <span className="font-bold text-slate-800">{selectedPatientStats.lastDate}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 block mb-1">상담 횟수</span>
                  <span className="font-bold text-slate-800">{selectedPatientStats.count}회</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 block mb-1">누적 결제</span>
                  <span className="font-bold text-purple-800">{selectedPatientStats.totalAmount.toLocaleString()}원</span>
                </div>
              </div>

              {/* 상세 인적 사항 및 메모 */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div><span className="text-slate-400 mr-2">출생연도:</span><span className="font-semibold text-slate-800">{selectedPatient.birth_year ? `${selectedPatient.birth_year}년` : "-"}</span></div>
                  <div><span className="text-slate-400 mr-2">성별:</span><span className="font-semibold text-slate-800">{selectedPatient.gender || "-"}</span></div>
                </div>
                <div><span className="text-slate-400 mr-2">주소:</span><span className="font-semibold text-slate-800">{selectedPatient.address || "-"}</span></div>
                
                {selectedPatient.tags && selectedPatient.tags.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    <span className="text-slate-400 mr-1">태그:</span>
                    {selectedPatient.tags.map((tag: string, idx: number) => (
                      <span key={idx} className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${getTagColor(tag)}`}>{tag}</span>
                    ))}
                  </div>
                )}

                {selectedPatient.memo && (
                  <div className="pt-1 border-t border-slate-200 mt-2">
                    <span className="text-teal-800 font-bold block mb-1">텍스트 메모:</span>
                    <p className="text-slate-700 whitespace-pre-line bg-white p-2.5 rounded-xl border border-slate-200">{selectedPatient.memo}</p>
                  </div>
                )}
              </div>

              {/* 최근 상담 내역 리스트 */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-extrabold text-slate-900">최근 상담 내역 ({selectedPatientStats.pConsults.length}건)</h3>
                  <button onClick={() => setHistoryModalPatient(selectedPatient)} className="text-[11px] font-bold text-teal-800 hover:underline">전체보기 →</button>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {selectedPatientStats.pConsults.length === 0 ? (
                    <div className="p-4 bg-slate-50 rounded-xl text-center text-xs text-slate-400">상담 내역이 없습니다.</div>
                  ) : (
                    selectedPatientStats.pConsults.slice(0, 3).map(c => (
                      <div key={c.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-xs space-y-1">
                        <div className="flex justify-between items-center text-[11px] font-bold text-slate-500">
                          <span>{c.consultation_date || c.created_at?.split('T')[0]}</span>
                          {c.amount && <span className="text-purple-800 font-extrabold">{c.amount.toLocaleString()}원</span>}
                        </div>
                        {c.symptoms && <p className="font-bold text-slate-900 truncate">주호소: {c.symptoms}</p>}
                        {c.prescription && <p className="text-teal-900 font-semibold truncate">처방: {c.prescription}</p>}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* 첨부 사진 바로보기 */}
              {selectedPatientAllPhotos.length > 0 && (
                <div className="space-y-2 pt-2">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-extrabold text-slate-900">첨부 사진 모아보기 ({selectedPatientAllPhotos.length}장)</h3>
                    <button onClick={() => setPhotosModalPatient(selectedPatient)} className="text-[11px] font-bold text-blue-700 hover:underline">전체보기 →</button>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {selectedPatientAllPhotos.slice(0, 4).map((photo: any, idx: number) => (
                      <div key={idx} className="relative w-16 h-16 border rounded-xl overflow-hidden bg-white cursor-pointer flex-shrink-0" onClick={() => setPreviewImageUrl(photo.url)}>
                        <img src={photo.url} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400 text-xs">
              좌측 목록에서 고객을 선택해주세요.
            </div>
          )}
        </div>

      </div>

      {/* 🟢 신규/수정 고객 등록 팝업 모달 */}
      {isModalOpen && (
        <div onClick={() => setIsModalOpen(false)} className="fixed inset-0 z-[120] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl border border-slate-200 flex flex-col space-y-4 cursor-default" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-base font-bold text-slate-900">{editingPatientId ? "👥 고객 정보 수정" : "➕ 신규 고객 등록"}</h3>
              <button onClick={() => setIsModalOpen(false)} className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-200">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">이름 *</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold" required />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">아이디 / 차트번호</label>
                  <input type="text" value={customId} onChange={(e) => setCustomId(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold" placeholder="예: 2026-001" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">성별</label>
                  <select value={gender} onChange={(e) => setGender(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold">
                    <option value="남">남</option>
                    <option value="여">여</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">출생 연도</label>
                  <input type="number" value={birthYear} onChange={(e) => setBirthYear(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold" placeholder="1981" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">체질</label>
                  <select value={bodyType} onChange={(e) => setBodyType(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold">
                    {CONSTITUTION_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">연락처</label>
                  <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold" placeholder="010-1234-5678" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">주소</label>
                  <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold" placeholder="거주지" />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">분류 태그 (쉼표로 구분)</label>
                <input type="text" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold" placeholder="예: VIP, 피로, 수면" />
              </div>

              <div>
                <label className="block font-bold text-teal-800 mb-1">텍스트 메모</label>
                <textarea value={memo} onChange={(e) => setMemo(e.target.value)} rows={2} className="w-full p-2.5 bg-teal-50/50 border border-teal-100 rounded-xl text-xs font-semibold resize-none" placeholder="환자 특이사항 등 메모..." />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition">취소</button>
                <button type="submit" className="px-5 py-2 bg-teal-900 text-white font-bold rounded-xl hover:bg-teal-800 transition shadow-sm">저장하기</button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* 전체 상담 기록 팝업 */}
      {historyModalPatient && (
        <div onClick={() => setHistoryModalPatient(null)} className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer">
          <div className="bg-white w-full max-w-3xl max-h-[85vh] rounded-3xl p-6 shadow-2xl border border-slate-200 flex flex-col space-y-4 cursor-default" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">📂 {historyModalPatient.name} 님의 전체 상담 기록</h3>
                <p className="text-xs text-slate-500">연락처: {historyModalPatient.phone || "없음"}</p>
              </div>
              <button onClick={() => setHistoryModalPatient(null)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-200">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {consultations.filter(c => c.patient_id === historyModalPatient.id).length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">작성된 상담 기록이 없습니다.</div>
              ) : (
                consultations.filter(c => c.patient_id === historyModalPatient.id).map((c, idx) => (
                  <div key={c.id || idx} className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-3 text-xs">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                      <span className="font-bold text-slate-900 text-sm">{c.consultation_date || c.created_at.split('T')[0]}</span>
                      {c.amount && <span className="font-extrabold text-purple-800 text-sm">{c.amount.toLocaleString()}원</span>}
                    </div>
                    <div className="flex flex-col sm:flex-row gap-4 items-start">
                      <div className="flex-1 space-y-2 min-w-0 w-full">
                        <div className="flex flex-wrap gap-x-4 text-sm font-bold text-slate-800 mb-2">
                          {c.symptoms && <div>주호소: {c.symptoms}</div>}
                          {c.prescription && <div className="text-teal-700">처방: {c.prescription}</div>}
                        </div>
                        {c.symptom_detail && (
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-slate-700 whitespace-pre-line leading-relaxed"><strong className="text-slate-900 block mb-1">증상 상세:</strong>{c.symptom_detail}</div>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {c.consult_memo && (
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-slate-700 whitespace-pre-line leading-relaxed"><strong className="text-slate-900 block mb-1">코멘트:</strong>{c.consult_memo}</div>
                          )}
                          {c.follow_up && (
                            <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-200/60 text-purple-900 whitespace-pre-line leading-relaxed"><strong className="text-purple-800 block mb-1">추후관리:</strong>{c.follow_up}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="flex justify-end pt-2 border-t"><button onClick={() => setHistoryModalPatient(null)} className="px-5 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800">닫기</button></div>
          </div>
        </div>
      )}

      {/* 사진 모아보기 팝업 */}
      {photosModalPatient && (
        <div onClick={() => setPhotosModalPatient(null)} className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer">
          <div className="bg-white w-full max-w-2xl max-h-[85vh] rounded-3xl p-6 shadow-2xl border border-slate-200 flex flex-col space-y-4 cursor-default" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold text-slate-900">📸 {photosModalPatient.name} 님의 사진 모아보기</h3>
              <button onClick={() => setPhotosModalPatient(null)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-200">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-3 gap-3 content-start pr-1">
              {selectedPatientAllPhotos.length === 0 ? (
                <div className="col-span-full text-center py-12 text-slate-400 text-sm">등록된 사진이 없습니다.</div>
              ) : (
                selectedPatientAllPhotos.map((photo: any, idx: number) => (
                  <div key={idx} className="relative aspect-square border border-slate-200 rounded-2xl overflow-hidden bg-white group cursor-pointer shadow-xs" onClick={() => setPreviewImageUrl(photo.url)}>
                    <img src={photo.url} className="w-full h-full object-cover group-hover:scale-105 transition" />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[10px] font-semibold px-2 py-1 truncate">{photo.date}</div>
                  </div>
                ))
              )}
            </div>
            <div className="flex justify-end pt-2 border-t"><button onClick={() => setPhotosModalPatient(null)} className="px-5 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800">닫기</button></div>
          </div>
        </div>
      )}

      {/* 이미지 라이트박스 */}
      {previewImageUrl && (
        <div onClick={() => setPreviewImageUrl(null)} className="fixed inset-0 z-[150] bg-slate-950/80 flex items-center justify-center p-4 cursor-pointer">
          <img src={previewImageUrl} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
          <button onClick={() => setPreviewImageUrl(null)} className="absolute top-4 right-4 text-white bg-slate-800 w-10 h-10 rounded-full font-bold">✕</button>
        </div>
      )}

    </div>
  );
}