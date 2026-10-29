"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/app/lib/supabase";

const CONSTITUTION_OPTIONS = ["선택 안함", "태양인", "태음인", "소양인", "소음인"];

// 태그 글자에 따라 일관된 컬러를 반환하는 함수
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
  
  const [activeTab, setActiveTab] = useState<"summary" | "info">("summary");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPatientId, setEditingPatientId] = useState<string | null>(null);

  // 팝업 상태들
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

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: pData } = await supabase.from("patients").select("*").order("name");
    if (pData) setPatients(pData);

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
    
    return { count, totalAmount, lastDate, lastPrescription };
  };

  const handleOpenRegister = () => {
    setEditingPatientId(null);
    setName(""); setCustomId(""); setPhone(""); setAddress(""); setGender("남"); setBirthYear(""); setBodyType("선택 안함");
    setTagsInput(""); 
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

  const filteredPatients = patients.filter(p => {
    const term = searchTerm.toLowerCase();
    const matchNameOrId = p.name?.toLowerCase().includes(term) || p.custom_id?.toLowerCase().includes(term) || p.phone?.includes(term);
    const matchTag = p.tags?.some((t: string) => t.toLowerCase().includes(term));
    const matchAddress = p.address?.toLowerCase().includes(term);
    return matchNameOrId || matchTag || matchAddress;
  });

  const patientConsultations = historyModalPatient 
    ? consultations
        .filter(c => c.patient_id === historyModalPatient.id)
        .sort((a, b) => {
          const dateA = new Date(a.consultation_date || a.created_at).getTime();
          const dateB = new Date(b.consultation_date || b.created_at).getTime();
          return dateB - dateA;
        })
    : [];

  const patientAllPhotos = photosModalPatient
    ? consultations
        .filter(c => c.patient_id === photosModalPatient.id)
        .flatMap(c => (c.display_image_urls || []).map((url: string) => ({ url, date: c.consultation_date || c.created_at.split('T')[0], symptoms: c.symptoms })))
    : [];

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 border-b pb-4">
        <h1 className="text-2xl font-extrabold text-slate-900">👥 환자 목록 ({patients.length}명)</h1>
        <div className="flex gap-3 w-full md:w-auto">
          <input 
            type="text" 
            placeholder="이름, 번호, 주소, 태그 검색..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            className="flex-1 md:w-80 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
          />
          <button onClick={handleOpenRegister} className="px-5 py-2 bg-teal-900 hover:bg-teal-800 text-white font-bold rounded-xl text-sm transition shadow-sm whitespace-nowrap">
            + 새 환자 등록
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        <button 
          onClick={() => setActiveTab("summary")} 
          className={`px-5 py-2.5 rounded-xl font-bold text-sm transition shadow-sm ${activeTab === "summary" ? "bg-slate-900 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}
        >
          📊 종합 목록
        </button>
        <button 
          onClick={() => setActiveTab("info")} 
          className={`px-5 py-2.5 rounded-xl font-bold text-sm transition shadow-sm ${activeTab === "info" ? "bg-slate-900 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}
        >
          👤 환자 정보 관리
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm min-w-[900px]">
          
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 whitespace-nowrap">
            {activeTab === "summary" ? (
              <tr>
                <th className="py-4 px-3 font-bold w-[12%]">환자명</th>
                <th className="py-4 px-3 font-bold w-[10%]">아이디</th>
                <th className="py-4 px-3 font-bold w-[18%]">분류</th>
                <th className="py-4 px-3 font-bold w-[11%]">최종상담일</th>
                <th className="py-4 px-3 font-bold w-[13%]">최종처방</th>
                <th className="py-4 px-3 font-bold text-center w-[8%]">상담횟수</th>
                <th className="py-4 px-3 font-bold w-[11%]">누적액</th>
                <th className="py-4 px-3 font-bold w-[9%]" style={{ paddingRight: '24px' }}>등록일자</th>
                <th className="py-4 px-3 font-bold text-center w-[8%]">관리</th>
              </tr>
            ) : (
              <tr>
                <th className="py-4 px-4 font-bold w-[20%]">환자명</th>
                <th className="py-4 px-4 font-bold w-[15%]">아이디</th>
                <th className="py-4 px-4 font-bold w-[20%]">연락처</th>
                <th className="py-4 px-4 font-bold w-[33%]">주소</th>
                <th className="py-4 px-4 font-bold text-center w-[12%]">관리</th>
              </tr>
            )}
          </thead>

          <tbody className="divide-y divide-slate-100">
            {filteredPatients.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-12 text-slate-400">검색된 환자가 없습니다.</td></tr>
            ) : (
              filteredPatients.map(p => {
                const stats = getPatientStats(p.id);
                const regDate = p.created_at ? p.created_at.split('T')[0] : "-";
                
                return (
                  <tr 
                    key={p.id} 
                    className="hover:bg-slate-50 transition cursor-pointer group" 
                    onDoubleClick={() => setHistoryModalPatient(p)}
                    title="더블클릭하여 상담 기록 보기"
                  >
                    {activeTab === "summary" ? (
                      <>
                        <td className="py-3 px-3 font-bold text-slate-900 group-hover:text-teal-800 transition whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span>{p.name}</span>
                            <span className="text-[10px] font-normal text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full">{p.gender} / {p.birth_year || "-"}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-slate-600 font-semibold whitespace-nowrap">{p.custom_id || "-"}</td>
                        <td className="py-3 px-3">
                          <div className="flex flex-wrap gap-1">
                            {p.tags && p.tags.length > 0 ? (
                              p.tags.map((tag: string, idx: number) => (
                                <span key={idx} className={`text-[11px] font-bold px-1.5 py-0.5 rounded-md border whitespace-nowrap ${getTagColor(tag)}`}>{tag}</span>
                              ))
                            ) : (
                              <span className="text-xs text-slate-400">-</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-slate-800 font-medium whitespace-nowrap">{stats.lastDate}</td>
                        <td className="py-3 px-3 text-teal-800 font-bold truncate max-w-[130px]" title={stats.lastPrescription}>{stats.lastPrescription}</td>
                        <td className="py-3 px-3 font-bold text-slate-700 text-center whitespace-nowrap">{stats.count}회</td>
                        <td className="py-3 px-3 font-bold text-purple-800 whitespace-nowrap">{stats.totalAmount.toLocaleString()}원</td>
                        <td className="py-3 px-3 text-slate-500 whitespace-nowrap" style={{ paddingRight: '24px' }}>{regDate}</td>
                      </>
                    ) : (
                      <>
                        <td className="py-3 px-4 font-bold text-slate-900 group-hover:text-teal-800 transition whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span>{p.name}</span>
                            <span className="text-[10px] font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{p.gender} / {p.birth_year || "-"}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-600 font-semibold whitespace-nowrap">{p.custom_id || "-"}</td>
                        <td className="py-3 px-4 text-slate-700 font-bold whitespace-nowrap">{p.phone || "-"}</td>
                        <td className="py-3 px-4 text-slate-600 font-medium truncate max-w-[280px]" title={p.address || ""}>{p.address || "-"}</td>
                      </>
                    )}

                    <td className="py-3 px-3 text-center whitespace-nowrap" onClick={e => e.stopPropagation()}> 
                      <div className="inline-flex items-center gap-1">
                        <button onClick={() => setHistoryModalPatient(p)} className="px-2 py-1 bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold text-[11px] rounded-md transition">기록</button>
                        <button onClick={() => setPhotosModalPatient(p)} className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold text-[11px] rounded-md transition">사진</button>
                        <button onClick={() => handleOpenEdit(p)} className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] rounded-md transition">수정</button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {historyModalPatient && (
        <div onClick={() => setHistoryModalPatient(null)} className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer">
          <div className="bg-white w-full max-w-3xl max-h-[85vh] rounded-3xl p-6 shadow-2xl border border-slate-200 flex flex-col space-y-4 cursor-default" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">📂 {historyModalPatient.name} 님의 전체 상담 기록</h3>
                <p className="text-xs text-slate-500">연락처: {historyModalPatient.phone || "없음"} | 총 상담 횟수: {patientConsultations.length}회</p>
              </div>
              <button onClick={() => setHistoryModalPatient(null)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-200">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {patientConsultations.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">작성된 상담 기록이 없습니다.</div>
              ) : (
                patientConsultations.map((c, idx) => (
                  <div key={c.id || idx} className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-3">
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
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-700 whitespace-pre-line leading-relaxed"><strong className="text-slate-900 block mb-1">증상 상세:</strong>{c.symptom_detail}</div>
                        )}
                        {c.consult_memo && (
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-700 whitespace-pre-line leading-relaxed"><strong className="text-slate-900 block mb-1">코멘트:</strong>{c.consult_memo}</div>
                        )}
                        {c.follow_up && (
                          <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-200/60 text-xs text-purple-900 whitespace-pre-line leading-relaxed"><strong className="text-purple-800 block mb-1">추후관리:</strong>{c.follow_up}</div>
                        )}
                      </div>
                      {c.display_image_urls && c.display_image_urls.length > 0 && (
                        <div className="w-full sm:w-auto sm:max-w-[180px] flex flex-row sm:flex-col flex-wrap gap-2 overflow-x-auto sm:overflow-visible pb-2 sm:pb-0 flex-shrink-0">
                          {c.display_image_urls.map((imgUrl: string, imgIdx: number) => (
                            <div key={imgIdx} className="relative w-24 h-24 sm:w-32 sm:h-32 border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs cursor-pointer flex items-center justify-center flex-shrink-0 group" onClick={() => setPreviewImageUrl(imgUrl)}>
                              <img src={imgUrl} className="max-w-full max-h-full object-contain group-hover:scale-105 transition rounded-lg" />
                            </div>
                          ))}
                        </div>
                      )}
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
              <div>
                <h3 className="text-lg font-bold text-slate-900">📸 {photosModalPatient.name} 님의 사진 모아보기</h3>
                <p className="text-xs text-slate-500">총 첨부된 사진: {patientAllPhotos.length}장</p>
              </div>
              <button onClick={() => setPhotosModalPatient(null)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-200">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-3 gap-3 content-start pr-1">
              {patientAllPhotos.length === 0 ? (
                <div className="col-span-full text-center py-12 text-slate-400 text-sm">등록된 사진이 없습니다.</div>
              ) : (
                patientAllPhotos.map((photo: any, idx: number) => (
                  <div key={idx} className="relative aspect-square border border-slate-200 rounded-2xl overflow-hidden bg-white group cursor-pointer shadow-xs" onClick={() => setPreviewImageUrl(photo.url)}>
                    <img src={photo.url} className="w-full h-full object-cover group-hover:scale-105 transition" />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[10px] font-semibold px-2 py-1 truncate">{photo.date} {photo.symptoms ? `(${photo.symptoms})` : ""}</div>
                  </div>
                ))
              )}
            </div>
            <div className="flex justify-end pt-2 border-t"><button onClick={() => setPhotosModalPatient(null)} className="px-5 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800">닫기</button></div>
          </div>
        </div>
      )}

      {previewImageUrl && (
        <div onClick={() => setPreviewImageUrl(null)} className="fixed inset-0 z-[100] bg-slate-950/80 flex items-center justify-center p-4 cursor-pointer">
          <img src={previewImageUrl} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
          <button onClick={() => setPreviewImageUrl(null)} className="absolute top-4 right-4 text-white bg-slate-800 w-10 h-10 rounded-full font-bold">✕</button>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md p-6 rounded-3xl shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-5 border-b pb-3">
              <h3 className="text-lg font-bold text-slate-900">{editingPatientId ? "✏️ 환자 정보 수정" : "👤 새 환자 등록"}</h3>
              <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold">✕</button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">환자명</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full p-2.5 bg-slate-50 border rounded-xl text-sm font-semibold" required />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">아이디</label>
                  <input type="text" value={customId} onChange={(e) => setCustomId(e.target.value)} className="w-full p-2.5 bg-slate-50 border rounded-xl text-sm font-semibold" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">성별</label>
                  <select value={gender} onChange={(e) => setGender(e.target.value)} className="w-full p-2.5 bg-slate-50 border rounded-xl text-sm font-semibold">
                    <option value="남">남</option>
                    <option value="여">여</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">출생년도</label>
                  <input type="number" value={birthYear} onChange={(e) => setBirthYear(e.target.value)} className="w-full p-2.5 bg-slate-50 border rounded-xl text-sm font-semibold" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">체질</label>
                  <select value={bodyType} onChange={(e) => setBodyType(e.target.value)} className="w-full p-2.5 bg-slate-50 border rounded-xl text-sm font-semibold">
                    {CONSTITUTION_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">연락처</label>
                  <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full p-2.5 bg-slate-50 border rounded-xl text-sm font-semibold" placeholder="010-0000-0000" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">주소</label>
                  <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className="w-full p-2.5 bg-slate-50 border rounded-xl text-sm font-semibold" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">분류 태그 (여러 개일 경우 쉼표로 구분)</label>
                <input 
                  type="text" 
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="예: 당뇨, 성장, 콜레"
                  className="w-full p-2.5 bg-slate-50 border rounded-xl text-sm font-semibold text-slate-900"
                />
              </div>

              <div className="flex gap-2 pt-3 border-t">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 bg-slate-100 font-bold text-slate-700 rounded-xl text-sm">취소</button>
                <button type="submit" className="flex-1 py-3 bg-teal-900 hover:bg-teal-800 text-white font-bold rounded-xl text-sm shadow-sm">
                  {/* 🟢 수정 완료 버튼의 조건식에서 editingId를 editingPatientId로 올바르게 수정 */}
                  {editingPatientId ? "수정 완료" : "등록하기"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}