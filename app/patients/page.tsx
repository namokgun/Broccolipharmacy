"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/app/lib/supabase";

const PRESET_TAGS = ["비만", "통증", "소화기", "피부", "갱년기", "보약", "허약", "불면", "비염"];

export default function PatientsPage() {
  const [patients, setPatients] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);
  
  // 환자별 상담 내역 및 사진 상태
  const [patientConsultations, setPatientConsultations] = useState<any[]>([]);

  // 모달 상태
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPatientId, setEditingPatientId] = useState<string | null>(null);

  // 폼 입력 상태
  const [name, setName] = useState("");
  const [customId, setCustomId] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState("남");
  const [birthYear, setBirthYear] = useState("");
  const [bodyType, setBodyType] = useState("태음인");
  const [patientTags, setPatientTags] = useState<string[]>([]);
  const [customTagInput, setCustomTagInput] = useState("");
  const [address, setAddress] = useState("");
  const [memo, setMemo] = useState("");

  useEffect(() => {
    fetchPatients();
  }, []);

  useEffect(() => {
    if (selectedPatient) {
      fetchPatientConsultations(selectedPatient.id);
    } else {
      setPatientConsultations([]);
    }
  }, [selectedPatient]);

  const fetchPatients = async () => {
    const { data, error } = await supabase.from("patients").select("*").order("name");
    if (error) {
      console.error("환자 목록 로딩 에러:", error.message);
      return;
    }
    if (data) {
      setPatients(data);
      if (data.length > 0 && !selectedPatient) {
        setSelectedPatient(data[0]);
      } else if (selectedPatient) {
        const updated = data.find(p => p.id === selectedPatient.id);
        if (updated) setSelectedPatient(updated);
      }
    }
  };

  const fetchPatientConsultations = async (patientId: string) => {
    const { data, error } = await supabase
      .from("consultations")
      .select("*")
      .eq("patient_id", patientId)
      .order("consultation_date", { ascending: false });

    if (error) {
      console.error("상담 내역 로딩 에러:", error.message);
      return;
    }

    if (data) {
      const processed = await Promise.all(
        data.map(async (c: any) => {
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
      setPatientConsultations(processed);
    }
  };

  const filteredPatients = patients.filter(p => {
    const q = searchQuery.toLowerCase();
    return (
      (p.name || "").toLowerCase().includes(q) ||
      (p.custom_id || "").toLowerCase().includes(q) ||
      (p.phone || "").includes(q)
    );
  });

  const handleOpenRegister = () => {
    setEditingPatientId(null);
    setName("");
    setCustomId("");
    setPhone("");
    setGender("남");
    setBirthYear("");
    setBodyType("태음인");
    setPatientTags([]);
    setCustomTagInput("");
    setAddress("");
    setMemo("");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (p: any) => {
    setEditingPatientId(p.id);
    setName(p.name || "");
    setCustomId(p.custom_id || "");
    setPhone(p.phone || "");
    setGender(p.gender || "남");
    setBirthYear(p.birth_year ? p.birth_year.toString() : "");
    setBodyType(p.body_type || "태음인");
    setPatientTags(Array.isArray(p.tags) ? p.tags : []);
    setCustomTagInput("");
    setAddress(p.address || "");
    setMemo(p.memo || "");
    setIsModalOpen(true);
  };

  const togglePatientTag = (tag: string) => {
    if (patientTags.includes(tag)) {
      setPatientTags(patientTags.filter(t => t !== tag));
    } else {
      setPatientTags([...patientTags, tag]);
    }
  };

  const handleAddCustomTag = () => {
    if (!customTagInput.trim()) return;
    if (!patientTags.includes(customTagInput.trim())) {
      setPatientTags([...patientTags, customTagInput.trim()]);
    }
    setCustomTagInput("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return alert("환자 이름을 입력해주세요.");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return alert("로그인 정보가 없습니다.");

    const payload = {
      name: name.trim(),
      custom_id: customId.trim() || null,
      phone: phone.trim() || null,
      gender,
      birth_year: birthYear ? parseInt(birthYear) : null,
      body_type: bodyType,
      tags: patientTags,
      address: address.trim() || null,
      memo: memo.trim() || null,
      user_id: user.id
    };

    if (editingPatientId) {
      const { error } = await supabase.from("patients").update(payload).eq("id", editingPatientId);
      if (error) alert("수정 실패: " + error.message);
      else { alert("수정되었습니다."); setIsModalOpen(false); fetchPatients(); }
    } else {
      const { error } = await supabase.from("patients").insert([payload]);
      if (error) alert("등록 실패: " + error.message);
      else { alert("등록되었습니다."); setIsModalOpen(false); fetchPatients(); }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("정말 이 환자를 삭제하시겠습니까? 관련된 상담 내역도 영향을 받을 수 있습니다.")) return;
    const { error } = await supabase.from("patients").delete().eq("id", id);
    if (error) alert("삭제 실패: " + error.message);
    else {
      alert("삭제되었습니다.");
      setSelectedPatient(null);
      fetchPatients();
    }
  };

  const calculateAge = (birthYearVal: any) => {
    if (!birthYearVal) return "-";
    const yearNum = parseInt(birthYearVal);
    if (isNaN(yearNum)) return "-";
    const currentYear = new Date().getFullYear();
    return `${currentYear - yearNum + 1}세 (${birthYearVal}년생)`;
  };

  const patientStats = useMemo(() => {
    const count = patientConsultations.length;
    const lastDate = count > 0 ? (patientConsultations[0].consultation_date || patientConsultations[0].created_at?.split('T')[0]) : "-";
    const totalAmount = patientConsultations.reduce((sum, c) => sum + (c.amount || 0), 0);
    const bodyTypeVal = selectedPatient?.body_type || "-";
    return { count, lastDate, totalAmount, bodyTypeVal };
  }, [patientConsultations, selectedPatient]);

  return (
    <div className="w-full h-[calc(100vh-32px)] flex flex-col space-y-3 overflow-hidden max-w-[1700px] mx-auto pb-2">
      
      {/* 상단 헤더 */}
      <div className="bg-white px-5 py-3 rounded-2xl shadow-sm border border-slate-200 flex justify-between items-center flex-shrink-0">
        <h1 className="text-lg font-extrabold text-slate-900">환자 목록</h1>
        <button onClick={handleOpenRegister} className="px-4 py-1.5 bg-[#528771] hover:bg-[#3d6856] text-white rounded-xl font-bold text-xs transition shadow-sm whitespace-nowrap">
          + 환자 등록
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 flex-1 min-h-0">
        
        {/* 🟢 좌측: 원래 형태 그대로 유지된 환자 목록 리스트 */}
        <div className="lg:col-span-7 bg-white rounded-3xl shadow-sm border border-slate-200 flex flex-col overflow-hidden p-4">
          <div className="mb-3 flex-shrink-0">
            <input 
              type="text" 
              placeholder="환자 이름, 아이디, 전화번호 검색..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#528771] transition"
            />
          </div>

          <div className="text-[11px] font-bold text-slate-400 mb-2 px-1 flex-shrink-0">
            총 <span className="text-slate-900 font-extrabold">{filteredPatients.length}명</span>의 환자
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
            {filteredPatients.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-xs font-bold">검색된 환자가 없습니다.</div>
            ) : (
              filteredPatients.map((p) => {
                const isSelected = selectedPatient?.id === p.id;
                const displayName = p.custom_id ? `${p.name} (${p.custom_id})` : p.name;
                return (
                  <div 
                    key={p.id} 
                    onClick={() => setSelectedPatient(p)}
                    className={`p-3 rounded-2xl border transition cursor-pointer flex items-center justify-between gap-3 text-xs ${
                      isSelected ? "bg-teal-50/70 border-teal-600 shadow-2xs" : "bg-white border-slate-100 hover:bg-slate-50/80"
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-shrink-0 w-44 whitespace-nowrap">
                      <span className="font-extrabold text-slate-900 truncate" title={displayName}>{displayName}</span>
                      <span className="text-[10px] font-bold text-slate-500">{p.gender || "-"} / {calculateAge(p.birth_year).split(' ')[0]}</span>
                    </div>

                    <div className="flex-1 flex items-center gap-1.5 truncate text-[11px]">
                      {Array.isArray(p.tags) && p.tags.map((t: string, idx: number) => (
                        <span key={idx} className="bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded text-[10px] font-extrabold truncate">
                          #{t}
                        </span>
                      ))}
                    </div>

                    <div className="text-slate-300 font-bold flex-shrink-0">›</div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 우측: 선택된 환자 상세 정보 패널 (나이, 성별, 태그만 표시되도록 수정된 부분) */}
        <div className="lg:col-span-5 bg-white rounded-3xl shadow-sm border border-slate-200 flex flex-col p-5 overflow-hidden">
          {selectedPatient ? (
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              
              {/* 상단 이름 및 수정/삭제 버튼 */}
              <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <span>👤</span> {selectedPatient.custom_id ? `${selectedPatient.name} (${selectedPatient.custom_id})` : selectedPatient.name}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    연락처: <span className="font-semibold text-slate-700">{selectedPatient.phone || "정보 없음"}</span>
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => handleOpenEdit(selectedPatient)} className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition">수정</button>
                  <button onClick={() => handleDelete(selectedPatient.id)} className="px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-bold transition">삭제</button>
                </div>
              </div>

              {/* 통계 요약 카드 */}
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col justify-center">
                  <span className="text-[10px] font-bold text-slate-400 mb-0.5">체질</span>
                  <span className="font-extrabold text-teal-900">{patientStats.bodyTypeVal}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col justify-center">
                  <span className="text-[10px] font-bold text-slate-400 mb-0.5">최근 상담일</span>
                  <span className="font-extrabold text-slate-800 text-[11px]">{patientStats.lastDate}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col justify-center">
                  <span className="text-[10px] font-bold text-slate-400 mb-0.5">상담 횟수</span>
                  <span className="font-extrabold text-slate-800">{patientStats.count}회</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col justify-center">
                  <span className="text-[10px] font-bold text-slate-400 mb-0.5">누적 결제</span>
                  <span className="font-extrabold text-purple-900 text-[11px]">{patientStats.totalAmount.toLocaleString()}원</span>
                </div>
              </div>

              {/* 🟢 환자 정보 카드: 나이, 성별, 태그 3개만 표시 (출생연도, 주소 등 삭제 완료) */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2.5 text-xs">
                <div className="flex items-center gap-6">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block">나이</span>
                    <span className="font-bold text-slate-800">{calculateAge(selectedPatient.birth_year)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block">성별</span>
                    <span className="font-bold text-slate-800">{selectedPatient.gender || "-"}</span>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-400 block mb-1">태그</span>
                  <div className="flex flex-wrap gap-1">
                    {Array.isArray(selectedPatient.tags) && selectedPatient.tags.length > 0 ? (
                      selectedPatient.tags.map((t: string, i: number) => (
                        <span key={i} className="bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded text-[10px] font-extrabold">
                          #{t}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-400 text-xs">등록된 태그가 없습니다.</span>
                    )}
                  </div>
                </div>
              </div>

              {/* 최근 상담 내역 요약 */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-extrabold text-slate-900">최근 상담 내역 ({patientConsultations.length}건)</h3>
                </div>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {patientConsultations.map(c => (
                    <div key={c.id} className="p-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs space-y-1">
                      <div className="flex justify-between font-bold text-slate-500 text-[10px]">
                        <span>{c.consultation_date || c.created_at?.split('T')[0]}</span>
                        {c.amount ? <span className="text-purple-900 font-extrabold">{c.amount.toLocaleString()}원</span> : null}
                      </div>
                      {c.symptoms && <div className="font-extrabold text-slate-900">{c.symptoms}</div>}
                      {c.prescription && <div className="font-bold text-teal-800">{c.prescription}</div>}
                    </div>
                  ))}
                  {patientConsultations.length === 0 && (
                    <div className="text-center text-xs text-slate-400 py-6 font-bold">상담 기록이 없습니다.</div>
                  )}
                </div>
              </div>

            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-xs font-bold text-slate-400">
              좌측 목록에서 환자를 선택해주세요.
            </div>
          )}
        </div>

      </div>

      {/* 환자 등록 / 수정 모달 */}
      {isModalOpen && (
        <div onClick={() => setIsModalOpen(false)} className="fixed inset-0 z-[120] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer">
          <div className="bg-white w-full max-w-lg max-h-[90vh] rounded-3xl p-6 shadow-2xl border border-slate-200 flex flex-col cursor-default" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b pb-3 mb-4 shrink-0">
              <h3 className="text-base font-bold text-slate-900">{editingPatientId ? "환자 정보 수정" : "새 환자 등록"}</h3>
              <button onClick={() => setIsModalOpen(false)} className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-200">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto pr-2 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">환자 이름 *</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold focus:outline-none focus:border-[#528771]" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">차트 번호 / 아이디</label>
                  <input type="text" value={customId} onChange={e => setCustomId(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold focus:outline-none focus:border-[#528771]" placeholder="예: 001" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">연락처</label>
                  <input type="text" value={phone} onChange={e => setPhone(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold focus:outline-none focus:border-[#528771]" placeholder="010-0000-0000" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">체질</label>
                  <select value={bodyType} onChange={e => setBodyType(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold">
                    <option value="태음인">태음인</option>
                    <option value="소음인">소음인</option>
                    <option value="소양인">소양인</option>
                    <option value="태양인">태양인</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">성별</label>
                  <select value={gender} onChange={e => setGender(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold">
                    <option value="남">남</option>
                    <option value="여">여</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">출생연도 (4자리)</label>
                  <input type="number" value={birthYear} onChange={e => setBirthYear(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold" placeholder="예: 1995" />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">태그 선택</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {PRESET_TAGS.map(tag => {
                    const isSelected = patientTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => togglePatientTag(tag)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all border ${
                          isSelected ? "bg-amber-600 text-white border-amber-600 shadow-2xs" : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        #{tag}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <input type="text" placeholder="직접 태그 입력 후 추가..." value={customTagInput} onChange={e => setCustomTagInput(e.target.value)} className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold" />
                  <button type="button" onClick={handleAddCustomTag} className="px-4 py-2 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-900 transition">추가</button>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">메모</label>
                <textarea value={memo} onChange={e => setMemo(e.target.value)} rows={3} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold resize-none focus:outline-none focus:border-[#528771]" placeholder="특이사항 입력..." />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 shrink-0">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition">취소</button>
                <button type="submit" className="px-6 py-2.5 bg-[#528771] text-white font-bold rounded-xl hover:bg-[#3d6856] transition shadow-sm">
                  저장하기
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}