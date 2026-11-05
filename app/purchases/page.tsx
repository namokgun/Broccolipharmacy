"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/app/lib/supabase";

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  
  // 탭 및 수정 팝업 상태 관리
  const [activeTab, setActiveTab] = useState<"register" | "history">("register");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null);

  // 전체 내역 검색 및 정렬 상태
  const [historySearch, setHistorySearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  // 등록 폼 상태
  const [purchaseDate, setPurchaseDate] = useState("");
  const [currentMonth, setCurrentMonth] = useState("");
  const [manufacturer, setManufacturer] = useState("직접입력");
  const [isCustomManufacturer, setIsCustomManufacturer] = useState(true);
  const [customManufacturerInput, setCustomManufacturerInput] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("완료");
  const [memo, setMemo] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<any[]>([]);

  // 수정 모달 폼 상태
  const [editPurchaseDate, setEditPurchaseDate] = useState("");
  const [editManufacturer, setEditManufacturer] = useState("직접입력");
  const [editIsCustomManufacturer, setEditIsCustomManufacturer] = useState(true);
  const [editCustomManufacturerInput, setEditCustomManufacturerInput] = useState("");
  const [editPaymentStatus, setEditPaymentStatus] = useState("완료");
  const [editMemo, setEditMemo] = useState("");
  const [editSelectedProducts, setEditSelectedProducts] = useState<any[]>([]);

  useEffect(() => {
    const now = new Date();
    setPurchaseDate(now.toISOString().split('T')[0]);
    setCurrentMonth(now.toISOString().slice(0, 7));
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: pData } = await supabase.from("purchases").select("*").order("purchase_date", { ascending: false });
    if (pData) setPurchases(pData);

    const { data: prData } = await supabase.from("products").select("*").order("name");
    if (prData) setProducts(prData);
  };

  const resetForm = () => {
    setPurchaseDate(new Date().toISOString().split('T')[0]);
    setManufacturer("직접입력");
    setIsCustomManufacturer(true);
    setCustomManufacturerInput("");
    setPaymentStatus("완료");
    setSelectedProducts([]);
    setMemo("");
  };

  // 제품 및 기존 사입 내역에서 제조사(거래처) 목록 추출
  const allManufacturers = useMemo(() => {
    const fromProducts = products.map(p => p.manufacturer);
    const fromPurchases = purchases.map(p => p.manufacturer);
    return Array.from(new Set([...fromProducts, ...fromPurchases])).filter(Boolean);
  }, [products, purchases]);

  // 등록 제품 추가
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

  // 수정 모달 제품 추가
  const handleEditAddProduct = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    if (!editSelectedProducts.find(p => p.id === product.id)) {
      setEditSelectedProducts([...editSelectedProducts, { ...product, purchase_price: product.price || 0, quantity: 1 }]);
    }
  };

  const updateEditProduct = (id: string, field: string, value: number) => {
    setEditSelectedProducts(editSelectedProducts.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const removeEditProduct = (id: string) => {
    setEditSelectedProducts(editSelectedProducts.filter(p => p.id !== id));
  };

  // 수정 모달 열기
  const handleOpenEditModal = (p: any) => {
    setEditingPurchaseId(p.id);
    setEditPurchaseDate(p.purchase_date || new Date().toISOString().split('T')[0]);
    
    if (allManufacturers.includes(p.manufacturer)) {
      setEditIsCustomManufacturer(false);
      setEditManufacturer(p.manufacturer);
      setEditCustomManufacturerInput("");
    } else {
      setEditIsCustomManufacturer(true);
      setEditManufacturer("직접입력");
      setEditCustomManufacturerInput(p.manufacturer || "");
    }

    setEditPaymentStatus(p.payment_status || "완료");
    setEditSelectedProducts(p.items || []);
    setEditMemo(p.memo || "");
    setIsEditModalOpen(true);
  };

  const handleDeletePurchase = async (id: string) => {
    if (!confirm("정말 이 사입 내역을 삭제하시겠습니까?")) return;
    const { error } = await supabase.from("purchases").delete().eq("id", id);
    if (error) alert("삭제 실패: " + error.message);
    else { alert("삭제되었습니다."); fetchData(); }
  };

  // 금액 계산
  const supplyAmount = selectedProducts.reduce((sum, p) => sum + (p.purchase_price * p.quantity), 0);
  const vat = Math.floor(supplyAmount * 0.1);
  const totalAmount = supplyAmount + vat;

  const editSupplyAmount = editSelectedProducts.reduce((sum, p) => sum + (p.purchase_price * p.quantity), 0);
  const editVat = Math.floor(editSupplyAmount * 0.1);
  const editTotalAmount = editSupplyAmount + editVat;

  // 등록 제출
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
      resetForm();
      fetchData();
    }
  };

  // 수정 제출
  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalManufacturer = editIsCustomManufacturer ? editCustomManufacturerInput.trim() : editManufacturer;
    if (!finalManufacturer) return alert("거래처를 선택하거나 입력해주세요.");
    if (editSelectedProducts.length === 0) return alert("제품을 추가해주세요.");

    const payload = {
      manufacturer: finalManufacturer, 
      payment_status: editPaymentStatus, 
      purchase_date: editPurchaseDate,
      items: editSelectedProducts, 
      total_amount: editTotalAmount, 
      memo: editMemo
    };

    const { error } = await supabase.from("purchases").update(payload).eq("id", editingPurchaseId);
    if (error) alert("수정 실패: " + error.message);
    else {
      alert("수정되었습니다.");
      setIsEditModalOpen(false);
      fetchData();
    }
  };

  // 통계 계산
  const thisMonthPurchases = purchases.filter(p => currentMonth && p.purchase_date?.startsWith(currentMonth));
  const thisMonthCount = thisMonthPurchases.length;
  const thisMonthSum = thisMonthPurchases.reduce((sum, p) => sum + (p.total_amount || 0), 0);

  const manufacturerStats = useMemo(() => {
    const stats: Record<string, number> = {};
    purchases.forEach(p => {
      stats[p.manufacturer] = (stats[p.manufacturer] || 0) + p.total_amount;
    });
    return Object.entries(stats).sort((a, b) => b[1] - a[1]);
  }, [purchases]);

  const filteredHistoryPurchases = useMemo(() => {
    let list = [...purchases];
    if (historySearch) {
      const term = historySearch.toLowerCase();
      list = list.filter(p => 
        p.manufacturer?.toLowerCase().includes(term) || 
        p.purchase_date?.includes(term) ||
        p.payment_status?.includes(term) ||
        p.items?.some((i: any) => i.name.toLowerCase().includes(term))
      );
    }
    return list.sort((a, b) => {
      const dateA = new Date(a.purchase_date).getTime();
      const dateB = new Date(b.purchase_date).getTime();
      return sortOrder === "desc" ? dateB - dateA : dateA - dateB;
    });
  }, [purchases, historySearch, sortOrder]);

  return (
    <div className="w-full h-[calc(100vh-32px)] flex flex-col space-y-3 overflow-hidden max-w-[1700px] mx-auto pb-2">
      
      {/* 🟢 판매관리와 동일한 미니멀 타이틀 및 탭 네비게이션 */}
      <div className="bg-white px-5 py-3 rounded-2xl shadow-sm border border-slate-200 flex justify-between items-center flex-shrink-0">
        <h1 className="text-lg font-extrabold text-slate-900">사입 관리</h1>
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button 
            onClick={() => { setActiveTab("register"); resetForm(); }} 
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${activeTab === "register" ? "bg-white text-teal-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            사입 등록
          </button>
          <button 
            onClick={() => setActiveTab("history")} 
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${activeTab === "history" ? "bg-white text-teal-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            전체 내역
          </button>
        </div>
      </div>

      {activeTab === "register" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 flex-1 min-h-0">
          
          {/* 🟢 좌측: 새 사입 등록 폼 (공간 확장, col-span-7) */}
          <div className="lg:col-span-7 bg-white rounded-3xl shadow-sm border border-slate-200 flex flex-col p-5 overflow-y-auto space-y-3">
            <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#528771]"></span> 새 사입 등록
            </h2>
            
            <form onSubmit={handleSubmit} className="flex flex-col h-full space-y-3 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">사입일 *</label>
                  <input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} required className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold focus:outline-none focus:border-[#528771]" />
                </div>
                
                <div>
                  <label className="block font-bold text-slate-700 mb-1">거래처(제조사) *</label>
                  <select 
                    value={isCustomManufacturer ? "직접입력" : manufacturer}
                    onChange={e => {
                      if (e.target.value === "직접입력") { setIsCustomManufacturer(true); setCustomManufacturerInput(""); } 
                      else { setIsCustomManufacturer(false); setManufacturer(e.target.value); }
                    }}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold focus:outline-none focus:border-[#528771] mb-1"
                  >
                    <option value="직접입력">직접 입력</option>
                    {allManufacturers.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  {isCustomManufacturer && (
                    <input type="text" value={customManufacturerInput} onChange={e => setCustomManufacturerInput(e.target.value)} placeholder="새 거래처명 입력..." required className="w-full p-2 bg-teal-50/50 border border-teal-200 rounded-xl font-semibold focus:outline-none focus:border-[#528771]" />
                  )}
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">결제 상태</label>
                  <select value={paymentStatus} onChange={e => setPaymentStatus(e.target.value)} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold focus:outline-none focus:border-[#528771]">
                    <option value="완료">결제 완료</option>
                    <option value="미결제">미결제</option>
                  </select>
                </div>
              </div>

              {/* 제품 테이블 영역 */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50">
                <table className="w-full text-left">
                  <thead className="bg-slate-100/50 border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="py-2 px-3 font-bold whitespace-nowrap">제품명</th>
                      <th className="py-2 px-3 font-bold w-28 whitespace-nowrap">매입 단가</th>
                      <th className="py-2 px-3 font-bold w-20 whitespace-nowrap">수량</th>
                      <th className="py-2 px-3 font-bold w-28 text-right whitespace-nowrap">공급가액</th>
                      <th className="py-2 px-3 font-bold w-12 text-center whitespace-nowrap">관리</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {selectedProducts.map(p => (
                      <tr key={p.id}>
                        <td className="py-1.5 px-3 font-extrabold text-slate-800 truncate max-w-[140px]" title={p.name}>{p.name}</td>
                        <td className="py-1.5 px-3"><input type="number" value={p.purchase_price} onChange={e => updateProduct(p.id, 'purchase_price', Number(e.target.value))} className="w-full p-1 bg-slate-50 border rounded-lg text-right font-semibold focus:outline-none focus:border-teal-500" /></td>
                        <td className="py-1.5 px-3"><input type="number" value={p.quantity} onChange={e => updateProduct(p.id, 'quantity', Number(e.target.value))} className="w-full p-1 bg-slate-50 border rounded-lg text-center font-semibold focus:outline-none focus:border-teal-500" /></td>
                        <td className="py-1.5 px-3 text-right font-bold text-slate-700">{(p.purchase_price * p.quantity).toLocaleString()}원</td>
                        <td className="py-1.5 px-3 text-center"><button type="button" onClick={() => removeProduct(p.id)} className="text-red-500 font-bold hover:bg-red-50 p-1 rounded-lg">✕</button></td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={5} className="py-2 px-3 bg-slate-50/50">
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

              {/* 금액 요약 바 */}
              <div className="flex justify-between items-center px-4 py-2.5 bg-slate-50 rounded-xl font-extrabold text-slate-700 border border-slate-100">
                <div className="flex items-center gap-4">
                  <span>공급가액 <span className="text-slate-900 ml-1">{supplyAmount.toLocaleString()}원</span></span>
                  <span className="text-slate-300">|</span>
                  <span>부가세 <span className="text-slate-900 ml-1">{vat.toLocaleString()}원</span></span>
                </div>
                <div className="text-[#528771]">총 사입 금액 <span className="text-base ml-1.5">{totalAmount.toLocaleString()}원</span></div>
              </div>

              <div className="flex-1"></div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">비고 / 메모</label>
                <textarea value={memo} onChange={e => setMemo(e.target.value)} rows={3} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold resize-none focus:outline-none focus:border-[#528771]" placeholder="특이사항 입력..." />
              </div>

              <div className="pt-1">
                <button type="submit" className="w-full py-3 bg-[#528771] hover:bg-[#3d6856] text-white font-black text-xs rounded-xl transition shadow-sm">사입 등록하기</button>
              </div>
            </form>
          </div>

          {/* 우측: 제조사별 매입액 & 최근 등록 내역 (col-span-5) */}
          <div className="lg:col-span-5 flex flex-col gap-3 overflow-hidden">
            
            <div className="grid grid-cols-2 gap-2 bg-white p-4 rounded-3xl shadow-sm border border-slate-200 flex-shrink-0">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                <div><span className="text-[10px] font-bold text-slate-400 block mb-0.5">이번 달 사입 건수</span><span className="text-base font-extrabold text-slate-900">{thisMonthCount}건</span></div>
                <span className="text-2xl">🛒</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                <div><span className="text-[10px] font-bold text-slate-400 block mb-0.5">이번 달 사입 금액</span><span className="text-base font-extrabold text-[#528771]">{thisMonthSum.toLocaleString()}원</span></div>
                <span className="text-2xl">₩</span>
              </div>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 flex flex-col p-4 flex-shrink-0">
              <h3 className="text-xs font-extrabold text-slate-900 mb-2 flex items-center gap-1.5">🏢 제조사별 매입액 (전체 누적)</h3>
              <div className="space-y-2 max-h-36 overflow-y-auto pr-1 hide-scrollbar">
                {manufacturerStats.map(([mfg, amt], idx) => {
                  const totalAllSum = purchases.reduce((sum, p) => sum + (p.total_amount || 0), 0);
                  const percent = Math.round((amt / totalAllSum) * 100) || 0;
                  return (
                    <div key={mfg} className="text-[10px]">
                      <div className="flex justify-between font-bold mb-0.5"><span className="text-slate-700">{idx + 1}. {mfg}</span><span className="text-slate-900">{amt.toLocaleString()}원 ({percent}%)</span></div>
                      <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden"><div className="bg-[#528771] h-full rounded-full" style={{ width: `${percent}%` }}></div></div>
                    </div>
                  );
                })}
                {manufacturerStats.length === 0 && <div className="text-[11px] text-slate-400 text-center py-2">데이터가 없습니다.</div>}
              </div>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 flex flex-col flex-1 p-4 overflow-hidden">
              <h3 className="text-xs font-extrabold text-slate-900 mb-2 flex justify-between items-center">
                <span>최근 등록된 내역</span>
                <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">총 {purchases.length}건</span>
              </h3>
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 hide-scrollbar">
                {purchases.map(p => (
                  <div key={p.id} className="py-2 px-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors cursor-default group relative flex flex-col justify-between">
                    <div className="flex justify-between items-center">
                      <div className="flex items-baseline gap-2 overflow-hidden">
                        <span className="font-black text-slate-900 text-xs truncate">{p.manufacturer}</span>
                        <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap">({p.purchase_date} · {p.payment_status})</span>
                      </div>
                      <span className="font-black text-[#528771] text-xs whitespace-nowrap ml-2">{p.total_amount?.toLocaleString()}원</span>
                    </div>
                    <div className="text-[10px] font-bold text-slate-600 truncate mt-0.5">
                      {p.items?.map((i:any) => `${i.name}(${i.quantity})`).join(', ')}
                    </div>
                    
                    <button onClick={() => handleOpenEditModal(p)} className="absolute top-2 right-2 text-[10px] font-bold text-white bg-slate-800 px-2 py-0.5 rounded shadow-md opacity-0 group-hover:opacity-100 transition-opacity">
                      수정
                    </button>
                  </div>
                ))}
                {purchases.length === 0 && <div className="text-xs font-bold text-slate-400 text-center py-8">등록된 내역이 없습니다.</div>}
              </div>
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
                <span className="w-2 h-2 rounded-full bg-[#528771]"></span> 전체 사입 내역 목록
              </h2>
              <span className="text-xs font-bold text-slate-500 whitespace-nowrap">총 {filteredHistoryPurchases.length}건</span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <input 
                type="text" 
                placeholder="날짜, 거래처명, 제품명 검색..." 
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
          
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/80 text-slate-600 sticky top-0 backdrop-blur-md z-10 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 font-bold whitespace-nowrap">사입일</th>
                  <th className="py-3 px-4 font-bold whitespace-nowrap">거래처(제조사)</th>
                  <th className="py-3 px-4 font-bold">매입 상품 내역</th>
                  <th className="py-3 px-4 font-bold whitespace-nowrap">상태</th>
                  <th className="py-3 px-4 font-bold text-right whitespace-nowrap">총 사입 금액</th>
                  <th className="py-3 px-4 font-bold text-center whitespace-nowrap">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredHistoryPurchases.length === 0 ? (
                  <tr><td colSpan={6} className="py-12 text-center text-slate-400 font-bold">검색된 사입 내역이 없습니다.</td></tr>
                ) : (
                  filteredHistoryPurchases.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-extrabold text-slate-800">{p.purchase_date}</td>
                      <td className="py-3 px-4 font-extrabold text-slate-900">{p.manufacturer}</td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-700 max-w-[250px] leading-tight">
                          {p.items?.map((i: any) => `${i.name}(${i.quantity})`).join(", ")}
                        </div>
                        {p.memo && <div className="text-[10px] text-slate-400 mt-1 truncate max-w-[250px]">{p.memo}</div>}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-600">
                        <span className={`px-2 py-0.5 rounded text-[10px] ${p.payment_status === '완료' ? 'bg-teal-50 text-teal-700' : 'bg-rose-50 text-rose-700'}`}>{p.payment_status}</span>
                      </td>
                      <td className="py-3 px-4 font-black text-[#528771] text-right">{p.total_amount?.toLocaleString()}원</td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex justify-center gap-1.5">
                          <button onClick={() => handleOpenEditModal(p)} className="text-[11px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-md transition">수정</button>
                          <button onClick={() => handleDeletePurchase(p.id)} className="text-[11px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-md transition">삭제</button>
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

      {/* =========================================================================
          🟢 사입 내역 수정 팝업 모달 (Modal)
      ========================================================================= */}
      {isEditModalOpen && (
        <div onClick={() => setIsEditModalOpen(false)} className="fixed inset-0 z-[120] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer">
          <div className="bg-white w-full max-w-xl max-h-[90vh] rounded-3xl p-6 shadow-2xl border border-slate-200 flex flex-col cursor-default" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b pb-3 mb-4 shrink-0">
              <h3 className="text-base font-bold text-slate-900">사입 내역 수정</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-200">✕</button>
            </div>

            <form onSubmit={handleUpdateSubmit} className="flex-1 overflow-y-auto pr-2 space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">사입일 *</label>
                  <input type="date" value={editPurchaseDate} onChange={e => setEditPurchaseDate(e.target.value)} required className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold focus:outline-none focus:border-[#528771]" />
                </div>
                
                <div>
                  <label className="block font-bold text-slate-700 mb-1">거래처(제조사) *</label>
                  <select 
                    value={editIsCustomManufacturer ? "직접입력" : editManufacturer}
                    onChange={e => {
                      if (e.target.value === "직접입력") { setEditIsCustomManufacturer(true); setEditCustomManufacturerInput(""); } 
                      else { setEditIsCustomManufacturer(false); setEditManufacturer(e.target.value); }
                    }}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold focus:outline-none focus:border-[#528771] mb-1"
                  >
                    <option value="직접입력">직접 입력</option>
                    {allManufacturers.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  {editIsCustomManufacturer && (
                    <input type="text" value={editCustomManufacturerInput} onChange={e => setEditCustomManufacturerInput(e.target.value)} placeholder="새 거래처명 입력..." required className="w-full p-2.5 bg-teal-50/50 border border-teal-200 rounded-xl font-semibold focus:outline-none focus:border-[#528771]" />
                  )}
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">결제 상태</label>
                  <select value={editPaymentStatus} onChange={e => setEditPaymentStatus(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold focus:outline-none focus:border-[#528771]">
                    <option value="완료">결제 완료</option>
                    <option value="미결제">미결제</option>
                  </select>
                </div>
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50">
                <table className="w-full text-left">
                  <thead className="bg-slate-100/50 border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="py-2.5 px-3 font-bold whitespace-nowrap">제품명</th>
                      <th className="py-2.5 px-3 font-bold w-28 whitespace-nowrap">매입 단가</th>
                      <th className="py-2.5 px-3 font-bold w-20 whitespace-nowrap">수량</th>
                      <th className="py-2.5 px-3 font-bold w-28 text-right whitespace-nowrap">공급가액</th>
                      <th className="py-2.5 px-3 font-bold w-12 text-center whitespace-nowrap">관리</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {editSelectedProducts.map(p => (
                      <tr key={p.id}>
                        <td className="py-2 px-3 font-extrabold text-slate-800">{p.name}</td>
                        <td className="py-2 px-3"><input type="number" value={p.purchase_price} onChange={e => updateEditProduct(p.id, 'purchase_price', Number(e.target.value))} className="w-full p-1.5 bg-slate-50 border rounded-lg text-right font-semibold" /></td>
                        <td className="py-2 px-3"><input type="number" value={p.quantity} onChange={e => updateEditProduct(p.id, 'quantity', Number(e.target.value))} className="w-full p-1.5 bg-slate-50 border rounded-lg text-center font-semibold" /></td>
                        <td className="py-2 px-3 text-right font-bold text-slate-700">{(p.purchase_price * p.quantity).toLocaleString()}원</td>
                        <td className="py-2 px-3 text-center"><button type="button" onClick={() => removeEditProduct(p.id)} className="text-red-500 font-bold hover:bg-red-50 p-1.5 rounded-lg">✕</button></td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={5} className="py-3 px-4 bg-slate-50/50">
                        <select 
                          className="w-full p-2 bg-white border border-slate-200 rounded-xl font-semibold text-slate-700 focus:outline-none focus:border-[#528771]"
                          value=""
                          onChange={(e) => handleEditAddProduct(e.target.value)}
                        >
                          <option value="" disabled>+ 제품 추가하기...</option>
                          {products.map(pr => (
                            <option key={pr.id} value={pr.id}>{pr.name}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl font-extrabold text-sm">
                <span>총 사입 금액</span>
                <span className="text-[#528771] text-base">{editTotalAmount.toLocaleString()}원</span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">비고</label>
                <textarea value={editMemo} onChange={e => setEditMemo(e.target.value)} rows={3} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold resize-none focus:outline-none focus:border-[#528771]" placeholder="특이사항 입력..." />
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