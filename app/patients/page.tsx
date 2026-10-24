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

  // 🟢 특정 환자의 상담 이력 불러오기
  const handleOpenHistoryModal = async (patient: any) => {
    setSelectedPatientForHistory(patient);
    setLoadingHistory(true);
    const { data, error } = await supabase
      .from("consultations")
      .select("*")
      .eq("patient_id", patient.id)
      .order("created_at", { ascending: false });
    
    if (data) setPatientConsultations(data);
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

      {/* 🟢 환자별 상담 이력 모달 팝업 */}
      {selectedPatientForHistory && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl max-w-3xl w-full max-h-[85vh] overflow-y-auto p-6 md:p-8 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b pb-4 mb-6">
              <div>
                <h3 className="text-xl font-bold text-slate-900">
                  📂 [{selectedPatientForHistory.name}] 님의 상담 이력 모음
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

            {loadingHistory ? (
              <p className="text-center text-slate-400 py-12 text-sm">상담 기록을 불러오는 중...</p>
            ) : patientConsultations.length === 0 ? (
              <p className="text-center text-slate-400 py-12 text-sm">이 환자에 대한 상담 기록이 아직 없습니다.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border border-slate-100 rounded-xl overflow-hidden">
                  <thead className="bg-slate-50 text-slate-400 uppercase text-xs">
                    <tr>
                      <th className="p-3 font-semibold">상담 일시</th>
                      <th className="p-3 font-semibold">주요 증상</th>
                      <th className="p-3 font-semibold">체질/허실</th>
                      <th className="p-3 font-semibold">권고 처방</th>
                      <th className="p-3 font-semibold text-center">사진</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {patientConsultations.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/80 transition">
                        <td className="p-3 text-slate-500 whitespace-nowrap text-xs">
                          {new Date(c.created_at).toLocaleDateString()} <br />
                          <span className="text-[10px] text-slate-400">{new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </td>
                        <td className="p-3 font-semibold text-slate-900">{c.symptoms}</td>
                        <td className="p-3 text-slate-600 text-xs">
                          {c.body_type || "-"} / {c.deficiency_type || "-"}
                        </td>
                        <td className="p-3 font-bold text-teal-800">{c.prescription}</td>
                        <td className="p-3 text-center">
                          {c.image_urls && c.image_urls.length > 0 ? (
                            <span className="text-xs bg-teal-50 text-teal-700 px-2 py-0.5 rounded font-semibold">
                              📸 {c.image_urls.length}장
                            </span>
                          ) : (
                            <span className="text-xs text-slate-300">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
    </div>
  );
}