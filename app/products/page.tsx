"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/app/lib/supabase";

const STATUS_OPTIONS = ["판매중", "품절", "단종"];

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedManufacturer, setSelectedManufacturer] = useState("전체");
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);

  // 모달 폼 상태
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  
  const [name, setName] = useState("");
  const [category, setCategory] = useState(""); 
  
  const [manufacturer, setManufacturer] = useState("직접입력");
  const [isCustomManufacturer, setIsCustomManufacturer] = useState(true);
  const [customManufacturerInput, setCustomManufacturerInput] = useState("");

  const [purchasePrice, setPurchasePrice] = useState(""); // 🟢 매입가 추가
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [status, setStatus] = useState("판매중");
  const [description, setDescription] = useState("");

  // 🟢 다중 수량 판매 옵션 상태
  const [options, setOptions] = useState<{ id: string, name: string, price: string, unit: string }[]>([]);
  
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false });
    if (error) {
      console.error("제품 로딩 에러:", error.message);
      return;
    }
    if (data) {
      setProducts(data);
      if (data.length > 0 && !selectedProduct) {
        setSelectedProduct(data[0]);
      }
    }
  };

  const allManufacturers = useMemo(() => {
    const dbManufacturers = products.map(p => p.manufacturer).filter(Boolean);
    return Array.from(new Set(dbManufacturers));
  }, [products]);

  const manufacturerTabs = ["전체", ...allManufacturers];

  const filteredProducts = products.filter(p => {
    const matchSearch = (p.name || "").includes(searchQuery) || (p.manufacturer || "").includes(searchQuery);
    const matchManufacturer = selectedManufacturer === "전체" || p.manufacturer === selectedManufacturer;
    return matchSearch && matchManufacturer;
  });

  const handleOpenRegister = () => {
    setEditingProductId(null);
    setName(""); 
    setCategory(""); 
    setManufacturer("직접입력");
    setIsCustomManufacturer(true); 
    setCustomManufacturerInput("");
    setPurchasePrice("");
    setPrice(""); 
    setStock(""); 
    setStatus("판매중"); 
    setDescription(""); 
    setOptions([]); // 옵션 초기화
    setImageFile(null); 
    setImagePreview(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (p: any) => {
    setEditingProductId(p.id);
    setName(p.name || "");
    setCategory(p.category || "");
    
    if (p.manufacturer && allManufacturers.includes(p.manufacturer)) {
      setManufacturer(p.manufacturer);
      setIsCustomManufacturer(false);
      setCustomManufacturerInput("");
    } else {
      setManufacturer("직접입력");
      setIsCustomManufacturer(true);
      setCustomManufacturerInput(p.manufacturer || "");
    }

    setPurchasePrice(p.purchase_price ? p.purchase_price.toString() : "");
    setPrice(p.price ? p.price.toString() : "");
    setStock(p.stock ? p.stock.toString() : "");
    setStatus(p.status || "판매중");
    setDescription(p.description || "");
    
    // 저장된 옵션 바인딩
    setOptions(p.options ? p.options.map((o: any) => ({ ...o, price: o.price.toString(), unit: o.unit.toString() })) : []);

    setImageFile(null);
    setImagePreview(p.image_url || null);
    setIsModalOpen(true);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const uploadImageToStorage = async () => {
    if (!imageFile) return imagePreview;
    const fileExt = imageFile.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
    const { error: uploadError } = await supabase.storage.from("product-images").upload(fileName, imageFile);
    
    if (uploadError) {
      console.error("이미지 업로드 실패:", uploadError.message);
      return null;
    }
    const { data } = supabase.storage.from("product-images").getPublicUrl(fileName);
    return data.publicUrl;
  };

  // 🟢 옵션 조작 핸들러
  const handleAddOption = () => {
    setOptions([...options, { id: Date.now().toString(), name: "", price: "", unit: "1" }]);
  };

  const updateOption = (id: string, field: string, value: string) => {
    setOptions(options.map(opt => opt.id === id ? { ...opt, [field]: value } : opt));
  };

  const removeOption = (id: string) => {
    setOptions(options.filter(opt => opt.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return alert("제품명을 입력해주세요.");

    const finalManufacturer = isCustomManufacturer ? customManufacturerInput.trim() : manufacturer;
    if (!finalManufacturer) return alert("제조사를 입력 또는 선택해주세요.");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return alert("로그인 정보가 없습니다.");

    // 옵션 데이터 정제
    const cleanedOptions = options
      .filter(o => o.name.trim() !== "")
      .map(o => ({
        id: o.id,
        name: o.name.trim(),
        price: parseInt(o.price) || 0,
        unit: parseInt(o.unit) || 1
      }));

    setUploading(true);
    try {
      const imageUrl = await uploadImageToStorage();

      const payload = {
        name, 
        category, 
        manufacturer: finalManufacturer, 
        status, 
        description,
        purchase_price: purchasePrice ? parseInt(purchasePrice) : 0,
        price: price ? parseInt(price) : 0,
        stock: stock ? parseInt(stock) : 0,
        options: cleanedOptions, // JSON 타입으로 옵션 저장
        image_url: imageUrl,
        user_id: user.id
      };

      if (editingProductId) {
        const { error } = await supabase.from("products").update(payload).eq("id", editingProductId);
        if (error) throw error;
        alert("수정되었습니다.");
      } else {
        const { error } = await supabase.from("products").insert([payload]);
        if (error) throw error;
        alert("등록되었습니다.");
      }
      setIsModalOpen(false);
      fetchProducts();
    } catch (error: any) {
      alert("저장 실패: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("정말 이 제품을 삭제하시겠습니까?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) alert("삭제 실패: " + error.message);
    else {
      alert("삭제되었습니다.");
      setSelectedProduct(null);
      fetchProducts();
    }
  };

  return (
    <div className="w-full h-[calc(100vh-32px)] flex flex-col space-y-3 overflow-hidden max-w-[1700px] mx-auto pb-2">
      
      <div className="bg-white px-5 py-3 rounded-2xl shadow-sm border border-slate-200 flex justify-between items-center flex-shrink-0">
        <h1 className="text-lg font-extrabold text-slate-900">제품 관리</h1>
        <button onClick={handleOpenRegister} className="px-4 py-1.5 bg-[#528771] hover:bg-[#3d6856] text-white rounded-xl font-bold text-xs transition shadow-sm whitespace-nowrap">
          + 제품 등록
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 flex-1 min-h-0">
        
        {/* 좌측: 제품 리스트 영역 */}
        <div className="lg:col-span-8 bg-white rounded-3xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
          <div className="px-4 pt-3 pb-2 flex items-center gap-1.5 overflow-x-auto hide-scrollbar border-b border-slate-100 flex-shrink-0">
            {manufacturerTabs.map(m => {
              const count = m === "전체" ? products.length : products.filter(p => p.manufacturer === m).length;
              const isActive = selectedManufacturer === m;
              return (
                <button 
                  key={m}
                  onClick={() => setSelectedManufacturer(m)}
                  className={`px-3.5 py-1 rounded-full text-xs font-bold transition-all whitespace-nowrap border ${
                    isActive ? "bg-[#528771] text-white border-[#528771]" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {m} ({count})
                </button>
              );
            })}
          </div>

          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/80 text-slate-600 sticky top-0 backdrop-blur-md z-10 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4 font-bold w-20 whitespace-nowrap">이미지</th>
                  <th className="py-2.5 px-4 font-bold">제품명</th>
                  <th className="py-2.5 px-4 font-bold text-center">분류</th>
                  <th className="py-2.5 px-4 font-bold text-center">옵션수</th>
                  <th className="py-2.5 px-4 font-bold text-right">매입가</th>
                  <th className="py-2.5 px-4 font-bold text-right">기본 판매가</th>
                  <th className="py-2.5 px-4 font-bold text-center">총 재고(낱개)</th>
                  <th className="py-2.5 px-4 font-bold text-center">상태</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.length === 0 ? (
                  <tr><td colSpan={8} className="py-12 text-center text-slate-400 font-bold">등록된 제품이 없습니다.</td></tr>
                ) : (
                  filteredProducts.map((p) => (
                    <tr 
                      key={p.id} 
                      onClick={() => setSelectedProduct(p)}
                      className={`cursor-pointer transition-colors ${selectedProduct?.id === p.id ? "bg-teal-50/40" : "hover:bg-slate-50"}`}
                    >
                      <td className="py-2 px-4">
                        <div className="w-8 h-8 rounded-lg overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center">
                          {p.image_url ? <img src={p.image_url} className="w-full h-full object-cover rounded-md" /> : <span className="text-[9px] text-slate-400">No</span>}
                        </div>
                      </td>
                      <td className="py-2.5 px-4 font-extrabold text-slate-900">{p.name}</td>
                      <td className="py-2.5 px-4 text-center">
                        <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-100 whitespace-nowrap">{p.category || "-"}</span>
                      </td>
                      <td className="py-2.5 px-4 font-bold text-slate-500 text-center">
                        {p.options && p.options.length > 0 ? `${p.options.length}개` : "-"}
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-slate-500 text-right">{p.purchase_price?.toLocaleString() || "0"}원</td>
                      <td className="py-2.5 px-4 font-extrabold text-slate-800 text-right">{p.price?.toLocaleString()}원</td>
                      <td className="py-2.5 px-4 font-black text-[#528771] text-center">{p.stock}</td>
                      <td className="py-2.5 px-4 text-center">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md whitespace-nowrap ${p.status === '판매중' ? 'text-emerald-700 bg-emerald-50' : 'text-rose-700 bg-rose-50'}`}>
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 우측: 상세 정보 영역 */}
        <div className="lg:col-span-4 bg-white rounded-3xl shadow-sm border border-slate-200 flex flex-col p-5 overflow-hidden">
          <div className="mb-3">
            <input 
              type="text" 
              placeholder="제품명 또는 제조사 검색..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#528771] transition"
            />
          </div>

          {selectedProduct ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex justify-between items-center mb-3 shrink-0">
                <h2 className="text-xs font-extrabold text-slate-900">제품 상세 정보</h2>
                <div className="flex gap-1.5">
                  <button onClick={() => handleOpenEdit(selectedProduct)} className="text-[10px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg transition">수정</button>
                  <button onClick={() => handleDelete(selectedProduct.id)} className="text-[10px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-lg transition">삭제</button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto pr-1 space-y-4 hide-scrollbar">
                <div className="flex items-center gap-3 bg-slate-50/50 p-3 rounded-2xl border border-slate-100">
                  <div className="w-16 h-16 rounded-xl overflow-hidden border border-slate-200 bg-slate-50 shrink-0 flex items-center justify-center">
                    {selectedProduct.image_url ? <img src={selectedProduct.image_url} className="w-full h-full object-cover rounded-lg" /> : <span className="text-[10px] text-slate-400">없음</span>}
                  </div>
                  <div className="flex flex-col gap-0.5 overflow-hidden">
                    <h3 className="text-sm font-extrabold text-slate-900 truncate">{selectedProduct.name}</h3>
                    <span className="text-[11px] font-bold text-slate-500">{selectedProduct.manufacturer}</span>
                    <p className="text-[10px] font-medium text-slate-600 mt-0.5 leading-relaxed truncate">
                      {selectedProduct.description || "상세 설명 없음"}
                    </p>
                  </div>
                </div>

                <div className="space-y-2 px-1 text-xs">
                  <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                    <span className="font-bold text-slate-400">분류</span>
                    <span className="font-bold text-slate-800">{selectedProduct.category || "-"}</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                    <span className="font-bold text-slate-400">상태</span>
                    <span className={`font-bold ${selectedProduct.status === '판매중' ? 'text-emerald-600' : 'text-rose-600'}`}>{selectedProduct.status}</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                    <span className="font-bold text-slate-400">기본 매입가</span>
                    <span className="font-extrabold text-slate-700">{selectedProduct.purchase_price?.toLocaleString() || "0"}원</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                    <span className="font-bold text-slate-400">기본 판매가</span>
                    <span className="font-extrabold text-[#528771]">{selectedProduct.price?.toLocaleString()}원</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-slate-100 bg-slate-50 px-2 rounded-lg mt-1">
                    <span className="font-bold text-slate-700">총 재고 수량 (단일재고)</span>
                    <span className="font-black text-slate-900 text-sm">{selectedProduct.stock}개</span>
                  </div>
                </div>

                {/* 🟢 다중 옵션 렌더링 영역 */}
                {selectedProduct.options && selectedProduct.options.length > 0 && (
                  <div className="px-1 mt-2">
                    <h4 className="text-[11px] font-bold text-slate-700 mb-2 border-b border-slate-200 pb-1">판매 옵션 구성</h4>
                    <div className="space-y-1.5">
                      {selectedProduct.options.map((opt: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center bg-white border border-slate-200 p-2 rounded-xl shadow-xs">
                          <div className="flex flex-col">
                            <span className="font-extrabold text-slate-800 text-[11px]">{opt.name}</span>
                            <span className="text-[9px] font-bold text-slate-400">재고 차감: {opt.unit}개</span>
                          </div>
                          <span className="font-extrabold text-[#528771] text-xs">{opt.price.toLocaleString()}원</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-xs font-bold text-slate-400">
              좌측 목록에서 제품을 선택해주세요.
            </div>
          )}
        </div>
      </div>

      {/* 🟢 제품 등록 / 수정 모달 */}
      {isModalOpen && (
        <div onClick={() => setIsModalOpen(false)} className="fixed inset-0 z-[120] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer">
          <div className="bg-white w-full max-w-2xl max-h-[90vh] rounded-3xl p-6 shadow-2xl border border-slate-200 flex flex-col cursor-default" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b pb-3 mb-4 shrink-0">
              <h3 className="text-base font-bold text-slate-900">{editingProductId ? "제품 정보 수정" : "새 제품 등록"}</h3>
              <button onClick={() => setIsModalOpen(false)} className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-200">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto pr-2 space-y-5 text-xs hide-scrollbar">
              
              <div className="flex gap-4">
                <div className="w-24 flex flex-col gap-1.5 shrink-0">
                  <label className="block font-bold text-slate-700">제품 이미지</label>
                  <label className="w-full aspect-square rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center cursor-pointer hover:bg-slate-100 overflow-hidden relative">
                    {imagePreview ? (
                      <img src={imagePreview} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[10px] text-slate-400 font-bold text-center px-1">클릭 등록</span>
                    )}
                    <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                  </label>
                </div>

                <div className="flex-1 space-y-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">제품명</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold focus:outline-none focus:border-[#528771]" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">제조사</label>
                      <select 
                        value={isCustomManufacturer ? "직접입력" : manufacturer} 
                        onChange={e => {
                          if (e.target.value === "직접입력") {
                            setIsCustomManufacturer(true);
                            setCustomManufacturerInput("");
                          } else {
                            setIsCustomManufacturer(false);
                            setManufacturer(e.target.value);
                          }
                        }} 
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold focus:outline-none focus:border-[#528771]"
                      >
                        {allManufacturers.length === 0 ? (
                          <option value="직접입력">직접 입력</option>
                        ) : (
                          <>
                            {allManufacturers.map(m => <option key={m} value={m}>{m}</option>)}
                            <option value="직접입력">직접 입력</option>
                          </>
                        )}
                      </select>

                      {isCustomManufacturer && (
                        <input 
                          type="text" 
                          placeholder="새 제조사명 입력..." 
                          value={customManufacturerInput} 
                          onChange={e => setCustomManufacturerInput(e.target.value)} 
                          className="w-full mt-2 p-2.5 bg-teal-50/50 border border-teal-200 rounded-xl font-semibold focus:outline-none focus:border-[#528771]" 
                          required 
                        />
                      )}
                    </div>
                    
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">분류</label>
                      <input type="text" value={category} onChange={e => setCategory(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold focus:outline-none focus:border-[#528771]" placeholder="예: 건강기능식품" />
                    </div>
                  </div>
                </div>
              </div>

              {/* 기본 가격 및 단일 재고 설정 영역 */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                <h4 className="font-extrabold text-slate-800 mb-3 border-b border-slate-200 pb-2">기본 가격 및 단일 재고 설정</h4>
                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">기본 매입가(원)</label>
                    <input type="number" value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)} placeholder="0" className="w-full p-2 bg-white border border-slate-200 rounded-xl font-semibold focus:outline-none focus:border-[#528771]" />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">대표 판매가(원)</label>
                    <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="0" className="w-full p-2 bg-white border border-slate-200 rounded-xl font-semibold focus:outline-none focus:border-[#528771]" />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">총 낱개 재고</label>
                    <input type="number" value={stock} onChange={e => setStock(e.target.value)} placeholder="0" className="w-full p-2 bg-white border border-slate-200 rounded-xl font-bold focus:outline-none focus:border-rose-400" />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">상태</label>
                    <select value={status} onChange={e => setStatus(e.target.value)} className="w-full p-2 bg-white border border-slate-200 rounded-xl font-semibold focus:outline-none">
                      {STATUS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* 🟢 다중 판매 옵션 영역 (1박스, 10개 등) */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <div>
                    <label className="block font-bold text-slate-700 text-sm">추가 판매 옵션 구성 (선택)</label>
                    <p className="text-[10px] text-slate-500 font-medium">다양한 묶음/단위(예: 1박스, 10환) 판매가 필요할 때 추가하세요.</p>
                  </div>
                  <button type="button" onClick={handleAddOption} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg font-bold transition">
                    + 옵션 추가
                  </button>
                </div>
                
                {options.length > 0 && (
                  <div className="space-y-2 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                    <div className="flex gap-2 text-[10px] font-extrabold text-slate-400 px-1">
                      <div className="flex-[2]">옵션명 (예: 10환)</div>
                      <div className="flex-1">판매가(원)</div>
                      <div className="flex-1">재고 차감 단위(개)</div>
                      <div className="w-6"></div>
                    </div>
                    {options.map((opt) => (
                      <div key={opt.id} className="flex gap-2 items-center">
                        <input type="text" placeholder="예: 30환(1박스)" value={opt.name} onChange={e => updateOption(opt.id, 'name', e.target.value)} className="flex-[2] p-2 bg-white border border-slate-200 rounded-lg font-semibold focus:outline-none focus:border-[#528771]" />
                        <input type="number" placeholder="금액" value={opt.price} onChange={e => updateOption(opt.id, 'price', e.target.value)} className="flex-1 p-2 bg-white border border-slate-200 rounded-lg font-semibold focus:outline-none focus:border-[#528771]" />
                        <input type="number" placeholder="예: 30" value={opt.unit} onChange={e => updateOption(opt.id, 'unit', e.target.value)} title="판매 시 총 재고에서 차감될 기준 수량입니다." className="flex-1 p-2 bg-white border border-slate-200 rounded-lg font-semibold focus:outline-none focus:border-[#528771]" />
                        <button type="button" onClick={() => removeOption(opt.id)} className="w-6 h-6 flex items-center justify-center bg-rose-50 text-rose-500 hover:bg-rose-100 rounded-md font-bold transition">✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">상세 설명</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold resize-none focus:outline-none focus:border-[#528771]" placeholder="제품 특징이나 주요 성분을 입력하세요." />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 shrink-0">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition">취소</button>
                <button type="submit" disabled={uploading} className="px-6 py-2.5 bg-[#528771] text-white font-bold rounded-xl hover:bg-[#3d6856] transition shadow-sm disabled:opacity-50">
                  {uploading ? "저장 중..." : "저장하기"}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}