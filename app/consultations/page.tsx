"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/app/lib/supabase";

export default function ConsultationsPage() {
  const [patients, setPatients] = useState<any[]>([]);
  const [consultations, setConsultations] = useState<any[]>([]);
  
  const [activeTab, setActiveTab] = useState<"write" | "history">("write");
  const [searchTerm, setSearchTerm] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingPatientName, setEditingPatientName] = useState("");

  const [selectedDetailConsultation, setSelectedDetailConsultation] = useState<any | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  const [patientSearchQuery, setPatientSearchQuery] = useState("");
  const [isPatientDropdownOpen, setIsPatientDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [selectedPatient, setSelectedPatient] = useState("");
  const [selectedPatientNameDisplay, setSelectedPatientNameDisplay] = useState("");
  const [symptoms, setSymptoms] = useState("");
  const [symptomDetail, setSymptomDetail] = useState("");
  const [digestionStool, setDigestionStool] = useState("");
  const [sleepState, setSleepState] = useState("");
  const [patientMemo, setPatientMemo] = useState("");
  const [bodyType, setBodyType] = useState("");
  const [deficiencyType, setDeficiencyType] = useState("");
  const [expertOpinion, setExpertOpinion] = useState("");
  const [comprehensiveJudgment, setComprehensiveJudgment] = useState("");
  const [prescription, setPrescription] = useState(""); 
  const [consultMemo, setConsultMemo] = useState("");
  
  // 🟢 새로 추가된 상태(State): 피드백 일정 및 모니터링 내용
  const [feedbackDays, setFeedbackDays] = useState("");
  const [monitoringContent, setMonitoringContent] = useState("");

  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([]);
  const [existingImagePreviews, setExistingImagePreviews] = useState<{ path: string; url: string }[]>([]);
  const [uploading, setUploading] = useState(false);

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

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsPatientDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      window.removeEventListener("hashchange", handleHashCheck);
      document.removeEventListener("mousedown", handleClickOutside);
    };
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
                const { data: signedData } = await supabase.storage
                  .from('consultation-images')
                  .createSignedUrl(path, 60 * 60);
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

  useEffect(() => {
    fetchData();
  }, []);

  const uploadImages = async () => {
    if (imageFiles.length === 0) return existingImageUrls;

    const uploadedPaths: string[] = [...existingImageUrls];

    for (const file of imageFiles) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("consultation-images")
        .upload(filePath, file);

      if (uploadError) {
        alert("이미지 업로드 실패: " + uploadError.message);
        continue;
      }

      uploadedPaths.push(filePath);
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
        symptoms, 
        prescription, 
        user_id: user.id,
        symptom_detail: symptomDetail,
        digestion_stool: digestionStool,
        sleep_state: sleepState,
        patient_memo: patientMemo,
        body_type: bodyType,
        deficiency_type: deficiencyType,
        expert_opinion: expertOpinion,
        comprehensive_judgment: comprehensiveJudgment,
        consult_memo: consultMemo,
        image_urls: finalImagePaths,
        // 🟢 추가된 데이터 저장
        feedback_days: feedbackDays ? parseInt(feedbackDays) : null,
        monitoring_content: monitoringContent,
      };

      if (editingId) {
        const { error } = await supabase.from("consultations").update(payload).eq("id", editingId);
        if (error) alert("수정 실패: " + error.message);
        else {
          alert("상담 기록이 수정되었습니다! 📝");
          resetForm();
          window.location.hash = "history";
          setActiveTab("history");
          fetchData();
        }
      } else {
        const { error } = await supabase.from("consultations").insert([payload]);
        if (error) alert("등록 실패: " + error.message);
        else {
          alert("전문 상담 기록이 저장되었습니다! 💊");
          resetForm();
          window.location.hash = "history";
          setActiveTab("history");
          fetchData();
        }
      }
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setEditingPatientName("");
    setSelectedPatient("");
    setSelectedPatientNameDisplay("");
    setPatientSearchQuery("");
    setSymptoms("");
    setSymptomDetail("");
    setDigestionStool("");
    setSleepState("");
    setPatientMemo("");
    setBodyType("");
    setDeficiencyType("");
    setExpertOpinion("");
    setComprehensiveJudgment("");
    setPrescription("");
    setConsultMemo("");
    // 🟢 폼 초기화 시 피드백 항목 초기화
    setFeedbackDays("");
    setMonitoringContent("");
    setImageFiles([]);
    setExistingImageUrls([]);
    setExistingImagePreviews([]);
  };

  const handleEditClick = async (c: any) => {
    setEditingId(c.id);
    setEditingPatientName(c.patients?.name || "환자");
    setSelectedPatient(c.patient_id || "");
    setSelectedPatientNameDisplay(c.patients?.name ? `${c.patients.name} (${c.patients.phone || "번호없음"})` : "");
    setPatientSearchQuery("");
    setSymptoms(c.symptoms || "");
    setSymptomDetail(c.symptom_detail || "");
    setDigestionStool(c.digestion_stool || "");
    setSleepState(c.sleep_state || "");
    setPatientMemo(c.patient_memo || "");
    setBodyType(c.body_type || "");
    setDeficiencyType(c.deficiency_type || "");
    setExpertOpinion(c.expert_opinion || "");
    setComprehensiveJudgment(c.comprehensive_judgment || "");
    setPrescription(c.prescription || "");
    setConsultMemo(c.consult_memo || "");
    // 🟢 수정 모드일 때 기존에 입력한 피드백 정보 불러오기
    setFeedbackDays(c.feedback_days ? c.feedback_days.toString() : "");
    setMonitoringContent(c.monitoring_content || "");
    
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
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("정말 이 상담 기록을 삭제하시겠습니까?")) return;
    const { error } = await supabase.from("consultations").delete().eq("id", id);
    if (error) alert("삭제 실패: " + error.message);
    else {
      alert("상담 기록이 삭제되었습니다.");
      fetchData();
    }
  };

  const filteredPatients = patients.filter(p => 
    p.name?.toLowerCase().includes(patientSearchQuery.toLowerCase()) ||
    p.phone?.includes(patientSearchQuery)
  );

  const filteredConsultations = consultations.filter(c => 
    c.patients?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.symptoms?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.prescription?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.body_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.deficiency_type?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center justify-between mb-6 border-b pb-4">
        <div className="flex gap-3">
          <button
            onClick={() => { resetForm(); window.location.hash = ""; setActiveTab("write"); }}
            className={`px-5 py-2.5 rounded-xl font-bold text-sm transition shadow-sm ${
              activeTab === "write" ? "bg-teal-900 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            📝 상담 기록 작성 / 수정
          </button>
          <button
            onClick={() => { window.location.hash = "history"; setActiveTab("history"); }}
            className={`px-5 py-2.5 rounded-xl font-bold text-sm transition shadow-sm ${
              activeTab === "history" ? "bg-teal-900 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            📂 전체 기록 조회 ({consultations.length})
          </button>
        </div>

        {editingId && (
          <button onClick={resetForm} className="px-4 py-2 bg-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-300 transition">
            수정 취소하기 ✕
          </button>
        )}
      </div>

      {activeTab === "write" && (
        <div className={`p-6 rounded-2xl shadow-sm border mb-8 transition ${editingId ? "bg-amber-50/40 border-amber-200" : "bg-white border-slate-100"}`}>
          <h2 className="text-xl font-bold mb-6 text-slate-900 border-b pb-3">
            {editingId ? (
              <span className="text-amber-600">✏️ [{editingPatientName}] 님의 상담 기록 수정 중...</span>
            ) : (
              "새 전문 상담 기록 작성"
            )}
          </h2>
          
          <form onSubmit={handleSubmitConsultation} className="space-y-6">
            <div className="relative" ref={dropdownRef}>
              <label className="block text-sm font-semibold text-slate-700 mb-1">상담 환자 검색 및 선택</label>
              <div 
                onClick={() => setIsPatientDropdownOpen(true)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer flex justify-between items-center text-sm"
              >
                <span className={selectedPatientNameDisplay ? "text-slate-900 font-semibold" : "text-slate-400"}>
                  {selectedPatientNameDisplay || "환자 이름 또는 전화번호로 검색하세요..."}
                </span>
                <span className="text-xs text-slate-400">▼</span>
              </div>

              {isPatientDropdownOpen && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto p-2">
                  <input 
                    type="text"
                    placeholder="이름이나 전화번호 입력..."
                    value={patientSearchQuery}
                    onChange={(e) => setPatientSearchQuery(e.target.value)}
                    className="w-full p-2.5 mb-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    autoFocus
                  />
                  <div className="space-y-1">
                    {filteredPatients.length === 0 ? (
                      <p className="p-3 text-center text-xs text-slate-400">검색된 환자가 없습니다.</p>
                    ) : (
                      filteredPatients.map(p => (
                        <div 
                          key={p.id}
                          onClick={() => {
                            setSelectedPatient(p.id);
                            setSelectedPatientNameDisplay(`${p.name} (${p.phone || "번호없음"})`);
                            setIsPatientDropdownOpen(false);
                            setPatientSearchQuery("");
                          }}
                          className="p-2.5 hover:bg-teal-50 rounded-lg cursor-pointer flex justify-between items-center text-sm transition"
                        >
                          <span className="font-semibold text-slate-800">{p.name}</span>
                          <span className="text-xs text-slate-500">{p.gender || "남"} / {p.birth_year || "-"}년생 · {p.phone || "번호없음"}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">주요 증상</label>
                <input 
                  type="text"
                  value={symptoms} 
                  onChange={(e) => setSymptoms(e.target.value)} 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:border-teal-500 focus:outline-none" 
                  placeholder="예: 두통, 소화불량, 피로감" 
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">체질 / 허실 유형</label>
                <div className="flex gap-2">
                  <input 
                    type="text"
                    value={bodyType} 
                    onChange={(e) => setBodyType(e.target.value)} 
                    className="w-1/2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:border-teal-500 focus:outline-none" 
                    placeholder="체질 (예: 태음인)" 
                  />
                  <input 
                    type="text"
                    value={deficiencyType} 
                    onChange={(e) => setDeficiencyType(e.target.value)} 
                    className="w-1/2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:border-teal-500 focus:outline-none" 
                    placeholder="허실 유형 (예: 기허증)" 
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">증상 자유 서술</label>
              <textarea 
                value={symptomDetail} 
                onChange={(e) => setSymptomDetail(e.target.value)} 
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:border-teal-500 focus:outline-none" 
                rows={3} 
                placeholder="환자의 호소 내용을 구체적으로 기록하세요..." 
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">소화 및 대변 상태</label>
                <input 
                  type="text"
                  value={digestionStool} 
                  onChange={(e) => setDigestionStool(e.target.value)} 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:border-teal-500 focus:outline-none" 
                  placeholder="예: 식후 더부룩함, 변비 경향" 
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">수면 상태</label>
                <input 
                  type="text"
                  value={sleepState} 
                  onChange={(e) => setSleepState(e.target.value)} 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:border-teal-500 focus:outline-none" 
                  placeholder="예: 입면 난조, 자주 깸" 
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">선진 소견</label>
                <textarea 
                  value={expertOpinion} 
                  onChange={(e) => setExpertOpinion(e.target.value)} 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:border-teal-500 focus:outline-none" 
                  rows={2} 
                  placeholder="전문가 관점의 소견..." 
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">종합 판단</label>
                <textarea 
                  value={comprehensiveJudgment} 
                  onChange={(e) => setComprehensiveJudgment(e.target.value)} 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:border-teal-500 focus:outline-none" 
                  rows={2} 
                  placeholder="종합적인 건강 상태 진단..." 
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-teal-800 mb-1">권고 의약품 (처방)</label>
                <textarea 
                  value={prescription} 
                  onChange={(e) => setPrescription(e.target.value)} 
                  className="w-full p-3 bg-teal-50/50 border border-teal-200 rounded-xl text-sm focus:border-teal-500 focus:outline-none" 
                  rows={2} 
                  placeholder="추천 영양제 및 일반의약품..." 
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">환자 메모 & 상담 메모</label>
                <div className="flex gap-2">
                  <textarea 
                    value={patientMemo} 
                    onChange={(e) => setPatientMemo(e.target.value)} 
                    className="w-1/2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:border-teal-500 focus:outline-none" 
                    rows={2} 
                    placeholder="환자 특이사항 메모" 
                  />
                  <textarea 
                    value={consultMemo} 
                    onChange={(e) => setConsultMemo(e.target.value)} 
                    className="w-1/2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:border-teal-500 focus:outline-none" 
                    rows={2} 
                    placeholder="상담 특이사항 메모" 
                  />
                </div>
              </div>
            </div>

            {/* 🟢 새로 추가된 피드백 / 모니터링 입력 섹션 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-100 pt-4 mt-2">
              <div>
                <label className="block text-sm font-semibold text-purple-800 mb-1">피드백 일정 지정 (숫자만 입력)</label>
                <div className="relative">
                  <input
                    type="number"
                    value={feedbackDays}
                    onChange={(e) => setFeedbackDays(e.target.value)}
                    className="w-full p-3 bg-purple-50/50 border border-purple-200 rounded-xl text-sm focus:border-purple-500 focus:outline-none pr-12 transition"
                    placeholder="예: 30"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-purple-600 text-sm font-bold">일 후</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5 ml-1">입력 시 피드백 전용 캘린더에 일정이 자동 등록됩니다.</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-purple-800 mb-1">모니터링 체크 내용</label>
                <input
                  type="text"
                  value={monitoringContent}
                  onChange={(e) => setMonitoringContent(e.target.value)}
                  className="w-full p-3 bg-purple-50/50 border border-purple-200 rounded-xl text-sm focus:border-purple-500 focus:outline-none transition"
                  placeholder="예: 소화 불량 개선 여부 확인"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">📸 사진 첨부</label>
              <input 
                type="file" 
                accept="image/*" 
                multiple
                onChange={(e) => {
                  if (e.target.files) {
                    setImageFiles(Array.from(e.target.files));
                  }
                }}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100"
              />

              {(existingImagePreviews.length > 0 || imageFiles.length > 0) && (
                <div className="flex flex-wrap gap-3 mt-3">
                  {existingImagePreviews.map((item, idx) => (
                    <div key={`exist-${idx}`} className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200">
                      <img src={item.url} alt="기존 이미지" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => {
                          const updatedPaths = existingImageUrls.filter((_, i) => i !== idx);
                          setExistingImageUrls(updatedPaths);
                          setExistingImagePreviews(existingImagePreviews.filter((_, i) => i !== idx));
                        }}
                        className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center opacity-80 hover:opacity-100"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  {imageFiles.map((file, idx) => (
                    <div key={`new-${idx}`} className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200">
                      <img src={URL.createObjectURL(file)} alt="새 이미지 미리보기" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setImageFiles(imageFiles.filter((_, i) => i !== idx))}
                        className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center opacity-80 hover:opacity-100"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button 
              type="submit" 
              disabled={uploading}
              className="w-full py-4 bg-teal-900 hover:bg-teal-800 text-white font-bold rounded-2xl shadow-sm transition text-base disabled:opacity-50"
            >
              {uploading ? "이미지 업로드 및 안전 저장 중..." : (editingId ? "수정 내용 저장하기" : "전문 상담 기록 저장하기")}
            </button>
          </form>
        </div>
      )}

      {/* 2. 전체 기록 조회 탭 */}
      {activeTab === "history" && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
            <h2 className="text-lg font-bold text-slate-900">전체 상담 기록 조회 ({filteredConsultations.length}건)</h2>
            <input
              type="text"
              placeholder="환자명, 증상, 처방약 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full md:w-80 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:border-teal-500 focus:outline-none"
            />
          </div>

          <div className="space-y-4">
            {filteredConsultations.length === 0 ? (
              <p className="text-center text-slate-400 py-12 text-sm">등록된 상담 기록이 없습니다.</p>
            ) : (
              filteredConsultations.map((c) => (
                <div key={c.id} className="p-5 bg-white border border-slate-200/80 rounded-2xl shadow-xs hover:shadow-md transition flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap whitespace-nowrap">
                      <span className="font-bold text-base text-slate-900">{c.patients?.name || "알 수 없음"}</span>
                      <span className="text-xs text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full font-medium">
                        {c.patients?.gender || "남"} / {c.patients?.birth_year || "-"}년생
                      </span>
                      <span className="text-xs text-slate-400">· {new Date(c.created_at).toLocaleDateString()}</span>
                      
                      {/* 🟢 리스트에도 피드백 일정이 있으면 뱃지로 표시되게 추가 */}
                      {c.feedback_days && (
                        <span className="text-xs bg-purple-50 text-purple-700 px-2.5 py-0.5 rounded-md font-semibold border border-purple-100">
                          🔔 {c.feedback_days}일 후 피드백
                        </span>
                      )}

                      {c.display_image_urls && c.display_image_urls.length > 0 && (
                        <span className="text-xs bg-teal-50 text-teal-700 px-2.5 py-0.5 rounded-md font-semibold">
                          📸 사진 {c.display_image_urls.length}장
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-slate-800">
                      <span className="text-slate-400 font-normal mr-1.5">증상:</span> {c.symptoms || "미기재"}
                    </p>
                    <p className="text-sm font-bold text-teal-800">
                      <span className="text-slate-400 font-normal mr-1.5">처방:</span> {c.prescription || "미기재"}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 w-full md:w-auto justify-end border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
                    <button 
                      onClick={() => setSelectedDetailConsultation(c)}
                      className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
                    >
                      🔍 자세히 보기
                    </button>
                    <button 
                      onClick={() => handleEditClick(c)}
                      className="px-3.5 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-bold rounded-lg transition"
                    >
                      수정
                    </button>
                    <button 
                      onClick={() => handleDelete(c.id)}
                      className="px-3.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold rounded-xl transition"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 자세히 보기 모달 */}
      {selectedDetailConsultation && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 md:p-8 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start border-b pb-4 mb-6">
              <div>
                <div className="flex items-center gap-2 mb-1 whitespace-nowrap flex-wrap">
                  <span className="text-xl font-bold text-slate-900">{selectedDetailConsultation.patients?.name} 님</span>
                  <span className="text-xs text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full font-medium">
                    {selectedDetailConsultation.patients?.gender || "남"} / {selectedDetailConsultation.patients?.birth_year || "-"}년생
                  </span>
                </div>
                <p className="text-xs text-slate-400">상담일시: {new Date(selectedDetailConsultation.created_at).toLocaleString()}</p>
              </div>
              <button 
                onClick={() => setSelectedDetailConsultation(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 font-bold transition"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">체질 / 허실</p>
                  <p className="font-bold text-slate-800">
                    {selectedDetailConsultation.body_type || "미입력"} / {selectedDetailConsultation.deficiency_type || "미입력"}
                  </p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">수면 및 소화 상태</p>
                  <p className="font-semibold text-slate-800">
                    수면: {selectedDetailConsultation.sleep_state || "-"} <br/>
                    소화: {selectedDetailConsultation.digestion_stool || "-"}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">주요 증상 및 세부 호소</p>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                  <p className="font-bold text-slate-900">{selectedDetailConsultation.symptoms || "미기재"}</p>
                  {selectedDetailConsultation.symptom_detail && (
                    <p className="text-slate-600 text-xs leading-relaxed whitespace-pre-line">{selectedDetailConsultation.symptom_detail}</p>
                  )}
                </div>
              </div>

              {selectedDetailConsultation.display_image_urls && selectedDetailConsultation.display_image_urls.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">📸 첨부된 사진 (클릭하여 확대)</p>
                  <div className="flex flex-wrap gap-3">
                    {selectedDetailConsultation.display_image_urls.map((imgUrl: string, idx: number) => (
                      <div 
                        key={idx} 
                        onClick={() => setPreviewImageUrl(imgUrl)}
                        className="w-24 h-24 rounded-2xl overflow-hidden border border-slate-200 cursor-pointer hover:opacity-90 transition shadow-xs bg-slate-100"
                      >
                        <img src={imgUrl} alt={`첨부사진 ${idx + 1}`} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(selectedDetailConsultation.expert_opinion || selectedDetailConsultation.comprehensive_judgment) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedDetailConsultation.expert_opinion && (
                    <div className="p-4 bg-teal-50/40 rounded-2xl border border-teal-100">
                      <p className="text-xs font-semibold text-teal-700 uppercase tracking-wider mb-1">선진 소견</p>
                      <p className="text-slate-700 text-xs whitespace-pre-line">{selectedDetailConsultation.expert_opinion}</p>
                    </div>
                  )}
                  {selectedDetailConsultation.comprehensive_judgment && (
                    <div className="p-4 bg-purple-50/40 rounded-2xl border border-purple-100">
                      <p className="text-xs font-semibold text-purple-700 uppercase tracking-wider mb-1">종합 판단</p>
                      <p className="text-slate-700 text-xs whitespace-pre-line">{selectedDetailConsultation.comprehensive_judgment}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="p-4 bg-teal-900 text-white rounded-2xl">
                <p className="text-xs font-semibold text-teal-300 uppercase tracking-wider mb-1">권고 의약품 (처방)</p>
                <p className="font-bold text-base whitespace-pre-line">{selectedDetailConsultation.prescription || "미기재"}</p>
              </div>

              {/* 🟢 자세히 보기 팝업에서도 피드백 정보가 나오도록 추가 */}
              {(selectedDetailConsultation.feedback_days || selectedDetailConsultation.monitoring_content) && (
                <div className="p-4 bg-purple-50/50 border border-purple-200 rounded-2xl space-y-2 text-xs">
                  <p className="font-bold text-purple-900 text-sm mb-2">🔔 피드백 및 모니터링 계획</p>
                  {selectedDetailConsultation.feedback_days && (
                    <p><strong className="text-purple-800">피드백 일정:</strong> <span className="text-slate-700">{selectedDetailConsultation.feedback_days}일 후 진행 예정</span></p>
                  )}
                  {selectedDetailConsultation.monitoring_content && (
                    <p><strong className="text-purple-800">체크할 내용:</strong> <span className="text-slate-700">{selectedDetailConsultation.monitoring_content}</span></p>
                  )}
                </div>
              )}

              {(selectedDetailConsultation.patient_memo || selectedDetailConsultation.consult_memo) && (
                <div className="p-4 bg-amber-50/50 border border-amber-200 rounded-2xl space-y-2 text-xs">
                  {selectedDetailConsultation.patient_memo && (
                    <p><strong className="text-amber-900">환자 특이사항 메모:</strong> <span className="text-slate-700">{selectedDetailConsultation.patient_memo}</span></p>
                  )}
                  {selectedDetailConsultation.consult_memo && (
                    <p><strong className="text-amber-900">상담 특이사항 메모:</strong> <span className="text-slate-700">{selectedDetailConsultation.consult_memo}</span></p>
                  )}
                </div>
              )}
            </div>

            <div className="mt-8 pt-4 border-t flex justify-end">
              <button 
                onClick={() => setSelectedDetailConsultation(null)}
                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-sm transition"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 라이트박스 */}
      {previewImageUrl && (
        <div 
          onClick={() => setPreviewImageUrl(null)}
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full flex items-center justify-center">
            <button 
              onClick={() => setPreviewImageUrl(null)}
              className="absolute -top-12 right-0 text-white bg-slate-800 hover:bg-slate-700 w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg shadow-lg transition"
            >
              ✕
            </button>
            <img 
              src={previewImageUrl} 
              alt="확대된 사진" 
              className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}