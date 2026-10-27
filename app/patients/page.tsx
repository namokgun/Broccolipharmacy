"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/app/lib/supabase";

const CONSTITUTION_OPTIONS = ["태음인", "소음인", "태양인", "소양인", "기타"];

export default function PatientsPage() {
  const [patients, setPatients] = useState<any[]>([]);
  const [consultations, setConsultations] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPatientId, setEditingPatientId] = useState<string | null>(null);

  // 폼 필드
  const [name, setName] = useState("");
  const [customId, setCustomId] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState("남");
  const [birthYear, setBirthYear] = useState("");
  const [address, setAddress] = useState("");
  const [bodyType, setBodyType] = useState("태음인");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: pData } = await supabase.from("patients").select("*").order("name");
    if (pData) setPatients(pData);

    const { data: cData } = await supabase.from("consultations").select("*").order("created_at", { ascending: false });
    if (cData) setConsultations(cData);
  };

  // 환자별 누적 상담 횟수, 누적 구매 금액, 최종 상담일 계산
  const getPatientStats = (patientId: string) => {
    const pConsults = consultations.filter(c => c.patient_id === patientId);
    const count = pConsults.length;
    const totalAmount = pConsults.reduce((sum, c) => sum + (c.amount || 0), 0);
    const lastDate = count > 0 ? (pConsults[0].consultation_date || pConsults[0].created_at.split('T')[0]) : "-";
    return { count, totalAmount, lastDate };
  };

  const handleOpenRegister = () => {
    setEditingPatientId(null);
    setName(""); setCustomId(""); setPhone(""); setGender("남"); setBirthYear(""); setAddress(""); setBodyType("태음인");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (p: any) => {
    setEditingPatientId(p.id);
    setName(p.name || "");
    setCustomId(p.custom_id || "");
    setPhone(p.phone || "");
    setGender(p.gender || "남");
    setBirthYear(p.birth_year ? p.birth_year.toString() : "");
    setAddress(p.address || "");
    setBodyType(p.body_type || "태음인");
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
      address,
      body_type: bodyType,
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
                  <tr key={p.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-4 font-bold text-slate-900 flex items-center gap-2">
                      <span>{p.name}</span>
                      <span className="text-xs font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{p.gender} / {p.birth_year || "-"}년</span>
                    </td>
                    <td className="p-4 text-slate-600 font-semibold">{p.custom_id || "-"}</td>
                    <td className="p-4 text-slate-500">{regDate}</td>
                    <td className="p-4 text-slate-800 font-medium">{stats.lastDate}</td>
                    <td className="p-4 font-bold text-teal-800">{stats.count}회</td>
                    <td className="p-4 font-bold text-purple-800">{stats.totalAmount.toLocaleString()}원</td>
                    <td className="p-4 text-right">
                      <button onClick={() => handleOpenEdit(p)} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition">
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
                  <label className="block text-xs font-bold text-slate-500 mb-1">환자명 *</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full p-2.5 bg-slate-50 border rounded-xl text-sm font-semibold" required />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">아이디</label>
                  <input type="text" value={customId} onChange={(e) => setCustomId(e.target.value)} className="w-full p-2.5 bg-slate-50 border rounded-xl text-sm font-semibold" placeholder="예: id001" />
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
                  <input type="number" value={birthYear} onChange={(e) => setBirthYear(e.target.value)} className="w-full p-2.5 bg-slate-50 border rounded-xl text-sm font-semibold" placeholder="1990" />
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

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">주소 (선택)</label>
                <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className="w-full p-2.5 bg-slate-50 border rounded-xl text-sm font-semibold" placeholder="상세 주소 입력..." />
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