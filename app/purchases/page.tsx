"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/app/lib/supabase";

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  
  // 🟢 탭 상태 관리 (register: 사입 등록, history: 전체 내역 조회)
  const [activeTab, setActiveTab] = useState<"register" | "history">("register");
  
  // 폼 상태
  const [purchaseDate, setPurchaseDate] = useState("");
  const [manufacturer, setManufacturer] = useState("직접입력");
  const [isCustomManufacturer, setIsCustomManufacturer] = useState(true);
  const [customManufacturerInput, setCustomManufacturerInput] = useState("");
  
  const [paymentStatus, setPaymentStatus] = useState("완료");
  const [memo, setMemo] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<any[]>([]);

  useEffect(() => {
    setPurchaseDate(new Date().toISOString().split('T')[0]);
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: pData } = await supabase.from("purchases").select("*").order("purchase_date", { ascending: false });
    if (pData) setPurchases(pData);

    const { data: prData } = await supabase.from("products").select("*").order("name");
    if (prData) setProducts(prData);
  };

  // 🟢 제품 및 기존 사입 내역에서 제조사(거래처) 목록 추출
  const allManufacturers = useMemo(() => {
    const fromProducts = products.map(p => p.manufacturer);
    const fromPurchases = purchases.map(p => p.manufacturer);
    return Array.from(new Set([...fromProducts, ...fromPurchases])).filter(Boolean);
  }, [products, purchases]);

  const handleAddProduct = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    if (!selectedProducts.find(p => p.id === product.id)) {
      setSelectedProducts([...selectedProducts, { ...product, purchase_price: product.price || 0, quantity: 1 }]);
    }
  };

  const updateProduct = (id: string, field: string, value: number) => {
    setSelectedProducts(selectedProducts.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const removeProduct = (id: string) => {
    setSelectedProducts(selectedProducts.filter(p => p.id !== id));
  };

  const handleDeletePurchase = async (id: string) => {
    if (!confirm("정말 이 사입 내역을 삭제하시겠습니까?")) return;
    const { error } = await supabase.from("purchases").delete().eq("id", id);
    if (error) alert("삭제 실패: " + error.message);
    else { alert("삭제되었습니다."); fetchData(); }
  };

  const supplyAmount = selectedProducts.reduce((sum, p) => sum + (p.purchase_price * p.quantity), 0);
  const vat = Math.floor(supplyAmount * 0.1);
  const totalAmount = supplyAmount + vat;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalManufacturer = isCustomManufacturer ? customManufacturerInput.trim() : manufacturer;
    if (!finalManufacturer) return alert("거래처를 선택하거나 입력해주세요.");
    if (selectedProducts.length === 0) return alert("제품을 추가해주세요.");

    const { data: { user } } = await supabase.auth.getUser();
    const payload = {
      manufacturer: finalManufacturer, 
      payment_status: paymentStatus, 
      purchase_date: purchaseDate,
      items: selectedProducts, 
      total_amount: totalAmount, 
      memo, 
      user_id: user?.id
    };

    const { error } = await supabase.from("purchases").insert([payload]);
    if (error) alert("등록 실패: " + error.message);
    else {
      alert("사입 내역이 등록되었습니다.");
      setManufacturer("직접입력"); 
      setIsCustomManufacturer(true);
      setCustomManufacturerInput("");
      setSelectedProducts([]); 
      setMemo(""); 
      fetchData();
    }
  };

  // 상단 요약 통계 계산
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  const thisMonthPurchases = purchases.filter(p => p.purchase_date?.startsWith(currentMonth));
  const thisMonthCount = thisMonthPurchases.length;
  const thisMonthSum = thisMonthPurchases.reduce((sum, p) => sum + (p.total_amount || 0), 0);

  // 제조사별 매입액 (TOP 5 용)
  const manufacturerStats = useMemo(() => {
    const stats: Record<string, number> = {};
    purchases.forEach(p => {
      stats[p.manufacturer] = (stats[p.manufacturer] || 0) + p.total_amount;
    });
    return Object.entries(stats).sort((a, b) => b[1] - a[1]);
  }, [purchases]);

  return (
    <div className="w-full h-[calc(100vh-80px)] flex flex-col space-y-4 overflow-hidden max-w-[1700px] mx-auto pb-4">
      
      {/* 🟢 최상단: 헤더 및 탭 네비게이션 */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end bg-white px-6 py-4 rounded-2xl shadow-sm border border-slate-200 gap-4 flex-shrink-0">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">사입 관리</h1>
          <p className="text-xs font-semibold text-slate-500 mt-1">제품 매입 내역을 기록하고 지출 비용을 관리합니다.</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button 
            onClick={() => setActiveTab("register")} 
            className={`px-6 py-2 rounded-lg text-xs font-bold transition ${activeTab === "register" ? "bg-white text-teal-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            사입 등록 및 현황
          </button>
          <button 
            onClick={() => setActiveTab("history")} 
            className={`px-6 py-2 rounded-lg text-xs font-bold transition ${activeTab === "history" ? "bg-white text-teal-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            전체 내역 조회
          </button>
        </div>
      </div>

      {/* =========================================================================
          탭 1: 사입 등록 및 현황 
      ========================================================================= */}
      {activeTab === "register" && (
        <>
          {/* 상단 요약 카드 (불필요한 항목 제거, 2분할) */}
          <div className="grid grid-cols-2 gap-4 bg-white p-5 rounded-3xl shadow-sm border border-slate-200 flex-shrink-0">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
              <div><span className="text-xs font-bold text-slate-400 block mb-1">이번 달 사입 건수</span><span className="text-2xl font-extrabold text-slate-900">{thisMonthCount}건</span></div>
              <span className="text-4xl">🛒</span>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
              <div><span className="text-xs font-bold text-slate-400 block mb-1">이번 달 총 사입 금액</span><span className="text-2xl font-extrabold text-[#528771]">{thisMonthSum.toLocaleString()}원</span></div>
              <span className="text-4xl">₩</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0">
            {/* 좌측: 사입 등록 폼 */}
            <div className="lg:col-span-8 bg-white rounded-3xl shadow-sm border border-slate-200 flex flex-col p-6 overflow-y-auto space-y-5">
              <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#528771]"></span> 새 사입 등록</h2>
              
              <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">사입일 *</label>
                    <input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} required className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold focus:outline-none focus:border-[#528771]" />
                  </div>
                  
                  {/* 🟢 거래처(제조사) 드롭다운 선택 기능 추가 */}
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">거래처(제조사) *</label>
                    <select 
                      value={isCustomManufacturer ? "직접입력" : manufacturer}
                      onChange={e => {
                        if (e.target.value === "직접입력") { setIsCustomManufacturer(true); setCustomManufacturerInput(""); } 
                        else { setIsCustomManufacturer(false); setManufacturer(e.target.value); }
                      }}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold focus:outline-none focus:border-[#528771] mb-2"
                    >
                      <option value="직접입력">직접 입력</option>
                      {allManufacturers.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    {isCustomManufacturer && (
                      <input type="text" value={customManufacturerInput} onChange={e => setCustomManufacturerInput(e.target.value)} placeholder="새 거래처명 입력..." required className="w-full p-2.5 bg-teal-50/50 border border-teal-200 rounded-xl font-semibold focus:outline-none focus:border-[#528771]" />
                    )}
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">결제 상태</label>
                    <select value={paymentStatus} onChange={e => setPaymentStatus(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold focus:outline-none focus:border-[#528771]">
                      <option value="완료">결제 완료</option>
                      <option value="미결제">미결제</option>
                    </select>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50">
                  <table className="w-full text-left">
                    <thead className="bg-slate-100/50 border-b border-slate-200 text-slate-500">
                      <tr>
                        {/* 🟢 공간 부족 및 줄바꿈 해결: width 조정 및 whitespace-nowrap 적용 */}
                        <th className="py-2.5 px-3 font-bold whitespace-nowrap">제품명</th>
                        <th className="py-2.5 px-3 font-bold w-28 whitespace-nowrap">매입 단가</th>
                        <th className="py-2.5 px-3 font-bold w-20 whitespace-nowrap">수량</th>
                        <th className="py-2.5 px-3 font-bold w-32 text-right whitespace-nowrap">공급가액</th>
                        <th className="py-2.5 px-3 font-bold w-12 text-center whitespace-nowrap">관리</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {selectedProducts.map(p => (
                        <tr key={p.id}>
                          <td className="py-2 px-3 font-extrabold text-slate-800 truncate max-w-[120px]" title={p.name}>{p.name}</td>
                          <td className="py-2 px-3"><input type="number" value={p.purchase_price} onChange={e => updateProduct(p.id, 'purchase_price', Number(e.target.value))} className="w-full p-1.5 bg-slate-50 border rounded-lg text-right font-semibold focus:outline-none focus:border-teal-500" /></td>
                          <td className="py-2 px-3"><input type="number" value={p.quantity} onChange={e => updateProduct(p.id, 'quantity', Number(e.target.value))} className="w-full p-1.5 bg-slate-50 border rounded-lg text-center font-semibold focus:outline-none focus:border-teal-500" /></td>
                          <td className="py-2 px-3 text-right font-bold text-slate-700">{(p.purchase_price * p.quantity).toLocaleString()}원</td>
                          <td className="py-2 px-3 text-center"><button type="button" onClick={() => removeProduct(p.id)} className="text-red-500 font-bold hover:bg-red-50 p-1.5 rounded-lg">✕</button></td>
                        </tr>
                      ))}
                      <tr>
                        <td colSpan={5} className="py-3 px-4 bg-slate-50/50">
                          {/* 🟢 검색창 대신 드롭다운으로 제품명 선택 */}
                          <select 
                            className="w-full p-2 bg-white border border-slate-200 rounded-xl font-semibold text-slate-700 focus:outline-none focus:border-[#528771]"
                            value=""
                            onChange={(e) => handleAddProduct(e.target.value)}
                          >
                            <option value="" disabled>+ 제품관리 탭에 등록된 제품 선택하여 추가...</option>
                            {products.map(pr => (
                              <option key={pr.id} value={pr.id}>{pr.name} (분류: {pr.category || "없음"})</option>
                            ))}
                          </select>
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

                <div>
                  <label className="block font-bold text-slate-700 mb-1">비고 / 메모</label>
                  <textarea value={memo} onChange={e => setMemo(e.target.value)} rows={2} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold resize-none focus:outline-none focus:border-[#528771]" placeholder="특이사항 입력..." />
                </div>

                <div className="flex justify-end pt-2">
                  <button type="submit" className="px-8 py-3 bg-[#528771] hover:bg-[#3d6856] text-white font-bold rounded-xl transition shadow-sm">등록하기</button>
                </div>
              </form>
            </div>

            {/* 우측: 제조사별 매입액 & 최근 내역 */}
            <div className="lg:col-span-4 flex flex-col gap-4 overflow-hidden">
              <div className="bg-white rounded-3xl shadow-sm border border-slate-200 flex flex-col p-5">
                <h3 className="text-xs font-extrabold text-slate-900 mb-3 flex items-center gap-1.5">🏢 제조사별 매입액 비중 (전체 기간 누적)</h3>
                <div className="space-y-3">
                  {manufacturerStats.slice(0, 5).map(([mfg, amt], idx) => {
                    const totalAllSum = purchases.reduce((sum, p) => sum + (p.total_amount || 0), 0);
                    const percent = Math.round((amt / totalAllSum) * 100) || 0;
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

              <div className="bg-white rounded-3xl shadow-sm border border-slate-200 flex flex-col flex-1 p-5 overflow-hidden">
                <h3 className="text-xs font-extrabold text-slate-900 mb-3">최근 등록된 내역 (5건)</h3>
                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                  {purchases.slice(0, 5).map(p => (
                    <div key={p.id} className="flex justify-between items-center p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs">
                      <div className="flex flex-col"><span className="font-extrabold text-slate-900">{p.manufacturer}</span><span className="text-[10px] font-bold text-slate-400">{p.purchase_date}</span></div>
                      <span className="font-extrabold text-[#528771]">{p.total_amount.toLocaleString()}원</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* =========================================================================
          탭 2: 전체 내역 조회 
      ========================================================================= */}
      {activeTab === "history" && (
        <div className="flex-1 bg-white rounded-3xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex justify-between items-center">
            <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#528771]"></span> 전체 사입 내역 목록</h2>
            <span className="text-xs font-bold text-slate-500">총 {purchases.length}건</span>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-500 sticky top-0 backdrop-blur-md z-10 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 font-bold whitespace-nowrap">사입일</th>
                  <th className="py-3 px-4 font-bold whitespace-nowrap">거래처(제조사)</th>
                  <th className="py-3 px-4 font-bold">매입 상품 내역</th>
                  <th className="py-3 px-4 font-bold text-right whitespace-nowrap">총 사입 금액</th>
                  <th className="py-3 px-4 font-bold text-center whitespace-nowrap">상태</th>
                  <th className="py-3 px-4 font-bold text-center whitespace-nowrap">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {purchases.length === 0 ? (
                  <tr><td colSpan={6} className="py-12 text-center text-slate-400 font-bold">등록된 사입 내역이 없습니다.</td></tr>
                ) : (
                  purchases.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-600">{p.purchase_date}</td>
                      <td className="py-3 px-4 font-extrabold text-slate-900">{p.manufacturer}</td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-700 truncate max-w-[250px]">
                          {p.items?.map((i: any) => `${i.name}(${i.quantity}개)`).join(", ")}
                        </div>
                        {p.memo && <div className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[250px]">{p.memo}</div>}
                      </td>
                      <td className="py-3 px-4 font-extrabold text-[#528771] text-right">{p.total_amount?.toLocaleString()}원</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${p.payment_status === '완료' ? 'bg-teal-50 text-teal-700' : 'bg-rose-50 text-rose-700'}`}>
                          {p.payment_status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button onClick={() => handleDeletePurchase(p.id)} className="text-[11px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 px-2 py-1 rounded-md transition">삭제</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}