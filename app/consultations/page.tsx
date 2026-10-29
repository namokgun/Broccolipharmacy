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
  const [historyDetailModal, setHistoryDetailModal] = useState<any | null>(null);

  const [patientSearchQuery, setPatientSearchQuery] = useState("");
  const [isPatientDropdownOpen, setIsPatientDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 📝 폼 상태값
  const [selectedPatient, setSelectedPatient] = useState("");
  const [selectedPatientNameDisplay, setSelectedPatientNameDisplay] = useState("");
  const [consultationDate, setConsultationDate] = useState(""); 
  
  const [symptoms, setSymptoms] = useState(""); 
  const [digestionStool, setDigestionStool] = useState(""); 
  const [sleepState, setSleepState] = useState(""); 
  const [symptomDetail, setSymptomDetail] = useState(""); 
  const [prescription, setPrescription] = useState(""); 
  const [consultMemo, setConsultMemo] = useState(""); 
  const [followUp, setFollowUp] = useState(""); 
  const [feedbackDays, setFeedbackDays] = useState(""); 
  const [amount, setAmount] = useState(""); 
  const [paymentMethod, setPaymentMethod] = useState(""); // 결제방식 상태

  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([]);
  const [existingImagePreviews, setExistingImagePreviews] = useState<{ path: string; url: string }[]>([]);
  const [uploading, setUploading] = useState(false);

  const formatPatientDisplayName = (p: any) => {
    if (!p) return "";
    return p.custom_id ? `${p.name} (${p.custom_id})` : p.name;
  };

  useEffect(() => {
    const handleHashCheck = () => {
      if (window.location.hash === "#history") {
        setActiveTab("history");
      } else {
        setActiveTab("write");
      }
    };
    handleHashCheck();
    window.addEventListener("hashchange", handleHashCheck);
    return () => window.removeEventListener("hashchange", handleHashCheck);
  }, []);

  useEffect(() => {
    setConsultationDate(new Date().toISOString().split('T')[0]);
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: pData } = await supabase.from("patients").select("*").order("name");
      if (pData) setPatients(pData);

      const { data: cData, error: cError } = await supabase
        .from("consultations")
        .select("*, patients(name, custom_id, gender, birth_year, phone)");
      
      if (cError) {
        console.error("상담 기록 조회 실패:", cError.message);
        return;
      }

      if (cData) {
        // 🟢 상담일(consultation_date) 기준 최신순(내림차순) 정렬 적용
        const sortedData = cData.sort((a, b) => {
          const dateA = new Date(a.consultation_date || a.created_at).getTime();
          const dateB = new Date(b.consultation_date || b.created_at).getTime();
          
          // 상담일이 같으면 데이터를 등록한 시간(created_at) 기준으로 최신순 정렬
          if (dateA === dateB) {
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          }
          return dateB - dateA;
        });

        const consultationsWithSignedUrls = await Promise.all(
          sortedData.map(async (c) => {
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
        setConsultations(consultationsWithSignedUrls);
      }
    } catch (error) {
      console.error("데이터 불러오기 오류:", error);
    }
  };

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
    if (files.length > 0) setImageFiles(prev => [...prev, ...files]);
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
        symptoms, digestion_stool: digestionStool, sleep_state: sleepState,
        symptom_detail: symptomDetail, prescription, consult_memo: consultMemo, follow_up: followUp,
        feedback_days: feedbackDays ? parseInt(feedbackDays) : null,
        amount: amount ? parseInt(amount) : null,
        payment_method: paymentMethod || null, 
        image_urls: finalImagePaths, user_id: user.id,
      };

      if (editingId) {
        const { error } = await supabase.from("consultations").update(payload).eq("id", editingId);
        if (error) alert("수정 실패: " + error.message);
        else { alert("수정되었습니다."); resetForm(); window.location.hash = "history"; setActiveTab("history"); fetchData(); }
      } else {
        const { error } = await supabase.from("consultations").insert([payload]);
        if (error) alert("등록 실패: " + error.message);
        else { alert("등록되었습니다."); resetForm(); window.location.hash = "history"; setActiveTab("history"); fetchData(); }
      }
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteConsultation = async (id: string) => {
    if (!window.confirm("정말로 이 상담 기록을 삭제하시겠습니까?")) return;
    const { error } = await supabase.from("consultations").delete().eq("id", id);
    if (error) alert("삭제 실패: " + error.message);
    else { alert("삭제되었습니다."); resetForm(); fetchData(); }
  };

  const resetForm = () => {
    setEditingId(null); setSelectedPatient(""); setSelectedPatientNameDisplay(""); setPatientSearchQuery("");
    setConsultationDate(new Date().toISOString().split('T')[0]);
    setSymptoms(""); setDigestionStool(""); setSleepState(""); setSymptomDetail(""); 
    setPrescription(""); setConsultMemo(""); setFollowUp(""); setFeedbackDays(""); setAmount("");
    setPaymentMethod(""); 
    setImageFiles([]); setExistingImageUrls([]); setExistingImagePreviews([]);
  };

  const handleEditClick = async (c: any) => {
    setEditingId(c.id);
    setSelectedPatient(c.patient_id || "");
    setSelectedPatientNameDisplay(formatPatientDisplayName(c.patients));
    setConsultationDate(c.consultation_date || c.created_at.split('T')[0]);
    setSymptoms(c.symptoms || ""); setDigestionStool(c.digestion_stool || ""); setSleepState(c.sleep_state || "");
    setSymptomDetail(c.symptom_detail || ""); setPrescription(c.prescription || ""); setConsultMemo(c.consult_memo || "");
    setFollowUp(c.follow_up || "");
    setFeedbackDays(c.feedback_days ? c.feedback_days.toString() : ""); 
    setAmount(c.amount != null ? c.amount.toString() : "");
    setPaymentMethod(c.payment_method || ""); 
    
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
    window.location.hash = "";
    setActiveTab("write");
  };

  const patientHistory = selectedPatient ? consultations.filter(c => c.patient_id === selectedPatient && c.id !== editingId) : [];
  const patientPastPhotos = patientHistory.flatMap(c => 
    (Array.isArray(c.display_image_urls) ? c.display_image_urls : []).map((url: string) => ({ url, date: c.consultation_date || c.created_at?.split('T')[0] || "", symptoms: c.symptoms }))
  );

  const filteredPatients = patients.filter(p => {
    if (!patientSearchQuery) return true;
    const term = patientSearchQuery.toLowerCase();
    return p.name?.toLowerCase().includes(term) || p.custom_id?.toLowerCase().includes(term) || p.phone?.includes(term);
  });

  const filteredConsultations = consultations.filter(c => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return c.patients?.name?.toLowerCase().includes(term) || 
           c.symptoms?.toLowerCase().includes(term) || 
           c.prescription?.toLowerCase().includes(term);
  });

  const totalCurrentPhotos = existingImagePreviews.length + imageFiles.length;

  return (
    <div className="w-full flex flex-col space-y-4 pb-12" onPaste={handlePaste}>
      {/* 상단 탭 헤더 */}
      <div className="flex gap-2 border-b pb-2 flex-shrink-0">
        <button onClick={() => { resetForm(); window.location.hash = ""; setActiveTab("write"); }} className={`px-4 py-2 rounded-lg font-bold text-sm transition ${activeTab === "write" ? "bg-teal-900 text-white" : "bg-white text-slate-600 border"}`}>📝 상담작성</button>
        <button onClick={() => { window.location.hash = "history"; setActiveTab("history"); }} className={`px-4 py-2 rounded-lg font-bold text-sm transition ${activeTab === "history" ? "bg-teal-900 text-white" : "bg-white text-slate-600 border"}`}>📂 기록 조회 ({filteredConsultations.length})</button>
      </div>

      {activeTab === "write" && (
        <form onSubmit={handleSubmitConsultation} className="flex flex-col lg:flex-row gap-6 w-full">
          
          {/* 🟢 왼쪽: 텍스트 입력 폼 영역 */}
          <div className="flex-[2] flex flex-col gap-3 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex flex-col sm:flex-row gap-2 relative z-25" ref={dropdownRef}>
              <div className="flex-1">
                <div onClick={() => setIsPatientDropdownOpen(true)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer flex justify-between items-center text-sm font-bold text-slate-900">
                  <span>{selectedPatientNameDisplay || "환자 선택 (이름 검색)..."}</span>
                  <span className="text-xs">▼</span>
                </div>
                {isPatientDropdownOpen && (
                  <div className="absolute top-full left-0 w-full sm:w-[60%] mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto p-2 z-30">
                    <input type="text" placeholder="이름 또는 아이디 검색..." value={patientSearchQuery} onChange={(e) => setPatientSearchQuery(e.target.value)} className="w-full p-2.5 mb-1 bg-slate-50 border rounded-lg text-sm font-bold text-slate-900 focus:outline-none" autoFocus />
                    {filteredPatients.map(p => (
                      <div key={p.id} onClick={() => { setSelectedPatient(p.id); setSelectedPatientNameDisplay(formatPatientDisplayName(p)); setIsPatientDropdownOpen(false); }} className="p-2.5 hover:bg-teal-50 rounded-lg cursor-pointer text-sm font-bold text-slate-900 flex justify-between items-center">
                        <span>{formatPatientDisplayName(p)}</span>
                        <span className="text-xs font-normal text-slate-600">({p.gender}/{p.birth_year || "-"})</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <input type="date" value={consultationDate} onChange={(e) => setConsultationDate(e.target.value)} className="w-full sm:w-44 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900" required />
            </div>

            <div className="flex items-center gap-2">
              <label className="w-16 text-xs font-bold text-slate-700 shrink-0">주호소</label>
              <input type="text" value={symptoms} onChange={(e) => setSymptoms(e.target.value)} className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900" />
            </div>
            <div className="flex items-center gap-2">
              <label className="w-16 text-xs font-bold text-slate-700 shrink-0">소화배변</label>
              <input type="text" value={digestionStool} onChange={(e) => setDigestionStool(e.target.value)} className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900" />
            </div>
            <div className="flex items-center gap-2">
              <label className="w-16 text-xs font-bold text-slate-700 shrink-0">수면상태</label>
              <input type="text" value={sleepState} onChange={(e) => setSleepState(e.target.value)} className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900" />
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 flex flex-col">
                <label className="text-xs font-bold text-blue-700 mb-1">증상 상세</label>
                <textarea value={symptomDetail} onChange={(e) => setSymptomDetail(e.target.value)} className="w-full h-28 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 resize-none" />
              </div>
              <div className="flex-1 flex flex-col">
                <label className="text-xs font-bold text-slate-900 mb-1">최근 방문내역</label>
                <div className="w-full h-28 border border-slate-200 rounded-xl overflow-y-auto bg-white p-1 text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-slate-100 sticky top-0 text-slate-900 font-bold">
                      <tr><th className="p-1.5"></th><th className="p-1.5 text-slate-900 font-bold">주호소</th><th className="p-1.5 text-slate-900 font-bold">처방</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {patientHistory.length === 0 ? <tr><td colSpan={3} className="text-center p-4 text-slate-400">내역 없음</td></tr> : 
                        patientHistory.map(h => (
                          <tr key={h.id} className="hover:bg-teal-50 cursor-pointer" onClick={() => setHistoryDetailModal(h)}>
                            <td className="p-1 font-semibold text-slate-800">{h.consultation_date?.slice(2) || h.created_at.slice(2,10)}</td>
                            <td className="p-1 truncate max-w-[80px] font-bold text-slate-900">{h.symptoms}</td>
                            <td className="p-1 truncate max-w-[80px] text-teal-900 font-bold">{h.prescription}</td>
                          </tr>
                        ))
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 flex flex-col">
                <label className="text-xs font-bold text-teal-900 mb-1">처방</label>
                <textarea value={prescription} onChange={(e) => setPrescription(e.target.value)} className="w-full h-28 p-3 bg-teal-50/80 border-2 border-teal-500 rounded-xl text-sm font-bold text-teal-950 resize-none shadow-xs" placeholder="처방 내용 입력..." />
              </div>
              <div className="flex-1 flex flex-col">
                <label className="text-xs font-bold text-slate-700 mb-1">코멘트</label>
                <textarea value={consultMemo} onChange={(e) => setConsultMemo(e.target.value)} className="w-full h-28 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 resize-none" />
              </div>
              <div className="flex-1 flex flex-col">
                <label className="text-xs font-bold text-purple-800 mb-1">추후관리</label>
                <textarea value={followUp} onChange={(e) => setFollowUp(e.target.value)} className="w-full h-28 p-3 bg-purple-50/50 border border-purple-200 rounded-xl text-sm font-semibold text-slate-900 resize-none" placeholder="추후관리 내용..." />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-700">피드백(일)</label>
                <input type="text" inputMode="numeric" pattern="[0-9]*" value={feedbackDays} onChange={(e) => setFeedbackDays(e.target.value.replace(/[^0-9]/g, ''))} className="w-20 p-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900" />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-700">금액</label>
                <input type="text" inputMode="numeric" pattern="[0-9]*" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))} className="w-28 p-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900" />
              </div>
              
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-700">결제방식</label>
                <select 
                  value={paymentMethod} 
                  onChange={(e) => setPaymentMethod(e.target.value)} 
                  className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none cursor-pointer"
                >
                  <option value="">선택</option>
                  <option value="링크">링크</option>
                  <option value="홈피">홈피</option>
                  <option value="매장">매장</option>
                  <option value="입금">입금</option>
                  <option value="현명">현명</option>
                  <option value="사업자">사업자</option>
                </select>
              </div>

              <div className="hidden sm:block flex-1 text-right text-xs text-slate-400">※ [Ctrl+V] 사진 붙여넣기</div>
              
              <div className="w-full sm:w-auto flex gap-2 pt-2 sm:pt-0 ml-auto">
                {editingId && (
                  <button type="button" onClick={() => handleDeleteConsultation(editingId)} className="flex-1 sm:flex-none px-4 py-3 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-xl transition text-sm">삭제</button>
                )}
                <button type="submit" disabled={uploading} className="flex-1 sm:flex-none px-6 py-3 bg-teal-900 hover:bg-teal-800 text-white font-bold rounded-xl transition disabled:opacity-50 shadow-sm text-sm">
                  {uploading ? "저장 중..." : (editingId ? "수정 저장" : "상담 등록")}
                </button>
              </div>
            </div>
          </div>

          {/* 🟢 오른쪽: 사진 뷰어 영역 (과거 사진 스크롤 기능 적용) */}
          <div className="flex-1 flex flex-col gap-4 min-w-[280px]">
            <div className="flex flex-col bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <div className="flex justify-between items-center mb-3">
                <label className="text-xs font-bold text-slate-900">📸 현재 상담 사진 첨부</label>
                <label className="cursor-pointer px-3 py-2 bg-teal-800 text-white rounded-xl text-xs font-bold hover:bg-teal-700 transition shadow-xs flex items-center gap-1">
                  <span>📁 사진 선택</span>
                  <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { if(e.target.files) setImageFiles(prev => [...prev, ...Array.from(e.target.files!)]) }} />
                </label>
              </div>
              
              <div className="border-2 border-dashed border-slate-300 bg-slate-50 rounded-xl p-3 flex flex-col gap-3 min-h-[200px] justify-center items-center">
                {totalCurrentPhotos === 0 && (
                  <div className="text-center text-xs font-bold text-slate-500 py-6">버튼을 눌러 사진을 선택하거나<br/>화면에 [Ctrl+V]를 누르세요.</div>
                )}
                {totalCurrentPhotos > 0 && (
                  <div className={`w-full ${totalCurrentPhotos > 1 ? "grid grid-cols-2 gap-3" : "flex justify-center"}`}>
                    {existingImagePreviews.map((item, idx) => (
                      <div key={`ex-${idx}`} className="relative w-full aspect-square flex items-center justify-center group bg-white rounded-xl shadow-xs border border-slate-200 p-1">
                        <img src={item.url} onClick={() => setPreviewImageUrl(item.url)} className="max-w-full max-h-full object-contain cursor-pointer hover:scale-105 transition rounded-lg" />
                        <button type="button" onClick={() => { setExistingImageUrls(prev => prev.filter((_, i) => i !== idx)); setExistingImagePreviews(prev => prev.filter((_, i) => i !== idx)); }} className="absolute top-2 right-2 bg-red-600 text-white w-7 h-7 rounded-full text-xs hidden group-hover:flex items-center justify-center font-bold shadow-md z-10">✕</button>
                      </div>
                    ))}
                    {imageFiles.map((file, idx) => (
                      <div key={`nw-${idx}`} className="relative w-full aspect-square flex items-center justify-center group bg-white rounded-xl shadow-xs border border-teal-400 p-1">
                        <img src={URL.createObjectURL(file)} onClick={() => setPreviewImageUrl(URL.createObjectURL(file))} className="max-w-full max-h-full object-contain cursor-pointer hover:scale-105 transition rounded-lg" />
                        <button type="button" onClick={() => setImageFiles(prev => prev.filter((_, i) => i !== idx))} className="absolute top-2 right-2 bg-red-600 text-white w-7 h-7 rounded-full text-xs hidden group-hover:flex items-center justify-center font-bold shadow-md z-10">✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col bg-slate-100 border border-slate-200 rounded-2xl p-4 shadow-sm">
              <label className="text-xs font-bold text-slate-800 mb-3 flex-shrink-0">🎞️ 과거 사진 데이터 모아보기</label>
              <div className="max-h-[320px] overflow-y-auto pr-1">
                {patientPastPhotos.length === 0 ? (
                  <div className="w-full text-center text-xs text-slate-500 font-semibold py-6">선택된 환자의 과거 사진이 없습니다.</div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {patientPastPhotos.map((photo, idx) => (
                      <div key={idx} className="relative w-full aspect-square flex items-center justify-center group bg-white rounded-xl shadow-2xs border border-slate-300 p-1 cursor-pointer" onClick={() => setPreviewImageUrl(photo.url)}>
                        <img src={photo.url} className="max-w-full max-h-full object-contain group-hover:scale-105 transition rounded-lg" />
                        <div className="absolute bottom-1 left-1 right-1 bg-black/70 text-white text-[10px] font-semibold px-2 py-1 truncate rounded">{photo.date}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </form>
      )}

      {/* 2. 전체 기록 조회 탭 */}
      {activeTab === "history" && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 sm:p-6 flex-1">
          <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
            <h2 className="text-lg font-bold text-slate-900">전체 상담 기록 조회 ({filteredConsultations.length}건)</h2>
            <input type="text" placeholder="환자명, 주호소, 처방약 검색..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full sm:w-80 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
          </div>
          <div className="space-y-3">
            {filteredConsultations.map((c) => (
              <div key={c.id} className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs hover:shadow-md flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{formatPatientDisplayName(c.patients)}</span>
                    <span className="text-xs text-slate-600 font-semibold">({c.consultation_date || c.created_at.split('T')[0]})</span>
                  </div>
                  <p className="text-sm font-bold text-slate-800"><span className="text-slate-400 font-normal">주호소:</span> {c.symptoms}</p>
                  <p className="text-sm font-bold text-teal-900"><span className="text-slate-400 font-normal">처방:</span> {c.prescription}</p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button onClick={() => setSelectedDetailConsultation(c)} className="px-3.5 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-200 transition">자세히</button>
                  <button onClick={() => handleEditClick(c)} className="px-3.5 py-2 bg-teal-50 text-teal-800 text-xs font-bold rounded-xl hover:bg-teal-100 transition">수정</button>
                  <button onClick={() => handleDeleteConsultation(c.id)} className="px-3.5 py-2 bg-red-50 text-red-600 text-xs font-bold rounded-xl hover:bg-red-100 transition">삭제</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 기록 조회 탭 [자세히] 상세 팝업 */}
      {selectedDetailConsultation && (
        <div onClick={() => setSelectedDetailConsultation(null)} className="fixed inset-0 z-[110] bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer">
          <div className="bg-white w-full max-w-xl max-h-[85vh] rounded-3xl p-6 shadow-2xl border border-slate-200 flex flex-col space-y-4 cursor-default" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">📄 상담 상세 내역</h3>
                <p className="text-xs text-slate-500">환자: <strong className="text-slate-800">{formatPatientDisplayName(selectedDetailConsultation.patients)}</strong> | 내방일: {selectedDetailConsultation.consultation_date || selectedDetailConsultation.created_at.split('T')[0]}</p>
              </div>
              <button onClick={() => setSelectedDetailConsultation(null)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-200">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 bg-slate-50 rounded-xl border"><span className="text-xs font-bold text-slate-400 block mb-0.5">주호소</span><span className="font-semibold text-slate-800">{selectedDetailConsultation.symptoms || "-"}</span></div>
                <div className="p-3 bg-slate-50 rounded-xl border">
                  <span className="text-xs font-bold text-slate-400 block mb-0.5">결제 금액/방식</span>
                  <span className="font-semibold text-purple-800">
                    {selectedDetailConsultation.amount ? `${selectedDetailConsultation.amount.toLocaleString()}원` : "-"} 
                    {selectedDetailConsultation.payment_method ? ` (${selectedDetailConsultation.payment_method})` : ""}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 bg-slate-50 rounded-xl border"><span className="text-xs font-bold text-slate-400 block mb-0.5">소화배변</span><span className="font-semibold text-slate-800">{selectedDetailConsultation.digestion_stool || "-"}</span></div>
                <div className="p-3 bg-slate-50 rounded-xl border"><span className="text-xs font-bold text-slate-400 block mb-0.5">수면상태</span><span className="font-semibold text-slate-800">{selectedDetailConsultation.sleep_state || "-"}</span></div>
              </div>
              {selectedDetailConsultation.symptom_detail && (
                <div className="p-3 bg-slate-50 rounded-xl border"><span className="text-xs font-bold text-slate-400 block mb-0.5">증상 상세</span><p className="text-slate-800 whitespace-pre-line">{selectedDetailConsultation.symptom_detail}</p></div>
              )}
              {selectedDetailConsultation.prescription && (
                <div className="p-3 bg-teal-50/60 rounded-xl border border-teal-200"><span className="text-xs font-bold text-teal-700 block mb-0.5">처방 내용</span><p className="font-bold text-teal-950 whitespace-pre-line">{selectedDetailConsultation.prescription}</p></div>
              )}
              {selectedDetailConsultation.consult_memo && (
                <div className="p-3 bg-slate-50 rounded-xl border"><span className="text-xs font-bold text-slate-400 block mb-0.5">코멘트</span><p className="text-slate-800 whitespace-pre-line">{selectedDetailConsultation.consult_memo}</p></div>
              )}
              {selectedDetailConsultation.follow_up && (
                <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-200"><span className="text-xs font-bold text-purple-700 block mb-0.5">추후관리</span><p className="font-bold text-purple-950 whitespace-pre-line">{selectedDetailConsultation.follow_up}</p></div>
              )}
              {selectedDetailConsultation.display_image_urls && selectedDetailConsultation.display_image_urls.length > 0 && (
                <div className="p-3 bg-slate-50 rounded-xl border space-y-2">
                  <span className="text-xs font-bold text-slate-500 block">첨부된 사진 ({selectedDetailConsultation.display_image_urls.length}장)</span>
                  <div className="grid grid-cols-2 gap-4 items-start">
                    {selectedDetailConsultation.display_image_urls.map((imgUrl: string, imgIdx: number) => (
                      <div key={imgIdx} className="relative w-full border rounded-xl overflow-hidden bg-white cursor-pointer" onClick={() => setPreviewImageUrl(imgUrl)}>
                        <img src={imgUrl} className="w-full h-auto block hover:scale-105 transition" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-between pt-2 border-t">
              <button onClick={() => { handleDeleteConsultation(selectedDetailConsultation.id); setSelectedDetailConsultation(null); }} className="px-4 py-2.5 bg-red-50 text-red-600 font-bold rounded-xl text-sm hover:bg-red-100">기록 삭제</button>
              <button onClick={() => setSelectedDetailConsultation(null)} className="px-5 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800">확인 완료</button>
            </div>
          </div>
        </div>
      )}

      {/* 최근방문내역 팝업 (작성 폼 쪽) */}
      {historyDetailModal && (
        <div onClick={() => setHistoryDetailModal(null)} className="fixed inset-0 z-[110] bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4 cursor-default" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">📅 과거 방문 상세 내역</h3>
                <p className="text-xs text-slate-500">내방일: {historyDetailModal.consultation_date || historyDetailModal.created_at.split('T')[0]}</p>
              </div>
              <button onClick={() => setHistoryDetailModal(null)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-200">✕</button>
            </div>
            <div className="space-y-3 text-sm max-h-[60vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 bg-slate-50 rounded-xl border"><span className="text-xs font-bold text-slate-400 block mb-0.5">주호소</span><span className="font-semibold text-slate-800">{historyDetailModal.symptoms || "-"}</span></div>
                <div className="p-3 bg-slate-50 rounded-xl border">
                  <span className="text-xs font-bold text-slate-400 block mb-0.5">결제 금액/방식</span>
                  <span className="font-semibold text-slate-800">
                    {historyDetailModal.amount ? `${historyDetailModal.amount.toLocaleString()}원` : "-"}
                    {historyDetailModal.payment_method ? ` (${historyDetailModal.payment_method})` : ""}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 bg-slate-50 rounded-xl border"><span className="text-xs font-bold text-slate-400 block mb-0.5">소화배변</span><span className="font-semibold text-slate-800">{historyDetailModal.digestion_stool || "-"}</span></div>
                <div className="p-3 bg-slate-50 rounded-xl border"><span className="text-xs font-bold text-slate-400 block mb-0.5">수면상태</span><span className="font-semibold text-slate-800">{historyDetailModal.sleep_state || "-"}</span></div>
              </div>
              {historyDetailModal.symptom_detail && (
                <div className="p-3 bg-slate-50 rounded-xl border"><span className="text-xs font-bold text-slate-400 block mb-0.5">증상 상세</span><p className="text-slate-800 whitespace-pre-line">{historyDetailModal.symptom_detail}</p></div>
              )}
              {historyDetailModal.prescription && (
                <div className="p-3 bg-teal-50/60 rounded-xl border border-teal-200"><span className="text-xs font-bold text-teal-700 block mb-0.5">처방 내용</span><p className="font-bold text-teal-950 whitespace-pre-line">{historyDetailModal.prescription}</p></div>
              )}
              {historyDetailModal.consult_memo && (
                <div className="p-3 bg-slate-50 rounded-xl border"><span className="text-xs font-bold text-slate-400 block mb-0.5">코멘트</span><p className="text-slate-800 whitespace-pre-line">{historyDetailModal.consult_memo}</p></div>
              )}
              {historyDetailModal.follow_up && (
                <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-200"><span className="text-xs font-bold text-purple-700 block mb-0.5">추후관리</span><p className="font-bold text-purple-950 whitespace-pre-line">{historyDetailModal.follow_up}</p></div>
              )}
            </div>
            <div className="flex justify-end pt-2">
              <button onClick={() => setHistoryDetailModal(null)} className="px-5 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800">확인 완료</button>
            </div>
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