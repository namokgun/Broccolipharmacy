"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/app/lib/supabase";

interface PurchaseItem {
  product_id?: string | null;
  name: string;
  manufacturer: string;
  cost_price: number;
  quantity: number;
}

interface PurchaseRecord {
  id: string;
  purchase_date: string;
  supplier?: string;
  manufacturer?: string;
  total_amount: number;
  memo?: string;
  items: PurchaseItem[];
  created_at?: string;
}

const getLocalToday = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

const getProductCostPrice = (p: any): number => {
  const val = p.cost_price ?? p.supply_price ?? p.purchase_price ?? 0;
  const num = Number(val);
  return isNaN(num) ? 0 : num;
};

const getProductManufacturer = (p: any): string => {
  return (p.manufacturer || p.company || p.supplier || "미지정").trim() || "미지정";
};

const getPurchaseTotal = (rec: any): number => {
  if (Array.isArray(rec.items) && rec.items.length > 0) {
    const itemsSum = rec.items.reduce(
      (sum: number, it: any) => sum + (Number(it.cost_price) || 0) * (Number(it.quantity) || 0),
      0
    );
    if (itemsSum > 0) return itemsSum;
  }
  const total = Number(rec.total_amount ?? rec.amount ?? 0);
  return isNaN(total) ? 0 : total;
};

export default function PurchasesPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [loading, setLoading] = useState(false);

  // 새 사입 등록 폼 상태
  const [purchaseDate, setPurchaseDate] = useState(getLocalToday());
  const [supplierInput, setSupplierInput] = useState("");
  const [purchaseMemo, setPurchaseMemo] = useState("");
  const [draftItems, setDraftItems] = useState<PurchaseItem[]>([]);

  // 새 사입 등록 - 매입 제품 검색 상태
  const [productSearch, setProductSearch] = useState("");
  const [highlightIdx, setHighlightIdx] = useState(0);
  const productSearchRef = useRef<HTMLInputElement | null>(null);
  const qtyInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const costInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // 최근 사입 내역 검색 필터
  const [historySearch, setHistorySearch] = useState("");

  // 사입 내역 수정 모달 상태 (배경 입력과 완전히 분리)
  const [editingPurchase, setEditingPurchase] = useState<PurchaseRecord | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editSupplier, setEditSupplier] = useState("");
  const [editMemo, setEditMemo] = useState("");
  const [editItems, setEditItems] = useState<PurchaseItem[]>([]);
  const [editProductSearch, setEditProductSearch] = useState("");
  const [editHighlightIdx, setEditHighlightIdx] = useState(0);
  const editSearchRef = useRef<HTMLInputElement | null>(null);
  const editQtyRefs = useRef<(HTMLInputElement | null)[]>([]);
  const editCostRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: prodData, error: prodErr } = await supabase
      .from("products")
      .select("*")
      .order("name");
    if (prodErr) console.error("제품 목록 로딩 오류:", prodErr.message);
    if (prodData) setProducts(prodData);

    const { data: purData, error: purErr } = await supabase
      .from("purchases")
      .select("*")
      .order("created_at", { ascending: false });
    if (purErr) console.error("사입 내역 로딩 오류:", purErr.message);
    if (purData) {
      const normalized: PurchaseRecord[] = purData
        .map((r: any) => ({
          ...r,
          purchase_date: r.purchase_date || r.created_at?.split("T")[0] || "",
          items: Array.isArray(r.items) ? r.items : [],
          total_amount: getPurchaseTotal(r),
        }))
        .sort((a: PurchaseRecord, b: PurchaseRecord) =>
          (b.purchase_date || "").localeCompare(a.purchase_date || "")
        );
      setPurchases(normalized);
    }
  };

  // 새 사입 등록 후보 목록
  const searchCandidates = useMemo(() => {
    const term = productSearch.trim();
    if (!term) return [];
    const lower = term.toLowerCase();

    const matched = products
      .filter(
        p =>
          p.name?.toLowerCase().includes(lower) ||
          getProductManufacturer(p).toLowerCase().includes(lower)
      )
      .map(p => ({
        id: p.id,
        name: p.name,
        manufacturer: getProductManufacturer(p),
        cost_price: getProductCostPrice(p),
        isCustom: false,
      }));

    const hasExact = matched.some(m => m.name.toLowerCase() === lower);
    if (!hasExact) {
      matched.push({
        id: null,
        name: term,
        manufacturer: supplierInput.trim() || "미지정",
        cost_price: 0,
        isCustom: true,
      });
    }

    return matched;
  }, [productSearch, products, supplierInput]);

  // 수정 모달 후보 목록
  const editSearchCandidates = useMemo(() => {
    const term = editProductSearch.trim();
    if (!term) return [];
    const lower = term.toLowerCase();

    const matched = products
      .filter(
        p =>
          p.name?.toLowerCase().includes(lower) ||
          getProductManufacturer(p).toLowerCase().includes(lower)
      )
      .map(p => ({
        id: p.id,
        name: p.name,
        manufacturer: getProductManufacturer(p),
        cost_price: getProductCostPrice(p),
        isCustom: false,
      }));

    const hasExact = matched.some(m => m.name.toLowerCase() === lower);
    if (!hasExact) {
      matched.push({
        id: null,
        name: term,
        manufacturer: editSupplier.trim() || "미지정",
        cost_price: 0,
        isCustom: true,
      });
    }

    return matched;
  }, [editProductSearch, products, editSupplier]);

  // 새 사입 항목 추가
  const handleSelectCandidate = (cand: {
    id: string | null;
    name: string;
    manufacturer: string;
    cost_price: number;
  }) => {
    const existIdx = draftItems.findIndex(
      it => it.name.trim().toLowerCase() === cand.name.trim().toLowerCase()
    );

    if (existIdx >= 0) {
      const updated = [...draftItems];
      updated[existIdx] = {
        ...updated[existIdx],
        quantity: (Number(updated[existIdx].quantity) || 0) + 1,
      };
      setDraftItems(updated);
      setProductSearch("");
      setHighlightIdx(0);
      setTimeout(() => qtyInputRefs.current[existIdx]?.focus(), 20);
      return;
    }

    const nextIdx = draftItems.length;
    setDraftItems(prev => [
      ...prev,
      {
        product_id: cand.id,
        name: cand.name,
        manufacturer: cand.manufacturer,
        cost_price: cand.cost_price,
        quantity: 1,
      },
    ]);

    if (!supplierInput.trim() && cand.manufacturer && cand.manufacturer !== "미지정") {
      setSupplierInput(cand.manufacturer);
    }

    setProductSearch("");
    setHighlightIdx(0);
    setTimeout(() => {
      qtyInputRefs.current[nextIdx]?.focus();
      qtyInputRefs.current[nextIdx]?.select();
    }, 20);
  };

  // 새 사입 검색창 Tab + Enter 핸들러
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (editingPurchase) return;

    if (e.key === "Tab" && productSearch.trim()) {
      e.preventDefault();
      if (searchCandidates.length > 0) {
        if (e.shiftKey) {
          setHighlightIdx(prev => (prev - 1 + searchCandidates.length) % searchCandidates.length);
        } else {
          setHighlightIdx(prev => (prev + 1) % searchCandidates.length);
        }
      }
      return;
    }

    if (e.key === "ArrowDown" && productSearch.trim()) {
      e.preventDefault();
      if (searchCandidates.length > 0) {
        setHighlightIdx(prev => (prev + 1) % searchCandidates.length);
      }
      return;
    }

    if (e.key === "ArrowUp" && productSearch.trim()) {
      e.preventDefault();
      if (searchCandidates.length > 0) {
        setHighlightIdx(prev => (prev - 1 + searchCandidates.length) % searchCandidates.length);
      }
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      if (!productSearch.trim()) return;
      const target = searchCandidates[highlightIdx] || searchCandidates[0];
      if (target) {
        handleSelectCandidate(target);
      }
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      setProductSearch("");
      setHighlightIdx(0);
    }
  };

  // 새 사입 총액 (공급가 * 수량 합계)
  const draftTotalAmount = useMemo(() => {
    return draftItems.reduce(
      (sum, item) => sum + (Number(item.cost_price) || 0) * (Number(item.quantity) || 0),
      0
    );
  }, [draftItems]);

  // 새 사입 저장
  const handleSavePurchase = async () => {
    if (!purchaseDate) return alert("사입일자를 선택해주세요.");
    const validItems = draftItems.filter(it => it.name.trim() !== "" && Number(it.quantity) > 0);
    if (validItems.length === 0) return alert("최소 1개 이상의 매입 제품을 추가해주세요.");

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return alert("로그인 정보가 없습니다.");

    const derivedSupplier =
      supplierInput.trim() ||
      validItems[0]?.manufacturer ||
      "미지정";

    const totalAmount = validItems.reduce(
      (sum, it) => sum + (Number(it.cost_price) || 0) * (Number(it.quantity) || 0),
      0
    );

    const payload = {
      purchase_date: purchaseDate,
      supplier: derivedSupplier,
      total_amount: totalAmount,
      memo: purchaseMemo.trim(),
      items: validItems.map(it => ({
        product_id: it.product_id || null,
        name: it.name.trim(),
        manufacturer: (it.manufacturer || derivedSupplier).trim(),
        cost_price: Number(it.cost_price) || 0,
        quantity: Number(it.quantity) || 0,
      })),
      user_id: user.id,
    };

    setLoading(true);
    const { error } = await supabase.from("purchases").insert([payload]);
    setLoading(false);

    if (error) {
      alert("사입 등록 실패: " + error.message);
      return;
    }

    setDraftItems([]);
    setSupplierInput("");
    setPurchaseMemo("");
    setProductSearch("");
    setHighlightIdx(0);
    fetchData();
  };

  // 사입 내역 삭제
  const handleDeletePurchase = async (id: string) => {
    if (!confirm("이 사입 내역을 삭제하시겠습니까?")) return;
    setLoading(true);
    const { error } = await supabase.from("purchases").delete().eq("id", id);
    setLoading(false);

    if (error) {
      alert("삭제 실패: " + error.message);
      return;
    }

    if (editingPurchase?.id === id) {
      setEditingPurchase(null);
    }
    fetchData();
  };

  // 수정 모달 열기
  const handleOpenEditModal = (rec: PurchaseRecord) => {
    setProductSearch("");
    setEditingPurchase(rec);
    setEditDate(rec.purchase_date || getLocalToday());
    setEditSupplier(rec.supplier || rec.manufacturer || "");
    setEditMemo(rec.memo || "");
    setEditItems(
      Array.isArray(rec.items)
        ? rec.items.map(it => ({
            product_id: it.product_id || null,
            name: it.name || "",
            manufacturer: it.manufacturer || rec.supplier || "미지정",
            cost_price: Number(it.cost_price) || 0,
            quantity: Number(it.quantity) || 1,
          }))
        : []
    );
    setEditProductSearch("");
    setEditHighlightIdx(0);
  };

  // 수정 모달 항목 추가
  const handleSelectEditCandidate = (cand: {
    id: string | null;
    name: string;
    manufacturer: string;
    cost_price: number;
  }) => {
    const existIdx = editItems.findIndex(
      it => it.name.trim().toLowerCase() === cand.name.trim().toLowerCase()
    );

    if (existIdx >= 0) {
      const updated = [...editItems];
      updated[existIdx] = {
        ...updated[existIdx],
        quantity: (Number(updated[existIdx].quantity) || 0) + 1,
      };
      setEditItems(updated);
      setEditProductSearch("");
      setEditHighlightIdx(0);
      setTimeout(() => editQtyRefs.current[existIdx]?.focus(), 20);
      return;
    }

    const nextIdx = editItems.length;
    setEditItems(prev => [
      ...prev,
      {
        product_id: cand.id,
        name: cand.name,
        manufacturer: cand.manufacturer,
        cost_price: cand.cost_price,
        quantity: 1,
      },
    ]);
    setEditProductSearch("");
    setEditHighlightIdx(0);
    setTimeout(() => {
      editQtyRefs.current[nextIdx]?.focus();
      editQtyRefs.current[nextIdx]?.select();
    }, 20);
  };

  // 수정 모달 검색창 Tab + Enter 핸들러
  const handleEditSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();

    if (e.key === "Tab" && editProductSearch.trim()) {
      e.preventDefault();
      if (editSearchCandidates.length > 0) {
        if (e.shiftKey) {
          setEditHighlightIdx(
            prev => (prev - 1 + editSearchCandidates.length) % editSearchCandidates.length
          );
        } else {
          setEditHighlightIdx(prev => (prev + 1) % editSearchCandidates.length);
        }
      }
      return;
    }

    if (e.key === "ArrowDown" && editProductSearch.trim()) {
      e.preventDefault();
      if (editSearchCandidates.length > 0) {
        setEditHighlightIdx(prev => (prev + 1) % editSearchCandidates.length);
      }
      return;
    }

    if (e.key === "ArrowUp" && editProductSearch.trim()) {
      e.preventDefault();
      if (editSearchCandidates.length > 0) {
        setEditHighlightIdx(
          prev => (prev - 1 + editSearchCandidates.length) % editSearchCandidates.length
        );
      }
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      if (!editProductSearch.trim()) return;
      const target = editSearchCandidates[editHighlightIdx] || editSearchCandidates[0];
      if (target) {
        handleSelectEditCandidate(target);
      }
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      setEditProductSearch("");
      setEditHighlightIdx(0);
    }
  };

  const editTotalAmount = useMemo(() => {
    return editItems.reduce(
      (sum, it) => sum + (Number(it.cost_price) || 0) * (Number(it.quantity) || 0),
      0
    );
  }, [editItems]);

  const handleUpdatePurchase = async () => {
    if (!editingPurchase) return;
    if (!editDate) return alert("사입일자를 선택해주세요.");
    const validItems = editItems.filter(it => it.name.trim() !== "" && Number(it.quantity) > 0);
    if (validItems.length === 0) return alert("최소 1개 이상의 품목이 필요합니다.");

    const derivedSupplier = editSupplier.trim() || validItems[0]?.manufacturer || "미지정";
    const totalAmount = validItems.reduce(
      (sum, it) => sum + (Number(it.cost_price) || 0) * (Number(it.quantity) || 0),
      0
    );

    setLoading(true);
    const { error } = await supabase
      .from("purchases")
      .update({
        purchase_date: editDate,
        supplier: derivedSupplier,
        total_amount: totalAmount,
        memo: editMemo.trim(),
        items: validItems.map(it => ({
          product_id: it.product_id || null,
          name: it.name.trim(),
          manufacturer: (it.manufacturer || derivedSupplier).trim(),
          cost_price: Number(it.cost_price) || 0,
          quantity: Number(it.quantity) || 0,
        })),
      })
      .eq("id", editingPurchase.id);
    setLoading(false);

    if (error) {
      alert("수정 실패: " + error.message);
      return;
    }

    setEditingPurchase(null);
    fetchData();
  };

  // 최근 사입 내역 필터링
  const filteredPurchases = useMemo(() => {
    const term = historySearch.trim().toLowerCase();
    if (!term) return purchases;
    return purchases.filter(rec => {
      const matchSupplier = (rec.supplier || rec.manufacturer || "").toLowerCase().includes(term);
      const matchDate = (rec.purchase_date || "").includes(term);
      const matchItem = rec.items?.some(it => it.name?.toLowerCase().includes(term));
      const matchMemo = (rec.memo || "").toLowerCase().includes(term);
      return matchSupplier || matchDate || matchItem || matchMemo;
    });
  }, [purchases, historySearch]);

  // 전체 매입액 합계
  const totalAllPurchaseAmount = useMemo(() => {
    return purchases.reduce((sum, rec) => sum + getPurchaseTotal(rec), 0);
  }, [purchases]);

  // 제조사별 매입액 TOP (비율 % 포함)
  const manufacturerRanking = useMemo(() => {
    const map: Record<string, { manufacturer: string; totalAmt: number; count: number }> = {};

    purchases.forEach(rec => {
      if (Array.isArray(rec.items) && rec.items.length > 0) {
        rec.items.forEach(it => {
          const matchedProd = products.find(
            p => p.id === it.product_id || p.name?.trim() === it.name?.trim()
          );
          const mName =
            (it.manufacturer && it.manufacturer !== "미지정" ? it.manufacturer : null) ||
            (matchedProd ? getProductManufacturer(matchedProd) : null) ||
            rec.supplier ||
            rec.manufacturer ||
            "미지정";

          const amt = (Number(it.cost_price) || 0) * (Number(it.quantity) || 0);
          if (!map[mName]) {
            map[mName] = { manufacturer: mName, totalAmt: 0, count: 0 };
          }
          map[mName].totalAmt += amt;
          map[mName].count += Number(it.quantity) || 0;
        });
      } else {
        const mName = rec.supplier || rec.manufacturer || "미지정";
        const amt = getPurchaseTotal(rec);
        if (!map[mName]) {
          map[mName] = { manufacturer: mName, totalAmt: 0, count: 0 };
        }
        map[mName].totalAmt += amt;
        map[mName].count += 1;
      }
    });

    const list = Object.values(map)
      .filter(m => m.totalAmt > 0)
      .sort((a, b) => b.totalAmt - a.totalAmt);

    const grandTotal = list.reduce((s, m) => s + m.totalAmt, 0) || totalAllPurchaseAmount || 1;

    return list.map(m => ({
      ...m,
      sharePercent: ((m.totalAmt / grandTotal) * 100).toFixed(1),
    }));
  }, [purchases, products, totalAllPurchaseAmount]);

  // 사입금액이 큰 제품순 TOP
  const productPurchaseRanking = useMemo(() => {
    const map: Record<
      string,
      { name: string; manufacturer: string; totalAmt: number; totalQty: number }
    > = {};

    purchases.forEach(rec => {
      if (!Array.isArray(rec.items)) return;
      rec.items.forEach(it => {
        const pName = (it.name || "").trim();
        if (!pName) return;
        const amt = (Number(it.cost_price) || 0) * (Number(it.quantity) || 0);
        const qty = Number(it.quantity) || 0;

        if (!map[pName]) {
          map[pName] = {
            name: pName,
            manufacturer: it.manufacturer || rec.supplier || "미지정",
            totalAmt: 0,
            totalQty: 0,
          };
        }
        map[pName].totalAmt += amt;
        map[pName].totalQty += qty;
      });
    });

    return Object.values(map)
      .filter(p => p.totalAmt > 0)
      .sort((a, b) => b.totalAmt - a.totalAmt);
  }, [purchases]);

  return (
    <div className="w-full h-[calc(100vh-32px)] flex flex-col space-y-2 overflow-hidden max-w-[1700px] mx-auto pb-1 text-xs">
      {/* 상단 헤더 */}
      <div className="bg-white px-4 py-2.5 rounded-2xl shadow-sm border border-slate-200 flex justify-between items-center flex-shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-extrabold text-slate-900">사입 관리</h1>
          <span className="text-[11px] font-bold text-slate-400">
            누적 매입 총액{" "}
            <strong className="text-[#528771]">{totalAllPurchaseAmount.toLocaleString()}원</strong>
          </span>
        </div>
      </div>

      {/* 3분할 메인 레이아웃 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 flex-1 min-h-0">
        {/* 1열: 새 사입 등록 */}
        <div className="lg:col-span-5 bg-white rounded-3xl shadow-sm border border-slate-200 flex flex-col overflow-hidden p-3.5 space-y-2.5">
          <div className="flex justify-between items-center border-b border-slate-100 pb-2 flex-shrink-0">
            <h2 className="text-sm font-extrabold text-slate-900">🛒 새 사입 등록</h2>
            {draftItems.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setDraftItems([]);
                  setSupplierInput("");
                  setPurchaseMemo("");
                }}
                className="text-[10px] font-bold text-slate-400 hover:text-rose-600 transition"
              >
                입력 초기화
              </button>
            )}
          </div>

          <form
            onSubmit={e => e.preventDefault()}
            className="flex-1 flex flex-col min-h-0 space-y-2.5"
          >
            <div className="grid grid-cols-2 gap-2 flex-shrink-0">
              <div>
                <label className="block font-bold text-slate-700 mb-1">사입일자 *</label>
                <input
                  type="date"
                  value={purchaseDate}
                  onChange={e => setPurchaseDate(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") e.preventDefault();
                  }}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold focus:outline-none focus:border-[#528771]"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">거래처 / 제조사</label>
                <input
                  type="text"
                  placeholder="제조사 또는 도매상"
                  value={supplierInput}
                  onChange={e => setSupplierInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      productSearchRef.current?.focus();
                    }
                  }}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold focus:outline-none focus:border-[#528771]"
                />
              </div>
            </div>

            {/* 매입 제품 선택 검색바 (Tab + Enter 지원) */}
            <div className="relative flex-shrink-0">
              <label className="block font-bold text-slate-700 mb-1">
                매입 제품 선택{" "}
                <span className="text-[10px] font-normal text-slate-400">
                  (검색 후 Tab / ↑↓ 이동, Enter 선택)
                </span>
              </label>
              <input
                ref={productSearchRef}
                type="text"
                placeholder="제품명 또는 제조사 검색..."
                value={editingPurchase ? "" : productSearch}
                disabled={Boolean(editingPurchase)}
                onChange={e => {
                  if (editingPurchase) return;
                  setProductSearch(e.target.value);
                  setHighlightIdx(0);
                }}
                onKeyDown={handleSearchKeyDown}
                className="w-full p-2 bg-teal-50/40 border border-teal-200 rounded-xl font-semibold focus:outline-none focus:border-[#528771] disabled:opacity-50"
              />

              {!editingPurchase && productSearch.trim() && (
                <div className="absolute z-30 w-full max-h-48 overflow-y-auto border border-slate-200 rounded-xl bg-white shadow-xl mt-1">
                  {searchCandidates.map((cand, idx) => {
                    const isHighlighted = idx === highlightIdx;
                    return (
                      <div
                        key={`${cand.name}-${idx}`}
                        onClick={() => handleSelectCandidate(cand)}
                        onMouseEnter={() => setHighlightIdx(idx)}
                        className={`px-3 py-2 cursor-pointer flex justify-between items-center border-b border-slate-100 last:border-none ${
                          isHighlighted ? "bg-teal-100/80" : "hover:bg-teal-50"
                        }`}
                      >
                        <div className="flex flex-col min-w-0 pr-2">
                          <span className="font-extrabold text-slate-900 truncate">
                            {cand.isCustom ? `+ "${cand.name}" 직접 추가` : cand.name}
                          </span>
                          <span className="text-[10px] text-slate-400 font-semibold">
                            {cand.manufacturer} · 공급가 {cand.cost_price.toLocaleString()}원
                          </span>
                        </div>
                        {isHighlighted && (
                          <span className="text-[9px] font-bold text-teal-800 bg-white px-1.5 py-0.5 rounded border border-teal-200 shrink-0">
                            Tab · Enter ↵
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 선택된 매입 제품 테이블 (공급가 * 수량 금액 표시) */}
            <div className="flex-1 overflow-y-auto border border-slate-200 rounded-2xl">
              {draftItems.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-400 font-semibold py-10">
                  위 검색창에서 매입할 제품을 선택해주세요.
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 text-slate-500 sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-2.5 font-bold w-[32%]">제품명</th>
                      <th className="py-2 px-2 font-bold w-[22%]">공급가</th>
                      <th className="py-2 px-2 font-bold w-[16%]">수량</th>
                      <th className="py-2 px-2 font-bold text-right w-[22%]">금액</th>
                      <th className="py-2 px-1.5 font-bold text-center w-[8%]">삭제</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {draftItems.map((item, idx) => {
                      const rowAmount =
                        (Number(item.cost_price) || 0) * (Number(item.quantity) || 0);
                      return (
                        <tr key={`${item.name}-${idx}`} className="hover:bg-slate-50/70">
                          <td className="py-1.5 px-2.5">
                            <div className="font-extrabold text-slate-900 truncate max-w-[130px]" title={item.name}>
                              {item.name}
                            </div>
                            <div className="text-[9.5px] text-slate-400 font-semibold truncate">
                              {item.manufacturer}
                            </div>
                          </td>
                          <td className="py-1.5 px-1.5">
                            <input
                              ref={el => {
                                costInputRefs.current[idx] = el;
                              }}
                              type="number"
                              min={0}
                              value={item.cost_price}
                              onChange={e => {
                                const next = [...draftItems];
                                next[idx] = {
                                  ...next[idx],
                                  cost_price: Number(e.target.value) || 0,
                                };
                                setDraftItems(next);
                              }}
                              onKeyDown={e => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  productSearchRef.current?.focus();
                                }
                              }}
                              className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-right font-bold text-slate-800 focus:outline-none focus:border-[#528771]"
                            />
                          </td>
                          <td className="py-1.5 px-1.5">
                            <input
                              ref={el => {
                                qtyInputRefs.current[idx] = el;
                              }}
                              type="number"
                              min={1}
                              value={item.quantity}
                              onChange={e => {
                                const next = [...draftItems];
                                next[idx] = {
                                  ...next[idx],
                                  quantity: Number(e.target.value) || 0,
                                };
                                setDraftItems(next);
                              }}
                              onKeyDown={e => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  costInputRefs.current[idx]?.focus();
                                  costInputRefs.current[idx]?.select();
                                }
                              }}
                              className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-center font-extrabold text-slate-900 focus:outline-none focus:border-[#528771]"
                            />
                          </td>
                          <td className="py-1.5 px-2 text-right font-black text-[#528771] tabular-nums whitespace-nowrap">
                            {rowAmount.toLocaleString()}원
                          </td>
                          <td className="py-1.5 px-1.5 text-center">
                            <button
                              type="button"
                              onClick={() =>
                                setDraftItems(draftItems.filter((_, i) => i !== idx))
                              }
                              className="text-slate-400 hover:text-rose-600 font-bold p-1"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* 메모 & 합계 & 저장 버튼 */}
            <div className="space-y-2 pt-1 flex-shrink-0">
              <input
                type="text"
                placeholder="사입 메모 (선택)"
                value={purchaseMemo}
                onChange={e => setPurchaseMemo(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") e.preventDefault();
                }}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold focus:outline-none focus:border-[#528771]"
              />

              <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center">
                <span className="font-bold text-slate-600">총 사입 금액 (공급가×수량)</span>
                <span className="text-base font-black text-[#528771] tabular-nums">
                  {draftTotalAmount.toLocaleString()}원
                </span>
              </div>

              <button
                type="button"
                disabled={loading}
                onClick={handleSavePurchase}
                className="w-full py-2.5 bg-[#528771] hover:bg-[#3d6856] text-white rounded-xl font-black text-xs transition shadow-sm disabled:opacity-50"
              >
                {loading ? "저장 중..." : "사입 내역 저장하기"}
              </button>
            </div>
          </form>
        </div>

        {/* 2열: 최근 사입 내역 (수정 / 삭제 버튼 포함) */}
        <div className="lg:col-span-4 bg-white rounded-3xl shadow-sm border border-slate-200 flex flex-col overflow-hidden p-3.5 space-y-2.5">
          <div className="flex justify-between items-center flex-shrink-0">
            <h2 className="text-sm font-extrabold text-slate-900">
              📋 최근 사입 내역 ({filteredPurchases.length}건)
            </h2>
          </div>

          <div className="flex-shrink-0">
            <input
              type="text"
              placeholder="제품명, 제조사, 날짜, 메모 검색..."
              value={historySearch}
              onChange={e => setHistorySearch(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold focus:outline-none focus:border-[#528771]"
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1 hide-scrollbar">
            {filteredPurchases.length === 0 ? (
              <div className="py-16 text-center text-slate-400">등록된 사입 내역이 없습니다.</div>
            ) : (
              filteredPurchases.map(rec => (
                <div
                  key={rec.id}
                  className="p-3 bg-slate-50 hover:bg-slate-100/70 rounded-2xl border border-slate-100 space-y-1.5 transition"
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[10.5px] font-bold text-slate-400 shrink-0">
                        {rec.purchase_date}
                      </span>
                      <span className="font-extrabold text-slate-800 truncate">
                        {rec.supplier || rec.manufacturer || "미지정"}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(rec)}
                        className="px-2 py-0.5 bg-white hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg font-bold text-[10px] transition"
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeletePurchase(rec.id)}
                        className="px-2 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200/70 rounded-lg font-bold text-[10px] transition"
                      >
                        삭제
                      </button>
                    </div>
                  </div>

                  <div className="space-y-0.5">
                    {rec.items?.map((it, i) => (
                      <div
                        key={i}
                        className="flex justify-between items-center text-[11px] text-slate-700"
                      >
                        <span className="font-semibold truncate pr-2">
                          {it.name} × {it.quantity}개
                        </span>
                        <span className="font-bold text-slate-500 tabular-nums shrink-0">
                          {((Number(it.cost_price) || 0) * (Number(it.quantity) || 0)).toLocaleString()}원
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between items-center pt-1 border-t border-slate-200/60">
                    <span className="text-[10px] text-slate-400 truncate max-w-[180px]">
                      {rec.memo || ""}
                    </span>
                    <span className="font-black text-[#528771] text-xs tabular-nums">
                      {getPurchaseTotal(rec).toLocaleString()}원
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 3열: 제조사별 매입액 TOP (% 표시) + 제품별 매입액 TOP */}
        <div className="lg:col-span-3 bg-white rounded-3xl shadow-sm border border-slate-200 flex flex-col overflow-hidden p-2.5 justify-between gap-2">
          {/* 제조사별 매입액 TOP */}
          <div className="flex flex-col flex-1 min-h-0 space-y-1.5">
            <div className="flex justify-between items-center flex-shrink-0 px-0.5">
              <h3 className="text-[11px] font-extrabold text-slate-900">🏭 제조사별 매입액 TOP</h3>
              <span className="text-[10px] font-bold text-slate-400">
                {totalAllPurchaseAmount.toLocaleString()}원
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1 pr-0.5 hide-scrollbar">
              {manufacturerRanking.slice(0, 10).map((m, idx) => (
                <div
                  key={m.manufacturer}
                  className="px-2 py-1 bg-slate-50 rounded-lg border border-slate-100 flex flex-col gap-1"
                >
                  <div className="flex justify-between items-center text-[10.5px] leading-none gap-1">
                    <span
                      className="font-extrabold text-slate-800 truncate"
                      title={`${m.manufacturer} (${m.sharePercent}%)`}
                    >
                      {idx + 1}. {m.manufacturer}{" "}
                      <span className="text-[9.5px] font-extrabold text-teal-700">
                        ({m.sharePercent}%)
                      </span>
                    </span>
                    <span className="font-black text-[#528771] tabular-nums shrink-0">
                      {m.totalAmt.toLocaleString()}원
                    </span>
                  </div>
                  <div className="w-full bg-slate-200/80 rounded-full h-[3px] overflow-hidden">
                    <div
                      className="bg-[#528771] h-full rounded-full"
                      style={{ width: `${Math.min(100, Number(m.sharePercent))}%` }}
                    />
                  </div>
                </div>
              ))}
              {manufacturerRanking.length === 0 && (
                <div className="text-[11px] text-slate-400 text-center py-6">데이터 없음</div>
              )}
            </div>
          </div>

          <hr className="border-slate-100 flex-shrink-0" />

          {/* 사입금액이 큰 제품순 TOP */}
          <div className="flex flex-col flex-1 min-h-0 space-y-1.5">
            <div className="flex justify-between items-center flex-shrink-0 px-0.5">
              <h3 className="text-[11px] font-extrabold text-slate-900">📦 사입금액 큰 제품 TOP</h3>
              <span className="text-[10px] font-bold text-slate-400">
                총 {productPurchaseRanking.length}종
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1 pr-0.5 hide-scrollbar">
              {productPurchaseRanking.slice(0, 10).map((prod, idx) => {
                const maxAmt = productPurchaseRanking[0]?.totalAmt || 1;
                const barPercent = Math.round((prod.totalAmt / maxAmt) * 100);
                return (
                  <div
                    key={prod.name}
                    className="px-2 py-1 bg-slate-50 rounded-lg border border-slate-100 flex flex-col gap-1"
                  >
                    <div className="flex justify-between items-center text-[10.5px] leading-none gap-1">
                      <span
                        className="font-extrabold text-slate-800 truncate"
                        title={`${prod.name} (${prod.totalQty}개)`}
                      >
                        {idx + 1}. {prod.name}{" "}
                        <span className="text-[9px] font-bold text-slate-400">
                          ({prod.totalQty}개)
                        </span>
                      </span>
                      <span className="font-black text-amber-700 tabular-nums shrink-0">
                        {prod.totalAmt.toLocaleString()}원
                      </span>
                    </div>
                    <div className="w-full bg-slate-200/80 rounded-full h-[3px] overflow-hidden">
                      <div
                        className="bg-amber-600 h-full rounded-full"
                        style={{ width: `${barPercent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              {productPurchaseRanking.length === 0 && (
                <div className="text-[11px] text-slate-400 text-center py-6">데이터 없음</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 사입 내역 수정 모달 */}
      {editingPurchase && (
        <div
          onClick={() => setEditingPurchase(null)}
          onKeyDown={e => e.stopPropagation()}
          className="fixed inset-0 z-[120] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
        >
          <div
            onClick={e => e.stopPropagation()}
            onKeyDown={e => e.stopPropagation()}
            className="bg-white w-full max-w-2xl max-h-[88vh] rounded-3xl p-5 shadow-2xl border border-slate-200 flex flex-col space-y-3 cursor-default"
          >
            <div className="flex justify-between items-center border-b border-slate-100 pb-2.5 shrink-0">
              <h3 className="text-sm font-extrabold text-slate-900">✎ 사입 내역 수정</h3>
              <button
                type="button"
                onClick={() => setEditingPurchase(null)}
                className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 flex flex-col min-h-0 space-y-2.5">
              <div className="grid grid-cols-2 gap-2 shrink-0">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">사입일자 *</label>
                  <input
                    type="date"
                    value={editDate}
                    onChange={e => setEditDate(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter") e.preventDefault();
                    }}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold focus:outline-none focus:border-[#528771]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">거래처 / 제조사</label>
                  <input
                    type="text"
                    value={editSupplier}
                    onChange={e => setEditSupplier(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter") e.preventDefault();
                    }}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold focus:outline-none focus:border-[#528771]"
                  />
                </div>
              </div>

              {/* 수정 모달 내 제품 추가 검색 (Tab + Enter 지원) */}
              <div className="relative shrink-0">
                <label className="block font-bold text-slate-700 mb-1">
                  품목 추가{" "}
                  <span className="text-[10px] font-normal text-slate-400">
                    (검색 후 Tab / ↑↓ 이동, Enter 선택)
                  </span>
                </label>
                <input
                  ref={editSearchRef}
                  type="text"
                  autoFocus
                  placeholder="추가할 제품명 검색..."
                  value={editProductSearch}
                  onChange={e => {
                    setEditProductSearch(e.target.value);
                    setEditHighlightIdx(0);
                  }}
                  onKeyDown={handleEditSearchKeyDown}
                  className="w-full p-2 bg-teal-50/40 border border-teal-200 rounded-xl font-semibold focus:outline-none focus:border-[#528771]"
                />

                {editProductSearch.trim() && (
                  <div className="absolute z-30 w-full max-h-44 overflow-y-auto border border-slate-200 rounded-xl bg-white shadow-xl mt-1">
                    {editSearchCandidates.map((cand, idx) => {
                      const isHighlighted = idx === editHighlightIdx;
                      return (
                        <div
                          key={`${cand.name}-${idx}`}
                          onClick={() => handleSelectEditCandidate(cand)}
                          onMouseEnter={() => setEditHighlightIdx(idx)}
                          className={`px-3 py-2 cursor-pointer flex justify-between items-center border-b border-slate-100 last:border-none ${
                            isHighlighted ? "bg-teal-100/80" : "hover:bg-teal-50"
                          }`}
                        >
                          <div className="flex flex-col min-w-0 pr-2">
                            <span className="font-extrabold text-slate-900 truncate">
                              {cand.isCustom ? `+ "${cand.name}" 직접 추가` : cand.name}
                            </span>
                            <span className="text-[10px] text-slate-400 font-semibold">
                              {cand.manufacturer} · 공급가 {cand.cost_price.toLocaleString()}원
                            </span>
                          </div>
                          {isHighlighted && (
                            <span className="text-[9px] font-bold text-teal-800 bg-white px-1.5 py-0.5 rounded border border-teal-200 shrink-0">
                              Tab · Enter ↵
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 수정 품목 테이블 */}
              <div className="flex-1 overflow-y-auto border border-slate-200 rounded-2xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 text-slate-500 sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3 font-bold w-[34%]">제품명</th>
                      <th className="py-2 px-2 font-bold w-[22%]">공급가</th>
                      <th className="py-2 px-2 font-bold w-[16%]">수량</th>
                      <th className="py-2 px-2 font-bold text-right w-[20%]">금액</th>
                      <th className="py-2 px-2 font-bold text-center w-[8%]">삭제</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {editItems.map((item, idx) => {
                      const rowAmount =
                        (Number(item.cost_price) || 0) * (Number(item.quantity) || 0);
                      return (
                        <tr key={`${item.name}-${idx}`}>
                          <td className="py-1.5 px-3 font-extrabold text-slate-900">
                            {item.name}
                          </td>
                          <td className="py-1.5 px-2">
                            <input
                              ref={el => {
                                editCostRefs.current[idx] = el;
                              }}
                              type="number"
                              min={0}
                              value={item.cost_price}
                              onChange={e => {
                                const next = [...editItems];
                                next[idx] = {
                                  ...next[idx],
                                  cost_price: Number(e.target.value) || 0,
                                };
                                setEditItems(next);
                              }}
                              onKeyDown={e => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  editSearchRef.current?.focus();
                                }
                              }}
                              className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-right font-bold"
                            />
                          </td>
                          <td className="py-1.5 px-2">
                            <input
                              ref={el => {
                                editQtyRefs.current[idx] = el;
                              }}
                              type="number"
                              min={1}
                              value={item.quantity}
                              onChange={e => {
                                const next = [...editItems];
                                next[idx] = {
                                  ...next[idx],
                                  quantity: Number(e.target.value) || 0,
                                };
                                setEditItems(next);
                              }}
                              onKeyDown={e => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  editCostRefs.current[idx]?.focus();
                                  editCostRefs.current[idx]?.select();
                                }
                              }}
                              className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-center font-extrabold"
                            />
                          </td>
                          <td className="py-1.5 px-2 text-right font-black text-[#528771] tabular-nums">
                            {rowAmount.toLocaleString()}원
                          </td>
                          <td className="py-1.5 px-2 text-center">
                            <button
                              type="button"
                              onClick={() =>
                                setEditItems(editItems.filter((_, i) => i !== idx))
                              }
                              className="text-slate-400 hover:text-rose-600 font-bold p-1"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="space-y-2 shrink-0">
                <input
                  type="text"
                  placeholder="메모"
                  value={editMemo}
                  onChange={e => setEditMemo(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") e.preventDefault();
                  }}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                />
                <div className="flex justify-between items-center pt-1 border-t border-slate-100">
                  <div className="font-extrabold text-slate-700">
                    합계:{" "}
                    <span className="text-[#528771] text-sm font-black">
                      {editTotalAmount.toLocaleString()}원
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingPurchase(null)}
                      className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={handleUpdatePurchase}
                      className="px-5 py-2 bg-[#528771] text-white font-bold rounded-xl hover:bg-[#3d6856] transition shadow-sm disabled:opacity-50"
                    >
                      {loading ? "저장 중..." : "수정 저장"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}