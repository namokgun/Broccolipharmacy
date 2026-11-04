"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/app/lib/supabase";

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  
  // 폼 상태
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [manufacturer, setManufacturer] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("완료");
  const [memo, setMemo] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<any[]>([]);
  const [productSearch, setProductSearch] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: pData } = await supabase.from("purchases").select("*").order("purchase_date", { ascending: false });
    if (pData) setPurchases(pData);

    const { data: prData } = await supabase.from("products").select("*");
    if (prData) setProducts(prData);
  };

  const handleAddProduct = (product: any) => {
    if (!selectedProducts.find(p => p.id === product.id)) {
      setSelectedProducts([...selectedProducts, { ...product, purchase_price: product.price || 0, quantity: 1 }]);
    }
    setProductSearch("");
  };

  const updateProduct = (id: string, field: string, value: number) => {
    setSelectedProducts(selectedProducts.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const removeProduct = (id: string) => {
    setSelectedProducts(selectedProducts.filter(p => p.id !== id));
  };

  const supplyAmount = selectedProducts.reduce((sum, p) => sum + (p.purchase_price * p.quantity), 0);
  const vat = Math.floor(supplyAmount * 0.1);
  const totalAmount = supplyAmount + vat;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manufacturer) return alert("거래처를 입력해주세요.");
    if (selectedProducts.length === 0) return alert("제품을 추가해주세요.");

    const { data: { user } } = await supabase.auth.getUser();
    const payload = {
      manufacturer, payment_status: paymentStatus, purchase_date: purchaseDate,
      items: selectedProducts, total_amount: totalAmount, memo, user_id: user?.id
    };

    const { error } = await supabase.from("purchases").insert([payload]);
    if (error) alert("등록 실패: " + error.message);
    else {
      alert("사입 내역이 등록되었습니다.");
      setManufacturer(""); setSelectedProducts([]); setMemo(""); fetchData();
    }
  };

  // 통계 계산
  const totalCount = purchases.length;
  const totalSum = purchases.reduce((sum, p) => sum + (p.total_amount || 0), 0);
  const totalStock = products.reduce((sum, p) => sum + (p.stock || 0), 0);
  const avgPrice = totalCount > 0 ? Math.round(totalSum / totalCount) : 0;

  // 🟢 제조사별 매입액 (요청 기능)
  const manufacturerStats = useMemo(() => {
    const stats: Record<string, number> = {};
    purchases.forEach(p => {
      stats[p.manufacturer] = (stats[p.manufacturer] || 0) + p.total_amount;
    });
    return Object.entries(stats).sort((a, b) => b[1] - a[1]);
  }, [purchases]);

  return (
    <div className="w-full h-[calc(100vh-80px)] flex flex-col space-y-4 overflow-hidden max-w-[1700px] mx-auto pb-4">
      {/* 상단 요약 카드 */}
      <div className="grid grid-cols-4 gap-4 bg-white p-5 rounded-3xl shadow-sm border border-slate-200 flex-shrink-0">
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
          <div><span className="text-[11px] font-bold text-slate-400 block mb-1">이번 달 사입 건수</span><span className="text-xl font-extrabold text-slate-900">{totalCount}건</span></div>
          <span className="text-3xl">🛒</span>
        </div>
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
          <div><span className="text-[11px] font-bold text-slate-400 block mb-1">이번 달 사입 금액</span><span className="text-xl font-extrabold text-[#528771]">{totalSum.toLocaleString()}원</span></div>
          <span className="text-3xl">₩</span>
        </div>
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
          <div><span className="text-[11px] font-bold text-slate-400 block mb-1">현재 재고 총 수량</span><span className="text-xl font-extrabold text-slate-900">{totalStock.toLocaleString()}개</span></div>
          <span className="text-3xl">📦</span>
        </div>
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
          <div><span className="text-[11px] font-bold text-slate-400 block mb-1">평균 매입 단가</span><span className="text-xl font-extrabold text-slate-900">{avgPrice.toLocaleString()}원</span></div>
          <span className="text-3xl">🧾</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0">
        {/* 좌측: 사입 등록 폼 */}
        <div className="lg:col-span-8 bg-white rounded-3xl shadow-sm border border-slate-200 flex flex-col p-6 overflow-y-auto space-y-5">
          <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#528771]"></span> 사입 등록</h2>
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div className="grid grid-cols-3 gap-4">
              <div><label className="block font-bold text-slate-700 mb-1">사입일 *</label><input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} required className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold" /></div>
              <div><label className="block font-bold text-slate-700 mb-1">거래처(제조사) *</label><input type="text" value={manufacturer} onChange={e => setManufacturer(e.target.value)} required placeholder="거래처명 입력..." className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold" /></div>
              <div><label className="block font-bold text-slate-700 mb-1">결제 상태</label><select value={paymentStatus} onChange={e => setPaymentStatus(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold"><option value="완료">완료</option><option value="미결제">미결제</option></select></div>
            </div>

            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50">
              <table className="w-full text-left">
                <thead className="bg-slate-100/50 border-b border-slate-200 text-slate-500">
                  <tr><th className="py-2.5 px-4 font-bold">제품명</th><th className="py-2.5 px-4 font-bold w-28">매입 단가</th><th className="py-2.5 px-4 font-bold w-20">수량</th><th className="py-2.5 px-4 font-bold w-32 text-right">공급가액</th><th className="py-2.5 px-4 font-bold w-12 text-center">관리</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {selectedProducts.map(p => (
                    <tr key={p.id}>
                      <td className="py-2 px-4 font-extrabold text-slate-800">{p.name}</td>
                      <td className="py-2 px-4"><input type="number" value={p.purchase_price} onChange={e => updateProduct(p.id, 'purchase_price', Number(e.target.value))} className="w-full p-1.5 bg-slate-50 border rounded-lg text-right font-semibold" /></td>
                      <td className="py-2 px-4"><input type="number" value={p.quantity} onChange={e => updateProduct(p.id, 'quantity', Number(e.target.value))} className="w-full p-1.5 bg-slate-50 border rounded-lg text-center font-semibold" /></td>
                      <td className="py-2 px-4 text-right font-bold text-slate-700">{(p.purchase_price * p.quantity).toLocaleString()}원</td>
                      <td className="py-2 px-4 text-center"><button type="button" onClick={() => removeProduct(p.id)} className="text-red-500 font-bold hover:bg-red-50 p-1.5 rounded-lg">✕</button></td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={5} className="py-3 px-4 relative">
                      <input type="text" placeholder="+ 제품명으로 검색하여 추가하세요..." value={productSearch} onChange={e => setProductSearch(e.target.value)} className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-semibold" />
                      {productSearch && (
                        <div className="absolute z-10 w-[calc(100%-2rem)] max-h-32 overflow-y-auto border border-slate-200 rounded-xl bg-white shadow-lg mt-1 left-4">
                          {products.filter(pr => pr.name.includes(productSearch)).map(pr => (
                            <div key={pr.id} onClick={() => handleAddProduct(pr)} className="p-2.5 hover:bg-teal-50 cursor-pointer font-semibold border-b border-slate-50 last:border-none">{pr.name}</div>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex justify-end items-center gap-6 p-4 bg-slate-50 rounded-xl font-extrabold text-sm text-slate-700 border border-slate-100">
              <span className="text-xs">공급가액 <span className="text-slate-900 ml-1">{supplyAmount.toLocaleString()}원</span></span>
              <span className="text-slate-300">|</span>
              <span className="text-xs">부가세 <span className="text-slate-900 ml-1">{vat.toLocaleString()}원</span></span>
              <span className="text-slate-300">|</span>
              <span className="text-[#528771]">총 사입 금액 <span className="text-lg ml-2">{totalAmount.toLocaleString()}원</span></span>
            </div>

            <div className="flex justify-end pt-2">
              <button type="submit" className="px-8 py-3 bg-[#528771] hover:bg-[#3d6856] text-white font-bold rounded-xl transition shadow-sm">등록하기</button>
            </div>
          </form>
        </div>

        {/* 우측: 제조사별 매입액 & 최근 내역 */}
        <div className="lg:col-span-4 flex flex-col gap-4 overflow-hidden">
          {/* 제조사별 매입액 */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 flex flex-col p-5">
            <h3 className="text-xs font-extrabold text-slate-900 mb-3 flex items-center gap-1.5">🏢 제조사별 매입액 (TOP 5)</h3>
            <div className="space-y-3">
              {manufacturerStats.slice(0, 5).map(([mfg, amt], idx) => {
                const percent = Math.round((amt / totalSum) * 100) || 0;
                return (
                  <div key={mfg} className="text-[11px]">
                    <div className="flex justify-between font-bold mb-1"><span className="text-slate-700">{idx + 1}. {mfg}</span><span className="text-slate-900">{amt.toLocaleString()}원 ({percent}%)</span></div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden"><div className="bg-[#528771] h-full rounded-full" style={{ width: `${percent}%` }}></div></div>
                  </div>
                );
              })}
              {manufacturerStats.length === 0 && <div className="text-xs text-slate-400 text-center py-4">데이터가 없습니다.</div>}
            </div>
          </div>

          {/* 최근 사입 내역 */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 flex flex-col flex-1 p-5 overflow-hidden">
            <h3 className="text-xs font-extrabold text-slate-900 mb-3">최근 사입 내역</h3>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {purchases.slice(0, 8).map(p => (
                <div key={p.id} className="flex justify-between items-center p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs">
                  <div className="flex flex-col"><span className="font-extrabold text-slate-900">{p.manufacturer}</span><span className="text-[10px] font-bold text-slate-400">{p.purchase_date}</span></div>
                  <span className="font-extrabold text-[#528771]">{p.total_amount.toLocaleString()}원</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}