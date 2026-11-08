"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/app/lib/supabase";

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  
  const [activeTab, setActiveTab] = useState<"register" | "history">("register");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null);

  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [historySearch, setHistorySearch] = useState("");

  const [purchaseDate, setPurchaseDate] = useState("");
  const [currentMonth, setCurrentMonth] = useState("");
  const [manufacturer, setManufacturer] = useState("직접입력");
  const [isCustomManufacturer, setIsCustomManufacturer] = useState(true);
  const [customManufacturerInput, setCustomManufacturerInput] = useState("");
  const [memo, setMemo] = useState("");
  
  const [productSearch, setProductSearch] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<any[]>([]);

  const [editPurchaseDate, setEditPurchaseDate] = useState("");
  const [editManufacturer, setEditManufacturer] = useState("직접입력");
  const [editIsCustomManufacturer, setEditIsCustomManufacturer] = useState(true);
  const [editCustomManufacturerInput, setEditCustomManufacturerInput] = useState("");
  const [editMemo, setEditMemo] = useState("");
  
  const [editProductSearch, setEditProductSearch] = useState("");
  const [editSelectedProducts, setEditSelectedProducts] = useState<any[]>([]);

  const [expandedRecentIds, setExpandedRecentIds] = useState<string[]>([]);
  const [expandedHistoryIds, setExpandedHistoryIds] = useState<string[]>([]);

  const toggleRecent = (id: string) => {
    setExpandedRecentIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };
  const toggleHistory = (id: string) => {
    setExpandedHistoryIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

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
    setSelectedProducts([]);
    setMemo("");
    setProductSearch("");
  };

  const allManufacturers = useMemo(() => {
    const fromProducts = products.map(p => p.manufacturer);
    const fromPurchases = purchases.map(p => p.manufacturer);
    return Array.from(new Set([...fromProducts, ...fromPurchases])).filter(Boolean);
  }, [products, purchases]);

  const handleAddProduct = (product: any) => {
    const existing = selectedProducts.find(p => p.id === product.id);
    if (existing) {
      setSelectedProducts(selectedProducts.map(p => p.id === product.id ? { ...p, quantity: p.quantity + 1 } : p));
    } else {
      setSelectedProducts([...selectedProducts, { 
        ...product, 
        original_price: product.price || 0, 
        purchase_price: product.purchase_price || 0, 
        quantity: 1 
      }]);
    }
    setProductSearch("");
  };

  const handleQuantity = (id: string, d: number) => {
    setSelectedProducts(selectedProducts.map(p => p.id === id ? { ...p, quantity: Math.max(1, p.quantity + d) } : p));
  };

  const handleManualQuantity = (id: string, val: string) => {
    const qty = parseInt(val, 10);
    const validQty = isNaN(qty) || qty < 1 ? 1 : qty;
    setSelectedProducts(selectedProducts.map(p => p.id === id ? { ...p, quantity: validQty } : p));
  };

  const removeProduct = (id: string) => {
    setSelectedProducts(selectedProducts.filter(p => p.id !== id));
  };

  const handleEditAddProduct = (product: any) => {
    const existing = editSelectedProducts.find(p => p.id === product.id);
    if (existing) {
      setEditSelectedProducts(editSelectedProducts.map(p => p.id === product.id ? { ...p, quantity: p.quantity + 1 } : p));
    } else {
      setEditSelectedProducts([...editSelectedProducts, { 
        ...product, 
        original_price: product.price || 0, 
        purchase_price: product.purchase_price || 0, 
        quantity: 1 
      }]);
    }
    setEditProductSearch("");
  };

  const handleEditQuantity = (id: string, d: number) => {
    setEditSelectedProducts(editSelectedProducts.map(p => p.id === id ? { ...p, quantity: Math.max(1, p.quantity + d) } : p));
  };

  const handleEditManualQuantity = (id: string, val: string) => {
    const qty = parseInt(val, 10);
    const validQty = isNaN(qty) || qty < 1 ? 1 : qty;
    setEditSelectedProducts(editSelectedProducts.map(p => p.id === id ? { ...p, quantity: validQty } : p));
  };

  const removeEditProduct = (id: string) => {
    setEditSelectedProducts(editSelectedProducts.filter(p => p.id !== id));
  };

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

    setEditSelectedProducts(p.items || []);
    setEditMemo(p.memo || "");
    setEditProductSearch("");
    setIsEditModalOpen(true);
  };

  const handleDeletePurchase = async (id: string) => {
    if (!confirm("정말 이 사입 내역을 삭제하시겠습니까?")) return;
    const { error } = await supabase.from("purchases").delete().eq("id", id);
    if (error) alert("삭제 실패: " + error.message);
    else { alert("삭제되었습니다."); fetchData(); }
  };

  const totalAmount = selectedProducts.reduce((sum, p) => sum + ((p.purchase_price || 0) * p.quantity), 0);
  const editTotalAmount = editSelectedProducts.reduce((sum, p) => sum + ((p.purchase_price || 0) * p.quantity), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalManufacturer = isCustomManufacturer ? customManufacturerInput.trim() : manufacturer;
    if (!finalManufacturer) return alert("거래처를 선택하거나 입력해주세요.");
    if (selectedProducts.length === 0) return alert("제품을 추가해주세요.");

    const { data: { user } } = await supabase.auth.getUser();
    const payload = {
      manufacturer: finalManufacturer, 
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

  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalManufacturer = editIsCustomManufacturer ? editCustomManufacturerInput.trim() : editManufacturer;
    if (!finalManufacturer) return alert("거래처를 선택하거나 입력해주세요.");
    if (editSelectedProducts.length === 0) return alert("제품을 추가해주세요.");

    const payload = {
      manufacturer: finalManufacturer, 
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
        p.items?.some((i: any) => i.name.toLowerCase().includes(term))
      );
    }
    return list.sort((a, b) => {
      const dateA = new Date(a.purchase_date).getTime();
      const dateB = new Date(b.purchase_date).getTime();
      return sortOrder === "desc" ? dateB - dateA : dateA - dateB;
    });
  }, [purchases, historySearch, sortOrder]);

  const calculateMargin = (salePrice: number, purchasePrice: number) => {
    if (!salePrice || salePrice === 0) return { amount: 0, percent: 0 };
    const pPrice = purchasePrice || 0;
    const marginAmount = salePrice - pPrice;
    const marginPercent = (marginAmount / salePrice) * 100;
    return { amount: marginAmount, percent: marginPercent };
  };

  const getSummaryText = (items: any[]) => {
    if (!items || items.length === 0) return "제품 없음";
    const mainItem = items[0].name;
    return items.length > 1 ? `${mainItem} 외 ${items.length - 1}건` : mainItem;
  };

  return (
    <div className="w-full h-[calc(100vh-32px)] flex flex-col space-y-3 overflow-hidden max-w-[1700px] mx-auto pb-2">
      
      <div className="bg-white px-5 py-3 rounded-2xl shadow-sm border border-slate-200 flex justify-between items-center flex-shrink-0">
        <h1 className="text-lg font-extrabold text-slate-900">사입 관리</h1>
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button onClick={() => { setActiveTab("register"); resetForm(); }} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${activeTab === "register" ? "bg-white text-teal-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
            사입 등록
          </button>
          <button onClick={() => setActiveTab("history")} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${activeTab === "history" ? "bg-white text-teal-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
            전체 내역
          </button>
        </div>
      </div>

      {activeTab === "register" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 flex-1 min-h-0">
          
          <div className="lg:col-span-6 bg-white rounded-3xl shadow-sm border border-slate-200 flex flex-col p-4 overflow-y-auto space-y-3">
            
            {/* 🟢 날짜 입력란을 헤더로 이동하여 세로 공간 절약 */}
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 shrink-0">
              <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#528771]"></span> 새 사입 등록
              </h2>
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg">
                <span className="text-[10px] font-bold text-slate-500">사입일자</span>
                <input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} required 
                  className="bg-transparent text-[10px] font-extrabold text-slate-700 focus:outline-none" 
                />
              </div>
            </div>
            
            <form onSubmit={handleSubmit} className="flex flex-col h-full space-y-3 pt-1">
              
              {/* 🟢 거래처 입력을 가로로 나란히 배치하여 한 줄 절약 */}
              <div>
                <label className="block font-bold text-slate-700 text-xs mb-1">거래처(제조사) *</label>
                <div className="flex gap-2">
                  <select 
                    value={isCustomManufacturer ? "직접입력" : manufacturer}
                    onChange={e => {
                      if (e.target.value === "직접입력") { setIsCustomManufacturer(true); setCustomManufacturerInput(""); } 
                      else { setIsCustomManufacturer(false); setManufacturer(e.target.value); }
                    }}
                    className={`p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#528771] ${isCustomManufacturer ? "w-1/2" : "w-full"}`}
                  >
                    <option value="직접입력">직접 입력</option>
                    {allManufacturers.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  {isCustomManufacturer && (
                    <input type="text" value={customManufacturerInput} onChange={e => setCustomManufacturerInput(e.target.value)} placeholder="거래처명 직접 입력..." required 
                      className="w-1/2 p-2 bg-teal-50/50 border border-teal-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#528771]" 
                    />
                  )}
                </div>
              </div>

              <div className="relative">
                <label className="block font-bold text-slate-700 text-xs mb-1">매입 제품 선택 *</label>
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
                        <span className="font-bold text-slate-500 text-[11px]">단가: {pr.purchase_price?.toLocaleString() || "0"}원</span>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="mt-3">
                  {selectedProducts.length > 0 && (
                    <div className="flex items-center text-[10px] font-extrabold text-slate-400 border-b border-slate-200 pb-1.5 mb-1.5 px-1">
                      <div className="flex-1">제품명 (판매가)</div>
                      <div className="w-[80px] text-right pr-2">공급가(원)</div>
                      <div className="w-[75px] text-center">수량</div>
                      <div className="w-[85px] text-right">예상 마진</div>
                      <div className="w-[30px]"></div>
                    </div>
                  )}
                  <div className="space-y-0.5 max-h-[250px] overflow-y-auto pr-1 hide-scrollbar">
                    {selectedProducts.map(p => {
                      const margin = calculateMargin(p.original_price, p.purchase_price);

                      return (
                        <div key={p.id} className="flex items-center justify-between py-1.5 border-b border-slate-100 hover:bg-slate-50 transition px-1 gap-2">
                          <div className="flex flex-col flex-1 min-w-0">
                            <span className="font-extrabold text-slate-900 text-xs truncate" title={p.name}>{p.name}</span>
                            <span className="text-[9px] font-bold text-slate-400 truncate">판매: {p.original_price?.toLocaleString()}원</span>
                          </div>
                          
                          <div className="w-[80px] flex-shrink-0 text-right pr-2">
                            <span className="font-extrabold text-slate-700 text-[11px]">{p.purchase_price?.toLocaleString() || "0"}</span>
                          </div>

                          <div className="w-[75px] flex items-center justify-center flex-shrink-0 bg-slate-50 border border-slate-200 rounded-lg overflow-hidden">
                            <button type="button" onClick={() => handleQuantity(p.id, -1)} className="w-5 h-6 bg-slate-100 text-[11px] font-black text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition">-</button>
                            <input 
                              type="number" 
                              value={p.quantity === 0 ? "" : p.quantity}
                              onChange={(e) => handleManualQuantity(p.id, e.target.value)}
                              className="w-7 h-6 text-center text-[11px] font-extrabold text-slate-900 bg-white border-none focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                            />
                            <button type="button" onClick={() => handleQuantity(p.id, 1)} className="w-5 h-6 bg-slate-100 text-[11px] font-black text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition">+</button>
                          </div>

                          <div className="w-[85px] flex flex-col text-right flex-shrink-0">
                            <span className={`text-[11px] font-extrabold ${margin.amount >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
                              {margin.amount.toLocaleString()}원
                            </span>
                            <span className="text-[9px] font-bold text-slate-400">({margin.percent.toFixed(1)}%)</span>
                          </div>

                          <div className="w-[30px] flex justify-end flex-shrink-0">
                            <button type="button" onClick={() => removeProduct(p.id)} className="text-red-400 hover:text-red-600 font-black text-[11px] px-1 py-0.5">✕</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex-1"></div>

              <div className="flex justify-between items-center p-3.5 bg-teal-50/50 border border-teal-100 rounded-2xl">
                <span className="font-black text-slate-900 text-sm">총 사입 금액</span>
                <span className="font-black text-[#2e5e49] text-xl">{totalAmount.toLocaleString()}원</span>
              </div>

              <div>
                <textarea value={memo} onChange={e => setMemo(e.target.value)} rows={2} 
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold resize-none focus:outline-none focus:border-[#528771]" 
                  placeholder="특이사항 입력..." 
                />
              </div>

              <div>
                <button type="submit" className="w-full py-3 bg-[#528771] hover:bg-[#3d6856] text-white font-black text-sm rounded-xl transition shadow-sm">
                  사입 등록하기
                </button>
              </div>
            </form>
          </div>

          <div className="lg:col-span-2 flex flex-col gap-3 overflow-hidden">
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 flex flex-col flex-1 p-4 overflow-hidden">
              <h3 className="text-xs font-extrabold text-slate-900 mb-3 flex items-center gap-1.5">
                🏢 제조사별 매입액
              </h3>
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 hide-scrollbar">
                {manufacturerStats.map(([mfg, amt], idx) => {
                  const totalAllSum = purchases.reduce((sum, p) => sum + (p.total_amount || 0), 0);
                  const percent = Math.round((amt / totalAllSum) * 100) || 0;
                  return (
                    <div key={mfg} className="text-[10px] bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <div className="flex justify-between font-bold mb-1">
                        <span className="text-slate-800 truncate max-w-[80px]">{idx + 1}. {mfg}</span>
                        <span className="text-slate-900">{amt.toLocaleString()}원</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-1 overflow-hidden">
                        <div className="bg-[#528771] h-full rounded-full" style={{ width: `${percent}%` }}></div>
                      </div>
                    </div>
                  );
                })}
                {manufacturerStats.length === 0 && (
                  <div className="text-xs font-bold text-slate-400 text-center py-8">데이터 없음</div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 bg-white p-3 rounded-3xl shadow-sm border border-slate-200 flex-shrink-0">
              <div className="flex flex-col p-2 bg-slate-50 rounded-xl border border-slate-100 text-center">
                <span className="text-[10px] font-bold text-slate-500 mb-0.5">이번 달 사입 건수</span>
                <span className="text-sm font-black text-slate-900">{thisMonthCount}건</span>
              </div>
              <div className="flex flex-col p-2 bg-slate-50 rounded-xl border border-slate-100 text-center">
                <span className="text-[10px] font-bold text-slate-500 mb-0.5">이번 달 총 사입액</span>
                <span className="text-sm font-black text-[#528771]">{thisMonthSum.toLocaleString()}원</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 bg-white rounded-3xl shadow-sm border border-slate-200 flex flex-col p-4 overflow-hidden">
            <h3 className="text-xs font-extrabold text-slate-900 mb-2.5 flex items-center justify-between">
              <span>최근 사입 내역</span>
              <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">총 {purchases.length}건</span>
            </h3>
            
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 hide-scrollbar">
              {purchases.map(p => {
                const totalQty = p.items?.reduce((sum: number, i: any) => sum + i.quantity, 0) || 0;
                const isExpanded = expandedRecentIds.includes(p.id);

                return (
                  <div key={p.id} className="p-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors cursor-default relative flex flex-col gap-2">
                    <div className="flex justify-between items-start">
                      <div className="text-[10px] font-bold text-slate-500 flex items-center gap-1.5">
                        <span className="bg-slate-100 border border-slate-200 text-slate-600 px-1.5 py-0.5 rounded">{p.manufacturer}</span>
                        <span className="text-slate-400">총 {totalQty}개</span>
                      </div>
                      <div className="flex flex-col items-end flex-shrink-0">
                        <span className="font-black text-[#528771] text-xs">{p.total_amount?.toLocaleString()}원</span>
                        <span className="text-[9px] font-bold text-slate-400 mt-0.5">{p.purchase_date}</span>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center mt-1">
                      <span className="font-extrabold text-slate-800 text-[11px] truncate">
                        {getSummaryText(p.items)}
                      </span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleOpenEditModal(p)} className="text-[10px] font-bold text-slate-500 bg-white border border-slate-200 hover:bg-slate-100 px-2 py-1 rounded-md transition">
                          수정
                        </button>
                        <button 
                          onClick={() => toggleRecent(p.id)}
                          className="text-[10px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-md transition"
                        >
                          {isExpanded ? "▲ 닫기" : "▼ 상세"}
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-1 pt-2 border-t border-slate-100">
                        <div className="bg-slate-50 rounded-lg p-2 space-y-1">
                          {p.items?.map((i:any, idx:number) => (
                            <div key={idx} className="flex justify-between items-center text-[10px]">
                              <span className="font-bold text-slate-700 truncate mr-2">{i.name}</span>
                              <div className="flex gap-2 flex-shrink-0">
                                <span className="text-slate-400">{i.purchase_price?.toLocaleString()}원</span>
                                <span className="font-extrabold text-teal-700 w-8 text-right">{i.quantity}개</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {purchases.length === 0 && (
                <div className="text-xs font-bold text-slate-400 text-center py-8">등록된 내역이 없습니다.</div>
              )}
            </div>
          </div>

        </div>
      )}

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
          
          <div className="flex-1 overflow-x-auto overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/80 text-slate-600 sticky top-0 backdrop-blur-md z-10 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 font-bold whitespace-nowrap w-[110px]">사입일자</th>
                  <th className="py-3 px-4 font-bold whitespace-nowrap w-[130px]">거래처(제조사)</th>
                  <th className="py-3 px-4 font-bold w-[350px]">매입 상품 내역</th>
                  <th className="py-3 px-4 font-extrabold w-auto min-w-[200px] text-slate-800">코멘트</th>
                  <th className="py-3 px-4 font-bold text-right whitespace-nowrap w-[120px]">총 사입 금액</th>
                  <th className="py-3 px-4 font-bold text-center whitespace-nowrap w-[90px]">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredHistoryPurchases.length === 0 ? (
                  <tr><td colSpan={6} className="py-12 text-center text-slate-400 font-bold">검색된 사입 내역이 없습니다.</td></tr>
                ) : (
                  filteredHistoryPurchases.map((p) => {
                    const isExpanded = expandedHistoryIds.includes(p.id);

                    return (
                      <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 font-extrabold text-slate-800 whitespace-nowrap align-top">{p.purchase_date}</td>
                        <td className="py-3 px-4 font-extrabold text-slate-900 whitespace-nowrap align-top">
                          <span className="bg-white border border-slate-200 px-2 py-1 rounded-lg shadow-sm">{p.manufacturer}</span>
                        </td>
                        <td className="py-3 px-4 align-top">
                          <div className="flex items-center gap-3">
                            <span className="font-extrabold text-slate-800 flex-1">
                              {getSummaryText(p.items)}
                            </span>
                            <button 
                              onClick={() => toggleHistory(p.id)}
                              className="text-[10px] font-bold text-slate-500 hover:text-slate-800 bg-white border border-slate-200 hover:bg-slate-100 px-2 py-1 rounded transition whitespace-nowrap"
                            >
                              {isExpanded ? "▲ 닫기" : "▼ 상세"}
                            </button>
                          </div>
                          
                          {isExpanded && (
                            <div className="mt-3 bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
                              <table className="w-full text-left">
                                <thead className="bg-slate-50 text-[10px] text-slate-500">
                                  <tr>
                                    <th className="px-3 py-1.5 font-bold">제품명</th>
                                    <th className="px-3 py-1.5 font-bold text-right">단가</th>
                                    <th className="px-3 py-1.5 font-bold text-right w-16">수량</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-[11px]">
                                  {p.items?.map((i:any, idx:number) => (
                                    <tr key={idx} className="hover:bg-slate-50/50">
                                      <td className="px-3 py-2 font-bold text-slate-700">{i.name}</td>
                                      <td className="px-3 py-2 text-right text-slate-500">{i.purchase_price?.toLocaleString() || "0"}원</td>
                                      <td className="px-3 py-2 text-right font-black text-[#528771]">{i.quantity}개</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-600 font-medium whitespace-normal break-words max-w-[250px] align-top">
                          {p.memo || "-"}
                        </td>
                        <td className="py-3 px-4 font-black text-[#528771] text-right whitespace-nowrap align-top">{p.total_amount?.toLocaleString()}원</td>
                        <td className="py-3 px-4 text-center whitespace-nowrap align-top">
                          <div className="flex justify-center gap-1.5">
                            <button onClick={() => handleOpenEditModal(p)} className="text-[11px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-md transition">수정</button>
                            <button onClick={() => handleDeletePurchase(p.id)} className="text-[11px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-md transition">삭제</button>
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

      {isEditModalOpen && (
        <div onClick={() => setIsEditModalOpen(false)} className="fixed inset-0 z-[120] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer">
          <div className="bg-white w-full max-w-2xl max-h-[90vh] rounded-3xl p-6 shadow-2xl border border-slate-200 flex flex-col cursor-default" onClick={e => e.stopPropagation()}>
            
            {/* 🟢 수정 팝업 헤더 영역에도 사입일자 압축 배치 */}
            <div className="flex justify-between items-center border-b pb-3 mb-4 shrink-0">
              <div className="flex items-center gap-3">
                <h3 className="text-base font-bold text-slate-900">사입 내역 수정</h3>
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg">
                  <span className="text-[10px] font-bold text-slate-500">사입일자</span>
                  <input type="date" value={editPurchaseDate} onChange={e => setEditPurchaseDate(e.target.value)} required 
                    className="bg-transparent text-[10px] font-extrabold text-slate-700 focus:outline-none" 
                  />
                </div>
              </div>
              <button onClick={() => setIsEditModalOpen(false)} className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-200">✕</button>
            </div>

            <form onSubmit={handleUpdateSubmit} className="flex-1 overflow-y-auto pr-2 space-y-4 text-xs">
              
              {/* 🟢 수정 팝업 제조사 가로 배치 */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">거래처(제조사) *</label>
                <div className="flex gap-2">
                  <select 
                    value={editIsCustomManufacturer ? "직접입력" : editManufacturer}
                    onChange={e => {
                      if (e.target.value === "직접입력") { setEditIsCustomManufacturer(true); setEditCustomManufacturerInput(""); } 
                      else { setEditIsCustomManufacturer(false); setEditManufacturer(e.target.value); }
                    }}
                    className={`p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold focus:outline-none focus:border-[#528771] ${editIsCustomManufacturer ? "w-1/2" : "w-full"}`}
                  >
                    <option value="직접입력">직접 입력</option>
                    {allManufacturers.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  {editIsCustomManufacturer && (
                    <input type="text" value={editCustomManufacturerInput} onChange={e => setEditCustomManufacturerInput(e.target.value)} placeholder="거래처명 직접 입력..." required 
                      className="w-1/2 p-2.5 bg-teal-50/50 border border-teal-200 rounded-xl font-semibold focus:outline-none focus:border-[#528771]" 
                    />
                  )}
                </div>
              </div>

              <div className="relative">
                <label className="block font-bold text-slate-700 mb-1">매입 제품 선택 *</label>
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
                        <span className="font-bold text-slate-500">단가: {pr.purchase_price?.toLocaleString() || "0"}원</span>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="mt-3">
                  {editSelectedProducts.length > 0 && (
                    <div className="flex items-center text-[10px] font-extrabold text-slate-400 border-b border-slate-200 pb-1.5 mb-1.5 px-1">
                      <div className="flex-1">제품명 (판매가)</div>
                      <div className="w-[80px] text-right pr-2">공급가(원)</div>
                      <div className="w-[75px] text-center">수량</div>
                      <div className="w-[85px] text-right">예상 마진</div>
                      <div className="w-[30px]"></div>
                    </div>
                  )}
                  <div className="space-y-0.5 max-h-[260px] overflow-y-auto pr-1 hide-scrollbar">
                    {editSelectedProducts.map(p => {
                      const margin = calculateMargin(p.original_price, p.purchase_price);

                      return (
                        <div key={p.id} className="flex items-center justify-between py-1.5 border-b border-slate-100 hover:bg-slate-50 transition px-1 gap-2">
                          <div className="flex flex-col flex-1 min-w-0">
                            <span className="font-extrabold text-slate-900 text-xs truncate" title={p.name}>{p.name}</span>
                            <span className="text-[9px] font-bold text-slate-400 truncate">판매: {p.original_price?.toLocaleString()}원</span>
                          </div>
                          
                          <div className="w-[80px] flex-shrink-0 text-right pr-2">
                            <span className="font-extrabold text-slate-700 text-[11px]">{p.purchase_price?.toLocaleString() || "0"}</span>
                          </div>

                          <div className="w-[75px] flex items-center justify-center flex-shrink-0 bg-slate-50 border border-slate-200 rounded-lg overflow-hidden">
                            <button type="button" onClick={() => handleEditQuantity(p.id, -1)} className="w-5 h-6 bg-slate-100 text-[11px] font-black text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition">-</button>
                            <input 
                              type="number" 
                              value={p.quantity === 0 ? "" : p.quantity}
                              onChange={(e) => handleEditManualQuantity(p.id, e.target.value)}
                              className="w-7 h-6 text-center text-[11px] font-extrabold text-slate-900 bg-white border-none focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                            />
                            <button type="button" onClick={() => handleEditQuantity(p.id, 1)} className="w-5 h-6 bg-slate-100 text-[11px] font-black text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition">+</button>
                          </div>

                          <div className="w-[85px] flex flex-col text-right flex-shrink-0">
                            <span className={`text-[11px] font-extrabold ${margin.amount >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
                              {margin.amount.toLocaleString()}원
                            </span>
                            <span className="text-[9px] font-bold text-slate-400">({margin.percent.toFixed(1)}%)</span>
                          </div>

                          <div className="w-[30px] flex justify-end flex-shrink-0">
                            <button type="button" onClick={() => removeEditProduct(p.id)} className="text-red-400 hover:text-red-600 font-black text-[11px] px-1 py-0.5">✕</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl font-extrabold text-sm">
                <span>총 사입 금액</span>
                <span className="text-[#528771] text-base">{editTotalAmount.toLocaleString()}원</span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">비고</label>
                <textarea value={editMemo} onChange={e => setEditMemo(e.target.value)} rows={2} 
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold resize-none focus:outline-none focus:border-[#528771]" 
                  placeholder="특이사항 입력..." 
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 shrink-0">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-4 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition">취소</button>
                <button type="submit" className="px-6 py-2.5 bg-[#528771] text-white font-bold rounded-xl hover:bg-[#3d6856] transition shadow-sm">
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