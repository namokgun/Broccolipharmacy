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
  const [category, setCategory] = useState("건강기능식품");
  
  // 제조사 선택 및 직접 입력 상태
  const [manufacturer, setManufacturer] = useState("");
  const [isCustomManufacturer, setIsCustomManufacturer] = useState(false);
  const [customManufacturerInput, setCustomManufacturerInput] = useState("");

  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [status, setStatus] = useState("판매중");
  const [description, setDescription] = useState("");
  
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

  // 🟢 오직 DB에 등록된 제품들의 제조사만 추출하여 상단 탭 및 드롭다운 생성
  const allManufacturers = useMemo(() => {
    const dbManufacturers = products.map(p => p.manufacturer).filter(Boolean);
    return Array.from(new Set(dbManufacturers));
  }, [products]);

  const manufacturerTabs = ["전체", ...allManufacturers];

  // 필터링 적용
  const filteredProducts = products.filter(p => {
    const matchSearch = (p.name || "").includes(searchQuery) || (p.manufacturer || "").includes(searchQuery);
    const matchManufacturer = selectedManufacturer === "전체" || p.manufacturer === selectedManufacturer;
    return matchSearch && matchManufacturer;
  });

  const handleOpenRegister = () => {
    setEditingProductId(null);
    setName(""); 
    setCategory("건강기능식품"); 
    setManufacturer(allManufacturers[0] || "");
    setIsCustomManufacturer(allManufacturers.length === 0); // 등록된 제조사가 없으면 기본으로 직접 입력 활성화
    setCustomManufacturerInput("");
    setPrice(""); 
    setStock(""); 
    setStatus("판매중"); 
    setDescription(""); 
    setImageFile(null); 
    setImagePreview(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (p: any) => {
    setEditingProductId(p.id);
    setName(p.name || "");
    setCategory(p.category || "건강기능식품");
    
    if (p.manufacturer && allManufacturers.includes(p.manufacturer)) {
      setManufacturer(p.manufacturer);
      setIsCustomManufacturer(false);
      setCustomManufacturerInput("");
    } else {
      setManufacturer("직접입력");
      setIsCustomManufacturer(true);
      setCustomManufacturerInput(p.manufacturer || "");
    }

    setPrice(p.price ? p.price.toString() : "");
    setStock(p.stock ? p.stock.toString() : "");
    setStatus(p.status || "판매중");
    setDescription(p.description || "");
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return alert("제품명을 입력해주세요.");

    const finalManufacturer = isCustomManufacturer ? customManufacturerInput.trim() : manufacturer;
    if (!finalManufacturer) return alert("제조사를 입력 또는 선택해주세요.");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return alert("로그인 정보가 없습니다.");

    setUploading(true);
    try {
      const imageUrl = await uploadImageToStorage();

      const payload = {
        name, 
        category, 
        manufacturer: finalManufacturer, 
        status, 
        description,
        price: price ? parseInt(price) : 0,
        stock: stock ? parseInt(stock) : 0,
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
    <div className="w-full h-[calc(100vh-80px)] flex flex-col space-y-4 overflow-hidden max-w-[1700px] mx-auto pb-4">
      
      {/* 상단 헤더 */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white px-6 py-5 rounded-2xl shadow-sm border border-slate-200 gap-3 flex-shrink-0">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">제품관리</h1>
          <p className="text-xs font-semibold text-slate-500 mt-1">약국에서 취급하는 제품을 관리하고, 판매 현황을 확인할 수 있습니다.</p>
        </div>
        <button onClick={handleOpenRegister} className="px-5 py-2.5 bg-[#528771] hover:bg-[#3d6856] text-white rounded-xl font-bold text-xs transition shadow-sm whitespace-nowrap">
          + 제품 등록
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0">
        
        {/* 좌측: 리스트 영역 */}
        <div className="lg:col-span-8 bg-white rounded-3xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
          
          {/* 제조사 탭 (DB 등록된 항목만 노출) */}
          <div className="px-5 pt-4 pb-2 flex items-center gap-2 overflow-x-auto hide-scrollbar border-b border-slate-100 flex-shrink-0">
            {manufacturerTabs.map(m => {
              const count = m === "전체" ? products.length : products.filter(p => p.manufacturer === m).length;
              const isActive = selectedManufacturer === m;
              return (
                <button 
                  key={m}
                  onClick={() => setSelectedManufacturer(m)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap border ${
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
              <thead className="bg-slate-50/80 text-slate-500 sticky top-0 backdrop-blur-md z-10 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 font-bold w-20">이미지</th>
                  <th className="py-3 px-4 font-bold">제품명</th>
                  <th className="py-3 px-4 font-bold text-center">분류</th>
                  <th className="py-3 px-4 font-bold">제조사</th>
                  <th className="py-3 px-4 font-bold text-right">판매가</th>
                  <th className="py-3 px-4 font-bold text-center">재고수량</th>
                  <th className="py-3 px-4 font-bold text-center">상태</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.length === 0 ? (
                  <tr><td colSpan={7} className="py-12 text-center text-slate-400">등록된 제품이 없습니다. 새로운 제품을 등록해보세요.</td></tr>
                ) : (
                  filteredProducts.map((p) => (
                    <tr 
                      key={p.id} 
                      onClick={() => setSelectedProduct(p)}
                      className={`cursor-pointer transition-colors ${selectedProduct?.id === p.id ? "bg-teal-50/40" : "hover:bg-slate-50"}`}
                    >
                      <td className="py-2 px-4">
                        <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200 bg-slate-50 p-0.5 flex items-center justify-center">
                          {p.image_url ? <img src={p.image_url} className="w-full h-full object-cover rounded-md" /> : <span className="text-[10px] text-slate-400">No Img</span>}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-extrabold text-slate-900">{p.name}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-1 rounded-md border border-teal-100 whitespace-nowrap">{p.category}</span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-600">{p.manufacturer || "-"}</td>
                      <td className="py-3 px-4 font-extrabold text-slate-800 text-right">{p.price?.toLocaleString()}원</td>
                      <td className="py-3 px-4 font-bold text-slate-700 text-center">{p.stock}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${p.status === '판매중' ? 'text-emerald-700 bg-emerald-50' : 'text-rose-700 bg-rose-50'}`}>
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
        <div className="lg:col-span-4 bg-white rounded-3xl shadow-sm border border-slate-200 flex flex-col p-6 overflow-hidden">
          <div className="mb-4">
            <input 
              type="text" 
              placeholder="제품명 또는 제조사로 검색하세요..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#528771] transition"
            />
          </div>

          {selectedProduct ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex justify-between items-center mb-6 shrink-0">
                <h2 className="text-[15px] font-extrabold text-slate-900">제품 상세 정보</h2>
                <div className="flex gap-2">
                  <button onClick={() => handleOpenEdit(selectedProduct)} className="text-[11px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition">✏️ 수정</button>
                  <button onClick={() => handleDelete(selectedProduct.id)} className="text-[11px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg transition">삭제</button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 space-y-6">
                <div className="flex items-center gap-5 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                  <div className="w-24 h-24 rounded-xl overflow-hidden border border-slate-200 bg-slate-50 p-1 shrink-0 flex items-center justify-center">
                    {selectedProduct.image_url ? <img src={selectedProduct.image_url} className="w-full h-full object-cover rounded-lg" /> : <span className="text-xs text-slate-400">이미지 없음</span>}
                  </div>
                  <div className="flex flex-col gap-1">
                    <h3 className="text-xl font-extrabold text-slate-900">{selectedProduct.name}</h3>
                    <span className="text-xs font-bold text-slate-500">{selectedProduct.manufacturer}</span>
                    <p className="text-[11px] font-medium text-slate-600 mt-1 leading-relaxed whitespace-pre-wrap">
                      {selectedProduct.description || "등록된 상세 설명이 없습니다."}
                    </p>
                  </div>
                </div>

                <div className="space-y-3 px-1 text-xs">
                  <div className="flex justify-between items-center py-2 border-b border-slate-100">
                    <span className="font-bold text-slate-400">분류</span>
                    <span className="font-bold text-slate-800">{selectedProduct.category}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-100">
                    <span className="font-bold text-slate-400">상태</span>
                    <span className={`font-bold ${selectedProduct.status === '판매중' ? 'text-emerald-600' : 'text-rose-600'}`}>{selectedProduct.status}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-100">
                    <span className="font-bold text-slate-400">판매가</span>
                    <span className="font-extrabold text-[#528771] text-sm">{selectedProduct.price?.toLocaleString()}원</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-100">
                    <span className="font-bold text-slate-400">재고수량</span>
                    <span className="font-bold text-slate-800">{selectedProduct.stock}개</span>
                  </div>
                </div>
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
          <div className="bg-white w-full max-w-xl max-h-[90vh] rounded-3xl p-6 shadow-2xl border border-slate-200 flex flex-col cursor-default" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b pb-3 mb-4 shrink-0">
              <h3 className="text-base font-bold text-slate-900">{editingProductId ? "제품 정보 수정" : "새 제품 등록"}</h3>
              <button onClick={() => setIsModalOpen(false)} className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-200">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto pr-2 space-y-4 text-xs">
              
              <div className="flex gap-4">
                <div className="w-28 flex flex-col gap-2 shrink-0">
                  <label className="block font-bold text-slate-700">제품 이미지</label>
                  <label className="w-full aspect-square rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center cursor-pointer hover:bg-slate-100 overflow-hidden relative">
                    {imagePreview ? (
                      <img src={imagePreview} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[10px] text-slate-400 font-bold">클릭하여 등록</span>
                    )}
                    <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                  </label>
                </div>

                <div className="flex-1 space-y-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">제품명 *</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold focus:outline-none focus:border-[#528771]" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">제조사 *</label>
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
                            <option value="직접입력">+ 직접 입력</option>
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

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">판매가 (원)</label>
                  <input type="number" value={price} onChange={e => setPrice(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold focus:outline-none focus:border-[#528771]" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">재고 수량</label>
                  <input type="number" value={stock} onChange={e => setStock(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold focus:outline-none focus:border-[#528771]" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">상태</label>
                  <select value={status} onChange={e => setStatus(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold">
                    {STATUS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">상세 설명</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold resize-none focus:outline-none focus:border-[#528771]" placeholder="제품 특징이나 주요 성분을 입력하세요." />
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