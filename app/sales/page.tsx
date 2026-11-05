"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/app/lib/supabase";

const PAYMENT_METHODS = ["카드", "링크", "홈피", "매장", "현영", "사업자", "입금", "지역상품", "기타"];

export default function SalesPage() {
  const [sales, setSales] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  
  // 탭 및 수정 상태 관리
  const [activeTab, setActiveTab] = useState<"register" | "history">("register");
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);

  // 폼 및 날짜 상태 (🟢 빌드 에러 해결)
  const [saleDate, setSaleDate] = useState("");
  const [currentMonth, setCurrentMonth] = useState("");

  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0]);
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);
  const [patientSearch, setPatientSearch] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<any[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [memo, setMemo] = useState("");

  useEffect(() => { 
    // 🟢 빌드 에러 해결: 클라이언트 로드 시 날짜 세팅
    const now = new Date();
    setSaleDate(now.toISOString().split('T')[0]);
    setCurrentMonth(now.toISOString().slice(0, 7));
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

  const resetForm = () => {
    setEditingSaleId(null);
    setSaleDate(new Date().toISOString().split('T')[0]);
    setPaymentMethod(PAYMENT_METHODS[0]);
    setSelectedPatient(null);
    setSelectedProducts([]);
    setMemo("");
    setPatientSearch("");
    setProductSearch("");
  };

  const handleEdit = (sale: any) => {
    setEditingSaleId(sale.id);
    setSaleDate(sale.sale_date || new Date().toISOString().split('T')[0]);
    setPaymentMethod(sale.payment_method);
    
    const pt = patients.find(p => p.id === sale.patient_id);
    setSelectedPatient(pt || { id: sale.patient_id, name: sale.patient_name });
    
    setSelectedProducts(sale.items || []);
    setMemo(sale.memo || "");
    setActiveTab("register");
  };

  const handleDelete = async (id: string) => {
    if (!confirm("정말 이 판매 내역을 삭제하시겠습니까?")) return;
    const { error } = await supabase.from("sales").delete().eq("id", id);
    if (error) alert("삭제 실패: " + error.message);
    else { alert("삭제되었습니다."); fetchData(); }
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
    if (!saleDate) return alert("판매일자를 입력해주세요.");
    if (!selectedPatient) return alert("고객을 선택해주세요.");
    if (selectedProducts.length === 0) return alert("판매할 제품을 선택해주세요.");

    const { data: { user } } = await supabase.auth.getUser();
    
    const payload = {
      patient_id: selectedPatient.id, 
      patient_name: selectedPatient.name, 
      payment_method: paymentMethod,
      items: selectedProducts, 
      total_amount: totalAmount, 
      memo, 
      user_id: user?.id, 
      sale_date: saleDate
    };

    if (editingSaleId) {
      const { error } = await supabase.from("sales").update(payload).eq("id", editingSaleId);
      if (error) alert("수정 실패: " + error.message);
      else { alert("수정되었습니다."); resetForm(); fetchData(); }
    } else {
      const { error } = await supabase.from("sales").insert([payload]);
      if (error) alert("등록 실패: " + error.message);
      else { alert("등록되었습니다."); resetForm(); fetchData(); }
    }
  };

  // 🟢 빌드 에러 해결: 상태(currentMonth) 기반 통계 계산
  const thisMonthSales = sales.filter(s => currentMonth && s.sale_date?.startsWith(currentMonth));
  const totalCount = thisMonthSales.length;
  const totalSum = thisMonthSales.reduce((sum, s) => sum + (s.total_amount || 0), 0);
  const avgPrice = totalCount > 0 ? Math.round(totalSum / totalCount) : 0;

  // 인기 제품 TOP
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
    <div className="w-full h-[calc(100vh-32px)] flex flex-col space-y-3 overflow-hidden max-w-[1700px] mx-auto pb-2">
      
      <div className="bg-white px-5 py-3 rounded-2xl shadow-sm border border-slate-200 flex justify-between items-center flex-shrink-0">
        <h1 className="text-lg font-extrabold text-slate-900">판매 관리</h1>
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button onClick={() => { setActiveTab("register"); resetForm(); }} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${activeTab === "register" ? "bg-white text-teal-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
            판매 등록
          </button>
          <button onClick={() => setActiveTab("history")} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${activeTab === "history" ? "bg-white text-teal-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
            전체 내역
          </button>
        </div>
      </div>

      {activeTab === "register" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 flex-1 min-h-0">
          
          <div className="lg:col-span-5 bg-white rounded-3xl shadow-sm border border-slate-200 flex flex-col p-5 overflow-y-auto space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${editingSaleId ? "bg-rose-500" : "bg-[#528771]"}`}></span> 
                {editingSaleId ? "판매 내역 수정" : "새 판매 등록"}
              </h2>
              {editingSaleId && (
                <button onClick={resetForm} className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-md hover:bg-slate-200">등록으로 전환 ✕</button>
              )}
            </div>
            
            <form onSubmit={handleSubmit} className="flex flex-col h-full space-y-4">
              
              <div>
                <label className="block font-bold text-slate-700 text-xs mb-1.5">결제 수단</label>
                <div className="flex flex-wrap gap-1">
                  {PAYMENT_METHODS.map(m => (
                    <button type="button" key={m} onClick={() => setPaymentMethod(m)} 
                      className={`px-3 py-1.5 rounded-lg font-bold transition-all border text-[11px] ${
                        paymentMethod === m ? "bg-[#528771] text-white border-[#528771] shadow-sm" : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 text-xs mb-1">판매일자 *</label>
                  <input type="date" value={saleDate} onChange={e => setSaleDate(e.target.value)} required 
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#528771]" 
                  />
                </div>
                <div className="relative">
                  <label className="block font-bold text-slate-700 text-xs mb-1">고객 선택 *</label>
                  <input type="text" placeholder="고객명/연락처 검색..." value={patientSearch} onChange={e => setPatientSearch(e.target.value)} 
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#528771]" 
                  />
                  {patientSearch && (
                    <div className="absolute z-20 w-full max-h-40 overflow-y-auto border border-slate-200 rounded-xl bg-white shadow-xl mt-1">
                      {patients.filter(p => p.name.includes(patientSearch) || (p.phone && p.phone.includes(patientSearch))).map(p => (
                        <div key={p.id} onClick={() => { setSelectedPatient(p); setPatientSearch(""); }} 
                          className="p-2.5 hover:bg-teal-50 cursor-pointer flex justify-between items-center border-b border-slate-100 last:border-none"
                        >
                          <span className="font-extrabold text-slate-900 text-xs">{p.name}</span>
                          <span className="font-bold text-slate-500 text-[11px]">{p.phone || "번호 없음"}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              {selectedPatient && (
                <div className="p-2 bg-teal-50/80 border border-teal-200 rounded-lg flex justify-between items-center -mt-2">
                  <span className="font-extrabold text-teal-900 text-xs">선택됨: {selectedPatient.name}</span>
                  <button type="button" onClick={() => setSelectedPatient(null)} className="text-[11px] text-rose-600 font-bold hover:underline">변경</button>
                </div>
              )}

              <div className="relative">
                <label className="block font-bold text-slate-700 text-xs mb-1">제품 선택 *</label>
                <input type="text" placeholder="+ 제품명 검색하여 추가..." value={productSearch} onChange={e => setProductSearch(e.target.value)} 
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#528771]" 
                />
                {productSearch && (
                  <div className="absolute z-10 w-full max-h-40 overflow-y-auto border border-slate-200 rounded-xl bg-white shadow-xl mt-1">
                    {products.filter(pr => pr.name.includes(productSearch)).map(pr => (
                      <div key={pr.id} onClick={() => handleAddProduct(pr)} 
                        className="p-2.5 hover:bg-teal-50 cursor-pointer flex justify-between items-center border-b border-slate-100 last:border-none"
                      >
                        <span className="font-extrabold text-slate-900 text-xs">{pr.name}</span>
                        <span className="font-extrabold text-teal-800 text-xs">{pr.price?.toLocaleString()}원</span>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="space-y-1.5 mt-2">
                  {selectedProducts.map(p => (
                    <div key={p.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 bg-white border border-slate-200 shadow-sm rounded-xl gap-1.5">
                      <div className="flex flex-col">
                        <span className="font-extrabold text-slate-900 text-xs">{p.name}</span>
                        <span className="text-[10px] font-bold text-slate-500">{p.price?.toLocaleString()}원</span>
                      </div>
                      <div className="flex items-center gap-1.5 self-end sm:self-auto">
                        <button type="button" onClick={() => handleQuantity(p.id, -1)} className="w-6 h-6 bg-slate-50 border border-slate-200 rounded text-xs font-black text-slate-700 hover:bg-slate-100">-</button>
                        <span className="font-extrabold w-5 text-center text-xs text-slate-900">{p.quantity}</span>
                        <button type="button" onClick={() => handleQuantity(p.id, 1)} className="w-6 h-6 bg-slate-50 border border-slate-200 rounded text-xs font-black text-slate-700 hover:bg-slate-100">+</button>
                        <span className="font-extrabold text-[#528771] ml-1 w-16 text-right text-xs">{(p.price * p.quantity).toLocaleString()}원</span>
                        <button type="button" onClick={() => setSelectedProducts(selectedProducts.filter(x => x.id !== p.id))} className="text-red-400 ml-1 hover:text-red-600 font-bold p-1 text-[10px]">✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex-1"></div>

              <div className="flex justify-between items-center p-3.5 bg-teal-50/50 border border-teal-100 rounded-2xl">
                <span className="font-black text-slate-900 text-sm">총 결제금액</span>
                <span className="font-black text-[#2e5e49] text-xl">{totalAmount.toLocaleString()}원</span>
              </div>

              <div>
                <textarea value={memo} onChange={e => setMemo(e.target.value)} rows={5} 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold resize-none focus:outline-none focus:border-[#528771]" 
                  placeholder="특이사항 입력..." 
                />
              </div>

              <div>
                <button type="submit" className={`w-full py-3 text-white font-black text-sm rounded-xl transition shadow-sm ${editingSaleId ? "bg-rose-600 hover:bg-rose-700" : "bg-[#528771] hover:bg-[#3d6856]"}`}>
                  {editingSaleId ? "판매 내역 수정 완료" : "판매 등록하기"}
                </button>
              </div>
              
            </form>
          </div>

          <div className="lg:col-span-3 flex flex-col gap-3 overflow-hidden">
            
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 flex flex-col flex-1 p-5 overflow-hidden">
              <h3 className="text-xs font-extrabold text-slate-900 mb-3 flex items-center gap-1.5">
                🔥 인기 제품 TOP
              </h3>
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 hide-scrollbar">
                {topProducts.slice(0, 15).map((p, idx) => {
                  const percent = Math.round((p.amt / totalSum) * 100) || 0;
                  return (
                    <div key={p.name} className="flex justify-between items-center text-[10px] bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <div className="flex items-center gap-1 overflow-hidden">
                        <span className="font-extrabold text-slate-800 truncate max-w-[85px]" title={p.name}>{idx + 1}. {p.name}</span>
                        <span className="text-slate-400 font-bold flex-shrink-0">({p.qty})</span>
                      </div>
                      <div className="font-black text-slate-900 flex-shrink-0 text-right ml-1">
                        {p.amt.toLocaleString()} <span className="text-teal-700 font-bold ml-0.5">({percent}%)</span>
                      </div>
                    </div>
                  );
                })}
                {topProducts.length === 0 && (
                  <div className="text-xs font-bold text-slate-400 text-center py-8">판매 데이터가 없습니다.</div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 bg-white p-4 rounded-3xl shadow-sm border border-slate-200 flex-shrink-0">
              <div className="flex justify-between items-center p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[11px] font-bold text-slate-500">이번 달 건수</span>
                <span className="text-base font-black text-slate-900">{totalCount}건</span>
              </div>
              <div className="flex justify-between items-center p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[11px] font-bold text-slate-500">이번 달 매출</span>
                <span className="text-base font-black text-[#528771]">{totalSum.toLocaleString()}원</span>
              </div>
              <div className="flex justify-between items-center p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[11px] font-bold text-slate-500">평균 객단가</span>
                <span className="text-base font-black text-slate-900">{avgPrice.toLocaleString()}원</span>
              </div>
            </div>

          </div>

          <div className="lg:col-span-4 bg-white rounded-3xl shadow-sm border border-slate-200 flex flex-col p-5 overflow-hidden">
            <h3 className="text-xs font-extrabold text-slate-900 mb-3 flex items-center justify-between">
              <span>최근 판매 내역</span>
              <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">총 {sales.length}건</span>
            </h3>
            
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 hide-scrollbar">
              {sales.slice(0, 15).map(s => (
                <div key={s.id} className="p-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors cursor-default group relative">
                  <div className="flex justify-between items-start mb-1.5">
                    <div className="flex flex-col">
                      <span className="font-black text-slate-900 text-xs">{s.patient_name}</span>
                      <span className="text-[9px] font-bold text-slate-400 mt-0.5">{s.sale_date} · {s.payment_method}</span>
                    </div>
                    <span className="font-black text-[#528771] text-sm">{s.total_amount?.toLocaleString()}원</span>
                  </div>
                  <div className="text-[11px] font-bold text-slate-600 bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                    {s.items?.map((i:any) => `${i.name}(${i.quantity})`).join(', ')}
                  </div>
                  
                  <button onClick={() => handleEdit(s)} className="absolute top-3 right-24 text-[10px] font-bold text-white bg-slate-800 px-2 py-1 rounded shadow-md opacity-0 group-hover:opacity-100 transition-opacity">
                    수정
                  </button>
                </div>
              ))}
              {sales.length === 0 && (
                <div className="text-xs font-bold text-slate-400 text-center py-8">등록된 내역이 없습니다.</div>
              )}
            </div>
          </div>

        </div>
      )}

      {activeTab === "history" && (
        <div className="flex-1 bg-white rounded-3xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#528771]"></span> 전체 판매 내역 목록
            </h2>
            <span className="text-xs font-bold text-slate-500">총 {sales.length}건</span>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/80 text-slate-600 sticky top-0 backdrop-blur-md z-10 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 font-bold whitespace-nowrap">판매일자</th>
                  <th className="py-3 px-4 font-bold whitespace-nowrap">고객명</th>
                  <th className="py-3 px-4 font-bold">판매 상품 내역</th>
                  <th className="py-3 px-4 font-bold whitespace-nowrap">결제수단</th>
                  <th className="py-3 px-4 font-bold text-right whitespace-nowrap">총 결제금액</th>
                  <th className="py-3 px-4 font-bold text-center whitespace-nowrap">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sales.length === 0 ? (
                  <tr><td colSpan={6} className="py-12 text-center text-slate-400 font-bold">등록된 판매 내역이 없습니다.</td></tr>
                ) : (
                  sales.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-600">{s.sale_date}</td>
                      <td className="py-3 px-4 font-extrabold text-slate-900">{s.patient_name}</td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-700 max-w-[250px] leading-tight">
                          {s.items?.map((i: any) => `${i.name}(${i.quantity})`).join(", ")}
                        </div>
                        {s.memo && <div className="text-[10px] text-slate-400 mt-1 truncate max-w-[250px]">{s.memo}</div>}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-600">{s.payment_method}</td>
                      <td className="py-3 px-4 font-black text-[#528771] text-right">{s.total_amount?.toLocaleString()}원</td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex justify-center gap-1.5">
                          <button onClick={() => handleEdit(s)} className="text-[11px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-md transition">수정</button>
                          <button onClick={() => handleDelete(s.id)} className="text-[11px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-md transition">삭제</button>
                        </div>
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