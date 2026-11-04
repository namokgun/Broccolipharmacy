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

  useEffect(() => { fetchData(); }, []);

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
    const payload = {
      patient_id: selectedPatient.id, patient_name: selectedPatient.name, payment_method: paymentMethod,
      items: selectedProducts, total_amount: totalAmount, memo, user_id: user?.id, sale_date: new Date().toISOString().split('T')[0]
    };

    const { error } = await supabase.from("sales").insert([payload]);
    if (error) alert("등록 실패: " + error.message);
    else { alert("판매가 등록되었습니다."); setSelectedProducts([]); setMemo(""); fetchData(); }
  };

  const totalCount = sales.length;
  const totalSum = sales.reduce((sum, s) => sum + (s.total_amount || 0), 0);
  const avgPrice = totalCount > 0 ? Math.round(totalSum / totalCount) : 0;

  // 인기 제품 TOP 5
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0">
        {/* 좌측: 판매 등록 폼 */}
        <div className="lg:col-span-7 bg-white rounded-3xl shadow-sm border border-slate-200 flex flex-col p-6 overflow-y-auto space-y-5">
          <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-teal-600"></span> 판매 등록</h2>
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            
            <div>
              <label className="block font-bold text-slate-700 mb-1.5">결제 수단</label>
              <div className="flex flex-wrap gap-1.5">
                {PAYMENT_METHODS.map(m => (
                  <button type="button" key={m} onClick={() => setPaymentMethod(m)} className={`px-4 py-2 rounded-xl font-bold transition-all border text-xs ${paymentMethod === m ? "bg-[#528771] text-white border-[#528771]" : "bg-slate-50 text-slate-600 border-slate-200"}`}>{m}</button>
                ))}
              </div>
            </div>

            <div className="relative">
              <label className="block font-bold text-slate-700 mb-1">고객 선택 *</label>
              <input type="text" placeholder="고객명 또는 연락처 검색..." value={patientSearch} onChange={e => setPatientSearch(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold mb-2" />
              {patientSearch && (
                <div className="absolute z-10 w-full max-h-32 overflow-y-auto border border-slate-200 rounded-xl bg-white shadow-lg">
                  {patients.filter(p => p.name.includes(patientSearch) || (p.phone && p.phone.includes(patientSearch))).map(p => (
                    <div key={p.id} onClick={() => { setSelectedPatient(p); setPatientSearch(""); }} className="p-3 hover:bg-teal-50 cursor-pointer flex justify-between font-semibold border-b border-slate-50">
                      <span>{p.name}</span><span className="text-slate-400">{p.phone}</span>
                    </div>
                  ))}
                </div>
              )}
              {selectedPatient && (
                <div className="p-3 bg-teal-50/60 border border-teal-200 rounded-xl flex justify-between items-center"><span className="font-extrabold text-teal-900">선택된 고객: {selectedPatient.name}</span><button type="button" onClick={() => setSelectedPatient(null)} className="text-rose-600 font-bold hover:underline">변경</button></div>
              )}
            </div>

            <div className="relative">
              <label className="block font-bold text-slate-700 mb-1">제품 선택 *</label>
              <input type="text" placeholder="+ 제품명 검색하여 추가..." value={productSearch} onChange={e => setProductSearch(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold" />
              {productSearch && (
                <div className="absolute z-10 w-full max-h-32 overflow-y-auto border border-slate-200 rounded-xl bg-white shadow-lg mt-1">
                  {products.filter(pr => pr.name.includes(productSearch)).map(pr => (
                    <div key={pr.id} onClick={() => handleAddProduct(pr)} className="p-3 hover:bg-teal-50 cursor-pointer flex justify-between font-semibold border-b border-slate-50">
                      <span>{pr.name}</span><span className="text-teal-800">{pr.price?.toLocaleString()}원</span>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="space-y-2 mt-3">
                {selectedProducts.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl">
                    <div className="flex flex-col"><span className="font-extrabold text-slate-900">{p.name}</span><span className="text-slate-500">{p.price?.toLocaleString()}원</span></div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => handleQuantity(p.id, -1)} className="w-7 h-7 bg-white border rounded-lg font-bold">-</button>
                      <span className="font-bold w-6 text-center">{p.quantity}</span>
                      <button type="button" onClick={() => handleQuantity(p.id, 1)} className="w-7 h-7 bg-white border rounded-lg font-bold">+</button>
                      <span className="font-extrabold text-teal-900 ml-2 w-20 text-right">{(p.price * p.quantity).toLocaleString()}원</span>
                      <button type="button" onClick={() => setSelectedProducts(selectedProducts.filter(x => x.id !== p.id))} className="text-red-400 ml-2 hover:text-red-600">✕</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between items-center p-4 bg-slate-50 rounded-xl font-extrabold text-sm border border-slate-100">
              <span>총 결제금액</span><span className="text-[#528771] text-lg">{totalAmount.toLocaleString()}원</span>
            </div>

            <textarea value={memo} onChange={e => setMemo(e.target.value)} rows={2} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold resize-none" placeholder="특이사항 입력..." />

            <div className="flex justify-end pt-2"><button type="submit" className="w-full py-3 bg-[#528771] hover:bg-[#3d6856] text-white font-bold rounded-xl transition shadow-sm">등록하기</button></div>
          </form>
        </div>

        {/* 우측: 요약, 최근 내역, 인기 제품 */}
        <div className="lg:col-span-5 flex flex-col gap-4 overflow-hidden">
          <div className="grid grid-cols-3 gap-3 bg-white p-4 rounded-3xl shadow-sm border border-slate-200 flex-shrink-0">
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-center"><span className="text-[10px] font-bold text-slate-400 block mb-1">판매 건수</span><span className="text-lg font-extrabold text-slate-900">{totalCount}건</span></div>
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-center"><span className="text-[10px] font-bold text-slate-400 block mb-1">총 매출</span><span className="text-lg font-extrabold text-[#528771]">{totalSum.toLocaleString()}원</span></div>
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-center"><span className="text-[10px] font-bold text-slate-400 block mb-1">평균 객단가</span><span className="text-lg font-extrabold text-slate-900">{avgPrice.toLocaleString()}원</span></div>
          </div>

          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 flex flex-col p-5">
            <h3 className="text-xs font-extrabold text-slate-900 mb-3">🔥 인기 제품 TOP 5</h3>
            <div className="space-y-3">
              {topProducts.slice(0, 5).map((p, idx) => {
                const percent = Math.round((p.amt / totalSum) * 100) || 0;
                return (
                  <div key={p.name} className="text-[11px]">
                    <div className="flex justify-between font-bold mb-1"><span className="text-slate-700">{idx + 1}. {p.name} ({p.qty}개)</span><span className="text-slate-900">{p.amt.toLocaleString()}원 ({percent}%)</span></div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden"><div className="bg-[#528771] h-full rounded-full" style={{ width: `${percent}%` }}></div></div>
                  </div>
                );
              })}
              {topProducts.length === 0 && <div className="text-xs text-slate-400 text-center py-4">판매 데이터가 없습니다.</div>}
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 flex flex-col flex-1 p-5 overflow-hidden">
            <h3 className="text-xs font-extrabold text-slate-900 mb-3">최근 판매 내역</h3>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {sales.slice(0, 5).map(s => (
                <div key={s.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs space-y-1">
                  <div className="flex justify-between font-extrabold text-slate-900"><span>{s.patient_name}</span><span className="text-[#528771]">{s.total_amount.toLocaleString()}원</span></div>
                  <div className="flex justify-between text-[10px] font-bold text-slate-500"><span>{s.sale_date} · {s.payment_method}</span><span className="truncate max-w-[120px]">{s.items?.map((i:any)=>i.name).join(', ')}</span></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}