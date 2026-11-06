"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/app/lib/supabase";

const PAYMENT_METHODS = ["카드", "링크", "홈피", "매장", "현영", "사업자", "입금", "지역상품", "기타"];

export default function SalesPage() {
  const [sales, setSales] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  
  // 탭 및 팝업 모달 상태 관리
  const [activeTab, setActiveTab] = useState<"register" | "history">("register");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);

  // 전체 내역 정렬 및 검색 상태
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [historySearch, setHistorySearch] = useState("");

  // 등록 폼 상태
  const [saleDate, setSaleDate] = useState("");
  const [currentMonth, setCurrentMonth] = useState("");
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0]);
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);
  const [patientSearch, setPatientSearch] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<any[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [memo, setMemo] = useState("");

  // 수정 모달 폼 상태
  const [editSaleDate, setEditSaleDate] = useState("");
  const [editPaymentMethod, setEditPaymentMethod] = useState(PAYMENT_METHODS[0]);
  const [editSelectedPatient, setEditSelectedPatient] = useState<any | null>(null);
  const [editPatientSearch, setEditPatientSearch] = useState("");
  const [editSelectedProducts, setEditSelectedProducts] = useState<any[]>([]);
  const [editProductSearch, setEditProductSearch] = useState("");
  const [editMemo, setEditMemo] = useState("");

  useEffect(() => { 
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
    setSaleDate(new Date().toISOString().split('T')[0]);
    setPaymentMethod(PAYMENT_METHODS[0]);
    setSelectedPatient(null);
    setSelectedProducts([]);
    setMemo("");
    setPatientSearch("");
    setProductSearch("");
  };

  const getCustomerDisplayInfo = (p: any) => {
    if (p.custom_id) return p.custom_id;
    if (p.phone) return p.phone;
    return "번호 없음";
  };

  const handleOpenEditModal = (sale: any) => {
    setEditingSaleId(sale.id);
    setEditSaleDate(sale.sale_date || new Date().toISOString().split('T')[0]);
    setEditPaymentMethod(sale.payment_method);
    
    const pt = patients.find(p => p.id === sale.patient_id);
    setEditSelectedPatient(pt || { id: sale.patient_id, name: sale.patient_name });
    
    setEditSelectedProducts(sale.items || []);
    setEditMemo(sale.memo || "");
    setEditPatientSearch("");
    setEditProductSearch("");
    setIsEditModalOpen(true);
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

  const handleManualQuantity = (id: string, val: string, isEdit: boolean) => {
    const qty = parseInt(val, 10);
    const validQty = isNaN(qty) || qty < 1 ? 1 : qty;
    
    if (isEdit) {
      setEditSelectedProducts(editSelectedProducts.map(p => p.id === id ? { ...p, quantity: validQty } : p));
    } else {
      setSelectedProducts(selectedProducts.map(p => p.id === id ? { ...p, quantity: validQty } : p));
    }
  };

  const totalAmount = selectedProducts.reduce((sum, p) => sum + (p.price || 0) * p.quantity, 0);

  const handleEditAddProduct = (product: any) => {
    const existing = editSelectedProducts.find(p => p.id === product.id);
    if (existing) setEditSelectedProducts(editSelectedProducts.map(p => p.id === product.id ? { ...p, quantity: p.quantity + 1 } : p));
    else setEditSelectedProducts([...editSelectedProducts, { ...product, quantity: 1 }]);
    setEditProductSearch("");
  };

  const handleEditQuantity = (id: string, d: number) => {
    setEditSelectedProducts(editSelectedProducts.map(p => p.id === id ? { ...p, quantity: Math.max(1, p.quantity + d) } : p));
  };

  const editTotalAmount = editSelectedProducts.reduce((sum, p) => sum + (p.price || 0) * p.quantity, 0);

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

    const { error } = await supabase.from("sales").insert([payload]);
    if (error) alert("등록 실패: " + error.message);
    else { alert("등록되었습니다."); resetForm(); fetchData(); }
  };

  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSaleDate) return alert("판매일자를 입력해주세요.");
    if (!editSelectedPatient) return alert("고객을 선택해주세요.");
    if (editSelectedProducts.length === 0) return alert("판매할 제품을 선택해주세요.");

    const payload = {
      patient_id: editSelectedPatient.id, 
      patient_name: editSelectedPatient.name, 
      payment_method: editPaymentMethod,
      items: editSelectedProducts, 
      total_amount: editTotalAmount, 
      memo: editMemo, 
      sale_date: editSaleDate
    };

    const { error } = await supabase.from("sales").update(payload).eq("id", editingSaleId);
    if (error) alert("수정 실패: " + error.message);
    else { 
      alert("수정되었습니다."); 
      setIsEditModalOpen(false); 
      fetchData(); 
    }
  };

  const thisMonthSales = sales.filter(s => currentMonth && s.sale_date?.startsWith(currentMonth));
  const totalCount = thisMonthSales.length;
  const totalSum = thisMonthSales.reduce((sum, s) => sum + (s.total_amount || 0), 0);
  const avgPrice = totalCount > 0 ? Math.round(totalSum / totalCount) : 0;

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

  const filteredHistorySales = useMemo(() => {
    let list = [...sales];
    if (historySearch) {
      const term = historySearch.toLowerCase();
      list = list.filter(s => {
        const pt = patients.find(p => p.id === s.patient_id);
        return (
          s.patient_name?.toLowerCase().includes(term) || 
          pt?.custom_id?.toLowerCase().includes(term) || 
          pt?.phone?.includes(term) || 
          s.sale_date?.includes(term) ||
          s.payment_method?.includes(term) ||
          s.items?.some((i: any) => i.name.toLowerCase().includes(term))
        );
      });
    }
    return list.sort((a, b) => {
      const dateA = new Date(a.sale_date).getTime();
      const dateB = new Date(b.sale_date).getTime();
      return sortOrder === "desc" ? dateB - dateA : dateA - dateB;
    });
  }, [sales, patients, historySearch, sortOrder]);

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
            <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#528771]"></span> 새 판매 등록
            </h2>
            
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
                  <input type="text" placeholder="이름/ID/전화번호 검색..." value={patientSearch} onChange={e => setPatientSearch(e.target.value)} 
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#528771]" 
                  />
                  {patientSearch && (
                    <div className="absolute z-20 w-full max-h-40 overflow-y-auto border border-slate-200 rounded-xl bg-white shadow-xl mt-1">
                      {patients.filter(p => p.name.includes(patientSearch) || p.custom_id?.includes(patientSearch) || p.phone?.includes(patientSearch)).map(p => (
                        <div key={p.id} onClick={() => { setSelectedPatient(p); setPatientSearch(""); }} 
                          className="p-2.5 hover:bg-teal-50 cursor-pointer flex justify-between items-center border-b border-slate-100 last:border-none"
                        >
                          <span className="font-extrabold text-slate-900 text-xs">{p.name}</span>
                          <span className="font-bold text-slate-500 text-[11px]">{getCustomerDisplayInfo(p)}</span>
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
                        
                        <input 
                          type="number" 
                          value={p.quantity === 0 ? "" : p.quantity}
                          onChange={(e) => handleManualQuantity(p.id, e.target.value, false)}
                          className="w-10 h-6 text-center text-xs font-extrabold text-slate-900 border border-slate-200 rounded focus:outline-none focus:border-[#528771] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                        />
                        
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
                <button type="submit" className="w-full py-3 bg-[#528771] hover:bg-[#3d6856] text-white font-black text-sm rounded-xl transition shadow-sm">
                  판매 등록하기
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

          <div className="lg:col-span-4 bg-white rounded-3xl shadow-sm border border-slate-200 flex flex-col p-4 overflow-hidden">
            <h3 className="text-xs font-extrabold text-slate-900 mb-2.5 flex items-center justify-between">
              <span>최근 판매 내역</span>
              <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">총 {sales.length}건</span>
            </h3>
            
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 hide-scrollbar">
              {sales.map(s => (
                <div key={s.id} className="py-2 px-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors cursor-default group relative flex flex-col justify-between">
                  <div className="flex justify-between items-center">
                    <div className="flex items-baseline gap-2 overflow-hidden">
                      <span className="font-black text-slate-900 text-xs truncate">{s.patient_name}</span>
                      <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap">({s.sale_date} · {s.payment_method})</span>
                    </div>
                    <span className="font-black text-[#528771] text-xs whitespace-nowrap ml-2">{s.total_amount?.toLocaleString()}원</span>
                  </div>
                  <div className="text-[10px] font-bold text-slate-600 truncate mt-0.5">
                    {s.items?.map((i:any) => `${i.name}(${i.quantity})`).join(', ')}
                  </div>
                  
                  <button onClick={() => handleOpenEditModal(s)} className="absolute top-2 right-2 text-[10px] font-bold text-white bg-slate-800 px-2 py-0.5 rounded shadow-md opacity-0 group-hover:opacity-100 transition-opacity">
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

      {/* 탭 2: 전체 내역 조회 */}
      {activeTab === "history" && (
        <div className="flex-1 bg-white rounded-3xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center bg-slate-50/50 gap-3">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5 whitespace-nowrap">
                <span className="w-2 h-2 rounded-full bg-[#528771]"></span> 전체 판매 내역 목록
              </h2>
              <span className="text-xs font-bold text-slate-500 whitespace-nowrap">총 {filteredHistorySales.length}건</span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <input 
                type="text" 
                placeholder="날짜, 고객명, 제품명 검색..." 
                value={historySearch} 
                onChange={(e) => setHistorySearch(e.target.value)}
                className="w-full sm:w-64 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#528771]"
              />
              <button 
                onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition whitespace-nowrap shadow-xs"
              >
                {sortOrder === "desc" ? "📅 최신순 ↓" : "📅 과거순 ↑"}
              </button>
            </div>
          </div>
          
          <div className="flex-1 overflow-x-auto overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/80 text-slate-600 sticky top-0 backdrop-blur-md z-10 border-b border-slate-200">
                <tr>
                  {/* 🟢 [수정됨] 간격 늘리고 줄바꿈 방지 적용 */}
                  <th className="py-3 px-4 font-bold whitespace-nowrap w-[110px]">판매일자</th>
                  <th className="py-3 px-4 font-bold whitespace-nowrap w-[90px]">고객명</th>
                  <th className="py-3 px-4 font-bold whitespace-nowrap w-[100px]">ID</th>
                  <th className="py-3 px-4 font-bold w-[220px]">판매 상품 내역</th>
                  
                  <th className="py-3 px-4 font-extrabold w-auto min-w-[250px] text-slate-800">코멘트</th>
                  
                  <th className="py-3 px-4 font-bold text-center whitespace-nowrap w-[90px]">결제수단</th>
                  <th className="py-3 px-4 font-bold text-right whitespace-nowrap w-[110px]">총 결제금액</th>
                  <th className="py-3 px-4 font-bold text-center whitespace-nowrap w-[90px]">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredHistorySales.length === 0 ? (
                  <tr><td colSpan={8} className="py-12 text-center text-slate-400 font-bold">검색된 판매 내역이 없습니다.</td></tr>
                ) : (
                  filteredHistorySales.map((s) => {
                    const pt = patients.find(p => p.id === s.patient_id);
                    const ptId = pt?.custom_id || "-";

                    return (
                      <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                        {/* 🟢 [수정됨] 데이터 셀에도 whitespace-nowrap 강제 적용 */}
                        <td className="py-3 px-4 font-extrabold text-slate-800 whitespace-nowrap">{s.sale_date}</td>
                        <td className="py-3 px-4 font-extrabold text-slate-900 whitespace-nowrap">{s.patient_name}</td>
                        <td className="py-3 px-4 font-bold text-slate-600 whitespace-nowrap">{ptId}</td>
                        
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-700 max-w-[250px] leading-tight">
                            {s.items?.map((i: any) => `${i.name}(${i.quantity})`).join(", ")}
                          </div>
                        </td>
                        
                        <td className="py-3 px-4 text-slate-600 font-medium whitespace-normal break-words max-w-md">
                          {s.memo || "-"}
                        </td>
                        
                        <td className="py-3 px-4 font-bold text-slate-600 text-center whitespace-nowrap">{s.payment_method}</td>
                        <td className="py-3 px-4 font-black text-[#528771] text-right whitespace-nowrap">{s.total_amount?.toLocaleString()}원</td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <div className="flex justify-center gap-1.5">
                            <button onClick={() => handleOpenEditModal(s)} className="text-[11px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-md transition">수정</button>
                            <button onClick={() => handleDelete(s.id)} className="text-[11px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-md transition">삭제</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          🟢 판매 내역 수정 팝업 모달 (Modal)
      ========================================================================= */}
      {isEditModalOpen && (
        <div onClick={() => setIsEditModalOpen(false)} className="fixed inset-0 z-[120] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer">
          <div className="bg-white w-full max-w-xl max-h-[90vh] rounded-3xl p-6 shadow-2xl border border-slate-200 flex flex-col cursor-default" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b pb-3 mb-4 shrink-0">
              <h3 className="text-base font-bold text-slate-900">판매 내역 수정</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-200">✕</button>
            </div>

            <form onSubmit={handleUpdateSubmit} className="flex-1 overflow-y-auto pr-2 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">결제 수단</label>
                <div className="flex flex-wrap gap-1">
                  {PAYMENT_METHODS.map(m => (
                    <button type="button" key={m} onClick={() => setEditPaymentMethod(m)} 
                      className={`px-3 py-1.5 rounded-lg font-bold transition-all border text-[11px] ${
                        editPaymentMethod === m ? "bg-[#528771] text-white border-[#528771] shadow-sm" : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">판매일자 *</label>
                  <input type="date" value={editSaleDate} onChange={e => setEditSaleDate(e.target.value)} required 
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold focus:outline-none focus:border-[#528771]" 
                  />
                </div>
                <div className="relative">
                  <label className="block font-bold text-slate-700 mb-1">고객 선택 *</label>
                  <input type="text" placeholder="이름/ID/전화번호 검색..." value={editPatientSearch} onChange={e => setEditPatientSearch(e.target.value)} 
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold focus:outline-none focus:border-[#528771]" 
                  />
                  {editPatientSearch && (
                    <div className="absolute z-20 w-full max-h-40 overflow-y-auto border border-slate-200 rounded-xl bg-white shadow-xl mt-1">
                      {patients.filter(p => p.name.includes(editPatientSearch) || p.custom_id?.includes(editPatientSearch) || p.phone?.includes(editPatientSearch)).map(p => (
                        <div key={p.id} onClick={() => { setEditSelectedPatient(p); setEditPatientSearch(""); }} 
                          className="p-2.5 hover:bg-teal-50 cursor-pointer flex justify-between items-center border-b border-slate-100 last:border-none"
                        >
                          <span className="font-extrabold text-slate-900">{p.name}</span>
                          <span className="font-bold text-slate-500">{getCustomerDisplayInfo(p)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {editSelectedPatient && (
                <div className="p-2.5 bg-teal-50/80 border border-teal-200 rounded-xl flex justify-between items-center">
                  <span className="font-extrabold text-teal-900">선택된 고객: {editSelectedPatient.name}</span>
                  <button type="button" onClick={() => setEditSelectedPatient(null)} className="text-rose-600 font-bold hover:underline">변경</button>
                </div>
              )}

              <div className="relative">
                <label className="block font-bold text-slate-700 mb-1">제품 선택 *</label>
                <input type="text" placeholder="+ 제품명 검색하여 추가..." value={editProductSearch} onChange={e => setEditProductSearch(e.target.value)} 
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold focus:outline-none focus:border-[#528771]" 
                />
                {editProductSearch && (
                  <div className="absolute z-10 w-full max-h-40 overflow-y-auto border border-slate-200 rounded-xl bg-white shadow-xl mt-1">
                    {products.filter(pr => pr.name.includes(editProductSearch)).map(pr => (
                      <div key={pr.id} onClick={() => handleEditAddProduct(pr)} 
                        className="p-2.5 hover:bg-teal-50 cursor-pointer flex justify-between items-center border-b border-slate-100 last:border-none"
                      >
                        <span className="font-extrabold text-slate-900">{pr.name}</span>
                        <span className="font-extrabold text-teal-800">{pr.price?.toLocaleString()}원</span>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="space-y-2 mt-2">
                  {editSelectedProducts.map(p => (
                    <div key={p.id} className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-100 rounded-xl">
                      <div className="flex flex-col">
                        <span className="font-extrabold text-slate-900">{p.name}</span>
                        <span className="text-slate-500">{p.price?.toLocaleString()}원</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => handleEditQuantity(p.id, -1)} className="w-6 h-6 bg-white border rounded font-bold">-</button>
                        
                        <input 
                          type="number" 
                          value={p.quantity === 0 ? "" : p.quantity}
                          onChange={(e) => handleManualQuantity(p.id, e.target.value, true)}
                          className="w-10 h-6 text-center font-extrabold text-slate-900 border border-slate-200 rounded focus:outline-none focus:border-[#528771] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                        />
                        
                        <button type="button" onClick={() => handleEditQuantity(p.id, 1)} className="w-6 h-6 bg-white border rounded font-bold">+</button>
                        <span className="font-extrabold text-teal-900 ml-2">{(p.price * p.quantity).toLocaleString()}원</span>
                        <button type="button" onClick={() => setEditSelectedProducts(editSelectedProducts.filter(x => x.id !== p.id))} className="text-red-400 ml-2 hover:text-red-600 font-bold">✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl font-extrabold text-sm">
                <span>총 결제금액</span>
                <span className="text-[#528771] text-base">{editTotalAmount.toLocaleString()}원</span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">비고</label>
                <textarea value={editMemo} onChange={e => setEditMemo(e.target.value)} rows={3} 
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold resize-none focus:outline-none focus:border-[#528771]" 
                  placeholder="특이사항 입력..." 
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 shrink-0">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-4 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition">취소</button>
                <button type="submit" className="px-6 py-2.5 bg-rose-600 text-white font-bold rounded-xl hover:bg-rose-700 transition shadow-sm">
                  수정 완료
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}