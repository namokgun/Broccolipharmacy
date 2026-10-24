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

  // 🟢 상세 보기 모달 상태
  const [selectedDetailConsultation, setSelectedDetailConsultation] = useState<any | null>(null);

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
    if (cData) setConsultations(cData);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmitConsultation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) return alert("환자를 선택해주세요.");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return alert("로그인 정보가 없습니다.");

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
      consult_memo: consultMemo
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
  };

  const handleEditClick = (c: any) => {
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
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" 
                  placeholder="예: 두통, 소화불량, 피로감" 
                  required 
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">체질 / 허실 유형</label>
                <div className="flex gap-2">
                  <input 
                    type="text"
                    value={bodyType} 
                    onChange={(e) => setBodyType(e.target.value)} 
                    className="w-1/2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" 
                    placeholder="체질 (예: 태음인)" 
                  />
                  <input 
                    type="text"
                    value={deficiencyType} 
                    onChange={(e) => setDeficiencyType(e.target.value)} 
                    className="w-1/2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" 
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
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" 
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
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" 
                  placeholder="예: 식후 더부룩함, 변비 경향" 
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">수면 상태</label>
                <input 
                  type="text"
                  value={sleepState} 
                  onChange={(e) => setSleepState(e.target.value)} 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" 
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
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" 
                  rows={2} 
                  placeholder="전문가 관점의 소견..." 
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">종합 판단</label>
                <textarea 
                  value={comprehensiveJudgment} 
                  onChange={(e) => setComprehensiveJudgment(e.target.value)} 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" 
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
                  className="w-full p-3 bg-teal-50/50 border border-teal-200 rounded-xl text-sm" 
                  rows={2} 
                  placeholder="추천 영양제 및 일반의약품..." 
                  required 
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">환자 메모 & 상담 메모</label>
                <div className="flex gap-2">
                  <textarea 
                    value={patientMemo} 
                    onChange={(e) => setPatientMemo(e.target.value)} 
                    className="w-1/2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" 
                    rows={2} 
                    placeholder="환자 특이사항 메모" 
                  />
                  <textarea 
                    value={consultMemo} 
                    onChange={(e) => setConsultMemo(e.target.value)} 
                    className="w-1/2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" 
                    rows={2} 
                    placeholder="상담 특이사항 메모" 
                  />
                </div>
              </div>
            </div>

            <button 
              type="submit" 
              className="w-full py-4 bg-teal-900 hover:bg-teal-800 text-white font-bold rounded-2xl shadow-sm transition text-base"
            >
              {editingId ? "수정 내용 저장하기" : "전문 상담 기록 저장하기"}
            </button>
          </form>
        </div>
      )}

      {/* 2. 전체 기록 조회 탭 (깔끔한 요약 카드 + 자세히 보기 버튼) */}
      {activeTab === "history" && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
            <h2 className="text-lg font-bold text-slate-900">전체 상담 기록 조회 ({filteredConsultations.length}건)</h2>
            <input
              type="text"
              placeholder="환자명, 증상, 처방약 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full md:w-80 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
            />
          </div>

          <div className="space-y-4">
            {filteredConsultations.length === 0 ? (
              <p className="text-center text-slate-400 py-12 text-sm">등록된 상담 기록이 없습니다.</p>
            ) : (
              filteredConsultations.map((c) => (
                <div key={c.id} className="p-5 bg-white border border-slate-200/80 rounded-2xl shadow-xs hover:shadow-md transition flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2.5">
                      <span className="font-bold text-base text-slate-900">{c.patients?.name || "알 수 없음"}</span>
                      <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full font-medium">
                        {c.patients?.gender || "남"} / {c.patients?.birth_year || "-"}년생
                      </span>
                      <span className="text-xs text-slate-400">· {new Date(c.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-800">
                      <span className="text-slate-400 font-normal mr-1.5">증상:</span> {c.symptoms}
                    </p>
                    <p className="text-sm font-bold text-teal-800">
                      <span className="text-slate-400 font-normal mr-1.5">처방:</span> {c.prescription}
                    </p>
                  </div>

                  {/* 액션 버튼 그룹 (자세히 보기, 수정, 삭제) */}
                  <div className="flex items-center gap-2 w-full md:w-auto justify-end border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
                    <button 
                      onClick={() => setSelectedDetailConsultation(c)}
                      className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
                    >
                      🔍 자세히 보기
                    </button>
                    <button 
                      onClick={() => handleEditClick(c)}
                      className="px-3.5 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-bold rounded-xl transition"
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

      {/* 🟢 [자세히 보기] 모달 팝업창 */}
      {selectedDetailConsultation && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 md:p-8 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start border-b pb-4 mb-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
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
                  <p className="font-bold text-slate-900">{selectedDetailConsultation.symptoms}</p>
                  {selectedDetailConsultation.symptom_detail && (
                    <p className="text-slate-600 text-xs leading-relaxed whitespace-pre-line">{selectedDetailConsultation.symptom_detail}</p>
                  )}
                </div>
              </div>

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
                <p className="font-bold text-base whitespace-pre-line">{selectedDetailConsultation.prescription}</p>
              </div>

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
    </div>
  );
}