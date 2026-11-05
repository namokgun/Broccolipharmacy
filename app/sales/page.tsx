"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/app/lib/supabase";

const PAYMENT_METHODS = ["카드", "링크", "홈피", "매장", "현영", "사업자", "입금", "지역상품", "기타"];

export default function SalesPage() {
  const [sales, setSales] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0]);
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);
  const [patientSearch, setPatientSearch] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<any[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [memo, setMemo] = useState("");

  useEffect(() => { 
    fetchData(); 
  }, []);

  const fetchData = async () => {
    const { data: sData } = await supabase.from("sales").select("*").order("sale_date", { ascending: false });
    if (sData) setSales(sData);
    const { data: pData } = await supabase.from("patients").select("*");
    if (pData) setPatients(pData);
    const { data: prData } = await supabase.from("products").select("*");
    if (prData) setProducts(prData);
  };

  const handleAddProduct = (product: any) => {
    const existing = selectedProducts.find(p => p.id === product.id);
    if (existing) setSelectedProducts(selectedProducts.map(p => p.id === product.id ? { ...p, quantity: p.quantity + 1 } : p));
    else setSelectedProducts([...selectedProducts, { ...product, quantity: 1 }]);
    setProductSearch("");
  };

  const handleQuantity = (id: string, d: number) => {
    setSelectedProducts(selectedProducts.map(p => p.id === id ? { ...p, quantity: Math.max(1, p.quantity + d) } : p));
  };

  const totalAmount = selectedProducts.reduce((sum, p) => sum + (p.price || 0) * p.quantity, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) return alert("고객을 선택해주세요.");
    if (selectedProducts.length === 0) return alert("판매할 제품을 선택해주세요.");

    const { data: { user } } = await supabase.auth.getUser();
    
    // 날짜는 버튼 누르는 시점에 생성하여 서버로 전송 (빌드 에러 방지)
    const today = new Date().toISOString().split('T')[0];

    const payload = {
      patient_id: selectedPatient.id, 
      patient_name: selectedPatient.name, 
      payment_method: paymentMethod,
      items: selectedProducts, 
      total_amount: totalAmount, 
      memo, 
      user_id: user?.id, 
      sale_date: today
    };

    const { error } = await supabase.from("sales").insert([payload]);
    if (error) alert("등록 실패: " + error.message);
    else { 
      alert("판매가 등록되었습니다."); 
      setSelectedPatient(null);
      setSelectedProducts([]); 
      setMemo(""); 
      fetchData(); 
    }
  };

  const totalCount = sales.length;
  const totalSum = sales.reduce((sum, s) => sum + (s.total_amount || 0), 0);
  const avgPrice = totalCount > 0 ? Math.round(totalSum / totalCount) : 0;

  // 인기 제품 TOP 5 계산
  const topProducts = useMemo(() => {
    const stats: Record<string, { qty: number, amt: number }> = {};
    sales.forEach(s => {
      s.items?.forEach((item: any) => {
        if (!stats[item.name]) stats[item.name] = { qty: 0, amt: 0 };
        stats[item.name].qty += item.quantity;
        stats[item.name].amt += (item.price * item.quantity);
      });
    });
    return Object.entries(stats).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.amt - a.amt);
  }, [sales]);

  return (
    <div className="w-full h-[calc(100vh-80px)] flex flex-col space-y-4 overflow-hidden max-w-[1700px] mx-auto pb-4">
      
      <div className="bg-white px-6 py-4 rounded-2xl shadow-sm border border-slate-200 flex-shrink-0">
        <h1 className="text-xl font-extrabold text-slate-900">판매 관리</h1>
        <p className="text-xs font-semibold text-slate-500 mt-0.5">제품 판매 내역을 등록하고, 매출 현황을 확인할 수 있습니다.</p>
      </div>

      {/* 🟢 완벽한 3분할(3-Column) 그리드 레이아웃 적용 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0">
        
        {/* =========================================================================
            1열(좌측): 판매 등록 폼 
        ========================================================================= */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 flex flex-col p-6 overflow-y-auto space-y-5">
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#528771]"></span> 판매 등록
          </h2>
          
          <form onSubmit={handleSubmit} className="flex flex-col h-full space-y-5">
            
            {/* 결제 수단 */}
            <div>
              <label className="block font-bold text-slate-700 mb-2">결제 수단</label>
              <div className="flex flex-wrap gap-1.5">
                {PAYMENT_METHODS.map(m => (
                  <button type="button" key={m} onClick={() => setPaymentMethod(m)} 
                    className={`px-4 py-2 rounded-xl font-bold transition-all border text-xs ${
                      paymentMethod === m ? "bg-[#528771] text-white border-[#528771] shadow-sm" : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* 고객 선택 (드롭다운 시인성 강화) */}
            <div className="relative">
              <label className="block font-bold text-slate-700 mb-1">고객 선택 *</label>
              <input type="text" placeholder="고객명 또는 연락처 검색..." value={patientSearch} onChange={e => setPatientSearch(e.target.value)} 
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-[#528771]" 
              />
              {patientSearch && (
                <div className="absolute z-20 w-full max-h-48 overflow-y-auto border border-slate-200 rounded-xl bg-white shadow-xl mt-1">
                  {patients.filter(p => p.name.includes(patientSearch) || (p.phone && p.phone.includes(patientSearch))).map(p => (
                    <div key={p.id} onClick={() => { setSelectedPatient(p); setPatientSearch(""); }} 
                      className="p-3 hover:bg-teal-50 cursor-pointer flex justify-between items-center border-b border-slate-100 last:border-none"
                    >
                      {/* 🟢 검색결과 글씨 진하게 변경 */}
                      <span className="font-extrabold text-slate-900 text-sm">{p.name}</span>
                      <span className="font-bold text-slate-500 text-xs">{p.phone || "번호 없음"}</span>
                    </div>
                  ))}
                  {patients.filter(p => p.name.includes(patientSearch) || (p.phone && p.phone.includes(patientSearch))).length === 0 && (
                     <div className="p-4 text-center text-sm font-bold text-slate-400">검색 결과가 없습니다.</div>
                  )}
                </div>
              )}
              {selectedPatient && (
                <div className="mt-2 p-3 bg-teal-50/80 border border-teal-200 rounded-xl flex justify-between items-center">
                  <span className="font-extrabold text-teal-900 text-sm">선택됨: {selectedPatient.name}</span>
                  <button type="button" onClick={() => setSelectedPatient(null)} className="text-xs text-rose-600 font-bold hover:underline">변경</button>
                </div>
              )}
            </div>

            {/* 제품 선택 (드롭다운 시인성 강화) */}
            <div className="relative">
              <label className="block font-bold text-slate-700 mb-1">제품 선택 *</label>
              <input type="text" placeholder="+ 제품명 검색하여 추가..." value={productSearch} onChange={e => setProductSearch(e.target.value)} 
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-[#528771]" 
              />
              {productSearch && (
                <div className="absolute z-10 w-full max-h-48 overflow-y-auto border border-slate-200 rounded-xl bg-white shadow-xl mt-1">
                  {products.filter(pr => pr.name.includes(productSearch)).map(pr => (
                    <div key={pr.id} onClick={() => handleAddProduct(pr)} 
                      className="p-3 hover:bg-teal-50 cursor-pointer flex justify-between items-center border-b border-slate-100 last:border-none"
                    >
                      {/* 🟢 검색결과 글씨 진하게 변경 */}
                      <span className="font-extrabold text-slate-900 text-sm">{pr.name}</span>
                      <span className="font-extrabold text-teal-800 text-sm">{pr.price?.toLocaleString()}원</span>
                    </div>
                  ))}
                  {products.filter(pr => pr.name.includes(productSearch)).length === 0 && (
                     <div className="p-4 text-center text-sm font-bold text-slate-400">검색 결과가 없습니다.</div>
                  )}
                </div>
              )}
              
              <div className="space-y-2 mt-3">
                {selectedProducts.map(p => (
                  <div key={p.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-white border border-slate-200 shadow-sm rounded-xl gap-2">
                    <div className="flex flex-col">
                      <span className="font-extrabold text-slate-900 text-sm">{p.name}</span>
                      <span className="text-xs font-bold text-slate-500">{p.price?.toLocaleString()}원</span>
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <button type="button" onClick={() => handleQuantity(p.id, -1)} className="w-8 h-8 bg-slate-50 border border-slate-200 rounded-lg font-black text-slate-700 hover:bg-slate-100">-</button>
                      <span className="font-extrabold w-6 text-center text-slate-900">{p.quantity}</span>
                      <button type="button" onClick={() => handleQuantity(p.id, 1)} className="w-8 h-8 bg-slate-50 border border-slate-200 rounded-lg font-black text-slate-700 hover:bg-slate-100">+</button>
                      <span className="font-extrabold text-[#528771] ml-2 w-20 text-right text-sm">{(p.price * p.quantity).toLocaleString()}원</span>
                      <button type="button" onClick={() => setSelectedProducts(selectedProducts.filter(x => x.id !== p.id))} className="text-red-400 ml-1 hover:text-red-600 font-bold p-1">✕</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex-1"></div> {/* 남는 공간 밀어내기 */}

            {/* 🟢 총 결제금액 (글씨 굵고 진하게 크기 확대) */}
            <div className="flex justify-between items-center p-4 bg-teal-50/50 border border-teal-100 rounded-2xl">
              <span className="font-black text-slate-900 text-base">총 결제금액</span>
              <span className="font-black text-[#2e5e49] text-2xl">{totalAmount.toLocaleString()}원</span>
            </div>

            {/* 🟢 특이사항 폼 크게 (rows 증가) */}
            <div>
              <textarea value={memo} onChange={e => setMemo(e.target.value)} rows={4} 
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold resize-none focus:outline-none focus:border-[#528771]" 
                placeholder="특이사항 입력..." 
              />
            </div>

            {/* 🟢 등록버튼 크게 (높이 및 글씨 크기 확대) */}
            <div>
              <button type="submit" className="w-full py-4 bg-[#528771] hover:bg-[#3d6856] text-white font-black text-base rounded-2xl transition shadow-md">
                판매 등록하기
              </button>
            </div>
            
          </form>
        </div>

        {/* =========================================================================
            2열(중앙): 요약 통계 & 인기 제품 TOP 5
        ========================================================================= */}
        <div className="flex flex-col gap-4 overflow-hidden">
          {/* 요약 3칸 */}
          <div className="grid grid-cols-1 gap-3 bg-white p-5 rounded-3xl shadow-sm border border-slate-200 flex-shrink-0">
            <div className="flex justify-between items-center p-3 bg-slate-50 rounded-2xl border border-slate-100">
              <span className="text-xs font-bold text-slate-500">판매 건수</span>
              <span className="text-lg font-black text-slate-900">{totalCount}건</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-slate-50 rounded-2xl border border-slate-100">
              <span className="text-xs font-bold text-slate-500">총 매출</span>
              <span className="text-lg font-black text-[#528771]">{totalSum.toLocaleString()}원</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-slate-50 rounded-2xl border border-slate-100">
              <span className="text-xs font-bold text-slate-500">평균 객단가</span>
              <span className="text-lg font-black text-slate-900">{avgPrice.toLocaleString()}원</span>
            </div>
          </div>

          {/* 인기 제품 TOP 5 */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 flex flex-col flex-1 p-6 overflow-hidden">
            <h3 className="text-sm font-extrabold text-slate-900 mb-5 flex items-center gap-1.5">
              🔥 인기 제품 TOP 5
            </h3>
            <div className="flex-1 overflow-y-auto space-y-5 pr-1">
              {topProducts.slice(0, 5).map((p, idx) => {
                const percent = Math.round((p.amt / totalSum) * 100) || 0;
                return (
                  <div key={p.name} className="flex flex-col gap-1.5 text-xs">
                    <div className="flex justify-between items-end">
                      <span className="font-extrabold text-slate-800 text-sm">{idx + 1}. {p.name} <span className="text-slate-400 text-xs font-bold ml-1">({p.qty}개)</span></span>
                      <span className="font-black text-slate-900">{p.amt.toLocaleString()}원 <span className="text-teal-700 ml-0.5">({percent}%)</span></span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div className="bg-[#528771] h-full rounded-full" style={{ width: `${percent}%` }}></div>
                    </div>
                  </div>
                );
              })}
              {topProducts.length === 0 && (
                <div className="text-sm font-bold text-slate-400 text-center py-10">판매 데이터가 없습니다.</div>
              )}
            </div>
          </div>
        </div>

        {/* =========================================================================
            3열(우측): 최근 판매 내역 (전체 높이 사용)
        ========================================================================= */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 flex flex-col p-6 overflow-hidden">
          <h3 className="text-sm font-extrabold text-slate-900 mb-4 flex items-center justify-between">
            <span>최근 판매 내역</span>
            <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">총 {sales.length}건</span>
          </h3>
          
          <div className="flex-1 overflow-y-auto space-y-3 pr-2 hide-scrollbar">
            {sales.map(s => (
              <div key={s.id} className="p-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl transition-colors cursor-default">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex flex-col">
                    <span className="font-black text-slate-900 text-sm">{s.patient_name}</span>
                    <span className="text-[10px] font-bold text-slate-400 mt-0.5">{s.sale_date} · {s.payment_method}</span>
                  </div>
                  <span className="font-black text-[#528771] text-base">{s.total_amount?.toLocaleString()}원</span>
                </div>
                <div className="text-xs font-bold text-slate-600 bg-slate-50 p-2 rounded-xl border border-slate-100">
                  {s.items?.map((i:any) => `${i.name}(${i.quantity})`).join(', ')}
                </div>
              </div>
            ))}
            {sales.length === 0 && (
              <div className="text-sm font-bold text-slate-400 text-center py-10">등록된 내역이 없습니다.</div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}