"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/app/lib/supabase";

export default function PatientsPage() {
  const [patients, setPatients] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState("남");
  const [birthYear, setBirthYear] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // 🟢 특정 환자 상담 이력 모달 상태
  const [selectedPatientForHistory, setSelectedPatientForHistory] = useState<any | null>(null);
  const [patientConsultations, setPatientConsultations] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyTab, setHistoryTab] = useState<"list" | "photos">("list");

  // 🟢 상세 보기 모달 상태
  const [selectedDetailConsultation, setSelectedDetailConsultation] = useState<any | null>(null);

  // 🟢 사진 단독 확대 미리보기(라이트박스) 상태
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  const fetchPatients = async () => {
    const { data } = await supabase.from("patients").select("*").order("created_at", { ascending: false });
    if (data) setPatients(data);
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  const handleAddPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return alert("환자 이름을 입력해주세요.");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return alert("로그인 정보가 없습니다.");

    const { error } = await supabase.from("patients").insert([{
      name,
      phone,
      gender,
      birth_year: birthYear ? parseInt(birthYear) : null,
      user_id: user.id
    }]);

    if (error) {
      alert("환자 등록 실패: " + error.message);
    } else {
      alert("환자가 등록되었습니다! 👥");
      setName("");
      setPhone("");
      setBirthYear("");
      fetchPatients();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("정말 이 환자를 삭제하시겠습니까? 관련 상담 기록도 함께 영향을 받을 수 있습니다.")) return;
    const { error } = await supabase.from("patients").delete().eq("id", id);
    if (error) alert("삭제 실패: " + error.message);
    else {
      alert("환자가 삭제되었습니다.");
      fetchPatients();
    }
  };

  // 🟢 특정 환자의 상담 이력 불러오기 (보안 Signed URL 포함)
  const handleOpenHistoryModal = async (patient: any) => {
    setSelectedPatientForHistory(patient);
    setHistoryTab("list");
    setLoadingHistory(true);
    const { data, error } = await supabase
      .from("consultations")
      .select("*")
      .eq("patient_id", patient.id)
      .order("created_at", { ascending: false });
    
    if (data) {
      const consultationsWithSignedUrls = await Promise.all(
        data.map(async (c) => {
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
      setPatientConsultations(consultationsWithSignedUrls);
    }
    setLoadingHistory(false);
  };

  const filteredPatients = patients.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.phone && p.phone.includes(searchTerm))
  );

  return (
    <div className="w-full space-y-6">
      <h1 className="text-2xl font-bold mb-6 text-slate-900">👥 환자 목록 및 등록 관리</h1>

      {/* 환자 등록 폼 */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-8">
        <h2 className="text-lg font-bold mb-4 text-slate-900">새 환자 등록</h2>
        <form onSubmit={handleAddPatient} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">환자명</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              placeholder="이름 입력"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">연락처</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              placeholder="010-0000-0000"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">성별</label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
            >
              <option value="남">남</option>
              <option value="여">여</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">출생 연도</label>
            <input
              type="number"
              value={birthYear}
              onChange={(e) => setBirthYear(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              placeholder="예: 1995"
            />
          </div>
          <button
            type="submit"
            className="py-3 bg-teal-900 text-white font-bold rounded-xl hover:bg-teal-800 transition text-sm shadow-sm"
          >
            환자 등록
          </button>
        </form>
      </div>

      {/* 환자 목록 테이블 */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <h2 className="text-lg font-bold text-slate-900">전체 환자 리스트 ({filteredPatients.length}명)</h2>
          <input
            type="text"
            placeholder="이름 또는 연락처 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full md:w-80 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-400 uppercase text-xs">
              <tr>
                <th className="p-4 font-semibold rounded-l-xl">환자명</th>
                <th className="p-4 font-semibold">성별 / 출생연도</th>
                <th className="p-4 font-semibold">연락처</th>
                <th className="p-4 font-semibold">등록일자</th>
                <th className="p-4 font-semibold text-center rounded-r-xl">관리 / 이력</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPatients.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">
                    등록된 환자가 없습니다.
                  </td>
                </tr>
              ) : (
                filteredPatients.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-4 font-semibold text-slate-900 flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-teal-50 text-teal-800 flex items-center justify-center text-xs font-bold">
                        {p.name[0]}
                      </span>
                      {p.name}
                    </td>
                    <td className="p-4 text-slate-600">
                      {p.gender || "남"} / {p.birth_year ? `${p.birth_year}년생` : "-"}
                    </td>
                    <td className="p-4 text-slate-600">{p.phone || "-"}</td>
                    <td className="p-4 text-slate-500">{new Date(p.created_at).toLocaleDateString()}</td>
                    <td className="p-4 text-center space-x-2">
                      <button
                        onClick={() => handleOpenHistoryModal(p)}
                        className="px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-bold rounded-lg transition"
                      >
                        📂 상담 이력
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="px-3.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold rounded-lg transition"
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 🟢 환자별 상담 이력 및 사진 모아보기 모달 팝업 */}
      {selectedPatientForHistory && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl max-w-3xl w-full max-h-[85vh] overflow-y-auto p-6 md:p-8 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b pb-4 mb-4">
              <div>
                <h3 className="text-xl font-bold text-slate-900">
                  📂 [{selectedPatientForHistory.name}] 님의 상담 기록 관리
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  연락처: {selectedPatientForHistory.phone || "번호 없음"} | 성별/출생: {selectedPatientForHistory.gender || "남"} / {selectedPatientForHistory.birth_year || "-"}년생
                </p>
              </div>
              <button 
                onClick={() => setSelectedPatientForHistory(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 font-bold transition"
              >
                ✕
              </button>
            </div>

            {/* 탭 전환 버튼 */}
            <div className="flex gap-2 mb-6 border-b pb-3">
              <button
                onClick={() => setHistoryTab("list")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                  historyTab === "list" ? "bg-teal-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                📋 상담 기록 목록
              </button>
              <button
                onClick={() => setHistoryTab("photos")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                  historyTab === "photos" ? "bg-teal-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                📸 환자 사진 모아보기
              </button>
            </div>

            {loadingHistory ? (
              <p className="text-center text-slate-400 py-12 text-sm">데이터를 불러오는 중...</p>
            ) : historyTab === "list" ? (
              patientConsultations.length === 0 ? (
                <p className="text-center text-slate-400 py-12 text-sm">이 환자에 대한 상담 기록이 아직 없습니다.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border border-slate-100 rounded-xl overflow-hidden">
                    <thead className="bg-slate-50 text-slate-400 uppercase text-xs">
                      <tr>
                        <th className="p-3 font-semibold">상담 일시</th>
                        <th className="p-3 font-semibold">주요 증상</th>
                        <th className="p-3 font-semibold">권고 처방</th>
                        <th className="p-3 font-semibold text-center">상세 / 사진</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {patientConsultations.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-50/80 transition">
                          <td className="p-3 text-slate-500 whitespace-nowrap text-xs">
                            {new Date(c.created_at).toLocaleDateString()} <br />
                            <span className="text-[10px] text-slate-400">{new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </td>
                          <td className="p-3 font-semibold text-slate-900">{c.symptoms || "미기재"}</td>
                          <td className="p-3 font-bold text-teal-800">{c.prescription || "미기재"}</td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => setSelectedDetailConsultation({ ...c, patients: selectedPatientForHistory })}
                              className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition"
                            >
                              🔍 자세히 보기 {c.display_image_urls?.length > 0 && `(📸 ${c.display_image_urls.length})`}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : (
              /* 사진 모아보기 갤러리 뷰 */
              (() => {
                const allPhotos = patientConsultations.flatMap(c => 
                  (c.display_image_urls || []).map((url: string) => ({
                    url,
                    date: c.created_at,
                    symptoms: c.symptoms
                  }))
                );

                if (allPhotos.length === 0) {
                  return <p className="text-center text-slate-400 py-12 text-sm">등록된 사진이 없습니다.</p>;
                }

                return (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-h-[50vh] overflow-y-auto p-1">
                    {allPhotos.map((photo, idx) => (
                      <div key={idx} className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden shadow-xs flex flex-col">
                        {/* 클릭 시 외부로 안 나가고 인앱 라이트박스 열림 */}
                        <div 
                          onClick={() => setPreviewImageUrl(photo.url)}
                          className="block h-36 overflow-hidden bg-slate-100 cursor-pointer"
                        >
                          <img src={photo.url} alt={`환자 사진 ${idx + 1}`} className="w-full h-full object-cover hover:scale-105 transition duration-200" />
                        </div>
                        <div className="p-3 text-[11px] space-y-1">
                          <p className="font-semibold text-slate-800 truncate">증상: {photo.symptoms || "미기재"}</p>
                          <p className="text-slate-400">{new Date(photo.date).toLocaleDateString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()
            )}

            <div className="mt-8 pt-4 border-t flex justify-end">
              <button 
                onClick={() => setSelectedPatientForHistory(null)}
                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-sm transition"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🟢 [자세히 보기] 상세 모달 팝업 */}
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
                  <p className="font-bold text-slate-900">{selectedDetailConsultation.symptoms || "미기재"}</p>
                  {selectedDetailConsultation.symptom_detail && (
                    <p className="text-slate-600 text-xs leading-relaxed whitespace-pre-line">{selectedDetailConsultation.symptom_detail}</p>
                  )}
                </div>
              </div>

              {selectedDetailConsultation.display_image_urls && selectedDetailConsultation.display_image_urls.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">📸 첨부된 사진 (클릭하여 앱 안에서 확대)</p>
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

      {/* 🟢 [인앱 이미지 라이트박스] 사진 원본 크게 확대 보기 팝업 */}
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
              onClick={(e) => e.stopPropagation()} // 이미지 클릭 시 닫히지 않게 방지
            />
          </div>
        </div>
      )}
    </div>
  );
}