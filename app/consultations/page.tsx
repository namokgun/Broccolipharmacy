"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { supabase } from "@/app/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";

function ConsultationsForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("id");

  const [patients, setPatients] = useState<any[]>([]);
  const [patientHistory, setPatientHistory] = useState<any[]>([]);
  const [historyDetailModal, setHistoryDetailModal] = useState<any | null>(null);

  const [patientSearchQuery, setPatientSearchQuery] = useState("");
  const [isPatientDropdownOpen, setIsPatientDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 📝 폼 상태값 (수면상태 제거, 소화배변은 설진 라벨로 사용됨)
  const [selectedPatient, setSelectedPatient] = useState("");
  const [selectedPatientNameDisplay, setSelectedPatientNameDisplay] = useState("");
  const [consultationDate, setConsultationDate] = useState(""); 
  
  const [symptoms, setSymptoms] = useState(""); 
  const [digestionStool, setDigestionStool] = useState(""); // 설진 데이터로 사용
  const [symptomDetail, setSymptomDetail] = useState(""); 
  const [prescription, setPrescription] = useState(""); 
  const [consultMemo, setConsultMemo] = useState(""); 
  const [followUp, setFollowUp] = useState(""); 
  const [feedbackDays, setFeedbackDays] = useState(""); 
  const [amount, setAmount] = useState(""); 
  const [paymentMethod, setPaymentMethod] = useState("");

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

  const resetForm = () => {
    setSelectedPatient("");
    setSelectedPatientNameDisplay("");
    setConsultationDate(new Date().toISOString().split('T')[0]);
    setSymptoms("");
    setDigestionStool(""); // 설진 초기화
    setSymptomDetail("");
    setPrescription("");
    setConsultMemo("");
    setFollowUp("");
    setFeedbackDays("");
    setAmount("");
    setPaymentMethod("");
    setImageFiles([]);
    setExistingImageUrls([]);
    setExistingImagePreviews([]);
    setCalculatorInput("");
    setCalculatorResult(null);
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  useEffect(() => {
    if (!editId) {
      resetForm();
    }
  }, [editId]);

  useEffect(() => {
    if (editId && patients.length > 0) {
      fetchConsultationForEdit(editId);
    }
  }, [editId, patients]);

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

  const fetchConsultationForEdit = async (id: string) => {
    const { data, error } = await supabase.from("consultations").select("*, patients(name, phone, custom_id)").eq("id", id).single();
    if (error) {
      console.error("수정 데이터 로딩 실패:", error.message);
      return;
    }
    if (data) {
      setSelectedPatient(data.patient_id);
      if (data.patients) setSelectedPatientNameDisplay(formatPatientDisplayName(data.patients));
      setConsultationDate(data.consultation_date || data.created_at?.split('T')[0] || "");
      setSymptoms(data.symptoms || "");
      setDigestionStool(data.digestion_stool || ""); // 설진 데이터 바인딩
      setSymptomDetail(data.symptom_detail || "");
      setPrescription(data.prescription || "");
      setConsultMemo(data.consult_memo || "");
      setFollowUp(data.follow_up || "");
      setFeedbackDays(data.feedback_days ? data.feedback_days.toString() : "");
      setAmount(data.amount ? data.amount.toString() : "");
      setPaymentMethod(data.payment_method || "");
      
      if (data.image_urls && Array.isArray(data.image_urls)) {
        setExistingImageUrls(data.image_urls);
        const previews = await Promise.all(
          data.image_urls.map(async (path: string) => {
            if (path.startsWith('http')) return { path, url: path };
            const { data: sData } = await supabase.storage.from("consultation-images").createSignedUrl(path, 60 * 60);
            return { path, url: sData?.signedUrl || '' };
          })
        );
        setExistingImagePreviews(previews.filter(p => p.url));
      }
    }
  };

  // 🟢 이전 사진 안 보임 버그 해결: 히스토리 데이터에도 Signed URL 발급 로직 추가
  const fetchPatientHistory = async (patientId: string) => {
    const { data } = await supabase
      .from("consultations")
      .select("*")
      .eq("patient_id", patientId)
      .order("consultation_date", { ascending: false });
    
    if (data) {
      const processedHistory = await Promise.all(data.map(async (c) => {
        if (c.image_urls && c.image_urls.length > 0) {
          const signedImages = await Promise.all(
            c.image_urls.map(async (path: string) => {
              if (path.startsWith('http')) return { url: path };
              const { data: sData } = await supabase.storage.from("consultation-images").createSignedUrl(path, 60 * 60);
              return { url: sData?.signedUrl || '' };
            })
          );
          return { ...c, display_images: signedImages.filter(img => img.url) };
        }
        return { ...c, display_images: [] };
      }));
      setPatientHistory(processedHistory);
    }
  };

  useEffect(() => {
    if (!calculatorInput.trim()) {
      setCalculatorResult(null);
      return;
    }
    try {
      const sanitized = calculatorInput.replace(/[^0-9+\-*/().]/g, "");
      if (sanitized) {
        const result = new Function(`return ${sanitized}`)();
        if (Number.isFinite(result)) {
          setCalculatorResult(Number(result.toFixed(2))); 
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
        symptoms, 
        digestion_stool: digestionStool, // 설진 데이터를 해당 DB 컬럼에 저장
        sleep_state: null, // 수면상태 사용 안 하므로 null 전송
        symptom_detail: symptomDetail, prescription, consult_memo: consultMemo, follow_up: followUp,
        feedback_days: finalFeedbackDays,
        amount: amount ? parseFloat(amount) : null,
        payment_method: paymentMethod || null, 
        image_urls: finalImagePaths, 
        user_id: user.id,
      };

      if (editId) {
        const { error } = await supabase.from("consultations").update(payload).eq("id", editId);
        if (error) alert("수정 실패: " + error.message);
        else { alert("수정되었습니다."); router.push("/consultations/history"); }
      } else {
        const { error } = await supabase.from("consultations").insert([payload]);
        if (error) alert("등록 실패: " + error.message);
        else { alert("등록되었습니다."); resetForm(); router.push("/consultations/history"); }
      }
    } finally {
      setUploading(false);
    }
  };

  // 🟢 과거 사진 모아보기 배열 정리 (Signed URL 반영 + 날짜 + 처방)
  const patientPastPhotos = patientHistory.flatMap(c => 
    (c.display_images || []).map((img: any) => ({ 
      url: img.url, 
      date: c.consultation_date || c.created_at?.split('T')[0] || "",
      prescription: c.prescription
    }))
  );

  const filteredPatients = patients.filter(p => {
    if (!patientSearchQuery) return true;
    const term = patientSearchQuery.toLowerCase();
    return p.name?.toLowerCase().includes(term) || p.custom_id?.toLowerCase().includes(term) || p.phone?.includes(term);
  });

  const totalCurrentPhotos = existingImagePreviews.length + imageFiles.length;

  return (
    <div className="w-full flex flex-col space-y-4 pb-12 max-w-[1600px] mx-auto" onPaste={handlePaste}>
      
      <div className="flex justify-between items-center bg-white px-6 py-4 rounded-2xl shadow-sm border border-slate-200">
        <h1 className="text-xl font-extrabold text-slate-900">{editId ? "상담 수정" : "새 상담 작성"}</h1>
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

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 flex items-center gap-2">
              <label className="w-12 text-xs font-bold text-slate-700 shrink-0">주호소</label>
              <input type="text" value={symptoms} onChange={(e) => setSymptoms(e.target.value)} className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900" />
            </div>
            {/* 🟢 기존 소화배변 라벨 -> 설진으로 변경, 수면상태 제거됨 */}
            <div className="flex-1 flex items-center gap-2">
              <label className="w-12 text-xs font-bold text-slate-700 shrink-0">설진</label>
              <input type="text" value={digestionStool} onChange={(e) => setDigestionStool(e.target.value)} className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900" placeholder="설진 결과 입력..." />
            </div>
          </div>

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
                <button type="button" onClick={() => { if (calculatorResult !== null) setAmount(calculatorResult.toString()); }} disabled={calculatorResult === null} className="px-2 py-1.5 bg-teal-600 text-white text-[10px] font-bold rounded-lg hover:bg-teal-700 disabled:opacity-50 transition">적용</button>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-700 pl-1">최종 금액</label>
                <input type="text" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} className="w-24 p-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900" />
              </div>
              
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-700">결제방식</label>
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none cursor-pointer">
                  <option value="">선택</option>
                  <option value="링크">링크</option>
                  <option value="홈피">홈피</option>
                  <option value="매장">매장</option>
                  <option value="지역상품권">지역상품권</option>
                  <option value="현금">현금</option>
                  <option value="사업자">사업자</option>
                </select>
              </div>
            </div>

            <div className="w-full xl:w-auto flex gap-2">
              <button type="submit" disabled={uploading} className="w-full xl:w-auto px-6 py-3 bg-teal-900 hover:bg-teal-800 text-white font-bold rounded-xl transition disabled:opacity-50 shadow-sm text-sm">
                {uploading ? "저장 중..." : (editId ? "상담 수정" : "상담 등록")}
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
                  {existingImagePreviews.map((img, idx) => (
                    <div key={`ex-${idx}`} className="relative w-full aspect-square flex items-center justify-center group bg-white rounded-xl shadow-xs border border-slate-300 p-1">
                      <img src={img.url} onClick={() => setPreviewImageUrl(img.url)} className="max-w-full max-h-full object-contain cursor-pointer hover:scale-105 transition rounded-lg" />
                      <button type="button" onClick={() => {
                        setExistingImagePreviews(prev => prev.filter((_, i) => i !== idx));
                        setExistingImageUrls(prev => prev.filter((_, i) => i !== idx));
                      }} className="absolute top-2 right-2 bg-red-600 text-white w-7 h-7 rounded-full text-xs hidden group-hover:flex items-center justify-center font-bold shadow-md z-10">✕</button>
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

          <div className="flex flex-col bg-slate-100 border border-slate-200 rounded-3xl p-4 shadow-sm">
            <label className="text-xs font-bold text-slate-800 mb-3 flex-shrink-0">🎞️ 과거 사진 데이터 모아보기</label>
            <div className="max-h-[400px] overflow-y-auto pr-1">
              {patientPastPhotos.length === 0 ? (
                <div className="w-full text-center text-xs text-slate-500 font-semibold py-6">선택된 환자의 과거 사진이 없습니다.</div>
              ) : (
                <div className="grid grid-cols-2 gap-x-2 gap-y-4">
                  {patientPastPhotos.map((photo, idx) => (
                    <div key={idx} className="flex flex-col gap-1 cursor-pointer group" onClick={() => setPreviewImageUrl(photo.url)}>
                      <div className="relative w-full aspect-square flex items-center justify-center bg-white rounded-xl shadow-2xs border border-slate-300 p-1 overflow-hidden">
                        <img src={photo.url} className="w-full h-full object-cover group-hover:scale-105 transition duration-300 rounded-lg" />
                      </div>
                      <div className="text-center text-[10px] leading-tight">
                        <div className="font-bold text-slate-800">{photo.date}</div>
                        <div className="text-teal-700 truncate px-1" title={photo.prescription}>{photo.prescription || "-"}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

      </form>

      {previewImageUrl && (
        <div onClick={() => setPreviewImageUrl(null)} className="fixed inset-0 z-[150] bg-slate-950/80 flex items-center justify-center p-4 cursor-pointer">
          <img src={previewImageUrl} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
          <button onClick={() => setPreviewImageUrl(null)} className="absolute top-4 right-4 text-white bg-slate-800 w-10 h-10 rounded-full font-bold">✕</button>
        </div>
      )}
    </div>
  );
}

export default function ConsultationsWritePage() {
  return (
    <Suspense fallback={<div className="w-full p-8 text-center text-slate-500 text-sm font-bold">상담 정보를 불러오는 중...</div>}>
      <ConsultationsForm />
    </Suspense>
  );
}