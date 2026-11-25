"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/app/lib/supabase";

interface SaleLineItem {
  product_id?: string | null;
  name: string;
  price: number;
  quantity: number;
}

interface SaleRecord {
  id: string;
  sale_date: string;
  patient_id?: string | null;
  patient_name?: string;
  payment_method?: string;
  total_amount?: number;
  amount?: number;
  memo?: string;
  items: SaleLineItem[];
  created_at?: string;
}

const getLocalToday = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
};

const getProductSellPrice = (p: any): number => {
  const val = p.sell_price ?? p.sale_price ?? p.price ?? 0;
  const num = Number(val);
  return isNaN(num) ? 0 : num;
};

const getSaleTotalAmount = (rec: any): number => {
  if (
    rec.total_amount !== null &&
    rec.total_amount !== undefined &&
    rec.total_amount !== "" &&
    !isNaN(Number(rec.total_amount))
  ) {
    return Number(rec.total_amount);
  }
  if (
    rec.amount !== null &&
    rec.amount !== undefined &&
    rec.amount !== "" &&
    !isNaN(Number(rec.amount))
  ) {
    return Number(rec.amount);
  }
  if (Array.isArray(rec.items)) {
    return rec.items.reduce(
      (sum: number, it: any) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 1),
      0
    );
  }
  return 0;
};

export default function SalesPage() {
  const [patients, setPatients] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [currentDate, setCurrentDate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);

  // 새 판매 등록 상태
  const [saleDate, setSaleDate] = useState("");
  const [patientSearch, setPatientSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);
  const [patientHighlightIdx, setPatientHighlightIdx] = useState(0);

  const [productSearch, setProductSearch] = useState("");
  const [productHighlightIdx, setProductHighlightIdx] = useState(0);

  const [draftItems, setDraftItems] = useState<SaleLineItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("카드");
  const [saleMemo, setSaleMemo] = useState("");

  const patientInputRef = useRef<HTMLInputElement | null>(null);
  const productInputRef = useRef<HTMLInputElement | null>(null);
  const qtyInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const priceInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // 최근 판매 내역 검색
  const [historySearch, setHistorySearch] = useState("");

  // 판매 내역 수정 모달 상태
  const [editingSale, setEditingSale] = useState<SaleRecord | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editPatientName, setEditPatientName] = useState("");
  const [editPaymentMethod, setEditPaymentMethod] = useState("카드");
  const [editMemo, setEditMemo] = useState("");
  const [editItems, setEditItems] = useState<SaleLineItem[]>([]);
  const [editProductSearch, setEditProductSearch] = useState("");
  const [editProductHighlightIdx, setEditProductHighlightIdx] = useState(0);
  const editProductInputRef = useRef<HTMLInputElement | null>(null);
  const editQtyRefs = useRef<(HTMLInputElement | null)[]>([]);
  const editPriceRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const now = new Date();
    setCurrentDate(now);
    setSaleDate(getLocalToday());
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: patData, error: patErr } = await supabase
      .from("patients")
      .select("*")
      .order("name");
    if (patErr) console.error("고객 목록 로딩 오류:", patErr.message);
    if (patData) setPatients(patData);

    const { data: prodData, error: prodErr } = await supabase
      .from("products")
      .select("*")
      .order("name");
    if (prodErr) console.error("제품 목록 로딩 오류:", prodErr.message);
    if (prodData) setProducts(prodData);

    const { data: salesData, error: salesErr } = await supabase
      .from("sales")
      .select("*")
      .order("created_at", { ascending: false });
    if (salesErr) console.error("판매 내역 로딩 오류:", salesErr.message);
    if (salesData) {
      const normalized: SaleRecord[] = salesData
        .map((s: any) => ({
          ...s,
          sale_date: s.sale_date || s.created_at?.split("T")[0] || "",
          items: Array.isArray(s.items) ? s.items : [],
          total_amount: getSaleTotalAmount(s),
        }))
        .sort((a: SaleRecord, b: SaleRecord) =>
          (b.sale_date || "").localeCompare(a.sale_date || "")
        );
      setSales(normalized);
    }
  };

  // 고객 검색 후보
  const patientCandidates = useMemo(() => {
    const term = patientSearch.trim().toLowerCase();
    if (!term || selectedPatient) return [];
    return patients
      .filter(
        p =>
          p.name?.toLowerCase().includes(term) ||
          p.custom_id?.toLowerCase().includes(term) ||
          p.phone?.includes(term)
      )
      .slice(0, 8);
  }, [patientSearch, patients, selectedPatient]);

  const handleSelectPatientCandidate = (p: any) => {
    setSelectedPatient(p);
    setPatientSearch(p.name);
    setPatientHighlightIdx(0);
    setTimeout(() => productInputRef.current?.focus(), 20);
  };

  const handlePatientKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (editingSale) return;

    if (e.key === "Tab" && patientCandidates.length > 0) {
      e.preventDefault();
      if (e.shiftKey) {
        setPatientHighlightIdx(
          prev => (prev - 1 + patientCandidates.length) % patientCandidates.length
        );
      } else {
        setPatientHighlightIdx(prev => (prev + 1) % patientCandidates.length);
      }
      return;
    }

    if (e.key === "ArrowDown" && patientCandidates.length > 0) {
      e.preventDefault();
      setPatientHighlightIdx(prev => (prev + 1) % patientCandidates.length);
      return;
    }

    if (e.key === "ArrowUp" && patientCandidates.length > 0) {
      e.preventDefault();
      setPatientHighlightIdx(
        prev => (prev - 1 + patientCandidates.length) % patientCandidates.length
      );
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      if (patientCandidates.length > 0) {
        const target = patientCandidates[patientHighlightIdx] || patientCandidates[0];
        if (target) {
          handleSelectPatientCandidate(target);
          return;
        }
      }
      productInputRef.current?.focus();
    }
  };

  // 제품 검색 후보
  const productCandidates = useMemo(() => {
    const term = productSearch.trim();
    if (!term) return [];
    const lower = term.toLowerCase();

    const matched = products
      .filter(p => p.name?.toLowerCase().includes(lower))
      .map(p => ({
        id: p.id,
        name: p.name,
        price: getProductSellPrice(p),
        isCustom: false,
      }));

    const hasExact = matched.some(m => m.name.toLowerCase() === lower);
    if (!hasExact) {
      matched.push({
        id: null,
        name: term,
        price: 0,
        isCustom: true,
      });
    }

    return matched;
  }, [productSearch, products]);

  const handleAddDraftProduct = (cand: {
    id: string | null;
    name: string;
    price: number;
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
      setProductHighlightIdx(0);
      setTimeout(() => {
        qtyInputRefs.current[existIdx]?.focus();
        qtyInputRefs.current[existIdx]?.select();
      }, 20);
      return;
    }

    const nextIdx = draftItems.length;
    setDraftItems(prev => [
      ...prev,
      {
        product_id: cand.id,
        name: cand.name,
        price: cand.price,
        quantity: 1,
      },
    ]);
    setProductSearch("");
    setProductHighlightIdx(0);
    setTimeout(() => {
      qtyInputRefs.current[nextIdx]?.focus();
      qtyInputRefs.current[nextIdx]?.select();
    }, 20);
  };

  const handleProductKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (editingSale) return;

    if (e.key === "Tab" && productSearch.trim()) {
      e.preventDefault();
      if (productCandidates.length > 0) {
        if (e.shiftKey) {
          setProductHighlightIdx(
            prev => (prev - 1 + productCandidates.length) % productCandidates.length
          );
        } else {
          setProductHighlightIdx(prev => (prev + 1) % productCandidates.length);
        }
      }
      return;
    }

    if (e.key === "ArrowDown" && productSearch.trim()) {
      e.preventDefault();
      if (productCandidates.length > 0) {
        setProductHighlightIdx(prev => (prev + 1) % productCandidates.length);
      }
      return;
    }

    if (e.key === "ArrowUp" && productSearch.trim()) {
      e.preventDefault();
      if (productCandidates.length > 0) {
        setProductHighlightIdx(
          prev => (prev - 1 + productCandidates.length) % productCandidates.length
        );
      }
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      if (!productSearch.trim()) return;
      const target = productCandidates[productHighlightIdx] || productCandidates[0];
      if (target) {
        handleAddDraftProduct(target);
      }
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      setProductSearch("");
      setProductHighlightIdx(0);
    }
  };

  const draftTotalAmount = useMemo(() => {
    return draftItems.reduce(
      (sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 0),
      0
    );
  }, [draftItems]);

  // 판매 등록 저장
  const handleSaveSale = async () => {
    if (!saleDate) return alert("판매일자를 선택해주세요.");
    const validItems = draftItems.filter(it => it.name.trim() !== "" && Number(it.quantity) > 0);
    if (validItems.length === 0) return alert("최소 1개 이상의 판매 품목을 추가해주세요.");

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return alert("로그인 정보가 없습니다.");

    const finalPatientName = (selectedPatient?.name || patientSearch || "일반 고객").trim();
    const totalAmt = validItems.reduce(
      (sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 0),
      0
    );

    const payload = {
      sale_date: saleDate,
      patient_id: selectedPatient?.id || null,
      patient_name: finalPatientName,
      payment_method: paymentMethod,
      total_amount: totalAmt,
      amount: totalAmt,
      memo: saleMemo.trim(),
      items: validItems.map(it => ({
        product_id: it.product_id || null,
        name: it.name.trim(),
        price: Number(it.price) || 0,
        quantity: Number(it.quantity) || 0,
      })),
      user_id: user.id,
    };

    setLoading(true);
    const { error } = await supabase.from("sales").insert([payload]);
    setLoading(false);

    if (error) {
      alert("판매 저장 실패: " + error.message);
      return;
    }

    setSelectedPatient(null);
    setPatientSearch("");
    setProductSearch("");
    setDraftItems([]);
    setSaleMemo("");
    fetchData();
  };

  // 판매 삭제
  const handleDeleteSale = async (id: string) => {
    if (!confirm("이 판매 내역을 삭제하시겠습니까?")) return;
    setLoading(true);
    const { error } = await supabase.from("sales").delete().eq("id", id);
    setLoading(false);

    if (error) {
      alert("삭제 실패: " + error.message);
      return;
    }

    if (editingSale?.id === id) {
      setEditingSale(null);
    }
    fetchData();
  };

  // 수정 모달 열기
  const handleOpenEditSale = (rec: SaleRecord) => {
    setProductSearch("");
    setEditingSale(rec);
    setEditDate(rec.sale_date || getLocalToday());
    setEditPatientName(rec.patient_name || "일반 고객");
    setEditPaymentMethod(rec.payment_method || "카드");
    setEditMemo(rec.memo || "");
    setEditItems(
      Array.isArray(rec.items)
        ? rec.items.map(it => ({
            product_id: it.product_id || null,
            name: it.name || "",
            price: Number(it.price) || 0,
            quantity: Number(it.quantity) || 1,
          }))
        : []
    );
    setEditProductSearch("");
    setEditProductHighlightIdx(0);
  };

  const editProductCandidates = useMemo(() => {
    const term = editProductSearch.trim();
    if (!term) return [];
    const lower = term.toLowerCase();

    const matched = products
      .filter(p => p.name?.toLowerCase().includes(lower))
      .map(p => ({
        id: p.id,
        name: p.name,
        price: getProductSellPrice(p),
        isCustom: false,
      }));

    const hasExact = matched.some(m => m.name.toLowerCase() === lower);
    if (!hasExact) {
      matched.push({
        id: null,
        name: term,
        price: 0,
        isCustom: true,
      });
    }

    return matched;
  }, [editProductSearch, products]);

  const handleAddEditProduct = (cand: {
    id: string | null;
    name: string;
    price: number;
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
      setEditProductHighlightIdx(0);
      setTimeout(() => editQtyRefs.current[existIdx]?.focus(), 20);
      return;
    }

    const nextIdx = editItems.length;
    setEditItems(prev => [
      ...prev,
      {
        product_id: cand.id,
        name: cand.name,
        price: cand.price,
        quantity: 1,
      },
    ]);
    setEditProductSearch("");
    setEditProductHighlightIdx(0);
    setTimeout(() => {
      editQtyRefs.current[nextIdx]?.focus();
      editQtyRefs.current[nextIdx]?.select();
    }, 20);
  };

  const handleEditProductKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();

    if (e.key === "Tab" && editProductSearch.trim()) {
      e.preventDefault();
      if (editProductCandidates.length > 0) {
        if (e.shiftKey) {
          setEditProductHighlightIdx(
            prev => (prev - 1 + editProductCandidates.length) % editProductCandidates.length
          );
        } else {
          setEditProductHighlightIdx(prev => (prev + 1) % editProductCandidates.length);
        }
      }
      return;
    }

    if (e.key === "ArrowDown" && editProductSearch.trim()) {
      e.preventDefault();
      if (editProductCandidates.length > 0) {
        setEditProductHighlightIdx(prev => (prev + 1) % editProductCandidates.length);
      }
      return;
    }

    if (e.key === "ArrowUp" && editProductSearch.trim()) {
      e.preventDefault();
      if (editProductCandidates.length > 0) {
        setEditProductHighlightIdx(
          prev => (prev - 1 + editProductCandidates.length) % editProductCandidates.length
        );
      }
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      if (!editProductSearch.trim()) return;
      const target = editProductCandidates[editProductHighlightIdx] || editProductCandidates[0];
      if (target) {
        handleAddEditProduct(target);
      }
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      setEditProductSearch("");
      setEditProductHighlightIdx(0);
    }
  };

  const editTotalAmount = useMemo(() => {
    return editItems.reduce(
      (sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 0),
      0
    );
  }, [editItems]);

  const handleUpdateSale = async () => {
    if (!editingSale) return;
    if (!editDate) return alert("판매일자를 선택해주세요.");
    const validItems = editItems.filter(it => it.name.trim() !== "" && Number(it.quantity) > 0);
    if (validItems.length === 0) return alert("최소 1개 이상의 판매 품목이 필요합니다.");

    const totalAmt = validItems.reduce(
      (sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 0),
      0
    );

    setLoading(true);
    const { error } = await supabase
      .from("sales")
      .update({
        sale_date: editDate,
        patient_name: editPatientName.trim() || "일반 고객",
        payment_method: editPaymentMethod,
        total_amount: totalAmt,
        amount: totalAmt,
        memo: editMemo.trim(),
        items: validItems.map(it => ({
          product_id: it.product_id || null,
          name: it.name.trim(),
          price: Number(it.price) || 0,
          quantity: Number(it.quantity) || 0,
        })),
      })
      .eq("id", editingSale.id);
    setLoading(false);

    if (error) {
      alert("수정 실패: " + error.message);
      return;
    }

    setEditingSale(null);
    fetchData();
  };

  // 필터링된 최근 판매 내역
  const filteredSales = useMemo(() => {
    const term = historySearch.trim().toLowerCase();
    if (!term) return sales;
    return sales.filter(s => {
      const matchPatient = (s.patient_name || "").toLowerCase().includes(term);
      const matchDate = (s.sale_date || "").includes(term);
      const matchMethod = (s.payment_method || "").toLowerCase().includes(term);
      const matchItem = s.items?.some(it => it.name?.toLowerCase().includes(term));
      const matchMemo = (s.memo || "").toLowerCase().includes(term);
      return matchPatient || matchDate || matchMethod || matchItem || matchMemo;
    });
  }, [sales, historySearch]);

  // 매출 요약 (오늘 / 이번 달 / 누적)
  const summaryStats = useMemo(() => {
    const todayStr = currentDate
      ? `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(
          2,
          "0"
        )}-${String(currentDate.getDate()).padStart(2, "0")}`
      : "";
    const monthPrefix = currentDate
      ? `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`
      : "";

    let todaySales = 0;
    let monthSales = 0;
    let totalSales = 0;

    sales.forEach(s => {
      const amt = getSaleTotalAmount(s);
      totalSales += amt;
      if (todayStr && s.sale_date === todayStr) todaySales += amt;
      if (monthPrefix && s.sale_date?.startsWith(monthPrefix)) monthSales += amt;
    });

    return { todaySales, monthSales, totalSales };
  }, [sales, currentDate]);

  // 제품별 판매 금액 TOP
  const productSalesRanking = useMemo(() => {
    const map: Record<string, { name: string; totalAmt: number; totalQty: number }> = {};

    sales.forEach(s => {
      if (!Array.isArray(s.items)) return;
      s.items.forEach(it => {
        const pName = (it.name || "").trim();
        if (!pName) return;
        const amt = (Number(it.price) || 0) * (Number(it.quantity) || 0);
        const qty = Number(it.quantity) || 0;

        if (!map[pName]) {
          map[pName] = { name: pName, totalAmt: 0, totalQty: 0 };
        }
        map[pName].totalAmt += amt;
        map[pName].totalQty += qty;
      });
    });

    return Object.values(map)
      .filter(p => p.totalAmt > 0)
      .sort((a, b) => b.totalAmt - a.totalAmt);
  }, [sales]);

  return (
    <div className="w-full h-[calc(100vh-32px)] flex flex-col space-y-2 overflow-hidden max-w-[1700px] mx-auto pb-1 text-xs">
      {/* 상단 헤더 */}
      <div className="bg-white px-4 py-2.5 rounded-2xl shadow-sm border border-slate-200 flex justify-between items-center flex-shrink-0">
        <h1 className="text-base font-extrabold text-slate-900">판매 관리</h1>
        <div className="flex items-center gap-4 text-[11px] font-bold">
          <span className="text-slate-500">
            오늘 매출{" "}
            <strong className="text-slate-900 tabular-nums">
              {summaryStats.todaySales.toLocaleString()}원
            </strong>
          </span>
          <span className="text-slate-500">
            이번 달 매출{" "}
            <strong className="text-[#528771] tabular-nums">
              {summaryStats.monthSales.toLocaleString()}원
            </strong>
          </span>
          <span className="text-slate-500">
            누적 매출{" "}
            <strong className="text-teal-800 tabular-nums">
              {summaryStats.totalSales.toLocaleString()}원
            </strong>
          </span>
        </div>
      </div>

      {/* 3분할 메인 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 flex-1 min-h-0">
        {/* 1열: 새 판매 등록 */}
        <div className="lg:col-span-5 bg-white rounded-3xl shadow-sm border border-slate-200 flex flex-col overflow-hidden p-3.5 space-y-2.5">
          <div className="flex justify-between items-center border-b border-slate-100 pb-2 flex-shrink-0">
            <h2 className="text-sm font-extrabold text-slate-900">💳 새 판매 등록</h2>
            {draftItems.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSelectedPatient(null);
                  setPatientSearch("");
                  setProductSearch("");
                  setDraftItems([]);
                  setSaleMemo("");
                }}
                className="text-[10px] font-bold text-slate-400 hover:text-rose-600 transition"
              >
                초기화
              </button>
            )}
          </div>

          <form
            onSubmit={e => e.preventDefault()}
            className="flex-1 flex flex-col min-h-0 space-y-2.5"
          >
            <div className="grid grid-cols-2 gap-2 flex-shrink-0">
              <div>
                <label className="block font-bold text-slate-700 mb-1">판매일자 *</label>
                <input
                  type="date"
                  value={saleDate}
                  onChange={e => setSaleDate(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") e.preventDefault();
                  }}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold focus:outline-none focus:border-[#528771]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">결제수단</label>
                <select
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold focus:outline-none focus:border-[#528771]"
                >
                  <option value="카드">카드</option>
                  <option value="현금">현금</option>
                  <option value="계좌이체">계좌이체</option>
                  <option value="기타">기타</option>
                </select>
              </div>
            </div>

            {/* 고객 선택 */}
            <div className="relative flex-shrink-0">
              <div className="flex justify-between items-center mb-1">
                <label className="block font-bold text-slate-700">고객 선택</label>
                {selectedPatient && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPatient(null);
                      setPatientSearch("");
                      setTimeout(() => patientInputRef.current?.focus(), 20);
                    }}
                    className="text-[10px] font-bold text-rose-500 hover:underline"
                  >
                    고객 선택 해제
                  </button>
                )}
              </div>
              <input
                ref={patientInputRef}
                type="text"
                placeholder="고객 이름, ID, 연락처 검색 (미선택 시 일반 고객)"
                value={editingSale ? "" : patientSearch}
                disabled={Boolean(editingSale)}
                onChange={e => {
                  if (editingSale) return;
                  setSelectedPatient(null);
                  setPatientSearch(e.target.value);
                  setPatientHighlightIdx(0);
                }}
                onKeyDown={handlePatientKeyDown}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold focus:outline-none focus:border-[#528771] disabled:opacity-50"
              />

              {!editingSale && patientCandidates.length > 0 && (
                <div className="absolute z-30 w-full max-h-40 overflow-y-auto border border-slate-200 rounded-xl bg-white shadow-xl mt-1">
                  {patientCandidates.map((p, idx) => {
                    const isHighlighted = idx === patientHighlightIdx;
                    return (
                      <div
                        key={p.id}
                        onClick={() => handleSelectPatientCandidate(p)}
                        onMouseEnter={() => setPatientHighlightIdx(idx)}
                        className={`px-3 py-2 cursor-pointer flex justify-between items-center border-b border-slate-100 last:border-none ${
                          isHighlighted ? "bg-teal-100/80" : "hover:bg-teal-50"
                        }`}
                      >
                        <div>
                          <span className="font-extrabold text-slate-900">{p.name}</span>
                          {p.custom_id && (
                            <span className="text-[10px] text-slate-400 ml-1.5">
                              ({p.custom_id})
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 font-semibold">
                          {p.phone || ""}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 판매 제품 검색 */}
            <div className="relative flex-shrink-0">
              <label className="block font-bold text-slate-700 mb-1">
                판매 제품 추가{" "}
                <span className="text-[10px] font-normal text-slate-400">
                  (검색 후 Tab / ↑↓ 이동, Enter 선택)
                </span>
              </label>
              <input
                ref={productInputRef}
                type="text"
                placeholder="제품명 검색..."
                value={editingSale ? "" : productSearch}
                disabled={Boolean(editingSale)}
                onChange={e => {
                  if (editingSale) return;
                  setProductSearch(e.target.value);
                  setProductHighlightIdx(0);
                }}
                onKeyDown={handleProductKeyDown}
                className="w-full p-2 bg-teal-50/40 border border-teal-200 rounded-xl font-semibold focus:outline-none focus:border-[#528771] disabled:opacity-50"
              />

              {!editingSale && productSearch.trim() && (
                <div className="absolute z-30 w-full max-h-44 overflow-y-auto border border-slate-200 rounded-xl bg-white shadow-xl mt-1">
                  {productCandidates.map((cand, idx) => {
                    const isHighlighted = idx === productHighlightIdx;
                    return (
                      <div
                        key={`${cand.name}-${idx}`}
                        onClick={() => handleAddDraftProduct(cand)}
                        onMouseEnter={() => setProductHighlightIdx(idx)}
                        className={`px-3 py-2 cursor-pointer flex justify-between items-center border-b border-slate-100 last:border-none ${
                          isHighlighted ? "bg-teal-100/80" : "hover:bg-teal-50"
                        }`}
                      >
                        <div className="flex flex-col min-w-0 pr-2">
                          <span className="font-extrabold text-slate-900 truncate">
                            {cand.isCustom ? `+ "${cand.name}" 직접 추가` : cand.name}
                          </span>
                          <span className="text-[10px] text-slate-400 font-semibold">
                            판매가 {cand.price.toLocaleString()}원
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

            {/* 판매 품목 테이블 */}
            <div className="flex-1 overflow-y-auto border border-slate-200 rounded-2xl">
              {draftItems.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-400 font-semibold py-10">
                  판매할 제품을 검색해 추가해주세요.
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 text-slate-500 sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-2.5 font-bold w-[34%]">제품명</th>
                      <th className="py-2 px-2 font-bold w-[22%]">단가</th>
                      <th className="py-2 px-2 font-bold w-[16%]">수량</th>
                      <th className="py-2 px-2 font-bold text-right w-[20%]">금액</th>
                      <th className="py-2 px-1.5 font-bold text-center w-[8%]">삭제</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {draftItems.map((it, idx) => {
                      const rowAmt = (Number(it.price) || 0) * (Number(it.quantity) || 0);
                      return (
                        <tr key={`${it.name}-${idx}`} className="hover:bg-slate-50/70">
                          <td className="py-1.5 px-2.5 font-extrabold text-slate-900 truncate max-w-[130px]">
                            {it.name}
                          </td>
                          <td className="py-1.5 px-1.5">
                            <input
                              ref={el => {
                                priceInputRefs.current[idx] = el;
                              }}
                              type="number"
                              min={0}
                              value={it.price}
                              onChange={e => {
                                const next = [...draftItems];
                                next[idx] = {
                                  ...next[idx],
                                  price: Number(e.target.value) || 0,
                                };
                                setDraftItems(next);
                              }}
                              onKeyDown={e => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  productInputRef.current?.focus();
                                }
                              }}
                              className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-right font-bold"
                            />
                          </td>
                          <td className="py-1.5 px-1.5">
                            <input
                              ref={el => {
                                qtyInputRefs.current[idx] = el;
                              }}
                              type="number"
                              min={1}
                              value={it.quantity}
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
                                  priceInputRefs.current[idx]?.focus();
                                  priceInputRefs.current[idx]?.select();
                                }
                              }}
                              className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-center font-extrabold"
                            />
                          </td>
                          <td className="py-1.5 px-2 text-right font-black text-[#528771] tabular-nums whitespace-nowrap">
                            {rowAmt.toLocaleString()}원
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

            <div className="space-y-2 pt-1 flex-shrink-0">
              <input
                type="text"
                placeholder="판매 메모 (선택)"
                value={saleMemo}
                onChange={e => setSaleMemo(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") e.preventDefault();
                }}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold focus:outline-none focus:border-[#528771]"
              />

              <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center">
                <span className="font-bold text-slate-600">총 판매 금액</span>
                <span className="text-base font-black text-[#528771] tabular-nums">
                  {draftTotalAmount.toLocaleString()}원
                </span>
              </div>

              <button
                type="button"
                disabled={loading}
                onClick={handleSaveSale}
                className="w-full py-2.5 bg-[#528771] hover:bg-[#3d6856] text-white rounded-xl font-black text-xs transition shadow-sm disabled:opacity-50"
              >
                {loading ? "저장 중..." : "판매 내역 저장하기"}
              </button>
            </div>
          </form>
        </div>

        {/* 2열: 최근 판매 내역 */}
        <div className="lg:col-span-4 bg-white rounded-3xl shadow-sm border border-slate-200 flex flex-col overflow-hidden p-3.5 space-y-2.5">
          <div className="flex justify-between items-center flex-shrink-0">
            <h2 className="text-sm font-extrabold text-slate-900">
              🧾 최근 판매 내역 ({filteredSales.length}건)
            </h2>
          </div>

          <div className="flex-shrink-0">
            <input
              type="text"
              placeholder="고객명, 제품명, 날짜, 결제수단 검색..."
              value={historySearch}
              onChange={e => setHistorySearch(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold focus:outline-none focus:border-[#528771]"
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1 hide-scrollbar">
            {filteredSales.length === 0 ? (
              <div className="py-16 text-center text-slate-400">등록된 판매 내역이 없습니다.</div>
            ) : (
              filteredSales.map(rec => (
                <div
                  key={rec.id}
                  className="p-3 bg-slate-50 hover:bg-slate-100/70 rounded-2xl border border-slate-100 space-y-1.5 transition"
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[10.5px] font-bold text-slate-400 shrink-0">
                        {rec.sale_date}
                      </span>
                      <span className="font-extrabold text-slate-800 truncate">
                        {rec.patient_name || "일반 고객"}
                      </span>
                      {rec.payment_method && (
                        <span className="text-[9.5px] font-bold px-1.5 py-0.5 bg-white border border-slate-200 rounded text-slate-500 shrink-0">
                          {rec.payment_method}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenEditSale(rec)}
                        className="px-2 py-0.5 bg-white hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg font-bold text-[10px] transition"
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSale(rec.id)}
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
                          {((Number(it.price) || 0) * (Number(it.quantity) || 0)).toLocaleString()}원
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between items-center pt-1 border-t border-slate-200/60">
                    <span className="text-[10px] text-slate-400 truncate max-w-[180px]">
                      {rec.memo || ""}
                    </span>
                    <span className="font-black text-[#528771] text-xs tabular-nums">
                      {getSaleTotalAmount(rec).toLocaleString()}원
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 3열: 제품별 판매 TOP */}
        <div className="lg:col-span-3 bg-white rounded-3xl shadow-sm border border-slate-200 flex flex-col overflow-hidden p-3 space-y-2">
          <div className="flex justify-between items-center flex-shrink-0 px-0.5">
            <h3 className="text-xs font-extrabold text-slate-900">🏆 제품별 판매 금액 TOP</h3>
            <span className="text-[10px] font-bold text-slate-400">
              총 {productSalesRanking.length}종
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5 hide-scrollbar">
            {productSalesRanking.slice(0, 15).map((prod, idx) => {
              const maxAmt = productSalesRanking[0]?.totalAmt || 1;
              const barPercent = Math.round((prod.totalAmt / maxAmt) * 100);
              return (
                <div
                  key={prod.name}
                  className="px-2.5 py-1.5 bg-slate-50 rounded-xl border border-slate-100 flex flex-col gap-1"
                >
                  <div className="flex justify-between items-center text-[11px] leading-none gap-1">
                    <span
                      className="font-extrabold text-slate-800 truncate"
                      title={`${prod.name} (${prod.totalQty}개)`}
                    >
                      {idx + 1}. {prod.name}{" "}
                      <span className="text-[9.5px] font-bold text-slate-400">
                        ({prod.totalQty}개)
                      </span>
                    </span>
                    <span className="font-black text-[#528771] tabular-nums shrink-0">
                      {prod.totalAmt.toLocaleString()}원
                    </span>
                  </div>
                  <div className="w-full bg-slate-200/80 rounded-full h-[3px] overflow-hidden">
                    <div
                      className="bg-[#528771] h-full rounded-full"
                      style={{ width: `${barPercent}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {productSalesRanking.length === 0 && (
              <div className="text-[11px] text-slate-400 text-center py-10">데이터 없음</div>
            )}
          </div>
        </div>
      </div>

      {/* 판매 내역 수정 모달 */}
      {editingSale && (
        <div
          onClick={() => setEditingSale(null)}
          onKeyDown={e => e.stopPropagation()}
          className="fixed inset-0 z-[120] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
        >
          <div
            onClick={e => e.stopPropagation()}
            onKeyDown={e => e.stopPropagation()}
            className="bg-white w-full max-w-2xl max-h-[88vh] rounded-3xl p-5 shadow-2xl border border-slate-200 flex flex-col space-y-3 cursor-default"
          >
            <div className="flex justify-between items-center border-b border-slate-100 pb-2.5 shrink-0">
              <h3 className="text-sm font-extrabold text-slate-900">✎ 판매 내역 수정</h3>
              <button
                type="button"
                onClick={() => setEditingSale(null)}
                className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 flex flex-col min-h-0 space-y-2.5">
              <div className="grid grid-cols-3 gap-2 shrink-0">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">판매일자 *</label>
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
                  <label className="block font-bold text-slate-700 mb-1">고객명</label>
                  <input
                    type="text"
                    value={editPatientName}
                    onChange={e => setEditPatientName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter") e.preventDefault();
                    }}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold focus:outline-none focus:border-[#528771]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">결제수단</label>
                  <select
                    value={editPaymentMethod}
                    onChange={e => setEditPaymentMethod(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold focus:outline-none focus:border-[#528771]"
                  >
                    <option value="카드">카드</option>
                    <option value="현금">현금</option>
                    <option value="계좌이체">계좌이체</option>
                    <option value="기타">기타</option>
                  </select>
                </div>
              </div>

              <div className="relative shrink-0">
                <label className="block font-bold text-slate-700 mb-1">
                  품목 추가{" "}
                  <span className="text-[10px] font-normal text-slate-400">
                    (검색 후 Tab / ↑↓ 이동, Enter 선택)
                  </span>
                </label>
                <input
                  ref={editProductInputRef}
                  type="text"
                  autoFocus
                  placeholder="추가할 제품명 검색..."
                  value={editProductSearch}
                  onChange={e => {
                    setEditProductSearch(e.target.value);
                    setEditProductHighlightIdx(0);
                  }}
                  onKeyDown={handleEditProductKeyDown}
                  className="w-full p-2 bg-teal-50/40 border border-teal-200 rounded-xl font-semibold focus:outline-none focus:border-[#528771]"
                />

                {editProductSearch.trim() && (
                  <div className="absolute z-30 w-full max-h-44 overflow-y-auto border border-slate-200 rounded-xl bg-white shadow-xl mt-1">
                    {editProductCandidates.map((cand, idx) => {
                      const isHighlighted = idx === editProductHighlightIdx;
                      return (
                        <div
                          key={`${cand.name}-${idx}`}
                          onClick={() => handleAddEditProduct(cand)}
                          onMouseEnter={() => setEditProductHighlightIdx(idx)}
                          className={`px-3 py-2 cursor-pointer flex justify-between items-center border-b border-slate-100 last:border-none ${
                            isHighlighted ? "bg-teal-100/80" : "hover:bg-teal-50"
                          }`}
                        >
                          <div className="flex flex-col min-w-0 pr-2">
                            <span className="font-extrabold text-slate-900 truncate">
                              {cand.isCustom ? `+ "${cand.name}" 직접 추가` : cand.name}
                            </span>
                            <span className="text-[10px] text-slate-400 font-semibold">
                              판매가 {cand.price.toLocaleString()}원
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

              <div className="flex-1 overflow-y-auto border border-slate-200 rounded-2xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 text-slate-500 sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3 font-bold w-[34%]">제품명</th>
                      <th className="py-2 px-2 font-bold w-[22%]">단가</th>
                      <th className="py-2 px-2 font-bold w-[16%]">수량</th>
                      <th className="py-2 px-2 font-bold text-right w-[20%]">금액</th>
                      <th className="py-2 px-2 font-bold text-center w-[8%]">삭제</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {editItems.map((it, idx) => {
                      const rowAmt = (Number(it.price) || 0) * (Number(it.quantity) || 0);
                      return (
                        <tr key={`${it.name}-${idx}`}>
                          <td className="py-1.5 px-3 font-extrabold text-slate-900">
                            {it.name}
                          </td>
                          <td className="py-1.5 px-2">
                            <input
                              ref={el => {
                                editPriceRefs.current[idx] = el;
                              }}
                              type="number"
                              min={0}
                              value={it.price}
                              onChange={e => {
                                const next = [...editItems];
                                next[idx] = {
                                  ...next[idx],
                                  price: Number(e.target.value) || 0,
                                };
                                setEditItems(next);
                              }}
                              onKeyDown={e => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  editProductInputRef.current?.focus();
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
                              value={it.quantity}
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
                                  editPriceRefs.current[idx]?.focus();
                                  editPriceRefs.current[idx]?.select();
                                }
                              }}
                              className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-center font-extrabold"
                            />
                          </td>
                          <td className="py-1.5 px-2 text-right font-black text-[#528771] tabular-nums">
                            {rowAmt.toLocaleString()}원
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
                      onClick={() => setEditingSale(null)}
                      className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={handleUpdateSale}
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