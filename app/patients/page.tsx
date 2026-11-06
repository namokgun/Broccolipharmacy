"use client";

import { useState, useEffect, useMemo } from "react";
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
  const [sales, setSales] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPatientId, setEditingPatientId] = useState<string | null>(null);

  const [historyModalPatient, setHistoryModalPatient] = useState<any | null>(null);
  const [photosModalPatient, setPhotosModalPatient] = useState<any | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  // 폼 필드
  const [name, setName] = useState("");
  const [customId, setCustomId] = useState("");
  const [address, setAddress] = useState("");
  const [gender, setGender] = useState("남");
  const [birthYear, setBirthYear] = useState("");
  const [bodyType, setBodyType] = useState("선택 안함");
  const [tagsInput, setTagsInput] = useState("");
  const [memo, setMemo] = useState("");
  
  // 대표 고객 검색 선택 관련 상태
  const [representativeId, setRepresentativeId] = useState<string>("");
  const [repSearch, setRepSearch] = useState("");

  const [activeCount, setActiveCount] = useState(0);

  useEffect(() => {
    fetchData();
  }, []);

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

    const { data: sData } = await supabase.from("sales").select("*").order("sale_date", { ascending: false });
    if (sData) setSales(sData);

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

  const getPatientStats = (patient: any) => {
    const familyPatientIds = patients
      .filter(p => p.id === patient.id || p.representative_id === patient.id || (patient.representative_id && p.representative_id === patient.representative_id))
      .map(p => p.id);
    familyPatientIds.push(patient.id);
    const uniquePatientIds = Array.from(new Set(familyPatientIds));

    const pConsults = consultations
      .filter(c => uniquePatientIds.includes(c.patient_id))
      .sort((a, b) => {
        const dateA = new Date(a.consultation_date || a.created_at).getTime();
        const dateB = new Date(b.consultation_date || b.created_at).getTime();
        return dateB - dateA; 
      });

    const pSales = sales.filter(s => uniquePatientIds.includes(s.patient_id) || s.patient_name === patient.name);

    const count = pConsults.length;
    const totalAmount = pSales.reduce((sum, s) => sum + (s.total_amount || 0), 0) + pConsults.reduce((sum, c) => sum + (c.amount || 0), 0);
    
    const lastDate = count > 0 ? (pConsults[0].consultation_date || pConsults[0].created_at.split('T')[0]) : "-";
    
    return { count, totalAmount, lastDate, pConsults, pSales };
  };

  const totalPatientsCount = patients.length;

  const patientConsultCounts: Record<string, number> = {};
  consultations.forEach(c => {
    if (c.patient_id) {
      patientConsultCounts[c.patient_id] = (patientConsultCounts[c.patient_id] || 0) + 1;
    }
  });
  const returningCount = Object.values(patientConsultCounts).filter(cnt => cnt >= 2).length;

  // 우측 통계: 전체 누적 TOP 산출
  const customerSalesRankingAll = useMemo(() => {
    const stats: Record<string, { name: string, totalAmt: number, count: number }> = {};
    sales.forEach(s => {
      const name = s.patient_name || "미지정 고객";
      if (!stats[name]) stats[name] = { name, totalAmt: 0, count: 0 };
      stats[name].totalAmt += (s.total_amount || 0);
      stats[name].count += 1;
    });
    return Object.values(stats).sort((a, b) => b.totalAmt - a.totalAmt);
  }, [sales]);

  const totalSalesSumAll = customerSalesRankingAll.reduce((sum, c) => sum + c.totalAmt, 0);

  // 우측 통계: 최근 3개월 누적 TOP 산출 (Client-side 안전 처리)
  const customerSalesRanking3Months = useMemo(() => {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const stats: Record<string, { name: string, totalAmt: number, count: number }> = {};
    sales.forEach(s => {
      if (s.sale_date) {
        const saleDateObj = new Date(s.sale_date);
        if (!isNaN(saleDateObj.getTime()) && saleDateObj >= threeMonthsAgo) {
          const name = s.patient_name || "미지정 고객";
          if (!stats[name]) stats[name] = { name, totalAmt: 0, count: 0 };
          stats[name].totalAmt += (s.total_amount || 0);
          stats[name].count += 1;
        }
      }
    });
    return Object.values(stats).sort((a, b) => b.totalAmt - a.totalAmt);
  }, [sales]);

  const totalSalesSum3Months = customerSalesRanking3Months.reduce((sum, c) => sum + c.totalAmt, 0);

  const handleOpenRegister = () => {
    setEditingPatientId(null);
    setName(""); setCustomId(""); setAddress(""); setGender("남"); setBirthYear(""); setBodyType("선택 안함");
    setTagsInput(""); setMemo(""); setRepresentativeId(""); setRepSearch("");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (p: any) => {
    setEditingPatientId(p.id);
    setName(p.name || "");
    setCustomId(p.custom_id || "");
    setAddress(p.address || "");
    setGender(p.gender || "남");
    setBirthYear(p.birth_year ? p.birth_year.toString() : "");
    setBodyType(p.body_type || "선택 안함");
    setTagsInput(p.tags && Array.isArray(p.tags) ? p.tags.join(", ") : "");
    setMemo(p.memo || "");
    setRepresentativeId(p.representative_id || "");
    
    if (p.representative_id) {
      const rep = patients.find(pt => pt.id === p.representative_id);
      setRepSearch(rep ? rep.name : "");
    } else {
      setRepSearch("");
    }

    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return alert("고객 이름을 입력해주세요.");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return alert("로그인 정보가 없습니다.");

    const tagsArray = tagsInput
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    const payload = {
      name, custom_id: customId, address, gender,
      birth_year: birthYear ? parseInt(birthYear) : null,
      body_type: bodyType === "선택 안함" ? null : bodyType,
      tags: tagsArray, 
      memo,
      representative_id: representativeId || null,
      user_id: user.id
    };

    if (editingPatientId) {
      const { error } = await supabase.from("patients").update(payload).eq("id", editingPatientId);
      if (error) alert("수정 실패: " + error.message);
      else { alert("고객 정보가 수정되었습니다."); setIsModalOpen(false); fetchData(); }
    } else {
      const { error } = await supabase.from("patients").insert([payload]);
      if (error) alert("등록 실패: " + error.message);
      else { alert("신규 고객이 등록되었습니다."); setIsModalOpen(false); fetchData(); }
    }
  };

  const handleDeletePatient = async (id: string) => {
    if (!confirm("정말 이 고객을 삭제하시겠습니까?")) return;
    const { error } = await supabase.from("patients").delete().eq("id", id);
    if (error) alert("삭제 실패: " + error.message);
    else { alert("삭제되었습니다."); setSelectedPatient(null); fetchData(); }
  };

  const enrichedPatients = patients.map(p => {
    const stats = getPatientStats(p);
    const created_at_date = p.created_at ? p.created_at.split('T')[0] : "-";
    return { ...p, ...stats, created_at_date };
  });

  const filteredPatients = enrichedPatients.filter(p => {
    const term = searchTerm.toLowerCase();
    const matchNameOrId = p.name?.toLowerCase().includes(term) || p.custom_id?.toLowerCase().includes(term);
    const matchTag = p.tags?.some((t: string) => t.toLowerCase().includes(term));
    const matchAddress = p.address?.toLowerCase().includes(term);
    return matchNameOrId || matchTag || matchAddress;
  });

  const sortedPatients = [...filteredPatients].sort((a, b) => a.name.localeCompare(b.name));

  const selectedPatientStats = selectedPatient ? getPatientStats(selectedPatient) : { count: 0, totalAmount: 0, lastDate: "-", pConsults: [], pSales: [] };
  
  const selectedPatientAllPhotos = selectedPatient 
    ? consultations
        .filter(c => c.patient_id === selectedPatient.id)
        .sort((a, b) => new Date(b.consultation_date || b.created_at).getTime() - new Date(a.consultation_date || a.created_at).getTime())
        .flatMap(c => (c.display_image_urls || []).map((url: string) => ({ 
          url, 
          date: c.consultation_date || c.created_at.split('T')[0], 
          prescription: c.prescription 
        })))
    : [];

  return (
    <div className="w-full h-[calc(100vh-32px)] flex flex-col space-y-2 overflow-hidden max-w-[1700px] mx-auto pb-1 text-xs">
      
      {/* 상단 헤더 */}
      <div className="bg-white px-4 py-2.5 rounded-2xl shadow-sm border border-slate-200 flex justify-between items-center flex-shrink-0">
        <h1 className="text-base font-extrabold text-slate-900">고객 관리</h1>
        <button onClick={handleOpenRegister} className="px-3.5 py-1.5 bg-[#528771] hover:bg-[#3d6856] text-white rounded-xl font-black text-xs transition shadow-sm whitespace-nowrap">
          + 신규 고객 등록
        </button>
      </div>

      {/* 3분할 인터페이스 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 flex-1 min-h-0">
        
        {/* 1열: 고객 목록 */}
        <div className="lg:col-span-5 bg-white rounded-3xl shadow-sm border border-slate-200 flex flex-col overflow-hidden p-3.5 space-y-2.5">
          
          <div className="grid grid-cols-3 gap-2 flex-shrink-0">
            <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col justify-between">
              <span className="text-[10px] font-bold text-slate-400">전체 고객</span>
              <div className="text-base font-extrabold text-slate-900 mt-0.5">{totalPatientsCount}<span className="text-[10px] font-semibold text-slate-500 ml-0.5">명</span></div>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col justify-between">
              <span className="text-[10px] font-bold text-slate-400">활성 고객</span>
              <div className="text-base font-extrabold text-slate-900 mt-0.5">{activeCount}<span className="text-[10px] font-semibold text-slate-500 ml-0.5">명</span></div>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col justify-between">
              <span className="text-[10px] font-bold text-slate-400">재방문 고객</span>
              <div className="text-base font-extrabold text-slate-900 mt-0.5">{returningCount}<span className="text-[10px] font-semibold text-slate-500 ml-0.5">명</span></div>
            </div>
          </div>

          <div className="flex-shrink-0">
            <input 
              type="text" 
              placeholder="이름, ID, 주소, 태그 검색..." 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#528771] transition"
            />
          </div>

          <div className="text-[11px] font-bold text-slate-400 px-0.5 flex-shrink-0">
            고객 목록 <span className="text-slate-900 font-extrabold">총 {sortedPatients.length}명</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1 pr-1 hide-scrollbar">
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
                    className={`p-2.5 rounded-xl border transition cursor-pointer flex items-center justify-between gap-2 text-xs ${
                      isSelected ? "bg-teal-50/70 border-teal-600 shadow-2xs" : "bg-white border-slate-100 hover:bg-slate-50/80"
                    }`}
                  >
                    <div className="grid grid-cols-12 items-center w-full gap-1.5 text-center text-[11px]">
                      <div className="col-span-4 text-left truncate pr-1">
                        <span className="font-extrabold text-slate-900 truncate" title={p.custom_id ? `${p.name} (${p.custom_id})` : p.name}>
                          {p.name} {p.custom_id && <span className="text-[10px] font-semibold text-slate-400 ml-0.5">({p.custom_id})</span>}
                        </span>
                      </div>
                      
                      <div className="col-span-3 text-slate-600 font-semibold truncate">
                        {ageText} / {p.gender || "-"}
                      </div>
                      
                      <div className="col-span-2">
                        {p.body_type && p.body_type !== "선택 안함" ? (
                          <span className="bg-teal-50 text-teal-800 px-1.5 py-0.2 rounded font-bold whitespace-nowrap">{p.body_type}</span>
                        ) : <span className="text-slate-300">-</span>}
                      </div>

                      <div className="col-span-3 flex flex-wrap justify-end gap-1 truncate">
                        {p.tags && p.tags.slice(0, 1).map((tag: string, idx: number) => (
                          <span key={idx} className={`text-[9px] font-bold px-1.5 py-0.2 rounded border whitespace-nowrap ${getTagColor(tag)}`}>{tag}</span>
                        ))}
                      </div>
                    </div>
                    <div className="text-slate-300 font-bold flex-shrink-0 ml-0.5">›</div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 2열: 선택된 고객 상세 정보 */}
        <div className="lg:col-span-4 bg-white rounded-3xl shadow-sm border border-slate-200 flex flex-col overflow-hidden p-3.5 space-y-2.5">
          {selectedPatient ? (
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 hide-scrollbar">
              
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                    <span>👤</span> {selectedPatient.name} {selectedPatient.custom_id ? `(${selectedPatient.custom_id})` : ""}
                  </h2>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => handleOpenEdit(selectedPatient)} className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg font-bold text-[10px] transition">수정</button>
                    <button onClick={() => handleDeletePatient(selectedPatient.id)} className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg font-bold text-[10px] transition">삭제</button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-600 pt-0.5">
                  <span className="font-bold text-teal-800">
                    {selectedPatient.body_type && selectedPatient.body_type !== "선택 안함" ? selectedPatient.body_type : "체질 미설정"}
                  </span>
                  <span>·</span>
                  <span>{selectedPatient.birth_year ? `${new Date().getFullYear() - selectedPatient.birth_year + 1}세` : "-"} / {selectedPatient.gender || "-"}</span>
                  
                  {selectedPatient.tags && selectedPatient.tags.length > 0 && (
                    <>
                      <span>·</span>
                      <div className="flex flex-wrap gap-1">
                        {selectedPatient.tags.map((tag: string, idx: number) => (
                          <span key={idx} className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${getTagColor(tag)}`}>{tag}</span>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1.5 text-center text-xs">
                <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[9px] text-slate-400 block mb-0.5">최근 상담일</span>
                  <span className="font-bold text-slate-800 text-[11px]">{selectedPatientStats.lastDate}</span>
                </div>
                <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[9px] text-slate-400 block mb-0.5">상담 횟수</span>
                  <span className="font-bold text-slate-800 text-[11px]">{selectedPatientStats.count}회</span>
                </div>
                <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[9px] text-slate-400 block mb-0.5">누적 결제</span>
                  <span className="font-bold text-[#528771] text-[11px]">{selectedPatientStats.totalAmount.toLocaleString()}원</span>
                </div>
              </div>

              {/* 최근 판매 내역 */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-extrabold text-slate-900">🛍️ 최근 판매 내역 ({selectedPatientStats.pSales.length}건)</h3>
                </div>
                <div className="space-y-1 max-h-36 overflow-y-auto pr-1 hide-scrollbar">
                  {selectedPatientStats.pSales.length === 0 ? (
                    <div className="p-2.5 bg-slate-50 rounded-xl text-center text-[11px] text-slate-400">판매 내역이 없습니다.</div>
                  ) : (
                    selectedPatientStats.pSales.slice(0, 3).map(s => (
                      <div key={s.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs flex justify-between items-center">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-slate-400">{s.sale_date} · {s.payment_method}</span>
                          <span className="font-extrabold text-slate-800 text-[11px]">
                            {s.items?.map((i: any) => `${i.name}(${i.quantity})`).join(", ")}
                          </span>
                        </div>
                        <span className="font-black text-[#528771] text-[11px]">{s.total_amount?.toLocaleString()}원</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* 최근 상담 내역 */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-extrabold text-slate-900">💬 최근 상담 내역 ({selectedPatientStats.pConsults.length}건)</h3>
                  <button onClick={() => setHistoryModalPatient(selectedPatient)} className="text-[10px] font-bold text-teal-800 hover:underline">전체보기 →</button>
                </div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 hide-scrollbar">
                  {selectedPatientStats.pConsults.length === 0 ? (
                    <div className="p-3 bg-slate-50 rounded-xl text-center text-[11px] text-slate-400">상담 내역이 없습니다.</div>
                  ) : (
                    selectedPatientStats.pConsults.slice(0, 2).map(c => (
                      <div key={c.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs flex flex-col gap-1">
                        <div className="flex justify-between items-center font-bold text-slate-700">
                          <div className="flex items-center gap-2 truncate">
                            <span className="text-[10px] text-slate-400">{c.consultation_date || c.created_at?.split('T')[0]}</span>
                            {c.prescription && <span className="text-teal-900 font-extrabold text-[11px] truncate" title={c.prescription}>{c.prescription}</span>}
                          </div>
                          {c.amount && <span className="text-purple-800 font-extrabold flex-shrink-0">{c.amount.toLocaleString()}원</span>}
                        </div>
                        {c.symptoms && <p className="font-semibold text-slate-600 text-[11px] truncate" title={c.symptoms}>{c.symptoms}</p>}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {selectedPatientAllPhotos.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-extrabold text-slate-900">📸 첨부 사진 ({selectedPatientAllPhotos.length}장)</h3>
                    <button onClick={() => setPhotosModalPatient(selectedPatient)} className="text-[10px] font-bold text-blue-700 hover:underline">크게 보기 →</button>
                  </div>
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {selectedPatientAllPhotos.slice(0, 4).map((photo: any, idx: number) => (
                      <div key={idx} className="relative w-14 h-14 border rounded-xl overflow-hidden bg-white cursor-pointer flex-shrink-0" onClick={() => setPreviewImageUrl(photo.url)}>
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

        {/* 3열: 우측 통계 */}
        <div className="lg:col-span-3 bg-white rounded-3xl shadow-sm border border-slate-200 flex flex-col overflow-hidden p-3.5 space-y-3">
          
          <div className="flex flex-col flex-1 overflow-hidden space-y-1.5">
            <div className="flex justify-between items-center flex-shrink-0">
              <h3 className="text-xs font-extrabold text-slate-900">🏆 전체 누적 판매 TOP</h3>
              <span className="text-[10px] font-bold text-slate-400">{totalSalesSumAll.toLocaleString()}원</span>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-1 pr-1 hide-scrollbar">
              {customerSalesRankingAll.slice(0, 5).map((c, idx) => {
                const percent = Math.round((c.totalAmt / (totalSalesSumAll || 1)) * 100);
                return (
                  <div key={c.name} className="p-1.5 bg-slate-50 rounded-xl border border-slate-100 flex flex-col gap-0.5">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="font-extrabold text-slate-800 truncate max-w-[100px]" title={c.name}>
                        {idx + 1}. {c.name}
                      </span>
                      <span className="font-black text-[#528771]">{c.totalAmt.toLocaleString()}원</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-1 overflow-hidden">
                      <div className="bg-[#528771] h-full rounded-full" style={{ width: `${percent}%` }}></div>
                    </div>
                  </div>
                );
              })}
              {customerSalesRankingAll.length === 0 && (
                <div className="text-[11px] text-slate-400 text-center py-4">데이터 없음</div>
              )}
            </div>
          </div>

          <hr className="border-slate-100 my-1" />

          <div className="flex flex-col flex-1 overflow-hidden space-y-1.5">
            <div className="flex justify-between items-center flex-shrink-0">
              <h3 className="text-xs font-extrabold text-slate-900">🔥 3개월 누적 판매 TOP</h3>
              <span className="text-[10px] font-bold text-slate-400">{totalSalesSum3Months.toLocaleString()}원</span>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-1 pr-1 hide-scrollbar">
              {customerSalesRanking3Months.slice(0, 5).map((c, idx) => {
                const percent = Math.round((c.totalAmt / (totalSalesSum3Months || 1)) * 100);
                return (
                  <div key={c.name} className="p-1.5 bg-slate-50 rounded-xl border border-slate-100 flex flex-col gap-0.5">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="font-extrabold text-slate-800 truncate max-w-[100px]" title={c.name}>
                        {idx + 1}. {c.name}
                      </span>
                      <span className="font-black text-amber-700">{c.totalAmt.toLocaleString()}원</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-1 overflow-hidden">
                      <div className="bg-amber-600 h-full rounded-full" style={{ width: `${percent}%` }}></div>
                    </div>
                  </div>
                );
              })}
              {customerSalesRanking3Months.length === 0 && (
                <div className="text-[11px] text-slate-400 text-center py-4">데이터 없음</div>
              )}
            </div>
          </div>

        </div>

      </div>

      {/* 신규 고객 등록 및 수정 모달 */}
      {isModalOpen && (
        <div onClick={() => setIsModalOpen(false)} className="fixed inset-0 z-[120] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer">
          <div className="bg-white w-full max-w-lg rounded-3xl p-5 shadow-2xl border border-slate-200 flex flex-col space-y-3 cursor-default" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b pb-2.5">
              <h3 className="text-sm font-extrabold text-slate-900">{editingPatientId ? "👥 고객 정보 수정" : "➕ 신규 고객 등록"}</h3>
              <button onClick={() => setIsModalOpen(false)} className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-200">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-2.5 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">이름 *</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold" required />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">아이디</label>
                  <input type="text" value={customId} onChange={(e) => setCustomId(e.target.value)} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold" />
                </div>
              </div>

              <div className="relative">
                <label className="block font-bold text-teal-800 mb-1">대표 고객 (가족 환자 연결)</label>
                <input 
                  type="text" 
                  placeholder="대표 고객 이름 검색..." 
                  value={repSearch} 
                  onChange={(e) => setRepSearch(e.target.value)} 
                  className="w-full p-2 bg-teal-50/50 border border-teal-100 rounded-xl font-semibold focus:outline-none focus:border-[#528771]" 
                />
                {representativeId && (
                  <div className="mt-1 flex items-center justify-between bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200 text-[11px]">
                    <span className="font-bold text-teal-900">선택됨: {patients.find(p => p.id === representativeId)?.name}</span>
                    <button type="button" onClick={() => { setRepresentativeId(""); setRepSearch(""); }} className="text-red-500 font-bold hover:underline">해제</button>
                  </div>
                )}
                {repSearch && !representativeId && (
                  <div className="absolute z-30 w-full max-h-36 overflow-y-auto border border-slate-200 rounded-xl bg-white shadow-xl mt-1">
                    {patients.filter(p => p.id !== editingPatientId && p.name.includes(repSearch)).map(p => (
                      <div key={p.id} onClick={() => { setRepresentativeId(p.id); setRepSearch(p.name); }} 
                        className="p-2 hover:bg-teal-50 cursor-pointer flex justify-between items-center border-b border-slate-100 last:border-none"
                      >
                        <span className="font-extrabold text-slate-900">{p.name}</span>
                        <span className="font-bold text-slate-400 text-[10px]">{p.custom_id || ""}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">성별</label>
                  <select value={gender} onChange={(e) => setGender(e.target.value)} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold"><option value="남">남</option><option value="여">여</option></select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">출생 연도</label>
                  <input type="number" value={birthYear} onChange={(e) => setBirthYear(e.target.value)} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">체질</label>
                  <select value={bodyType} onChange={(e) => setBodyType(e.target.value)} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold">{CONSTITUTION_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}</select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">주소</label>
                <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold" />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">분류 태그 (쉼표로 구분)</label>
                <input type="text" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold" />
              </div>

              <div>
                <label className="block font-bold text-teal-800 mb-1">텍스트 메모</label>
                <textarea value={memo} onChange={(e) => setMemo(e.target.value)} rows={2} className="w-full p-2 bg-teal-50/50 border border-teal-100 rounded-xl text-xs font-semibold resize-none" />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-3.5 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition">취소</button>
                <button type="submit" className="px-4 py-2 bg-[#528771] text-white font-bold rounded-xl hover:bg-[#3d6856] transition shadow-sm">저장하기</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {historyModalPatient && (
        <div onClick={() => setHistoryModalPatient(null)} className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer">
          <div className="bg-white w-full max-w-3xl max-h-[85vh] rounded-3xl p-6 shadow-2xl border border-slate-200 flex flex-col space-y-4 cursor-default" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold text-slate-900">📂 {historyModalPatient.name} 님의 전체 상담 기록</h3>
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
                          {c.symptoms && <div>{c.symptoms}</div>}
                          {c.prescription && <div className="text-teal-700">{c.prescription}</div>}
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

      {photosModalPatient && (
        <div onClick={() => setPhotosModalPatient(null)} className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer">
          <div className="bg-white w-full max-w-2xl max-h-[85vh] rounded-3xl p-6 shadow-2xl border border-slate-200 flex flex-col space-y-4 cursor-default" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold text-slate-900">📸 {photosModalPatient.name} 님의 사진 모아보기</h3>
              <button onClick={() => setPhotosModalPatient(null)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-200">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-6 content-start pr-1">
              {selectedPatientAllPhotos.length === 0 ? (
                <div className="col-span-full text-center py-12 text-slate-400 text-sm">등록된 사진이 없습니다.</div>
              ) : (
                selectedPatientAllPhotos.map((photo: any, idx: number) => (
                  <div key={idx} className="flex flex-col gap-1.5">
                    <div className="relative aspect-square border border-slate-200 rounded-2xl overflow-hidden bg-slate-50 cursor-pointer shadow-sm group" onClick={() => setPreviewImageUrl(photo.url)}>
                      <img src={photo.url} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                    </div>
                    <div className="text-center text-[11px] leading-tight flex flex-col">
                      <span className="font-extrabold text-slate-800">{photo.date}</span>
                      <span className="font-semibold text-teal-700 truncate px-1" title={photo.prescription}>{photo.prescription || "-"}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="flex justify-end pt-3 border-t"><button onClick={() => setPhotosModalPatient(null)} className="px-5 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800">닫기</button></div>
          </div>
        </div>
      )}

      {previewImageUrl && (
        <div onClick={() => setPreviewImageUrl(null)} className="fixed inset-0 z-[150] bg-slate-950/80 flex items-center justify-center p-4 cursor-pointer">
          <img src={previewImageUrl} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
          <button onClick={() => setPreviewImageUrl(null)} className="absolute top-4 right-4 text-white bg-slate-800 w-10 h-10 rounded-full font-bold">✕</button>
        </div>
      )}

    </div>
  );
}