"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/app/lib/supabase";

const CONSTITUTION_OPTIONS = ["선택 안함", "태양인", "태음인", "소양인", "소음인"];

export default function PatientsPage() {
  const [patients, setPatients] = useState<any[]>([]);
  const [consultations, setConsultations] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  
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
  const [gender, setGender] = useState("남");
  const [birthYear, setBirthYear] = useState("");
  const [bodyType, setBodyType] = useState("선택 안함");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: pData } = await supabase.from("patients").select("*").order("name");
    if (pData) setPatients(pData);

    const { data: cData } = await supabase.from("consultations").select("*").order("created_at", { ascending: false });
    if (cData) {
      // 이미지 URL에 대한 Signed URL 처리
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
    const pConsults = consultations.filter(c => c.patient_id === patientId);
    const count = pConsults.length;
    const totalAmount = pConsults.reduce((sum, c) => sum + (c.amount || 0), 0);
    const lastDate = count > 0 ? (pConsults[0].consultation_date || pConsults[0].created_at.split('T')[0]) : "-";
    return { count, totalAmount, lastDate };
  };

  const handleOpenRegister = () => {
    setEditingPatientId(null);
    setName(""); setCustomId(""); setPhone(""); setGender("남"); setBirthYear(""); setBodyType("선택 안함");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (p: any) => {
    setEditingPatientId(p.id);
    setName(p.name || "");
    setCustomId(p.custom_id || "");
    setPhone(p.phone || "");
    setGender(p.gender || "남");
    setBirthYear(p.birth_year ? p.birth_year.toString() : "");
    setBodyType(p.body_type || "선택 안함");
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return alert("환자 이름을 입력해주세요.");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return alert("로그인 정보가 없습니다.");

    const payload = {
      name,
      custom_id: customId,
      phone,
      gender,
      birth_year: birthYear ? parseInt(birthYear) : null,
      body_type: bodyType === "선택 안함" ? null : bodyType,
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

  const filteredPatients = patients.filter(p => 
    p.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.custom_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.phone?.includes(searchTerm)
  );

  const patientConsultations = historyModalPatient 
    ? consultations.filter(c => c.patient_id === historyModalPatient.id) 
    : [];

  // 환자별 모든 사진 모아보기 목록 추출
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
            placeholder="환자명, 아이디, 전화번호 검색..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            className="flex-1 md:w-72 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
          />
          <button onClick={handleOpenRegister} className="px-5 py-2 bg-teal-900 hover:bg-teal-800 text-white font-bold rounded-xl text-sm transition shadow-sm whitespace-nowrap">
            + 새 환자 등록
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-left border-collapse text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-700">
            <tr>
              <th className="p-4 font-bold">환자명</th>
              <th className="p-4 font-bold">아이디</th>
              <th className="p-4 font-bold">등록일자</th>
              <th className="p-4 font-bold">최종상담일</th>
              <th className="p-4 font-bold">상담횟수</th>
              <th className="p-4 font-bold">누적액</th>
              <th className="p-4 font-bold text-right">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredPatients.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-slate-400">등록된 환자가 없습니다.</td></tr>
            ) : (
              filteredPatients.map(p => {
                const stats = getPatientStats(p.id);
                const regDate = p.created_at ? p.created_at.split('T')[0] : "-";
                return (
                  // 🟢 tr 태그에 onDoubleClick 이벤트와 cursor-pointer 클래스 추가
                  <tr 
                    key={p.id} 
                    className="hover:bg-slate-50 transition cursor-pointer group" 
                    onDoubleClick={() => setHistoryModalPatient(p)}
                    title="더블클릭하여 상담 기록 보기"
                  >
                    <td className="p-4 font-bold text-slate-900 flex items-center gap-2 group-hover:text-teal-800 transition">
                      <span>{p.name}</span>
                      <span className="text-xs font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{p.gender} / {p.birth_year || "-"}년</span>
                    </td>
                    <td className="p-4 text-slate-600 font-semibold">{p.custom_id || "-"}</td>
                    <td className="p-4 text-slate-500">{regDate}</td>
                    <td className="p-4 text-slate-800 font-medium">{stats.lastDate}</td>
                    <td className="p-4 font-bold text-teal-800">{stats.count}회</td>
                    <td className="p-4 font-bold text-purple-800">{stats.totalAmount.toLocaleString()}원</td>
                    <td className="p-4 text-right space-x-1" onClick={e => e.stopPropagation()}> 
                      {/* 버튼 클릭 시 더블클릭 이벤트 방지(e.stopPropagation) */}
                      <button onClick={() => setHistoryModalPatient(p)} className="px-2.5 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold text-xs rounded-lg transition">
                        기록보기
                      </button>
                      <button onClick={() => setPhotosModalPatient(p)} className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold text-xs rounded-lg transition">
                        사진모아보기
                      </button>
                      <button onClick={() => handleOpenEdit(p)} className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition">
                        수정
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 환자별 전체 상담 기록 모아보기 팝업 (좌우 분할 개편) */}
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
                    
                    {/* 카드 상단: 날짜 및 금액 */}
                    <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                      <span className="font-bold text-slate-900 text-sm">{c.consultation_date || c.created_at.split('T')[0]}</span>
                      {c.amount && <span className="font-extrabold text-purple-800 text-sm">{c.amount.toLocaleString()}원</span>}
                    </div>
                    
                    {/* 카드 본문: 좌(텍스트) 우(사진) 레이아웃 */}
                    <div className="flex flex-col sm:flex-row gap-4 items-start">
                      
                      {/* 왼쪽: 텍스트 영역 */}
                      <div className="flex-1 space-y-2 min-w-0 w-full">
                        <div className="flex flex-wrap gap-x-4 text-sm font-bold text-slate-800 mb-2">
                          {c.symptoms && <div>{c.symptoms}</div>}
                          {c.prescription && <div className="text-teal-700">{c.prescription}</div>}
                        </div>
                        
                        {c.symptom_detail && (
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-700 whitespace-pre-line leading-relaxed">
                            <strong className="text-slate-900 block mb-1">증상 상세:</strong>
                            {c.symptom_detail}
                          </div>
                        )}
                        {c.consult_memo && (
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-700 whitespace-pre-line leading-relaxed">
                            <strong className="text-slate-900 block mb-1">코멘트:</strong>
                            {c.consult_memo}
                          </div>
                        )}
                        {c.follow_up && (
                          <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-200/60 text-xs text-purple-900 whitespace-pre-line leading-relaxed">
                            <strong className="text-purple-800 block mb-1">추후관리:</strong>
                            {c.follow_up}
                          </div>
                        )}
                      </div>

                      {/* 오른쪽: 사진 영역 (빈 공간에 들어갈 수 있도록) */}
                      {c.display_image_urls && c.display_image_urls.length > 0 && (
                        <div className="w-full sm:w-auto sm:max-w-[180px] flex flex-row sm:flex-col flex-wrap gap-2 overflow-x-auto sm:overflow-visible pb-2 sm:pb-0 flex-shrink-0">
                          {c.display_image_urls.map((imgUrl: string, imgIdx: number) => (
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
                ))
              )}
            </div>

            <div className="flex justify-end pt-2 border-t">
              <button onClick={() => setHistoryModalPatient(null)} className="px-5 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800">닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* 환자별 사진 모아보기 팝업 */}
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
                    <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[10px] font-semibold px-2 py-1 truncate">
                      {photo.date} {photo.symptoms ? `(${photo.symptoms})` : ""}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2 border-t">
              <button onClick={() => setPhotosModalPatient(null)} className="px-5 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800">닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* 이미지 확대 라이트박스 팝업 */}
      {previewImageUrl && (
        <div onClick={() => setPreviewImageUrl(null)} className="fixed inset-0 z-[100] bg-slate-950/80 flex items-center justify-center p-4 cursor-pointer">
          <img src={previewImageUrl} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
          <button onClick={() => setPreviewImageUrl(null)} className="absolute top-4 right-4 text-white bg-slate-800 w-10 h-10 rounded-full font-bold">✕</button>
        </div>
      )}

      {/* 환자 등록 / 수정 모달 */}
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

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">연락처</label>
                <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full p-2.5 bg-slate-50 border rounded-xl text-sm font-semibold" placeholder="010-0000-0000" />
              </div>

              <div className="flex gap-2 pt-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 bg-slate-100 font-bold text-slate-700 rounded-xl text-sm">취소</button>
                <button type="submit" className="flex-1 py-3 bg-teal-900 hover:bg-teal-800 text-white font-bold rounded-xl text-sm shadow-sm">
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