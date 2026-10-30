"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/app/lib/supabase";
import { useRouter } from "next/navigation";

export default function ConsultationsWritePage() {
  const router = useRouter();
  const [patients, setPatients] = useState<any[]>([]);
  const [patientHistory, setPatientHistory] = useState<any[]>([]);
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
  const [paymentMethod, setPaymentMethod] = useState("");

  // 🟢 수식 계산기 상태
  const [calculatorInput, setCalculatorInput] = useState("");
  const [calculatorResult, setCalculatorResult] = useState<number | null>(null);

  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([]);
  const [existingImagePreviews, setExistingImagePreviews] = useState<{ path: string; url: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  const formatPatientDisplayName = (p: any) => {
    if (!p) return "";
    return p.custom_id ? `${p.name} (${p.custom_id})` : p.name;
  };

  useEffect(() => {
    setConsultationDate(new Date().toISOString().split('T')[0]);
    fetchPatients();
  }, []);

  useEffect(() => {
    if (selectedPatient) {
      fetchPatientHistory(selectedPatient);
    } else {
      setPatientHistory([]);
    }
  }, [selectedPatient]);

  const fetchPatients = async () => {
    const { data } = await supabase.from("patients").select("*").order("name");
    if (data) setPatients(data);
  };

  const fetchPatientHistory = async (patientId: string) => {
    const { data } = await supabase
      .from("consultations")
      .select("*")
      .eq("patient_id", patientId)
      .order("consultation_date", { ascending: false });
    if (data) setPatientHistory(data);
  };

  // 🟢 실시간 수식 계산 로직
  useEffect(() => {
    if (!calculatorInput.trim()) {
      setCalculatorResult(null);
      return;
    }
    try {
      const sanitized = calculatorInput.replace(/[^0-9+\-*/().]/g, "");
      if (sanitized) {
        // eslint-disable-next-line no-new-func
        const result = new Function(`return ${sanitized}`)();
        if (Number.isFinite(result)) {
          setCalculatorResult(Math.round(result));
        } else {
          setCalculatorResult(null);
        }
      } else {
        setCalculatorResult(null);
      }
    } catch {
      setCalculatorResult(null);
    }
  }, [calculatorInput]);

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
      
      const parsedFeedbackDays = parseInt(feedbackDays);
      const finalFeedbackDays = (!isNaN(parsedFeedbackDays) && parsedFeedbackDays > 0) ? parsedFeedbackDays : null;

      const payload = {
        patient_id: selectedPatient,
        consultation_date: consultationDate,
        symptoms, digestion_stool: digestionStool, sleep_state: sleepState,
        symptom_detail: symptomDetail, prescription, consult_memo: consultMemo, follow_up: followUp,
        feedback_days: finalFeedbackDays,
        amount: amount ? parseInt(amount) : null,
        payment_method: paymentMethod || null, 
        image_urls: finalImagePaths, user_id: user.id,
      };

      const { error } = await supabase.from("consultations").insert([payload]);
      if (error) alert("등록 실패: " + error.message);
      else { 
        alert("등록되었습니다."); 
        router.push("/consultations/history"); 
      }
    } finally {
      setUploading(false);
    }
  };

  const patientPastPhotos = patientHistory.flatMap(c => 
    (Array.isArray(c.image_urls) ? c.image_urls : []).map((path: string) => ({ path, date: c.consultation_date || c.created_at?.split('T')[0] || "" }))
  );

  const filteredPatients = patients.filter(p => {
    if (!patientSearchQuery) return true;
    const term = patientSearchQuery.toLowerCase();
    return p.name?.toLowerCase().includes(term) || p.custom_id?.toLowerCase().includes(term) || p.phone?.includes(term);
  });

  const totalCurrentPhotos = existingImagePreviews.length + imageFiles.length;

  return (
    <div className="w-full flex flex-col space-y-4 pb-12 max-w-[1600px] mx-auto" onPaste={handlePaste}>
      
      {/* 상단 타이틀 및 이동 버튼 */}
      <div className="flex justify-between items-center bg-white px-6 py-4 rounded-2xl shadow-sm border border-slate-200">
        <h1 className="text-xl font-extrabold text-slate-900">새 상담 작성</h1>
        <button onClick={() => router.push("/consultations/history")} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition">
          기록 조회로 가기 →
        </button>
      </div>

      <form onSubmit={handleSubmitConsultation} className="flex flex-col lg:flex-row gap-6 w-full">
        
        {/* 왼쪽: 텍스트 입력 폼 영역 */}
        <div className="flex-[2] flex flex-col gap-3 bg-white p-4 sm:p-6 rounded-3xl border border-slate-200 shadow-sm">
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

          {/* 증상 상세와 최근 방문내역 영역 */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 flex flex-col">
              <label className="text-xs font-bold text-blue-700 mb-1">증상 상세</label>
              <textarea value={symptomDetail} onChange={(e) => setSymptomDetail(e.target.value)} className="w-full h-64 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 resize-none" />
            </div>
            <div className="flex-1 flex flex-col">
              <label className="text-xs font-bold text-slate-900 mb-1">최근 방문내역</label>
              <div className="w-full h-64 border border-slate-200 rounded-xl overflow-y-auto bg-white p-1 text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 sticky top-0 text-slate-900 font-bold">
                    <tr><th className="p-1.5">날짜</th><th className="p-1.5 text-slate-900 font-bold">주호소</th><th className="p-1.5 text-slate-900 font-bold">처방</th></tr>
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

          <div className="flex flex-col xl:flex-row gap-3 pt-2 items-start xl:items-center justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-700">피드백(일)</label>
                <input type="text" inputMode="numeric" pattern="[0-9]*" placeholder="0입력시 제외" value={feedbackDays} onChange={(e) => setFeedbackDays(e.target.value.replace(/[^0-9]/g, ''))} className="w-24 p-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900" />
              </div>

              <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 pl-2">계산기</span>
                <input type="text" placeholder="ex) 4000+6000" value={calculatorInput} onChange={(e) => setCalculatorInput(e.target.value)} className="w-28 p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:border-teal-500" />
                <div className="text-xs font-bold text-teal-800 min-w-[50px]">
                  {calculatorResult !== null ? `= ${calculatorResult.toLocaleString()}` : "="}
                </div>
                <button type="button" onClick={() => { if (calculatorResult !== null) setAmount(calculatorResult.toString()); }} disabled={calculatorResult === null} className="px-2 py-1.5 bg-teal-600 text-white text-[10px] font-bold rounded-lg hover:bg-teal-700 disabled:opacity-50 transition">
                  적용
                </button>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-700 pl-1">최종 금액</label>
                <input type="text" inputMode="numeric" pattern="[0-9]*" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))} className="w-24 p-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900" />
              </div>
              
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-700">결제방식</label>
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none cursor-pointer">
                  <option value="">선택</option>
                  <option value="링크">링크</option>
                  <option value="홈피">홈피</option>
                  <option value="매장">매장</option>
                  <option value="입금">입금</option>
                  <option value="현금">현금</option>
                  <option value="사업자">사업자</option>
                </select>
              </div>
            </div>

            <div className="w-full xl:w-auto flex gap-2">
              <button type="submit" disabled={uploading} className="w-full xl:w-auto px-6 py-3 bg-teal-900 hover:bg-teal-800 text-white font-bold rounded-xl transition disabled:opacity-50 shadow-sm text-sm">
                {uploading ? "저장 중..." : "상담 등록"}
              </button>
            </div>
          </div>
        </div>

        {/* 오른쪽: 사진 뷰어 영역 */}
        <div className="flex-1 flex flex-col gap-4 min-w-[280px]">
          <div className="flex flex-col bg-white border border-slate-200 rounded-3xl p-4 shadow-sm">
            <div className="flex justify-between items-center mb-3">
              <label className="text-xs font-bold text-slate-900">📸 현재 상담 사진 첨부</label>
              <label className="cursor-pointer px-3 py-2 bg-teal-800 text-white rounded-xl text-xs font-bold hover:bg-teal-700 transition shadow-xs flex items-center gap-1">
                <span>📁 사진 선택</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { if(e.target.files) setImageFiles(prev => [...prev, ...Array.from(e.target.files!)]) }} />
              </label>
            </div>
            
            <div className="border-2 border-dashed border-slate-300 bg-slate-50 rounded-2xl p-3 flex flex-col gap-3 min-h-[200px] justify-center items-center">
              {totalCurrentPhotos === 0 && (
                <div className="text-center text-xs font-bold text-slate-500 py-6">버튼을 눌러 사진을 선택하거나<br/>화면에 [Ctrl+V]를 누르세요.</div>
              )}
              {totalCurrentPhotos > 0 && (
                <div className={`w-full ${totalCurrentPhotos > 1 ? "grid grid-cols-2 gap-3" : "flex justify-center"}`}>
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

          <div className="flex flex-col bg-slate-100 border border-slate-200 rounded-3xl p-4 shadow-sm">
            <label className="text-xs font-bold text-slate-800 mb-3 flex-shrink-0">🎞️ 과거 사진 데이터 모아보기</label>
            <div className="max-h-[320px] overflow-y-auto pr-1">
              {patientPastPhotos.length === 0 ? (
                <div className="w-full text-center text-xs text-slate-500 font-semibold py-6">선택된 환자의 과거 사진이 없습니다.</div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {patientPastPhotos.map((photo, idx) => (
                    <div key={idx} className="relative w-full aspect-square flex items-center justify-center group bg-white rounded-xl shadow-2xs border border-slate-300 p-1 cursor-pointer" onClick={() => setPreviewImageUrl(photo.url)}>
                      <div className="absolute bottom-1 left-1 right-1 bg-black/70 text-white text-[10px] font-semibold px-2 py-1 truncate rounded">{photo.date}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

      </form>
    </div>
  );
}