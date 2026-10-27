"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/app/lib/supabase";

export default function ConsultationsPage() {
  const [patients, setPatients] = useState<any[]>([]);
  const [consultations, setConsultations] = useState<any[]>([]);
  
  const [activeTab, setActiveTab] = useState<"write" | "history">("write");
  const [searchTerm, setSearchTerm] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);

  const [selectedDetailConsultation, setSelectedDetailConsultation] = useState<any | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  const [patientSearchQuery, setPatientSearchQuery] = useState("");
  const [isPatientDropdownOpen, setIsPatientDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 📝 폼 상태값 (빌드 에러 방지를 위해 초기값을 빈 문자열로 설정)
  const [selectedPatient, setSelectedPatient] = useState("");
  const [selectedPatientNameDisplay, setSelectedPatientNameDisplay] = useState("");
  const [consultationDate, setConsultationDate] = useState(""); 
  
  const [symptoms, setSymptoms] = useState(""); // 주호소
  const [digestionStool, setDigestionStool] = useState(""); // 소화배변
  const [sleepState, setSleepState] = useState(""); // 수면상태
  const [symptomDetail, setSymptomDetail] = useState(""); // 증상 상세
  const [prescription, setPrescription] = useState(""); // 처방
  const [consultMemo, setConsultMemo] = useState(""); // 코멘트
  const [feedbackDays, setFeedbackDays] = useState(""); // 피드백일정
  const [amount, setAmount] = useState(""); // 금액

  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([]);
  const [existingImagePreviews, setExistingImagePreviews] = useState<{ path: string; url: string }[]>([]);
  const [uploading, setUploading] = useState(false);

  // 🟢 선택된 환자의 과거 데이터 추출 (시간역순)
  const patientHistory = selectedPatient ? consultations.filter(c => c.patient_id === selectedPatient && c.id !== editingId) : [];
  const patientPastPhotos = patientHistory.flatMap(c => 
    (c.display_image_urls || []).map((url: string) => ({ url, date: c.consultation_date || c.created_at.split('T')[0], symptoms: c.symptoms }))
  );

  useEffect(() => {
    // 마운트 시점에 오늘 날짜 세팅 및 데이터 로드
    setConsultationDate(new Date().toISOString().split('T')[0]);
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: pData } = await supabase.from("patients").select("*").order("name");
    if (pData) setPatients(pData);

    const { data: cData } = await supabase
      .from("consultations")
      .select("*, patients(name, gender, birth_year, phone)")
      .order("created_at", { ascending: false });
    
    if (cData) {
      const consultationsWithSignedUrls = await Promise.all(
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
      setConsultations(consultationsWithSignedUrls);
    }
  };

  // 🟢 붙여넣기(Ctrl+V) 이미지 첨부 핸들러
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length > 0) {
      setImageFiles(prev => [...prev, ...files]);
    }
  };

  const uploadImages = async () => {
    if (imageFiles.length === 0) return existingImageUrls;
    const uploadedPaths: string[] = [...existingImageUrls];
    for (const file of imageFiles) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from("consultation-images").upload(fileName, file);
      if (!uploadError) uploadedPaths.push(fileName);
    }
    return uploadedPaths;
  };

  const handleSubmitConsultation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) return alert("환자를 선택해주세요.");
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return alert("로그인 정보가 없습니다.");

    setUploading(true);
    try {
      const finalImagePaths = await uploadImages();
      const payload = {
        patient_id: selectedPatient,
        consultation_date: consultationDate,
        symptoms, 
        digestion_stool: digestionStool,
        sleep_state: sleepState,
        symptom_detail: symptomDetail,
        prescription, 
        consult_memo: consultMemo,
        feedback_days: feedbackDays ? parseInt(feedbackDays) : null,
        amount: amount ? parseInt(amount) : null,
        image_urls: finalImagePaths,
        user_id: user.id,
      };

      if (editingId) {
        const { error } = await supabase.from("consultations").update(payload).eq("id", editingId);
        if (error) alert("수정 실패: " + error.message);
        else { alert("수정되었습니다."); resetForm(); setActiveTab("history"); fetchData(); }
      } else {
        const { error } = await supabase.from("consultations").insert([payload]);
        if (error) alert("등록 실패: " + error.message);
        else { alert("등록되었습니다."); resetForm(); setActiveTab("history"); fetchData(); }
      }
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setEditingId(null); setSelectedPatient(""); setSelectedPatientNameDisplay(""); setPatientSearchQuery("");
    setConsultationDate(new Date().toISOString().split('T')[0]);
    setSymptoms(""); setDigestionStool(""); setSleepState(""); setSymptomDetail(""); 
    setPrescription(""); setConsultMemo(""); setFeedbackDays(""); setAmount("");
    setImageFiles([]); setExistingImageUrls([]); setExistingImagePreviews([]);
  };

  const handleEditClick = async (c: any) => {
    setEditingId(c.id);
    setSelectedPatient(c.patient_id || "");
    setSelectedPatientNameDisplay(c.patients?.name ? `${c.patients.name} (${c.patients.phone || "번호없음"})` : "");
    setConsultationDate(c.consultation_date || c.created_at.split('T')[0]);
    setSymptoms(c.symptoms || ""); setDigestionStool(c.digestion_stool || ""); setSleepState(c.sleep_state || "");
    setSymptomDetail(c.symptom_detail || ""); setPrescription(c.prescription || ""); setConsultMemo(c.consult_memo || "");
    setFeedbackDays(c.feedback_days ? c.feedback_days.toString() : ""); setAmount(c.amount ? c.amount.toString() : "");
    
    const rawPaths = c.image_urls || [];
    setExistingImageUrls(rawPaths);
    const previews = await Promise.all(
      rawPaths.map(async (path: string) => {
        if (path.startsWith('http')) return { path, url: path };
        const { data } = await supabase.storage.from('consultation-images').createSignedUrl(path, 60 * 60);
        return { path, url: data?.signedUrl || '' };
      })
    );
    setExistingImagePreviews(previews);
    setImageFiles([]);
    setActiveTab("write");
  };

  const filteredPatients = patients.filter(p => p.name?.includes(patientSearchQuery) || p.phone?.includes(patientSearchQuery));
  const filteredConsultations = consultations.filter(c => c.patients?.name?.includes(searchTerm) || c.symptoms?.includes(searchTerm) || c.prescription?.includes(searchTerm));

  return (
    <div className="w-full h-[calc(100vh-80px)] flex flex-col space-y-4" onPaste={handlePaste}>
      {/* 상단 탭 헤더 */}
      <div className="flex gap-2 border-b pb-2 flex-shrink-0">
        <button onClick={() => { resetForm(); setActiveTab("write"); }} className={`px-4 py-2 rounded-lg font-bold text-sm transition ${activeTab === "write" ? "bg-teal-900 text-white" : "bg-white text-slate-600 border"}`}>📝 상담 기록 작성 / 수정</button>
        <button onClick={() => setActiveTab("history")} className={`px-4 py-2 rounded-lg font-bold text-sm transition ${activeTab === "history" ? "bg-teal-900 text-white" : "bg-white text-slate-600 border"}`}>📂 전체 기록 조회 ({consultations.length})</button>
      </div>

      {activeTab === "write" && (
        <form onSubmit={handleSubmitConsultation} className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0 overflow-hidden">
          
          {/* 🟢 왼쪽: 텍스트 폼 영역 (스크롤 없이 꽉 차게) */}
          <div className="flex-[2] flex flex-col gap-2.5 bg-white p-4 rounded-xl border border-slate-200 overflow-y-auto lg:overflow-visible">
            
            {/* 1. 이름 & 상담일자 */}
            <div className="flex gap-2 relative z-20" ref={dropdownRef}>
              <div className="flex-1">
                <div onClick={() => setIsPatientDropdownOpen(true)} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer flex justify-between items-center text-sm font-bold text-slate-800">
                  <span>{selectedPatientNameDisplay || "환자 선택 (이름 검색)..."}</span>
                  <span className="text-xs">▼</span>
                </div>
                {isPatientDropdownOpen && (
                  <div className="absolute top-full left-0 w-[60%] mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-48 overflow-y-auto p-2">
                    <input type="text" placeholder="이름 검색..." value={patientSearchQuery} onChange={(e) => setPatientSearchQuery(e.target.value)} className="w-full p-2 mb-1 bg-slate-50 border rounded text-sm focus:outline-none" autoFocus />
                    {filteredPatients.map(p => (
                      <div key={p.id} onClick={() => { setSelectedPatient(p.id); setSelectedPatientNameDisplay(`${p.name} (${p.phone || ""})`); setIsPatientDropdownOpen(false); }} className="p-2 hover:bg-teal-50 rounded cursor-pointer text-sm font-semibold">{p.name} <span className="text-xs font-normal text-slate-500">({p.gender}/{p.birth_year})</span></div>
                    ))}
                  </div>
                )}
              </div>
              <input type="date" value={consultationDate} onChange={(e) => setConsultationDate(e.target.value)} className="w-40 p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-800" required />
            </div>

            {/* 2. 주호소, 소화배변, 수면상태 */}
            <div className="flex items-center gap-2">
              <label className="w-16 text-xs font-bold text-slate-500 shrink-0">주호소</label>
              <input type="text" value={symptoms} onChange={(e) => setSymptoms(e.target.value)} className="flex-1 p-2 bg-slate-50 border rounded-lg text-sm" />
            </div>
            <div className="flex items-center gap-2">
              <label className="w-16 text-xs font-bold text-slate-500 shrink-0">소화배변</label>
              <input type="text" value={digestionStool} onChange={(e) => setDigestionStool(e.target.value)} className="flex-1 p-2 bg-slate-50 border rounded-lg text-sm" />
            </div>
            <div className="flex items-center gap-2">
              <label className="w-16 text-xs font-bold text-slate-500 shrink-0">수면상태</label>
              <input type="text" value={sleepState} onChange={(e) => setSleepState(e.target.value)} className="flex-1 p-2 bg-slate-50 border rounded-lg text-sm" />
            </div>

            {/* 3. 증상 및 최근방문내역 (반반 분할) */}
            <div className="flex gap-4 flex-1 min-h-[120px]">
              <div className="flex-1 flex flex-col">
                <label className="text-xs font-bold text-blue-600 mb-1">증상</label>
                <textarea value={symptomDetail} onChange={(e) => setSymptomDetail(e.target.value)} className="flex-1 p-2 bg-slate-50 border rounded-lg text-sm resize-none" />
              </div>
              <div className="flex-1 flex flex-col">
                <label className="text-xs font-bold text-slate-800 mb-1">최근 방문내역 (선택 환자)</label>
                <div className="flex-1 border rounded-lg overflow-y-auto bg-white p-1 text-[11px]">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 sticky top-0"><tr><th className="p-1">내방일</th><th className="p-1">주호소</th><th className="p-1">처방</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {patientHistory.length === 0 ? <tr><td colSpan={3} className="text-center p-4 text-slate-400">내역 없음</td></tr> : 
                        patientHistory.map(h => (
                          <tr key={h.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => handleEditClick(h)}>
                            <td className="p-1">{h.consultation_date?.slice(2) || h.created_at.slice(2,10)}</td>
                            <td className="p-1 truncate max-w-[80px] font-semibold">{h.symptoms}</td>
                            <td className="p-1 truncate max-w-[80px] text-teal-700 font-semibold">{h.prescription}</td>
                          </tr>
                        ))
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* 4. 처방 및 코멘트 */}
            <div className="flex gap-4 flex-1 min-h-[120px]">
              <div className="flex-1 flex flex-col">
                <label className="text-xs font-bold text-teal-800 mb-1">처방</label>
                <textarea value={prescription} onChange={(e) => setPrescription(e.target.value)} className="flex-1 p-2 bg-teal-50/50 border border-teal-200 rounded-lg text-sm font-bold text-teal-900 resize-none" />
              </div>
              <div className="flex-1 flex flex-col">
                <label className="text-xs font-bold text-slate-600 mb-1">코멘트</label>
                <textarea value={consultMemo} onChange={(e) => setConsultMemo(e.target.value)} className="flex-1 p-2 bg-slate-50 border rounded-lg text-sm resize-none" />
              </div>
            </div>

            {/* 5. 피드백일정, 금액 & 저장 버튼 */}
            <div className="flex items-center gap-3 pt-2">
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-500">피드백일정(일)</label>
                <input type="number" value={feedbackDays} onChange={(e) => setFeedbackDays(e.target.value)} className="w-20 p-2 bg-slate-50 border rounded-lg text-sm" placeholder="예:30" />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-500">금액</label>
                <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-28 p-2 bg-slate-50 border rounded-lg text-sm" placeholder="숫자만" />
              </div>
              <div className="flex-1 text-right text-xs text-slate-400">※ 창 아무 곳에서나 [Ctrl+V]로 사진 첨부 가능</div>
              <button type="submit" disabled={uploading} className="px-6 py-2.5 bg-teal-900 hover:bg-teal-800 text-white font-bold rounded-lg transition disabled:opacity-50">
                {uploading ? "저장 중..." : (editingId ? "수정 저장" : "상담 등록")}
              </button>
            </div>
          </div>

          {/* 🟢 오른쪽: 사진 뷰어 영역 */}
          <div className="flex-1 flex flex-col gap-3 min-w-[280px]">
            {/* 현재 상담 사진 첨부 영역 */}
            <div className="flex-1 flex flex-col bg-white border border-slate-200 rounded-xl p-3 overflow-hidden">
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-bold text-slate-800">📸 현재 상담 사진 첨부</label>
                <input type="file" accept="image/*" multiple onChange={(e) => { if(e.target.files) setImageFiles(prev => [...prev, ...Array.from(e.target.files!)]) }} className="text-[10px] w-48" />
              </div>
              <div className="flex-1 border-2 border-dashed border-slate-200 bg-slate-50 rounded-lg p-2 overflow-y-auto flex flex-wrap gap-2 content-start">
                {(existingImagePreviews.length === 0 && imageFiles.length === 0) && <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">클릭하여 파일 선택 또는 (Ctrl+V) 붙여넣기</div>}
                {existingImagePreviews.map((item, idx) => (
                  <div key={`ex-${idx}`} className="relative w-20 h-20 border rounded-lg overflow-hidden group">
                    <img src={item.url} onClick={() => setPreviewImageUrl(item.url)} className="w-full h-full object-cover cursor-pointer" />
                    <button type="button" onClick={() => { setExistingImageUrls(prev => prev.filter((_, i) => i !== idx)); setExistingImagePreviews(prev => prev.filter((_, i) => i !== idx)); }} className="absolute top-0 right-0 bg-red-500 text-white w-5 h-5 text-[10px] hidden group-hover:block">✕</button>
                  </div>
                ))}
                {imageFiles.map((file, idx) => (
                  <div key={`nw-${idx}`} className="relative w-20 h-20 border rounded-lg overflow-hidden group">
                    <img src={URL.createObjectURL(file)} onClick={() => setPreviewImageUrl(URL.createObjectURL(file))} className="w-full h-full object-cover cursor-pointer" />
                    <button type="button" onClick={() => setImageFiles(prev => prev.filter((_, i) => i !== idx))} className="absolute top-0 right-0 bg-red-500 text-white w-5 h-5 text-[10px] hidden group-hover:block">✕</button>
                  </div>
                ))}
              </div>
            </div>

            {/* 과거 사진 데이터 모아보기 */}
            <div className="flex-1 flex flex-col bg-slate-100 border border-slate-200 rounded-xl p-3 overflow-hidden">
              <label className="text-xs font-bold text-slate-600 mb-2">🎞️ 사진 데이터 (최신-과거순)</label>
              <div className="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-3 gap-2 content-start pr-1">
                {patientPastPhotos.length === 0 ? <div className="col-span-full text-center text-xs text-slate-400 py-8">선택된 환자의 과거 사진이 없습니다.</div> : 
                  patientPastPhotos.map((photo, idx) => (
                    <div key={idx} className="relative aspect-square border border-slate-300 rounded-lg overflow-hidden bg-white group cursor-pointer" onClick={() => setPreviewImageUrl(photo.url)}>
                      <img src={photo.url} className="w-full h-full object-cover group-hover:scale-110 transition" />
                      <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] px-1 py-0.5 truncate">{photo.date}</div>
                    </div>
                  ))
                }
              </div>
            </div>
          </div>

        </form>
      )}

      {/* 2. 전체 기록 조회 탭 */}
      {activeTab === "history" && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 overflow-y-auto flex-1">
          <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
            <h2 className="text-lg font-bold text-slate-900">전체 상담 기록 조회 ({filteredConsultations.length}건)</h2>
            <input type="text" placeholder="환자명, 증상, 처방약 검색..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full md:w-80 px-4 py-2.5 bg-slate-50 border rounded-xl text-sm" />
          </div>
          <div className="space-y-3">
            {filteredConsultations.map((c) => (
              <div key={c.id} className="p-4 bg-white border rounded-xl shadow-xs hover:shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{c.patients?.name || "알 수 없음"}</span>
                    <span className="text-xs text-slate-500">({c.consultation_date || c.created_at.split('T')[0]})</span>
                  </div>
                  <p className="text-sm font-semibold"><span className="text-slate-400">증상:</span> {c.symptoms}</p>
                  <p className="text-sm font-bold text-teal-800"><span className="text-slate-400">처방:</span> {c.prescription}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setSelectedDetailConsultation(c)} className="px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg">자세히</button>
                  <button onClick={() => handleEditClick(c)} className="px-3 py-1.5 bg-teal-50 text-teal-800 text-xs font-bold rounded-lg">수정</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 라이트박스 팝업 */}
      {previewImageUrl && (
        <div onClick={() => setPreviewImageUrl(null)} className="fixed inset-0 z-[100] bg-slate-950/80 flex items-center justify-center p-4 cursor-pointer">
          <img src={previewImageUrl} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
          <button onClick={() => setPreviewImageUrl(null)} className="absolute top-4 right-4 text-white bg-slate-800 w-10 h-10 rounded-full font-bold">✕</button>
        </div>
      )}
    </div>
  );
}