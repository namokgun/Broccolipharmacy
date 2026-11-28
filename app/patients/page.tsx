"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

const CONSTITUTION_OPTIONS = ["선택 안함", "태양인", "태음인", "소양인", "소음인", "강아지", "고양이"];

// 제공된 검사지 및 기존 양식의 검사항목 목록
const LAB_PRESETS: string[] = [
  "TG",
  "LDL",
  "HDL",
  "TOTAL",
  "HP",
  "당화혈",
  "FPS",
  "안압",
  "총빌리루빈",
  "간접빌리루빈",
  "TSH",
  "T4",
  "uric acid",
  "AST",
  "ALT",
  "Protein total",
  "Albumin",
  "BUN",
  "Creatinine",
  "eGFR",
  "Glucose",
  "Sodium",
  "Potassium",
  "Chloride",
  "Phosphorus",
  "Calcium",
  "Triglyceride",
  "HDL-Cholesterol",
  "LDL-Cholesterol",
  "Microalbumin/Creatinine Ratio",
  "Microalbumin(U)",
  "Malb/CrRatio",
];

interface LabItemEntry {
  name: string;
  ref: string;
  value: string;
}

interface LabRecord {
  id: string;
  exam_date: string;
  items: LabItemEntry[];
}

const getLocalToday = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

// 참고치(ref) 대비 높음/낮음 자동 판정
const evaluateLabStatus = (value: string, ref: string): "high" | "low" | "normal" => {
  if (!value || !ref) return "normal";
  const cleanVal = value.trim();
  if (!/^-?\d+(\.\d+)?$/.test(cleanVal)) return "normal";
  const num = parseFloat(cleanVal);
  if (isNaN(num)) return "normal";

  const cleanRef = ref.replace(/\s+/g, "");

  // <150, <=150 형태
  const lessMatch = cleanRef.match(/^<=?(-?\d+(?:\.\d+)?)/);
  if (lessMatch) {
    const max = parseFloat(lessMatch[1]);
    return num > max ? "high" : "normal";
  }

  // >60, >=60 형태
  const greaterMatch = cleanRef.match(/^>=?(-?\d+(?:\.\d+)?)/);
  if (greaterMatch) {
    const min = parseFloat(greaterMatch[1]);
    return num < min ? "low" : "normal";
  }

  // 3-7, 0.35-5.5, 0~33 범위 형태
  const rangeMatch = cleanRef.match(/^(-?\d+(?:\.\d+)?)[-~](-?\d+(?:\.\d+)?)/);
  if (rangeMatch) {
    const min = parseFloat(rangeMatch[1]);
    const max = parseFloat(rangeMatch[2]);
    if (num > max) return "high";
    if (num < min) return "low";
    return "normal";
  }

  return "normal";
};

const getLabValueColorClass = (status: "high" | "low" | "normal") => {
  if (status === "high") return "text-rose-600 font-extrabold";
  if (status === "low") return "text-blue-600 font-extrabold";
  return "text-slate-800 font-bold";
};

const getTagColor = (tag: string) => {
  const colors = [
    "bg-red-100 text-red-800 border-red-200", 
    "bg-orange-100 text-orange-800 border-orange-200", 
    "bg-amber-100 text-amber-800 border-amber-200", 
    "bg-green-100 text-green-800 border-green-200", 
    "bg-emerald-100 text-emerald-800 border-emerald-200", 
    "bg-blue-100 text-blue-800 border-blue-200", 
    "bg-indigo-100 text-indigo-800 border-indigo-200", 
    "bg-purple-100 text-purple-800 border-purple-200", 
    "bg-pink-100 text-pink-800 border-pink-200",
    "bg-rose-100 text-rose-800 border-rose-200"
  ];
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

// 숫자/문자열 관계없이 판매 금액 추출
const getSaleAmount = (s: any) => {
  const totalAmt = Number(s.total_amount);
  if (s.total_amount !== null && s.total_amount !== undefined && s.total_amount !== "" && !isNaN(totalAmt)) {
    return totalAmt;
  }
  const amt = Number(s.amount);
  if (s.amount !== null && s.amount !== undefined && s.amount !== "" && !isNaN(amt)) {
    return amt;
  }
  if (Array.isArray(s.items)) {
    return s.items.reduce((sum: number, item: any) => sum + ((Number(item.price) || 0) * (Number(item.quantity) || 1)), 0);
  }
  return 0;
};

// 환자(및 대표 고객 연결 가족)별 누적 판매 금액 합산 헬퍼
const calculatePatientCumulativeSales = (patientsList: any[], salesList: any[]) => {
  if (patientsList.length === 0 || salesList.length === 0) return [];

  const patientIdSet = new Set(patientsList.map(p => String(p.id)));

  const groups: Record<string, {
    repPatient: any;
    memberIds: Set<string>;
    memberNames: Set<string>;
    totalAmt: number;
    count: number;
  }> = {};

  patientsList.forEach(p => {
    const hasValidRep = p.representative_id && patientIdSet.has(String(p.representative_id));
    const repId = hasValidRep ? String(p.representative_id) : String(p.id);
    const repPatient = hasValidRep
      ? patientsList.find(pt => String(pt.id) === repId) || p
      : p;

    if (!groups[repId]) {
      groups[repId] = {
        repPatient,
        memberIds: new Set<string>(),
        memberNames: new Set<string>(),
        totalAmt: 0,
        count: 0,
      };
    }

    groups[repId].memberIds.add(String(p.id));
    if (p.name && p.name.trim()) {
      groups[repId].memberNames.add(p.name.trim());
    }
  });

  const groupList = Object.values(groups);

  salesList.forEach(s => {
    const amt = s.computed_amount ?? getSaleAmount(s);
    const sPatientId = s.patient_id ? String(s.patient_id) : null;
    const sPatientName = (s.patient_name || "").trim();

    let matchedGroup = sPatientId
      ? groupList.find(g => g.memberIds.has(sPatientId))
      : undefined;

    if (!matchedGroup && sPatientName && (!sPatientId || !patientIdSet.has(sPatientId))) {
      matchedGroup = groupList.find(g => g.memberNames.has(sPatientName));
    }

    if (matchedGroup) {
      matchedGroup.totalAmt += amt;
      matchedGroup.count += 1;
    }
  });

  return groupList
    .filter(g => g.totalAmt > 0 || g.count > 0)
    .map(g => ({
      key: String(g.repPatient.id),
      patient: g.repPatient,
      patientId: g.repPatient.id,
      name: g.repPatient.name,
      customId: g.repPatient.custom_id,
      totalAmt: g.totalAmt,
      count: g.count,
    }))
    .sort((a, b) => b.totalAmt - a.totalAmt);
};

export default function PatientsPage() {
  const router = useRouter();

  const [patients, setPatients] = useState<any[]>([]);
  const [consultations, setConsultations] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentDate, setCurrentDate] = useState<Date | null>(null);
  
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPatientId, setEditingPatientId] = useState<string | null>(null);

  const [historyModalPatient, setHistoryModalPatient] = useState<any | null>(null);
  const [photosModalPatient, setPhotosModalPatient] = useState<any | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  // 혈액검사 모달 및 동적 입력 상태
  const [isLabTableModalOpen, setIsLabTableModalOpen] = useState(false);
  const [isEditingTableRefs, setIsEditingTableRefs] = useState(false);
  const [draftTableRefs, setDraftTableRefs] = useState<Record<string, string>>({});

  const [isLabInputModalOpen, setIsLabInputModalOpen] = useState(false);
  const [editingLabRecordId, setEditingLabRecordId] = useState<string | null>(null);
  const [labExamDate, setLabExamDate] = useState("");
  const [labDraftItems, setLabDraftItems] = useState<LabItemEntry[]>([]);
  const [labItemSearch, setLabItemSearch] = useState("");
  const [labSearchHighlightIdx, setLabSearchHighlightIdx] = useState(0);
  const [savingLab, setSavingLab] = useState(false);
  const labItemSearchInputRef = useRef<HTMLInputElement | null>(null);
  const labValueInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // 폼 필드
  const [name, setName] = useState("");
  const [customId, setCustomId] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [gender, setGender] = useState("남");
  const [birthYear, setBirthYear] = useState("");
  const [bodyType, setBodyType] = useState("선택 안함");
  const [tagsInput, setTagsInput] = useState("");
  const [memo, setMemo] = useState("");
  
  // 대표 고객 검색 선택 관련 상태
  const [representativeId, setRepresentativeId] = useState<string>("");
  const [repSearch, setRepSearch] = useState("");

  const [activeCount, setActiveCount] = useState(0);

  useEffect(() => {
    setCurrentDate(new Date());
    fetchData();
  }, []);

  useEffect(() => {
    if (consultations.length > 0 && currentDate) {
      const threeMonthsAgo = new Date(currentDate);
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      const activePatientIds = new Set(
        consultations
          .filter(c => new Date(c.consultation_date || c.created_at) >= threeMonthsAgo)
          .map(c => c.patient_id)
      );
      setActiveCount(activePatientIds.size);
    } else {
      setActiveCount(0);
    }
  }, [consultations, currentDate]);

  const fetchData = async () => {
    const { data: pData, error: pError } = await supabase.from("patients").select("*").order("name");
    if (pError) console.error("고객 데이터 로딩 에러:", pError.message);
    if (pData) {
      setPatients(pData);
      setSelectedPatient((prev: any) => {
        if (!prev) return pData.length > 0 ? pData[0] : null;
        return pData.find((p: any) => p.id === prev.id) || pData[0] || null;
      });
    }

    const { data: sData, error: sError } = await supabase
      .from("sales")
      .select("*")
      .order("created_at", { ascending: false });
    if (sError) console.error("판매 데이터 로딩 에러:", sError.message);
    if (sData) {
      const normalizedSales = sData
        .map((s: any) => ({
          ...s,
          sale_date_str: s.sale_date || s.created_at?.split("T")[0] || "",
          computed_amount: getSaleAmount(s),
        }))
        .sort((a: any, b: any) => (b.sale_date_str || "").localeCompare(a.sale_date_str || ""));
      setSales(normalizedSales);
    }

    const { data: cData, error: cError } = await supabase.from("consultations").select("*").order("created_at", { ascending: false });
    if (cError) console.error("상담 데이터 로딩 에러:", cError.message);
    if (cData) {
      const withSignedUrls = await Promise.all(
        cData.map(async (c) => {
          if (c.image_urls && c.image_urls.length > 0) {
            const signedUrls = await Promise.all(
              c.image_urls.map(async (path: string) => {
                if (path.startsWith('http')) return path;
                const { data: signedData } = await supabase.storage.from('consultation-images').createSignedUrl(path, 60 * 60);
                return signedData?.signedUrl || '';
              })
            );
            return { ...c, display_image_urls: signedUrls.filter(Boolean) };
          }
          return { ...c, display_image_urls: [] };
        })
      );
      setConsultations(withSignedUrls);
    }
  };

  // 상담 내역 클릭 시 해당 상담 페이지로 이동
  const handleNavigateToConsultation = (consultation: any) => {
    if (!consultation?.id) return;
    setHistoryModalPatient(null);
    const params = new URLSearchParams();
    params.set("consultationId", String(consultation.id));
    if (consultation.patient_id) {
      params.set("patientId", String(consultation.patient_id));
    }
    router.push(`/consultations?${params.toString()}`);
  };

  // =========================================================================
  // 혈액검사 기록 파싱 및 시계열 매트릭스 계산
  // =========================================================================
  const selectedPatientLabRecords: LabRecord[] = useMemo(() => {
    if (!selectedPatient || !Array.isArray(selectedPatient.lab_records)) return [];
    return [...selectedPatient.lab_records]
      .filter((r: any) => r && r.exam_date && Array.isArray(r.items))
      .sort((a: LabRecord, b: LabRecord) => (b.exam_date || "").localeCompare(a.exam_date || ""));
  }, [selectedPatient]);

  const patientLabMatrixRows = useMemo(() => {
    const rowMap = new Map<string, { name: string; ref: string }>();
    const chronological = [...selectedPatientLabRecords].reverse();
    chronological.forEach(rec => {
      rec.items.forEach(item => {
        const key = item.name.trim();
        if (!key) return;
        const existing = rowMap.get(key);
        if (!existing) {
          rowMap.set(key, { name: key, ref: item.ref || "" });
        } else if (item.ref && item.ref.trim() !== "") {
          existing.ref = item.ref.trim();
        }
      });
    });
    return Array.from(rowMap.values());
  }, [selectedPatientLabRecords]);

  // 추이표에서 [기준치 수정] 시작
  const handleStartEditTableRefs = () => {
    const initialRefs: Record<string, string> = {};
    patientLabMatrixRows.forEach(r => {
      initialRefs[r.name] = r.ref || "";
    });
    setDraftTableRefs(initialRefs);
    setIsEditingTableRefs(true);
  };

  // 추이표에서 수정한 기준치 일괄 저장
  const handleSaveTableRefs = async () => {
    if (!selectedPatient) return;

    const existingRecords: LabRecord[] = Array.isArray(selectedPatient.lab_records)
      ? [...selectedPatient.lab_records]
      : [];

    const updatedRecords = existingRecords.map(rec => ({
      ...rec,
      items: rec.items.map(item => {
        const matchedKey = Object.keys(draftTableRefs).find(
          k => k.trim().toLowerCase() === item.name.trim().toLowerCase()
        );
        if (matchedKey !== undefined) {
          return { ...item, ref: draftTableRefs[matchedKey].trim() };
        }
        return item;
      }),
    }));

    setSavingLab(true);
    const { error } = await supabase
      .from("patients")
      .update({ lab_records: updatedRecords })
      .eq("id", selectedPatient.id);
    setSavingLab(false);

    if (error) {
      alert("기준치 저장 실패: " + error.message);
      return;
    }

    setIsEditingTableRefs(false);
    fetchData();
  };

  const labSearchCandidates = useMemo(() => {
    const term = labItemSearch.trim();
    if (!term) return [];
    const lower = term.toLowerCase();

    const matchedPresets = LAB_PRESETS.filter(itemName =>
      itemName.toLowerCase().includes(lower)
    ).map(itemName => ({
      name: itemName,
      isCustom: false,
    }));

    const hasExactMatch = matchedPresets.some(p => p.name.toLowerCase() === lower);
    if (!hasExactMatch) {
      matchedPresets.push({
        name: term,
        isCustom: true,
      });
    }

    return matchedPresets;
  }, [labItemSearch]);

  const handleOpenLabInput = (recordToEdit: LabRecord | null = null) => {
    if (!selectedPatient) return;

    if (recordToEdit) {
      setEditingLabRecordId(recordToEdit.id);
      setLabExamDate(recordToEdit.exam_date);
      setLabDraftItems(recordToEdit.items.map(i => ({ ...i })));
    } else {
      setEditingLabRecordId(null);
      setLabExamDate(getLocalToday());
      if (patientLabMatrixRows.length > 0) {
        setLabDraftItems(
          patientLabMatrixRows.map(r => ({
            name: r.name,
            ref: "",
            value: "",
          }))
        );
      } else {
        setLabDraftItems([]);
      }
    }

    setLabItemSearch("");
    setLabSearchHighlightIdx(0);
    setIsLabInputModalOpen(true);
    setTimeout(() => labItemSearchInputRef.current?.focus(), 50);
  };

  const handleAddLabItemRow = (itemName: string) => {
    const trimmed = itemName.trim();
    if (!trimmed) return;

    const alreadyIdx = labDraftItems.findIndex(
      i => i.name.toLowerCase() === trimmed.toLowerCase()
    );

    if (alreadyIdx >= 0) {
      setLabItemSearch("");
      setLabSearchHighlightIdx(0);
      setTimeout(() => labValueInputRefs.current[alreadyIdx]?.focus(), 30);
      return;
    }

    const matchedPreset = LAB_PRESETS.find(
      p => p.toLowerCase() === trimmed.toLowerCase()
    );

    const nextIdx = labDraftItems.length;
    setLabDraftItems(prev => [
      ...prev,
      {
        name: matchedPreset || trimmed,
        ref: "",
        value: "",
      },
    ]);
    setLabItemSearch("");
    setLabSearchHighlightIdx(0);
    setTimeout(() => labValueInputRefs.current[nextIdx]?.focus(), 30);
  };

  const handleLabSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!labItemSearch.trim()) return;

    if (e.key === "Tab") {
      e.preventDefault();
      if (labSearchCandidates.length > 0) {
        if (e.shiftKey) {
          setLabSearchHighlightIdx(prev => (prev - 1 + labSearchCandidates.length) % labSearchCandidates.length);
        } else {
          setLabSearchHighlightIdx(prev => (prev + 1) % labSearchCandidates.length);
        }
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (labSearchCandidates.length > 0) {
        setLabSearchHighlightIdx(prev => (prev + 1) % labSearchCandidates.length);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (labSearchCandidates.length > 0) {
        setLabSearchHighlightIdx(prev => (prev - 1 + labSearchCandidates.length) % labSearchCandidates.length);
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = labSearchCandidates[labSearchHighlightIdx];
      if (target) {
        handleAddLabItemRow(target.name);
      } else {
        handleAddLabItemRow(labItemSearch.trim());
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setLabItemSearch("");
      setLabSearchHighlightIdx(0);
    }
  };

  const handleSaveLabRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) return;
    if (!labExamDate) return alert("검사일자를 입력해주세요.");

    const validItems = labDraftItems
      .filter(i => i.name.trim() !== "" && i.value.trim() !== "")
      .map(i => ({
        name: i.name.trim(),
        ref: i.ref.trim(),
        value: i.value.trim(),
      }));

    if (validItems.length === 0) {
      return alert("최소 1개 이상의 검사 결과값을 입력해주세요.");
    }

    const existingRecords: LabRecord[] = Array.isArray(selectedPatient.lab_records)
      ? [...selectedPatient.lab_records]
      : [];

    let updatedRecords: LabRecord[];
    if (editingLabRecordId) {
      updatedRecords = existingRecords.map(rec =>
        rec.id === editingLabRecordId
          ? { ...rec, exam_date: labExamDate, items: validItems }
          : rec
      );
    } else {
      const newRecord: LabRecord = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        exam_date: labExamDate,
        items: validItems,
      };
      updatedRecords = [newRecord, ...existingRecords];
    }

    setSavingLab(true);
    const { error } = await supabase
      .from("patients")
      .update({ lab_records: updatedRecords })
      .eq("id", selectedPatient.id);
    setSavingLab(false);

    if (error) {
      if (error.message?.includes("lab_records")) {
        alert(
          "Supabase의 patients 테이블에 lab_records 컬럼이 없습니다.\nSQL Editor에서 아래 명령어를 실행해 주세요:\n\nALTER TABLE patients ADD COLUMN IF NOT EXISTS lab_records JSONB DEFAULT '[]'::jsonb;"
        );
      } else {
        alert("혈액검사 저장 실패: " + error.message);
      }
      return;
    }

    setIsLabInputModalOpen(false);
    fetchData();
  };

  const handleDeleteLabRecord = async (recordId: string) => {
    if (!selectedPatient) return;
    if (!confirm("이 날짜의 혈액검사 기록을 삭제하시겠습니까?")) return;

    const existingRecords: LabRecord[] = Array.isArray(selectedPatient.lab_records)
      ? selectedPatient.lab_records
      : [];
    const updatedRecords = existingRecords.filter(r => r.id !== recordId);

    setSavingLab(true);
    const { error } = await supabase
      .from("patients")
      .update({ lab_records: updatedRecords })
      .eq("id", selectedPatient.id);
    setSavingLab(false);

    if (error) {
      alert("삭제 실패: " + error.message);
      return;
    }

    setIsLabInputModalOpen(false);
    fetchData();
  };

  const getPatientStats = (patient: any) => {
    const familyMembers = patients.filter(
      p => p.id === patient.id || p.representative_id === patient.id || (patient.representative_id && p.representative_id === patient.representative_id)
    );
    const uniquePatientIds = Array.from(new Set([String(patient.id), ...familyMembers.map(p => String(p.id))]));
    const familyNames = new Set(familyMembers.map(p => (p.name || "").trim()).filter(Boolean));
    if (patient.name) familyNames.add(patient.name.trim());

    const allPatientIds = new Set(patients.map(p => String(p.id)));

    const pConsults = consultations
      .filter(c => uniquePatientIds.includes(String(c.patient_id)))
      .sort((a, b) => {
        const dateA = new Date(a.consultation_date || a.created_at).getTime();
        const dateB = new Date(b.consultation_date || b.created_at).getTime();
        return dateB - dateA; 
      });

    const pSales = sales.filter(s => {
      const sPatientId = s.patient_id ? String(s.patient_id) : null;
      if (sPatientId && allPatientIds.has(sPatientId)) {
        return uniquePatientIds.includes(sPatientId);
      }
      const sName = (s.patient_name || "").trim();
      return sName !== "" && familyNames.has(sName);
    });

    const count = pConsults.length;
    const totalAmount = pSales.reduce((sum, s) => sum + (s.computed_amount ?? getSaleAmount(s)), 0);
    
    const lastDate = count > 0 ? (pConsults[0].consultation_date || pConsults[0].created_at.split('T')[0]) : "-";
    
    return { count, totalAmount, lastDate, pConsults, pSales };
  };

  const totalPatientsCount = patients.length;

  const patientConsultCounts: Record<string, number> = {};
  consultations.forEach(c => {
    if (c.patient_id) {
      patientConsultCounts[c.patient_id] = (patientConsultCounts[c.patient_id] || 0) + 1;
    }
  });
  const returningCount = Object.values(patientConsultCounts).filter(cnt => cnt >= 2).length;

  const customerSalesRankingAll = useMemo(
    () => calculatePatientCumulativeSales(patients, sales),
    [patients, sales]
  );

  const totalSalesSumAll = useMemo(
    () => customerSalesRankingAll.reduce((sum, c) => sum + c.totalAmt, 0),
    [customerSalesRankingAll]
  );

  const customerSalesRanking3Months = useMemo(() => {
    if (!currentDate) return [];

    const threeMonthsAgo = new Date(currentDate);
    threeMonthsAgo.setHours(0, 0, 0, 0);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const recentSales = sales.filter(s => {
      const dateStr = s.sale_date_str || s.sale_date || s.created_at?.split("T")[0];
      if (!dateStr) return false;
      const [y, m, d] = dateStr.split("-").map(Number);
      const saleDateObj = y && m && d ? new Date(y, m - 1, d) : new Date(dateStr);
      return !isNaN(saleDateObj.getTime()) && saleDateObj >= threeMonthsAgo;
    });

    return calculatePatientCumulativeSales(patients, recentSales);
  }, [patients, sales, currentDate]);

  const totalSalesSum3Months = useMemo(
    () => customerSalesRanking3Months.reduce((sum, c) => sum + c.totalAmt, 0),
    [customerSalesRanking3Months]
  );

  const handleSelectTopCustomer = (item: { patient?: any; patientId: string | null; name: string }) => {
    if (item.patient) {
      setSelectedPatient(item.patient);
      return;
    }
    const found =
      (item.patientId ? patients.find(p => String(p.id) === String(item.patientId)) : null) ||
      patients.find(p => (p.name || "").trim() === item.name.trim());
    if (found) setSelectedPatient(found);
  };

  const handleOpenRegister = () => {
    setEditingPatientId(null);
    setName(""); setCustomId(""); setPhone(""); setAddress(""); setGender("남"); setBirthYear(""); setBodyType("선택 안함");
    setTagsInput(""); setMemo(""); setRepresentativeId(""); setRepSearch("");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (p: any) => {
    setEditingPatientId(p.id);
    setName(p.name || "");
    setCustomId(p.custom_id || "");
    setPhone(p.phone || "");
    setAddress(p.address || "");
    setGender(p.gender || "남");
    setBirthYear(p.birth_year ? p.birth_year.toString() : "");
    setBodyType(p.body_type || "선택 안함");
    setTagsInput(p.tags && Array.isArray(p.tags) ? p.tags.join(", ") : "");
    setMemo(p.memo || "");
    setRepresentativeId(p.representative_id || "");
    
    if (p.representative_id) {
      const rep = patients.find(pt => pt.id === p.representative_id);
      setRepSearch(rep ? rep.name : "");
    } else {
      setRepSearch("");
    }

    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return alert("고객 이름을 입력해주세요.");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return alert("로그인 정보가 없습니다.");

    const tagsArray = tagsInput
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    const payload = {
      name, custom_id: customId, phone, address, gender,
      birth_year: birthYear ? parseInt(birthYear) : null,
      body_type: bodyType === "선택 안함" ? null : bodyType,
      tags: tagsArray, 
      memo,
      representative_id: representativeId || null,
      user_id: user.id
    };

    if (editingPatientId) {
      const { error } = await supabase.from("patients").update(payload).eq("id", editingPatientId);
      if (error) alert("수정 실패: " + error.message);
      else { alert("고객 정보가 수정되었습니다."); setIsModalOpen(false); fetchData(); }
    } else {
      const { error } = await supabase.from("patients").insert([payload]);
      if (error) alert("등록 실패: " + error.message);
      else { alert("신규 고객이 등록되었습니다."); setIsModalOpen(false); fetchData(); }
    }
  };

  const handleDeletePatient = async (id: string) => {
    if (!confirm("정말 이 고객을 삭제하시겠습니까?")) return;
    const { error } = await supabase.from("patients").delete().eq("id", id);
    if (error) alert("삭제 실패: " + error.message);
    else { alert("삭제되었습니다."); setSelectedPatient(null); fetchData(); }
  };

  const enrichedPatients = patients.map(p => {
    const stats = getPatientStats(p);
    const created_at_date = p.created_at ? p.created_at.split('T')[0] : "-";
    return { ...p, ...stats, created_at_date };
  });

  const filteredPatients = enrichedPatients.filter(p => {
    const term = searchTerm.toLowerCase();
    const matchNameOrId = p.name?.toLowerCase().includes(term) || p.custom_id?.toLowerCase().includes(term) || p.phone?.includes(term);
    const matchTag = p.tags?.some((t: string) => t.toLowerCase().includes(term));
    const matchAddress = p.address?.toLowerCase().includes(term);
    return matchNameOrId || matchTag || matchAddress;
  });

  const sortedPatients = [...filteredPatients].sort((a, b) => a.name.localeCompare(b.name));

  const selectedPatientStats = selectedPatient ? getPatientStats(selectedPatient) : { count: 0, totalAmount: 0, lastDate: "-", pConsults: [], pSales: [] };
  
  const selectedPatientAllPhotos = selectedPatient 
    ? consultations
        .filter(c => c.patient_id === selectedPatient.id)
        .sort((a, b) => new Date(b.consultation_date || b.created_at).getTime() - new Date(a.consultation_date || a.created_at).getTime())
        .flatMap(c => (c.display_image_urls || []).map((url: string) => ({ 
          url, 
          date: c.consultation_date || c.created_at.split('T')[0], 
          prescription: c.prescription 
        })))
    : [];

  return (
    <div className="w-full h-[calc(100vh-32px)] flex flex-col space-y-2 overflow-hidden max-w-[1700px] mx-auto pb-1 text-xs">
      
      {/* 상단 헤더 */}
      <div className="bg-white px-4 py-2.5 rounded-2xl shadow-sm border border-slate-200 flex justify-between items-center flex-shrink-0">
        <h1 className="text-base font-extrabold text-slate-900">고객 관리</h1>
        <button onClick={handleOpenRegister} className="px-3.5 py-1.5 bg-[#528771] hover:bg-[#3d6856] text-white rounded-xl font-black text-xs transition shadow-sm whitespace-nowrap">
          + 신규 고객 등록
        </button>
      </div>

      {/* 3분할 인터페이스 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 flex-1 min-h-0">
        
        {/* 1열: 고객 목록 */}
        <div className="lg:col-span-5 bg-white rounded-3xl shadow-sm border border-slate-200 flex flex-col overflow-hidden p-3.5 space-y-2.5">
          
          <div className="grid grid-cols-3 gap-2 flex-shrink-0">
            <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col justify-between">
              <span className="text-[10px] font-bold text-slate-400">전체 고객</span>
              <div className="text-base font-extrabold text-slate-900 mt-0.5">{totalPatientsCount}<span className="text-[10px] font-semibold text-slate-500 ml-0.5">명</span></div>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col justify-between">
              <span className="text-[10px] font-bold text-slate-400">활성 고객</span>
              <div className="text-base font-extrabold text-slate-900 mt-0.5">{activeCount}<span className="text-[10px] font-semibold text-slate-500 ml-0.5">명</span></div>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col justify-between">
              <span className="text-[10px] font-bold text-slate-400">재방문 고객</span>
              <div className="text-base font-extrabold text-slate-900 mt-0.5">{returningCount}<span className="text-[10px] font-semibold text-slate-500 ml-0.5">명</span></div>
            </div>
          </div>

          <div className="flex-shrink-0">
            <input 
              type="text" 
              placeholder="이름, 번호, ID, 주소, 태그 검색..." 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#528771] transition"
            />
          </div>

          <div className="text-[11px] font-bold text-slate-400 px-0.5 flex-shrink-0">
            고객 목록 <span className="text-slate-900 font-extrabold">총 {sortedPatients.length}명</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1 pr-1 hide-scrollbar">
            {sortedPatients.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-xs">등록된 고객이 없습니다.</div>
            ) : (
              sortedPatients.map((p) => {
                const isSelected = selectedPatient?.id === p.id;
                const ageText = p.birth_year && currentDate ? `${currentDate.getFullYear() - p.birth_year + 1}세` : "-";

                return (
                  <div 
                    key={p.id} 
                    onClick={() => setSelectedPatient(p)}
                    className={`p-2.5 rounded-xl border transition cursor-pointer flex items-center justify-between gap-2 text-xs ${
                      isSelected ? "bg-teal-50/70 border-teal-600 shadow-2xs" : "bg-white border-slate-100 hover:bg-slate-50/80"
                    }`}
                  >
                    <div className="grid grid-cols-12 items-center w-full gap-1.5 text-center text-[11px]">
                      <div className="col-span-4 text-left truncate pr-1 flex flex-col justify-center">
                        <span className="font-extrabold text-slate-900 truncate" title={p.custom_id ? `${p.name} (${p.custom_id})` : p.name}>
                          {p.name} {p.custom_id && <span className="text-[9px] font-semibold text-slate-400 ml-0.5">({p.custom_id})</span>}
                        </span>
                        {p.phone && <span className="text-[9px] font-bold text-slate-500 truncate">{p.phone}</span>}
                      </div>
                      
                      <div className="col-span-3 text-slate-600 font-semibold truncate flex flex-col justify-center">
                        <span>{ageText} / {p.gender || "-"}</span>
                      </div>
                      
                      <div className="col-span-2 flex flex-col justify-center items-center">
                        {p.body_type && p.body_type !== "선택 안함" ? (
                          <span className="bg-teal-50 text-teal-800 px-1.5 py-0.2 rounded font-bold whitespace-nowrap">{p.body_type}</span>
                        ) : <span className="text-slate-300">-</span>}
                      </div>

                      <div className="col-span-3 flex flex-wrap justify-end gap-1 truncate items-center">
                        {p.tags && p.tags.slice(0, 1).map((tag: string, idx: number) => (
                          <span key={idx} className={`text-[9px] font-bold px-1.5 py-0.2 rounded border whitespace-nowrap ${getTagColor(tag)}`}>{tag}</span>
                        ))}
                      </div>
                    </div>
                    <div className="text-slate-300 font-bold flex-shrink-0 ml-0.5">›</div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 2열: 선택된 고객 상세 정보 */}
        <div className="lg:col-span-4 bg-white rounded-3xl shadow-sm border border-slate-200 flex flex-col overflow-hidden p-3.5 space-y-2.5">
          {selectedPatient ? (
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 hide-scrollbar">
              
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                    <span>👤</span> {selectedPatient.name} {selectedPatient.custom_id ? `(${selectedPatient.custom_id})` : ""}
                  </h2>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => handleOpenEdit(selectedPatient)} className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg font-bold text-[10px] transition">수정</button>
                    <button onClick={() => handleDeletePatient(selectedPatient.id)} className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg font-bold text-[10px] transition">삭제</button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-600 pt-0.5">
                  <span className="font-bold text-teal-800">
                    {selectedPatient.body_type && selectedPatient.body_type !== "선택 안함" ? selectedPatient.body_type : "체질 미설정"}
                  </span>
                  <span>·</span>
                  <span>{selectedPatient.birth_year && currentDate ? `${currentDate.getFullYear() - selectedPatient.birth_year + 1}세` : "-"} / {selectedPatient.gender || "-"}</span>
                  
                  {selectedPatient.phone && (
                    <>
                      <span>·</span>
                      <span className="font-bold">{selectedPatient.phone}</span>
                    </>
                  )}

                  {selectedPatient.tags && selectedPatient.tags.length > 0 && (
                    <>
                      <span>·</span>
                      <div className="flex flex-wrap gap-1">
                        {selectedPatient.tags.map((tag: string, idx: number) => (
                          <span key={idx} className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${getTagColor(tag)}`}>{tag}</span>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1.5 text-center text-xs">
                <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[9px] text-slate-400 block mb-0.5">최근 상담일</span>
                  <span className="font-bold text-slate-800 text-[11px]">{selectedPatientStats.lastDate}</span>
                </div>
                <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[9px] text-slate-400 block mb-0.5">상담 횟수</span>
                  <span className="font-bold text-slate-800 text-[11px]">{selectedPatientStats.count}회</span>
                </div>
                <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[9px] text-slate-400 block mb-0.5">누적 결제</span>
                  <span className="font-bold text-[#528771] text-[11px]">{selectedPatientStats.totalAmount.toLocaleString()}원</span>
                </div>
              </div>

              {/* 혈액검사 기록 요약 카드 */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-extrabold text-slate-900">
                    🩸 혈액검사 기록 ({selectedPatientLabRecords.length}회)
                  </h3>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleOpenLabInput(null)}
                      className="px-2 py-0.5 bg-[#528771] hover:bg-[#3d6856] text-white rounded-md font-bold text-[10px] transition"
                    >
                      + 결과 입력
                    </button>
                    {selectedPatientLabRecords.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingTableRefs(false);
                          setIsLabTableModalOpen(true);
                        }}
                        className="text-[10px] font-bold text-teal-800 hover:underline"
                      >
                        전체 표 보기 →
                      </button>
                    )}
                  </div>
                </div>

                {selectedPatientLabRecords.length === 0 ? (
                  <div
                    onClick={() => handleOpenLabInput(null)}
                    className="p-2.5 bg-slate-50 hover:bg-teal-50/40 rounded-xl border border-dashed border-slate-200 text-center text-[11px] text-slate-400 cursor-pointer transition"
                  >
                    등록된 혈액검사 기록이 없습니다. (+ 결과 입력)
                  </div>
                ) : (
                  <div
                    onClick={() => {
                      setIsEditingTableRefs(false);
                      setIsLabTableModalOpen(true);
                    }}
                    className="p-2.5 bg-slate-50 hover:bg-teal-50/40 rounded-xl border border-slate-100 cursor-pointer transition space-y-1.5"
                  >
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="font-extrabold text-slate-700">
                        최근 검사일: {selectedPatientLabRecords[0].exam_date}
                      </span>
                      <span className="text-slate-400 font-bold">
                        {selectedPatientLabRecords[0].items.length}개 항목
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {selectedPatientLabRecords[0].items.slice(0, 6).map((item, idx) => {
                        const activeRef =
                          item.ref ||
                          patientLabMatrixRows.find(r => r.name === item.name)?.ref ||
                          "";
                        const status = evaluateLabStatus(item.value, activeRef);
                        return (
                          <span
                            key={idx}
                            className="px-1.5 py-0.5 bg-white border border-slate-200/80 rounded-md text-[10px] flex items-center gap-1"
                          >
                            <span className="text-slate-500 font-semibold">{item.name}</span>
                            <span className={getLabValueColorClass(status)}>{item.value}</span>
                          </span>
                        );
                      })}
                      {selectedPatientLabRecords[0].items.length > 6 && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold text-slate-400">
                          +{selectedPatientLabRecords[0].items.length - 6}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 최근 판매 내역 */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-extrabold text-slate-900">🛍️ 최근 판매 내역 ({selectedPatientStats.pSales.length}건)</h3>
                </div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 hide-scrollbar">
                  {selectedPatientStats.pSales.length === 0 ? (
                    <div className="p-3 bg-slate-50 rounded-xl text-center text-[11px] text-slate-400">판매 내역이 없습니다.</div>
                  ) : (
                    selectedPatientStats.pSales.slice(0, 3).map(s => {
                      const itemsText = s.items?.map((i: any) => `${i.name}(${i.quantity})`).join(", ") || "판매 내역";
                      const subText = [s.payment_method, s.memo].filter(Boolean).join(" · ");
                      return (
                        <div key={s.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs flex flex-col gap-1">
                          <div className="flex justify-between items-center font-bold text-slate-700">
                            <div className="flex items-center gap-2 truncate">
                              <span className="text-[10px] text-slate-400">{s.sale_date_str || s.sale_date}</span>
                              <span className="text-teal-900 font-extrabold text-[11px] truncate" title={itemsText}>{itemsText}</span>
                            </div>
                            <span className="text-[#528771] font-extrabold flex-shrink-0">{(s.computed_amount ?? getSaleAmount(s)).toLocaleString()}원</span>
                          </div>
                          {subText && <p className="font-semibold text-slate-600 text-[11px] truncate" title={subText}>{subText}</p>}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* 최근 상담 내역 */}
              <div className="space-y-1.5 pt-2.5">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-extrabold text-slate-900">💬 최근 상담 내역 ({selectedPatientStats.pConsults.length}건)</h3>
                  <button onClick={() => setHistoryModalPatient(selectedPatient)} className="text-[10px] font-bold text-teal-800 hover:underline">전체보기 →</button>
                </div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 hide-scrollbar">
                  {selectedPatientStats.pConsults.length === 0 ? (
                    <div className="p-3 bg-slate-50 rounded-xl text-center text-[11px] text-slate-400">상담 내역이 없습니다.</div>
                  ) : (
                    selectedPatientStats.pConsults.slice(0, 2).map(c => (
                      <div
                        key={c.id}
                        onClick={() => handleNavigateToConsultation(c)}
                        className="p-2.5 bg-slate-50 hover:bg-teal-50/70 rounded-xl border border-slate-100 hover:border-teal-300 text-xs flex flex-col gap-1 cursor-pointer transition"
                      >
                        <div className="flex justify-between items-center font-bold text-slate-700">
                          <div className="flex items-center gap-2 truncate">
                            <span className="text-[10px] text-slate-400">{c.consultation_date || c.created_at?.split('T')[0]}</span>
                            {c.prescription && <span className="text-teal-900 font-extrabold text-[11px] truncate" title={c.prescription}>{c.prescription}</span>}
                          </div>
                          {c.amount && <span className="text-purple-800 font-extrabold flex-shrink-0">{c.amount.toLocaleString()}원</span>}
                        </div>
                        {c.symptoms && <p className="font-semibold text-slate-600 text-[11px] truncate" title={c.symptoms}>{c.symptoms}</p>}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {selectedPatientAllPhotos.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-extrabold text-slate-900">📸 첨부 사진 ({selectedPatientAllPhotos.length}장)</h3>
                    <button onClick={() => setPhotosModalPatient(selectedPatient)} className="text-[10px] font-bold text-blue-700 hover:underline">크게 보기 →</button>
                  </div>
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {selectedPatientAllPhotos.slice(0, 4).map((photo: any, idx: number) => (
                      <div key={idx} className="relative w-14 h-14 border rounded-xl overflow-hidden bg-white cursor-pointer flex-shrink-0" onClick={() => setPreviewImageUrl(photo.url)}>
                        <img src={photo.url} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400 text-xs">
              좌측 목록에서 고객을 선택해주세요.
            </div>
          )}
        </div>

        {/* 3열: 우측 통계 */}
        <div className="lg:col-span-3 bg-white rounded-3xl shadow-sm border border-slate-200 flex flex-col overflow-hidden p-2.5 justify-between gap-1.5">
          
          <div className="flex flex-col flex-1 min-h-0 space-y-1">
            <div className="flex justify-between items-center flex-shrink-0 px-0.5">
              <h3 className="text-[11px] font-extrabold text-slate-900">🏆 전체 누적 판매 TOP 10</h3>
              <span className="text-[10px] font-bold text-slate-400">{totalSalesSumAll.toLocaleString()}원</span>
            </div>
            
            <div className="flex-1 flex flex-col justify-start gap-[2px] overflow-hidden">
              {customerSalesRankingAll.slice(0, 10).map((c, idx) => {
                const percent = Math.round((c.totalAmt / (totalSalesSumAll || 1)) * 100);
                return (
                  <div 
                    key={c.key} 
                    onClick={() => handleSelectTopCustomer(c)}
                    className="px-2 py-[2.5px] bg-slate-50 hover:bg-teal-50/70 rounded-lg border border-slate-100 flex flex-col gap-[2px] cursor-pointer transition"
                  >
                    <div className="flex justify-between items-center text-[10.5px] leading-none">
                      <span className="font-extrabold text-slate-800 truncate max-w-[135px]" title={c.customId ? `${c.name} (${c.customId})` : c.name}>
                        {idx + 1}. {c.name} <span className="text-[9px] font-bold text-slate-400">({c.count}건)</span>
                      </span>
                      <span className="font-black text-[#528771] tabular-nums">{c.totalAmt.toLocaleString()}원</span>
                    </div>
                    <div className="w-full bg-slate-200/80 rounded-full h-[2.5px] overflow-hidden">
                      <div className="bg-[#528771] h-full rounded-full" style={{ width: `${percent}%` }}></div>
                    </div>
                  </div>
                );
              })}
              {customerSalesRankingAll.length === 0 && (
                <div className="text-[11px] text-slate-400 text-center py-4">데이터 없음</div>
              )}
            </div>
          </div>

          <hr className="border-slate-100 flex-shrink-0" />

          <div className="flex flex-col flex-1 min-h-0 space-y-1">
            <div className="flex justify-between items-center flex-shrink-0 px-0.5">
              <h3 className="text-[11px] font-extrabold text-slate-900">🔥 3개월 누적 판매 TOP 10</h3>
              <span className="text-[10px] font-bold text-slate-400">{totalSalesSum3Months.toLocaleString()}원</span>
            </div>
            
            <div className="flex-1 flex flex-col justify-start gap-[2px] overflow-hidden">
              {customerSalesRanking3Months.slice(0, 10).map((c, idx) => {
                const percent = Math.round((c.totalAmt / (totalSalesSum3Months || 1)) * 100);
                return (
                  <div 
                    key={c.key} 
                    onClick={() => handleSelectTopCustomer(c)}
                    className="px-2 py-[2.5px] bg-slate-50 hover:bg-amber-50/70 rounded-lg border border-slate-100 flex flex-col gap-[2px] cursor-pointer transition"
                  >
                    <div className="flex justify-between items-center text-[10.5px] leading-none">
                      <span className="font-extrabold text-slate-800 truncate max-w-[135px]" title={c.customId ? `${c.name} (${c.customId})` : c.name}>
                        {idx + 1}. {c.name} <span className="text-[9px] font-bold text-slate-400">({c.count}건)</span>
                      </span>
                      <span className="font-black text-amber-700 tabular-nums">{c.totalAmt.toLocaleString()}원</span>
                    </div>
                    <div className="w-full bg-slate-200/80 rounded-full h-[2.5px] overflow-hidden">
                      <div className="bg-amber-600 h-full rounded-full" style={{ width: `${percent}%` }}></div>
                    </div>
                  </div>
                );
              })}
              {customerSalesRanking3Months.length === 0 && (
                <div className="text-[11px] text-slate-400 text-center py-4">데이터 없음</div>
              )}
            </div>
          </div>

        </div>

      </div>

      {/* =========================================================================
          혈액검사 시계열 추이표 모달 (기준치 수정 버튼 포함)
      ========================================================================= */}
      {isLabTableModalOpen && selectedPatient && (
        <div
          onClick={() => {
            setIsEditingTableRefs(false);
            setIsLabTableModalOpen(false);
          }}
          className="fixed inset-0 z-[110] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-white w-full max-w-5xl max-h-[88vh] rounded-3xl p-5 shadow-2xl border border-slate-200 flex flex-col space-y-3 cursor-default"
          >
            <div className="flex flex-wrap justify-between items-center border-b border-slate-100 pb-3 gap-2">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  🩸 {selectedPatient.name} 님 혈액검사 추이표
                </h3>
                <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
                  상단 날짜를 클릭하면 해당 일자의 검사 결과를 수정하거나 삭제할 수 있습니다.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {selectedPatientLabRecords.length > 0 && !isEditingTableRefs && (
                  <button
                    type="button"
                    onClick={handleStartEditTableRefs}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs transition"
                  >
                    ✎ 기준치 수정
                  </button>
                )}
                {isEditingTableRefs && (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsEditingTableRefs(false)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold text-xs transition"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveTableRefs}
                      disabled={savingLab}
                      className="px-3.5 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl font-bold text-xs transition shadow-sm"
                    >
                      {savingLab ? "저장 중..." : "기준치 저장"}
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => handleOpenLabInput(null)}
                  className="px-3.5 py-1.5 bg-[#528771] hover:bg-[#3d6856] text-white rounded-xl font-bold text-xs transition shadow-sm"
                >
                  + 새 검사결과 입력
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingTableRefs(false);
                    setIsLabTableModalOpen(false);
                  }}
                  className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-200"
                >
                  ✕
                </button>
              </div>
            </div>

            {selectedPatientLabRecords.length === 0 ? (
              <div className="py-16 text-center text-slate-400 font-bold text-xs">
                등록된 혈액검사 기록이 없습니다.
              </div>
            ) : (
              <div className="flex-1 overflow-auto border border-slate-200 rounded-2xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-100 text-slate-700 sticky top-0 z-20 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3.5 font-extrabold bg-slate-100 sticky left-0 z-30 min-w-[145px] border-r border-slate-200">
                        검사항목
                      </th>
                      <th className="py-2.5 px-3 font-bold text-slate-500 bg-slate-100 sticky left-[145px] z-30 min-w-[115px] border-r border-slate-200">
                        ref
                      </th>
                      {selectedPatientLabRecords.map(rec => (
                        <th
                          key={rec.id}
                          onClick={() => handleOpenLabInput(rec)}
                          title="클릭하여 이 날짜 결과 수정/삭제"
                          className="py-2.5 px-3.5 font-extrabold text-center min-w-[105px] border-r border-slate-200 last:border-none cursor-pointer hover:bg-teal-100/70 hover:text-teal-900 transition whitespace-nowrap group"
                        >
                          <span>{rec.exam_date}</span>
                          <span className="ml-1 text-[9px] text-slate-400 group-hover:text-teal-700">✎</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {patientLabMatrixRows.map(row => (
                      <tr key={row.name} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3.5 font-extrabold text-slate-900 bg-white sticky left-0 z-10 border-r border-slate-200 whitespace-nowrap">
                          {row.name}
                        </td>
                        <td className="py-1.5 px-2.5 font-semibold text-slate-500 bg-white sticky left-[145px] z-10 border-r border-slate-200 whitespace-nowrap">
                          {isEditingTableRefs ? (
                            <input
                              type="text"
                              value={draftTableRefs[row.name] ?? ""}
                              onChange={e =>
                                setDraftTableRefs(prev => ({
                                  ...prev,
                                  [row.name]: e.target.value,
                                }))
                              }
                              className="w-24 px-2 py-1 bg-teal-50/50 border border-teal-300 rounded-lg text-[11px] font-bold text-slate-800 focus:outline-none focus:border-[#528771]"
                            />
                          ) : (
                            row.ref || "-"
                          )}
                        </td>
                        {selectedPatientLabRecords.map(rec => {
                          const found = rec.items.find(
                            i => i.name.trim().toLowerCase() === row.name.toLowerCase()
                          );
                          const val = found?.value || "";
                          const activeRef = isEditingTableRefs
                            ? draftTableRefs[row.name] || ""
                            : found?.ref || row.ref || "";
                          const status = evaluateLabStatus(val, activeRef);

                          return (
                            <td
                              key={`${rec.id}-${row.name}`}
                              onClick={() => handleOpenLabInput(rec)}
                              title={found?.ref ? `해당 검사 참고치: ${found.ref}` : undefined}
                              className={`py-2.5 px-3.5 text-center border-r border-slate-100 last:border-none cursor-pointer tabular-nums ${
                                val ? getLabValueColorClass(status) : "text-slate-300"
                              }`}
                            >
                              {val || "-"}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex flex-wrap justify-between items-center text-[11px] text-slate-400 pt-1 gap-2">
              <div className="flex flex-wrap items-center gap-3">
                <span>
                  <strong className="text-rose-600">빨간색</strong>: 상한 초과
                </span>
                <span>
                  <strong className="text-blue-600">파란색</strong>: 하한 미만
                </span>
                <span className="text-slate-400">
                  · 기준치 표기법: <code className="text-slate-600">&lt;150</code>, <code className="text-slate-600">&gt;60</code>, <code className="text-slate-600">3-7</code>
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsEditingTableRefs(false);
                  setIsLabTableModalOpen(false);
                }}
                className="px-4 py-1.5 bg-slate-900 text-white rounded-xl font-bold text-xs hover:bg-slate-800"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          혈액검사 동적 항목 선택/직접 입력 모달 (Tab + Enter 선택 지원)
      ========================================================================= */}
      {isLabInputModalOpen && selectedPatient && (
        <div
          onClick={() => setIsLabInputModalOpen(false)}
          className="fixed inset-0 z-[130] bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-white w-full max-w-2xl max-h-[90vh] rounded-3xl p-5 shadow-2xl border border-slate-200 flex flex-col space-y-3 cursor-default"
          >
            <div className="flex justify-between items-center border-b border-slate-100 pb-2.5 shrink-0">
              <h3 className="text-sm font-extrabold text-slate-900">
                🩸 {selectedPatient.name} 님 혈액검사 {editingLabRecordId ? "결과 수정" : "결과 입력"}
              </h3>
              <button
                type="button"
                onClick={() => setIsLabInputModalOpen(false)}
                className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveLabRecord} className="flex-1 flex flex-col min-h-0 space-y-3 text-xs">
              {/* 검사일자 + 항목 검색/직접추가 바 */}
              <div className="grid grid-cols-12 gap-2.5 shrink-0">
                <div className="col-span-4">
                  <label className="block font-bold text-slate-700 mb-1">검사일자 *</label>
                  <input
                    type="date"
                    value={labExamDate}
                    onChange={e => setLabExamDate(e.target.value)}
                    required
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold focus:outline-none focus:border-[#528771]"
                  />
                </div>

                <div className="col-span-8 relative">
                  <label className="block font-bold text-slate-700 mb-1">
                    검사항목 추가 <span className="text-[10px] font-normal text-slate-400">(검색 후 Tab / ↑↓ 이동, Enter 선택)</span>
                  </label>
                  <input
                    ref={labItemSearchInputRef}
                    type="text"
                    placeholder=""
                    value={labItemSearch}
                    onChange={e => {
                      setLabItemSearch(e.target.value);
                      setLabSearchHighlightIdx(0);
                    }}
                    onKeyDown={handleLabSearchKeyDown}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold focus:outline-none focus:border-[#528771]"
                  />

                  {labItemSearch.trim() && (
                    <div className="absolute z-30 w-full max-h-44 overflow-y-auto border border-slate-200 rounded-xl bg-white shadow-xl mt-1">
                      {labSearchCandidates.map((cand, idx) => {
                        const isHighlighted = idx === labSearchHighlightIdx;
                        return (
                          <div
                            key={`${cand.name}-${idx}`}
                            onClick={() => handleAddLabItemRow(cand.name)}
                            onMouseEnter={() => setLabSearchHighlightIdx(idx)}
                            className={`px-3 py-2 cursor-pointer flex justify-between items-center border-b border-slate-100 last:border-none ${
                              isHighlighted ? "bg-teal-100/80" : "hover:bg-teal-50"
                            }`}
                          >
                            <span className="font-extrabold text-slate-900">
                              {cand.isCustom ? `+ "${cand.name}" 새 항목 직접 추가` : cand.name}
                            </span>
                            {isHighlighted && (
                              <span className="text-[9px] font-bold text-teal-800 bg-white px-1.5 py-0.5 rounded border border-teal-200">
                                Tab · Enter ↵
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-between items-center shrink-0">
                <span className="text-[10px] text-slate-400 font-semibold">
                  기준치(ref) 작성법: &lt;150, &gt;60, 3-7
                </span>
                {labDraftItems.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setLabDraftItems([])}
                    className="text-[10px] font-bold text-slate-400 hover:text-rose-600 px-1.5 py-0.5 transition"
                  >
                    전체 비우기
                  </button>
                )}
              </div>

              {/* 선택된 검사항목 입력 테이블 */}
              <div className="flex-1 overflow-y-auto border border-slate-200 rounded-2xl">
                {labDraftItems.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 font-semibold text-xs">
                    위 검색창에서 원하는 검사항목을 검색하거나 직접 입력해 추가하세요.
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-50 text-slate-500 sticky top-0 border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-3 font-bold w-[34%]">검사항목</th>
                        <th className="py-2 px-3 font-bold w-[26%]">참고치 (ref)</th>
                        <th className="py-2 px-3 font-bold w-[32%]">검사 결과</th>
                        <th className="py-2 px-2 font-bold text-center w-[8%]">삭제</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {labDraftItems.map((item, idx) => {
                        const status = evaluateLabStatus(item.value, item.ref);
                        return (
                          <tr key={`${item.name}-${idx}`} className="hover:bg-slate-50/60">
                            <td className="py-1.5 px-3 font-extrabold text-slate-900">
                              {item.name}
                            </td>
                            <td className="py-1.5 px-2">
                              <input
                                type="text"
                                placeholder=""
                                value={item.ref}
                                onChange={e => {
                                  const next = [...labDraftItems];
                                  next[idx] = { ...next[idx], ref: e.target.value };
                                  setLabDraftItems(next);
                                }}
                                className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-600 focus:outline-none focus:border-[#528771]"
                              />
                            </td>
                            <td className="py-1.5 px-2">
                              <input
                                ref={el => {
                                  labValueInputRefs.current[idx] = el;
                                }}
                                type="text"
                                placeholder=""
                                value={item.value}
                                onChange={e => {
                                  const next = [...labDraftItems];
                                  next[idx] = { ...next[idx], value: e.target.value };
                                  setLabDraftItems(next);
                                }}
                                onKeyDown={e => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    const nextInput = labValueInputRefs.current[idx + 1];
                                    if (nextInput) {
                                      nextInput.focus();
                                    } else {
                                      labItemSearchInputRef.current?.focus();
                                    }
                                  }
                                }}
                                className={`w-full px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-[#528771] ${getLabValueColorClass(status)}`}
                              />
                            </td>
                            <td className="py-1.5 px-2 text-center">
                              <button
                                type="button"
                                onClick={() =>
                                  setLabDraftItems(labDraftItems.filter((_, i) => i !== idx))
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

              <div className="flex justify-between items-center pt-2 border-t border-slate-100 shrink-0">
                <div>
                  {editingLabRecordId && (
                    <button
                      type="button"
                      onClick={() => handleDeleteLabRecord(editingLabRecordId)}
                      disabled={savingLab}
                      className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold rounded-xl transition"
                    >
                      이 날짜 기록 삭제
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsLabInputModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={savingLab}
                    className="px-5 py-2 bg-[#528771] text-white font-bold rounded-xl hover:bg-[#3d6856] transition shadow-sm disabled:opacity-50"
                  >
                    {savingLab ? "저장 중..." : "저장하기"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 신규 고객 등록 및 수정 모달 */}
      {isModalOpen && (
        <div onClick={() => setIsModalOpen(false)} className="fixed inset-0 z-[120] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer">
          <div className="bg-white w-full max-w-lg rounded-3xl p-5 shadow-2xl border border-slate-200 flex flex-col space-y-3 cursor-default" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b pb-2.5">
              <h3 className="text-sm font-extrabold text-slate-900">{editingPatientId ? "👥 고객 정보 수정" : "➕ 신규 고객 등록"}</h3>
              <button onClick={() => setIsModalOpen(false)} className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-200">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-2.5 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">이름 *</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold" required />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">전화번호</label>
                  <input type="text" placeholder="010-0000-0000" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold" />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">아이디</label>
                  <input type="text" value={customId} onChange={(e) => setCustomId(e.target.value)} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold" />
                </div>
                <div className="relative">
                  <label className="block font-bold text-teal-800 mb-1">대표 고객 연결</label>
                  <input 
                    type="text" 
                    placeholder="이름 검색..." 
                    value={repSearch} 
                    onChange={(e) => setRepSearch(e.target.value)} 
                    className="w-full p-2 bg-teal-50/50 border border-teal-100 rounded-xl font-semibold focus:outline-none focus:border-[#528771]" 
                  />
                  {representativeId && (
                    <div className="mt-1 flex items-center justify-between bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200 text-[11px]">
                      <span className="font-bold text-teal-900">선택: {patients.find(p => p.id === representativeId)?.name}</span>
                      <button type="button" onClick={() => { setRepresentativeId(""); setRepSearch(""); }} className="text-red-500 font-bold hover:underline">해제</button>
                    </div>
                  )}
                  {repSearch && !representativeId && (
                    <div className="absolute z-30 w-full max-h-36 overflow-y-auto border border-slate-200 rounded-xl bg-white shadow-xl mt-1">
                      {patients.filter(p => p.id !== editingPatientId && p.name.includes(repSearch)).map(p => (
                        <div key={p.id} onClick={() => { setRepresentativeId(p.id); setRepSearch(p.name); }} 
                          className="p-2 hover:bg-teal-50 cursor-pointer flex justify-between items-center border-b border-slate-100 last:border-none"
                        >
                          <span className="font-extrabold text-slate-900">{p.name}</span>
                          <span className="font-bold text-slate-400 text-[10px]">{p.custom_id || ""}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">성별</label>
                  <select value={gender} onChange={(e) => setGender(e.target.value)} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold"><option value="남">남</option><option value="여">여</option></select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">출생 연도</label>
                  <input type="number" value={birthYear} onChange={(e) => setBirthYear(e.target.value)} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">체질</label>
                  <select value={bodyType} onChange={(e) => setBodyType(e.target.value)} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold">{CONSTITUTION_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}</select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">주소</label>
                <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold" />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">분류 태그 (쉼표로 구분)</label>
                <input type="text" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold" />
              </div>

              <div>
                <label className="block font-bold text-teal-800 mb-1">메모</label>
                <textarea value={memo} onChange={(e) => setMemo(e.target.value)} rows={2} className="w-full p-2 bg-teal-50/50 border border-teal-100 rounded-xl text-xs font-semibold resize-none" />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-3.5 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition">취소</button>
                <button type="submit" className="px-4 py-2 bg-[#528771] text-white font-bold rounded-xl hover:bg-[#3d6856] transition shadow-sm">저장하기</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 전체 상담 기록 모달 */}
      {historyModalPatient && (
        <div onClick={() => setHistoryModalPatient(null)} className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer">
          <div className="bg-white w-full max-w-3xl max-h-[85vh] rounded-3xl p-6 shadow-2xl border border-slate-200 flex flex-col space-y-4 cursor-default" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold text-slate-900">📂 {historyModalPatient.name} 님의 전체 상담 기록</h3>
              <span className="text-[11px] font-semibold text-slate-400">기록을 클릭하면 해당 상담 내역으로 이동합니다</span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {consultations.filter(c => c.patient_id === historyModalPatient.id).length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">작성된 상담 기록이 없습니다.</div>
              ) : (
                consultations.filter(c => c.patient_id === historyModalPatient.id).map((c, idx) => (
                  <div
                    key={c.id || idx}
                    onClick={() => handleNavigateToConsultation(c)}
                    className="p-4 bg-white hover:bg-teal-50/50 border border-slate-200 hover:border-teal-400 rounded-2xl shadow-xs space-y-3 text-xs cursor-pointer transition group"
                  >
                    <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">{c.consultation_date || c.created_at.split('T')[0]}</span>
                        <span className="text-[10px] font-bold text-teal-700 opacity-0 group-hover:opacity-100 transition">상담 내역으로 이동 →</span>
                      </div>
                      {c.amount && <span className="font-extrabold text-purple-800 text-sm">{c.amount.toLocaleString()}원</span>}
                    </div>
                    <div className="flex flex-col sm:flex-row gap-4 items-start">
                      <div className="flex-1 space-y-2 min-w-0 w-full">
                        <div className="flex flex-wrap gap-x-4 text-sm font-bold text-slate-800 mb-2">
                          {c.symptoms && <div>{c.symptoms}</div>}
                          {c.prescription && <div className="text-teal-700">{c.prescription}</div>}
                        </div>
                        {c.symptom_detail && (
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-slate-700 whitespace-pre-line leading-relaxed"><strong className="text-slate-900 block mb-1">증상 상세:</strong>{c.symptom_detail}</div>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {c.consult_memo && (
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-slate-700 whitespace-pre-line leading-relaxed"><strong className="text-slate-900 block mb-1">코멘트:</strong>{c.consult_memo}</div>
                          )}
                          {c.follow_up && (
                            <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-200/60 text-purple-900 whitespace-pre-line leading-relaxed"><strong className="text-purple-800 block mb-1">추후관리:</strong>{c.follow_up}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="flex justify-end pt-2 border-t"><button onClick={() => setHistoryModalPatient(null)} className="px-5 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800">닫기</button></div>
          </div>
        </div>
      )}

      {/* 사진 모아보기 모달 (팝업창 및 사진 크기 확대) */}
      {photosModalPatient && (
        <div onClick={() => setPhotosModalPatient(null)} className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer">
          <div className="bg-white w-[94vw] max-w-6xl h-[90vh] max-h-[90vh] rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-200 flex flex-col space-y-4 cursor-default" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b pb-3.5 shrink-0">
              <h3 className="text-lg font-extrabold text-slate-900">📸 {photosModalPatient.name} 님의 사진 모아보기 ({selectedPatientAllPhotos.length}장)</h3>
              <button onClick={() => setPhotosModalPatient(null)} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-200 text-sm">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-7 content-start pr-1">
              {selectedPatientAllPhotos.length === 0 ? (
                <div className="col-span-full text-center py-12 text-slate-400 text-sm">등록된 사진이 없습니다.</div>
              ) : (
                selectedPatientAllPhotos.map((photo: any, idx: number) => (
                  <div key={idx} className="flex flex-col gap-2">
                    <div className="relative aspect-square border border-slate-200 rounded-2xl overflow-hidden bg-slate-50 cursor-pointer shadow-sm group" onClick={() => setPreviewImageUrl(photo.url)}>
                      <img src={photo.url} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                    </div>
                    <div className="text-center text-xs leading-snug flex flex-col">
                      <span className="font-extrabold text-slate-800">{photo.date}</span>
                      <span className="font-semibold text-teal-700 truncate px-1" title={photo.prescription}>{photo.prescription || "-"}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="flex justify-end pt-3 border-t shrink-0"><button onClick={() => setPhotosModalPatient(null)} className="px-6 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800">닫기</button></div>
          </div>
        </div>
      )}

      {previewImageUrl && (
        <div onClick={() => setPreviewImageUrl(null)} className="fixed inset-0 z-[150] bg-slate-950/85 flex items-center justify-center p-4 cursor-pointer">
          <img src={previewImageUrl} className="w-[92vw] h-[90vh] object-contain rounded-xl shadow-2xl" onClick={(e) => e.stopPropagation()} />
          <button onClick={() => setPreviewImageUrl(null)} className="absolute top-5 right-5 text-white bg-slate-800/90 hover:bg-slate-700 w-11 h-11 rounded-full font-bold text-base">✕</button>
        </div>
      )}

    </div>
  );
}