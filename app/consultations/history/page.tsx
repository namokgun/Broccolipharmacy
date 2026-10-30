"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/app/lib/supabase";
import Link from "next/link";

export default function ConsultationHistoryPage() {
  const [consultations, setConsultations] = useState<any[]>([]);
  const [selectedConsultation, setSelectedConsultation] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  useEffect(() => {
    fetchConsultations();
  }, []);

  const fetchConsultations = async () => {
    const { data, error } = await supabase
      .from("consultations")
      .select("*, patients(name, phone, custom_id, gender, birth_year)")
      .order("consultation_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("상담 기록 로딩 에러:", error.message);
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

      setConsultations(processed);
      if (processed.length > 0 && !selectedConsultation) {
        setSelectedConsultation(processed[0]);
      }
    }
  };

  const formatPatientName = (p: any) => {
    if (!p) return "알수없음";
    return p.custom_id ? `${p.name} (${p.custom_id})` : p.name;
  };

  const handleDelete = async (id: string) => {
    if (!confirm("정말 이 기록을 삭제하시겠습니까?")) return;
    const { error } = await supabase.from("consultations").delete().eq("id", id);
    if (error) {
      alert("삭제 실패: " + error.message);
    } else {
      alert("삭제되었습니다.");
      setSelectedConsultation(null);
      fetchConsultations();
    }
  };

  const filteredConsultations = consultations.filter(c => {
    const q = searchQuery.toLowerCase();
    const name = c.patients?.name?.toLowerCase() || "";
    const phone = c.patients?.phone?.toLowerCase() || "";
    const symptoms = c.symptoms?.toLowerCase() || "";
    const prescription = c.prescription?.toLowerCase() || "";
    return name.includes(q) || phone.includes(q) || symptoms.includes(q) || prescription.includes(q);
  });

  return (
    <div className="w-full h-[calc(100vh-80px)] flex flex-col space-y-4 overflow-hidden max-w-[1700px] mx-auto pb-4">
      
      {/* 상단 헤더 */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white px-6 py-4 rounded-2xl shadow-sm border border-slate-200 gap-3 flex-shrink-0">
        <h1 className="text-xl font-extrabold text-slate-900">상담 기록 조회</h1>
        <div className="flex items-center gap-2">
          <Link href="/consultations" className="px-4 py-2 bg-teal-900 hover:bg-teal-800 text-white rounded-xl font-semibold text-xs transition shadow-sm">
            + 새 상담 작성
          </Link>
        </div>
      </div>

      {/* 좌우 분할 레이아웃 (좌측 넓힘 유지) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0">
        
        {/* 좌측: 1줄 리스트 창 (날짜 및 이름 영역 w-44로 충분히 확보) */}
        <div className="lg:col-span-7 bg-white rounded-3xl shadow-sm border border-slate-200 flex flex-col overflow-hidden p-4">
          <div className="mb-3 flex-shrink-0">
            <input 
              type="text" 
              placeholder="고객명, 전화번호, 주호소, 처방내용 검색..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-teal-700 transition"
            />
          </div>

          <div className="text-[11px] font-bold text-slate-400 mb-2 px-1 flex-shrink-0">
            총 <span className="text-slate-900 font-extrabold">{filteredConsultations.length}</span> 건의 기록 (최신순)
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
            {filteredConsultations.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-xs">검색 결과가 없습니다.</div>
            ) : (
              filteredConsultations.map((c) => {
                const isSelected = selectedConsultation?.id === c.id;
                const dateStr = c.consultation_date || c.created_at?.split('T')[0];

                return (
                  <div 
                    key={c.id} 
                    onClick={() => setSelectedConsultation(c)}
                    className={`p-3 rounded-2xl border transition cursor-pointer flex items-center justify-between gap-3 text-xs ${
                      isSelected 
                        ? "bg-teal-50/70 border-teal-600 shadow-2xs" 
                        : "bg-white border-slate-100 hover:bg-slate-50/80"
                    }`}
                  >
                    {/* 날짜 및 이름 영역 (w-44로 확장하여 이름 잘림 방지) */}
                    <div className="flex items-center gap-3 flex-shrink-0 w-44 whitespace-nowrap">
                      <span className="text-[11px] font-bold text-slate-500">{dateStr}</span>
                      <span className="font-extrabold text-slate-900 truncate" title={formatPatientName(c.patients)}>
                        {formatPatientName(c.patients)}
                      </span>
                    </div>

                    {/* 주호소 및 처방내용 */}
                    <div className="flex-1 flex items-center gap-2 truncate text-[11px]">
                      {c.symptoms && (
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-semibold truncate max-w-[180px]" title={c.symptoms}>
                          {c.symptoms}
                        </span>
                      )}
                      {c.prescription && (
                        <span className="bg-teal-50 text-teal-800 px-2 py-0.5 rounded-md font-bold truncate flex-1" title={c.prescription}>
                          {c.prescription}
                        </span>
                      )}
                    </div>

                    <div className="text-slate-300 font-bold flex-shrink-0">›</div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 우측: 클릭 시 상세 내용 표시 창 (정보를 직관적이고 꽉 찬 형태로 배치) */}
        <div className="lg:col-span-5 bg-white rounded-3xl shadow-sm border border-slate-200 flex flex-col overflow-hidden p-5">
          {selectedConsultation ? (
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              
              {/* 고객 요약 카드 */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <span>👤</span> {formatPatientName(selectedConsultation.patients)}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    연락처: <span className="font-semibold text-slate-700">{selectedConsultation.patients?.phone || "정보 없음"}</span>
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[11px] bg-teal-100 text-teal-900 font-bold px-3 py-1 rounded-xl">
                    {selectedConsultation.consultation_date || selectedConsultation.created_at?.split('T')[0]} 내방
                  </span>
                </div>
              </div>

              {/* 상세 정보 카드 섹션 */}
              <div className="space-y-3 text-xs">
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3.5 bg-slate-50/60 rounded-2xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 block mb-1">결제 금액 및 방식</span>
                    <span className="font-extrabold text-purple-900 text-sm">
                      {selectedConsultation.amount ? `${selectedConsultation.amount.toLocaleString()}원` : "0원"}
                      {selectedConsultation.payment_method ? ` (${selectedConsultation.payment_method})` : ""}
                    </span>
                  </div>
                  <div className="p-3.5 bg-slate-50/60 rounded-2xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 block mb-1">소화배변 / 수면상태</span>
                    <span className="font-bold text-slate-800">{selectedConsultation.digestion_stool || "-"} / {selectedConsultation.sleep_state || "-"}</span>
                  </div>
                </div>

                {selectedConsultation.symptoms && (
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 block mb-1">주호소</span>
                    <p className="font-bold text-slate-900 text-sm">{selectedConsultation.symptoms}</p>
                  </div>
                )}

                {selectedConsultation.symptom_detail && (
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 block mb-1">증상 상세 내용</span>
                    <p className="font-medium text-slate-700 whitespace-pre-line leading-relaxed">{selectedConsultation.symptom_detail}</p>
                  </div>
                )}

                {selectedConsultation.prescription && (
                  <div className="p-4 bg-teal-50/70 rounded-2xl border border-teal-200">
                    <span className="text-[10px] font-bold text-teal-700 block mb-1">처방 내용</span>
                    <p className="font-extrabold text-teal-950 text-sm">{selectedConsultation.prescription}</p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {selectedConsultation.consult_memo && (
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 block mb-1">상담 코멘트</span>
                      <p className="font-medium text-slate-700 whitespace-pre-line leading-relaxed">{selectedConsultation.consult_memo}</p>
                    </div>
                  )}
                  {selectedConsultation.follow_up && (
                    <div className="p-4 bg-purple-50/60 rounded-2xl border border-purple-200">
                      <span className="text-[10px] font-bold text-purple-700 block mb-1">추후 관리 / 피드백 ({selectedConsultation.feedback_days || 0}일 뒤)</span>
                      <p className="font-medium text-purple-950 whitespace-pre-line leading-relaxed">{selectedConsultation.follow_up}</p>
                    </div>
                  )}
                </div>

                {selectedConsultation.display_image_urls && selectedConsultation.display_image_urls.length > 0 && (
                  <div className="pt-2">
                    <span className="text-[10px] font-bold text-slate-400 block mb-2">첨부 사진 ({selectedConsultation.display_image_urls.length}장)</span>
                    <div className="flex flex-row flex-wrap gap-2">
                      {selectedConsultation.display_image_urls.map((imgUrl: string, imgIdx: number) => (
                        <div 
                          key={imgIdx} 
                          className="relative w-20 h-20 border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs cursor-pointer flex items-center justify-center group"
                          onClick={() => setPreviewImageUrl(imgUrl)}
                        >
                          <img src={imgUrl} className="max-w-full max-h-full object-contain group-hover:scale-105 transition rounded-lg" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t flex justify-end">
                <button onClick={() => handleDelete(selectedConsultation.id)} className="px-4 py-2 bg-red-50 text-red-600 font-bold rounded-xl text-xs hover:bg-red-100 transition">
                  기록 삭제
                </button>
              </div>

            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400 text-xs">
              좌측 목록에서 상담 기록을 선택해주세요.
            </div>
          )}
        </div>

      </div>

      {previewImageUrl && (
        <div onClick={() => setPreviewImageUrl(null)} className="fixed inset-0 z-[120] bg-slate-950/80 flex items-center justify-center p-4 cursor-pointer">
          <img src={previewImageUrl} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
          <button onClick={() => setPreviewImageUrl(null)} className="absolute top-4 right-4 text-white bg-slate-800 w-10 h-10 rounded-full font-bold">✕</button>
        </div>
      )}

    </div>
  );
}