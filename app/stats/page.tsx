"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/app/lib/supabase";
import Link from "next/link";

export default function StatsPage() {
  const [patients, setPatients] = useState<any[]>([]);
  const [consultations, setConsultations] = useState<any[]>([]);
  const [currentDate, setCurrentDate] = useState<Date | null>(null);

  const [periodFilter, setPeriodFilter] = useState("month");

  useEffect(() => {
    setCurrentDate(new Date());
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: pData } = await supabase.from("patients").select("*").order("created_at");
    if (pData) setPatients(pData);

    const { data: cData, error } = await supabase
      .from("consultations")
      .select("*, patients(name, phone, custom_id, gender, birth_year)")
      .order("created_at", { ascending: false });

    if (error) console.error("데이터 로딩 에러:", error.message);

    if (cData) {
      const processed = cData.map((c: any) => {
        const consultDateStr = c.consultation_date || c.created_at?.split('T')[0];
        return { ...c, consult_date_str: consultDateStr };
      });
      setConsultations(processed);
    }
  };

  if (!currentDate) return <div className="p-8 text-center text-slate-400 text-xs">통계 로딩 중...</div>;

  let startDate = new Date();
  let endDate = new Date();
  let prevStartDate = new Date();
  let prevEndDate = new Date();

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  const todayDate = currentDate.getDate();

  if (periodFilter === "month") {
    startDate = new Date(currentYear, currentMonth, 1);
    endDate = new Date(currentYear, currentMonth + 1, 0); 
    prevStartDate = new Date(currentYear, currentMonth - 1, 1);
    prevEndDate = new Date(currentYear, currentMonth, 0);
  } else if (periodFilter === "lastMonth") {
    startDate = new Date(currentYear, currentMonth - 1, 1);
    endDate = new Date(currentYear, currentMonth, 0);
    prevStartDate = new Date(currentYear, currentMonth - 2, 1);
    prevEndDate = new Date(currentYear, currentMonth - 1, 0);
  } else if (periodFilter === "3months") {
    startDate = new Date(currentYear, currentMonth - 3, todayDate);
    endDate = currentDate;
    prevStartDate = new Date(currentYear, currentMonth - 6, todayDate);
    prevEndDate = new Date(currentYear, currentMonth - 3, todayDate - 1);
  } else if (periodFilter === "6months") {
    startDate = new Date(currentYear, currentMonth - 6, todayDate);
    endDate = currentDate;
    prevStartDate = new Date(currentYear, currentMonth - 12, todayDate);
    prevEndDate = new Date(currentYear, currentMonth - 6, todayDate - 1);
  } else if (periodFilter === "1year") {
    startDate = new Date(currentYear - 1, currentMonth, todayDate);
    endDate = currentDate;
    prevStartDate = new Date(currentYear - 2, currentMonth, todayDate);
    prevEndDate = new Date(currentYear - 1, currentMonth, todayDate - 1);
  }

  const formatYMD = (d: Date) => {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const startStr = formatYMD(startDate);
  const endStr = formatYMD(endDate);
  const prevStartStr = formatYMD(prevStartDate);
  const prevEndStr = formatYMD(prevEndDate);

  const currentConsultations = consultations.filter(c => c.consult_date_str >= startStr && c.consult_date_str <= endStr);
  const currentPatients = patients.filter(p => {
    const d = p.created_at?.split('T')[0];
    return d >= startStr && d <= endStr;
  });
  const currentSales = currentConsultations.reduce((sum, c) => sum + (c.amount || 0), 0);
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  const dailyAverageSales = Math.round(currentSales / diffDays);

  const prevConsultations = consultations.filter(c => c.consult_date_str >= prevStartStr && c.consult_date_str <= prevEndStr);
  const prevPatients = patients.filter(p => {
    const d = p.created_at?.split('T')[0];
    return d >= prevStartStr && d <= prevEndStr;
  });
  const prevSales = prevConsultations.reduce((sum, c) => sum + (c.amount || 0), 0);
  const prevDiffTime = Math.abs(prevEndDate.getTime() - prevStartDate.getTime());
  const prevDiffDays = Math.max(1, Math.ceil(prevDiffTime / (1000 * 60 * 60 * 24)));
  const prevDailyAverageSales = Math.round(prevSales / prevDiffDays);

  const calcRateText = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? "+100%" : "0%";
    const rate = Math.round(((current - previous) / previous) * 100);
    return rate > 0 ? `+${rate}%` : `${rate}%`;
  };
  const calcRateValue = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };
  const getRateColor = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? "text-emerald-500 bg-emerald-50" : "text-slate-500 bg-slate-100";
    return current >= previous ? "text-emerald-500 bg-emerald-50" : "text-red-500 bg-red-50";
  };

  const salesRate = calcRateText(currentSales, prevSales);
  const consultRate = calcRateText(currentConsultations.length, prevConsultations.length);
  const patientRate = calcRateText(patients.length, patients.length - currentPatients.length);
  const newPatientRate = calcRateText(currentPatients.length, prevPatients.length);
  const dailyAvgRate = calcRateText(dailyAverageSales, prevDailyAverageSales);

  const constitutionCounts: Record<string, number> = {};
  patients.forEach(p => {
    let cType = p.constitution || p.sasang || p.body_type || p.type || p['체질'] || "";
    cType = cType.trim() !== "" ? cType : "미입력";
    constitutionCounts[cType] = (constitutionCounts[cType] || 0) + 1;
  });
  const totalPatientsCount = Math.max(1, patients.length);
  const constitutionArray = Object.entries(constitutionCounts).sort((a, b) => b[1] - a[1]);
  const donutColors = ["#14b8a6", "#f59e0b", "#3b82f6", "#8b5cf6", "#94a3b8", "#f43f5e", "#10b981"]; 

  const chartDates: string[] = [];
  let tempDate = new Date(startDate);
  while (tempDate <= endDate) {
    chartDates.push(formatYMD(tempDate));
    tempDate.setDate(tempDate.getDate() + 1);
  }

  const dailySalesMap: Record<string, { sales: number, activeCustomers: number }> = {};
  chartDates.forEach(d => { dailySalesMap[d] = { sales: 0, activeCustomers: 0 }; });

  currentConsultations.forEach(c => {
    const d = c.consult_date_str;
    if (dailySalesMap[d]) {
      dailySalesMap[d].sales += (c.amount || 0);
      dailySalesMap[d].activeCustomers += 1;
    }
  });

  const prevDailySalesMap: Record<number, { sales: number, activeCustomers: number }> = {};
  prevConsultations.forEach(c => {
    const dayIndex = new Date(c.consult_date_str).getDate(); 
    if (!prevDailySalesMap[dayIndex]) prevDailySalesMap[dayIndex] = { sales: 0, activeCustomers: 0 };
    prevDailySalesMap[dayIndex].sales += (c.amount || 0);
    prevDailySalesMap[dayIndex].activeCustomers += 1;
  });

  const dailyChartData = chartDates.map(dateStr => {
    const dayIndex = new Date(dateStr).getDate();
    const sales = dailySalesMap[dateStr].sales;
    const activeCustomers = dailySalesMap[dateStr].activeCustomers;

    const prevSalesDay = prevDailySalesMap[dayIndex]?.sales || 0;
    const prevCustDay = prevDailySalesMap[dayIndex]?.activeCustomers || 0;

    let sRate = calcRateValue(sales, prevSalesDay);
    let cRate = calcRateValue(activeCustomers, prevCustDay);

    // 🟢 0% ~ 100% 범위로 리미트 수정
    sRate = Math.max(0, Math.min(100, sRate));
    cRate = Math.max(0, Math.min(100, cRate));

    return { dateStr, dayLabel: dateStr.slice(5).replace('-', '.'), sales, activeCustomers, sRate, cRate };
  });

  const renderSVGChart = (type: "customer" | "sales") => {
    const maxVal = Math.max(...dailyChartData.map(d => type === "customer" ? d.activeCustomers : d.sales), 1);
    
    const barColor = type === "customer" ? "#94a3b8" : "#e5e5e5"; 
    const lineColor = type === "customer" ? "#334155" : "#78350f"; 

    return (
      <div className="relative w-full h-[240px] mt-4 select-none">
        
        {/* Y축 범례 (좌측: 숫자, 우측: 퍼센트) */}
        <div className="absolute left-0 top-4 bottom-8 flex flex-col justify-between text-[10px] text-slate-400 w-8 text-right pr-1 z-0">
          <span>{type === "customer" ? maxVal : `${Math.round(maxVal / 10000)}만`}</span>
          <span>{type === "customer" ? Math.round(maxVal/2) : `${Math.round(maxVal / 20000)}만`}</span>
          <span>0</span>
        </div>
        {/* 🟢 우측 범례 100% ~ 0% 로 수정 */}
        <div className="absolute right-0 top-4 bottom-8 flex flex-col justify-between text-[10px] text-slate-400 w-8 pl-1 z-0">
          <span>100%</span>
          <span>50%</span>
          <span>0%</span>
        </div>

        {/* 차트 영역 */}
        <div className="absolute left-10 right-10 top-4 bottom-8 border-b border-slate-200">
          <svg className="w-full h-full overflow-visible" preserveAspectRatio="none">
            
            {/* 가이드 라인 (0%, 50%) */}
            <line x1="0" y1="0%" x2="100%" y2="0%" stroke="#f1f5f9" strokeWidth="1" />
            <line x1="0" y1="50%" x2="100%" y2="50%" stroke="#e2e8f0" strokeDasharray="4" strokeWidth="1.5" />

            {/* 데이터 막대(Bar) & 점(Dots) */}
            {dailyChartData.map((d, i) => {
              const x = (i / Math.max(1, dailyChartData.length - 1)) * 100;
              const val = type === "customer" ? d.activeCustomers : d.sales;
              const heightPct = (val / maxVal) * 100; 
              
              const rate = type === "customer" ? d.cRate : d.sRate;
              // 🟢 0%~100% 스케일로 매핑 (0%면 y는 100(최하단))
              const y = 100 - rate; 

              const barWidth = dailyChartData.length > 31 ? 1 : (dailyChartData.length > 15 ? 2 : 4);

              return (
                <g key={`group-${i}`} className="group cursor-pointer">
                  {/* 숨겨진 호버 박스 (툴팁 인식용) */}
                  <rect x={`${x - barWidth}%`} y="0" width={`${barWidth * 2}%`} height="100%" fill="transparent" />
                  
                  {/* 데이터 막대 */}
                  {val > 0 && (
                    <rect 
                      x={`${x - (barWidth/2)}%`} 
                      y={`${100 - heightPct}%`} 
                      width={`${barWidth}%`} 
                      height={`${heightPct}%`} 
                      fill={barColor} 
                      className="transition-all duration-300"
                    />
                  )}

                  {/* 증감률 나타내는 동그라미 점 (Line-dot) */}
                  <circle 
                    cx={`${x}%`} 
                    cy={`${y}%`} 
                    r="3.5" 
                    fill="#ffffff" 
                    stroke={lineColor} 
                    strokeWidth="2" 
                    className="group-hover:r-[5] transition-all"
                  />
                  
                  {/* 호버 툴팁 */}
                  <g className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <rect x={`${x - 10}%`} y="-20" width="80" height="22" rx="4" fill="#1e293b" />
                    <text x={`${x}%`} y="-6" fill="white" fontSize="10" fontWeight="bold" textAnchor="middle">
                      {val.toLocaleString()}{type === "customer" ? "명" : "원"}
                    </text>
                  </g>
                </g>
              );
            })}
          </svg>
        </div>

        {/* X축 날짜 렌더링 (시작, 중간, 끝) */}
        <div className="absolute left-10 right-10 bottom-0 h-6 flex justify-between items-end text-[10px] font-semibold text-slate-400">
          <span>{dailyChartData[0]?.dayLabel}</span>
          {dailyChartData.length > 2 && (
             <span>{dailyChartData[Math.floor(dailyChartData.length / 2)]?.dayLabel}</span>
          )}
          <span>{dailyChartData[dailyChartData.length - 1]?.dayLabel}</span>
        </div>
      </div>
    );
  };

  const getFilterClass = (filterStr: string) => {
    return periodFilter === filterStr 
      ? "bg-slate-700 text-white shadow-md font-bold px-3 py-1.5 rounded-lg" 
      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 font-semibold px-3 py-1.5 rounded-lg transition-all";
  };

  return (
    <div className="w-full space-y-6 pb-12 max-w-[1400px] mx-auto bg-slate-50/50 min-h-screen">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white px-6 py-5 rounded-2xl shadow-sm border border-slate-200 gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">📊 통계 및 성과 분석</h1>
          <p className="text-xs font-semibold text-slate-500 mt-1">상담 데이터를 기반으로 약국의 건강관리 성과를 분석합니다.</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <button onClick={() => setPeriodFilter("month")} className={getFilterClass("month")}>이번 달</button>
          <button onClick={() => setPeriodFilter("lastMonth")} className={getFilterClass("lastMonth")}>지난달</button>
          <button onClick={() => setPeriodFilter("3months")} className={getFilterClass("3months")}>3개월</button>
          <button onClick={() => setPeriodFilter("6months")} className={getFilterClass("6months")}>6개월</button>
          <button onClick={() => setPeriodFilter("1year")} className={getFilterClass("1year")}>1년</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-500 mb-2">총 고객 수</span>
          <div className="text-2xl font-extrabold text-slate-900 mb-2">{patients.length} <span className="text-sm font-bold text-slate-500">명</span></div>
          <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1">전기 대비 <span className={`px-1.5 py-0.5 rounded ${getRateColor(patients.length, patients.length - currentPatients.length)}`}>{patientRate}</span></div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-500 mb-2">해당 기간 총 매출</span>
          <div className="text-2xl font-extrabold text-slate-900 mb-2 truncate" title={`${currentSales.toLocaleString()}원`}>{currentSales.toLocaleString()} <span className="text-sm font-bold text-slate-500">원</span></div>
          <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1">전기 대비 <span className={`px-1.5 py-0.5 rounded ${getRateColor(currentSales, prevSales)}`}>{salesRate}</span></div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-500 mb-2">평균 일매출</span>
          <div className="text-2xl font-extrabold text-slate-900 mb-2 truncate" title={`${dailyAverageSales.toLocaleString()}원`}>{dailyAverageSales.toLocaleString()} <span className="text-sm font-bold text-slate-500">원</span></div>
          <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1">전기 대비 <span className={`px-1.5 py-0.5 rounded ${getRateColor(dailyAverageSales, prevDailyAverageSales)}`}>{dailyAvgRate}</span></div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-500 mb-2">신규 등록 환자</span>
          <div className="text-2xl font-extrabold text-slate-900 mb-2">{currentPatients.length} <span className="text-sm font-bold text-slate-500">명</span></div>
          <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1">전기 대비 <span className={`px-1.5 py-0.5 rounded ${getRateColor(currentPatients.length, prevPatients.length)}`}>{newPatientRate}</span></div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between col-span-2 md:col-span-1">
          <span className="text-xs font-bold text-slate-500 mb-2">총 상담 건수</span>
          <div className="text-2xl font-extrabold text-slate-900 mb-2">{currentConsultations.length} <span className="text-sm font-bold text-slate-500">건</span></div>
          <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1">전기 대비 <span className={`px-1.5 py-0.5 rounded ${getRateColor(currentConsultations.length, prevConsultations.length)}`}>{consultRate}</span></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col h-[340px]">
          <div className="flex justify-between items-center border-b border-slate-50 pb-3">
            <h3 className="text-[15px] font-extrabold text-slate-800 flex items-center gap-2">
              <span className="text-slate-400">👥</span> 고객 수 추이
            </h3>
            <div className="flex items-center gap-3 text-[11px] font-bold text-slate-400">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-[#94a3b8] rounded-sm"></span> 고객 수(명)</span>
              <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-[#334155]"></span> 전월 대비 증감률(%)</span>
            </div>
          </div>
          {renderSVGChart("customer")}
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col h-[340px]">
          <div className="flex justify-between items-center border-b border-slate-50 pb-3">
            <h3 className="text-[15px] font-extrabold text-slate-800 flex items-center gap-2">
              <span className="text-slate-400">💰</span> 매출 추이
            </h3>
            <div className="flex items-center gap-3 text-[11px] font-bold text-slate-400">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-[#e5e5e5] rounded-sm"></span> 매출(원)</span>
              <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-[#78350f]"></span> 전월 대비 증감률(%)</span>
            </div>
          </div>
          {renderSVGChart("sales")}
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        <div className="lg:col-span-5 bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between h-[340px]">
          <div className="flex justify-between items-center border-b border-slate-50 pb-3 mb-6">
            <h3 className="text-[15px] font-extrabold text-slate-800 flex items-center gap-2">
              <span className="text-slate-400">🧬</span> 체질별 환자군 비율
            </h3>
          </div>
          
          <div className="flex-1 flex flex-row items-center px-4">
            <div className="relative w-32 h-32 flex-shrink-0">
              <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                <path className="text-slate-50" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4.5" />
                {(() => {
                  let offset = 0;
                  return constitutionArray.map(([name, count], idx) => {
                    const percent = (count / totalPatientsCount) * 100;
                    if(percent === 0) return null;
                    const strokeDasharray = `${percent} ${100 - percent}`;
                    const strokeDashoffset = -offset;
                    offset += percent;
                    return (
                      <path 
                        key={name}
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
                        fill="none" 
                        stroke={donutColors[idx % donutColors.length]} 
                        strokeWidth="4.5" 
                        strokeDasharray={strokeDasharray}
                        strokeDashoffset={strokeDashoffset}
                        className="transition-all duration-700"
                      />
                    );
                  });
                })()}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-[9px] text-slate-400 font-bold mb-0.5">총 고객수</span>
                <span className="text-lg font-extrabold text-slate-800">{patients.length}<span className="text-xs font-bold text-slate-500">명</span></span>
              </div>
            </div>

            <div className="flex flex-col gap-3 ml-8 flex-1 max-h-[200px] overflow-y-auto pr-1">
              {constitutionArray.map(([name, count], idx) => {
                const percent = Math.round((count / totalPatientsCount) * 100);
                const color = donutColors[idx % donutColors.length];
                return (
                  <div key={name} className="flex items-center justify-between text-xs w-full">
                    <div className="flex items-center gap-2 truncate">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }}></span>
                      <span className="font-bold text-slate-700 truncate">{name}</span>
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <span className="font-extrabold text-slate-900 w-8 text-right">{percent}%</span>
                      <span className="font-bold text-slate-400 w-8 text-right">{count}명</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between h-[340px]">
          <div className="flex justify-between items-center border-b border-slate-50 pb-3 mb-2">
            <h3 className="text-[15px] font-extrabold text-slate-800 flex items-center gap-2">
              <span className="text-slate-400">📄</span> 최근 매출 현황
            </h3>
            <Link href="/consultations#history" className="text-[11px] font-bold text-slate-400 hover:text-slate-800 transition">
              더보기 →
            </Link>
          </div>
          
          <div className="overflow-x-auto flex-1 flex items-start mt-2">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4 font-bold rounded-tl-lg">날짜</th>
                  <th className="py-3 px-4 font-bold">매출액</th>
                  <th className="py-3 px-4 font-bold">방문 고객수</th>
                  <th className="py-3 px-4 font-bold text-right rounded-tr-lg">평균 객단가</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {currentConsultations.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-12 text-slate-400 font-bold">매출 데이터가 없습니다.</td>
                  </tr>
                ) : (
                  [...dailyChartData].reverse().filter(d => d.sales > 0 || d.activeCustomers > 0).slice(0, 5).map((data, idx) => {
                    const avgTicket = data.activeCustomers > 0 ? Math.round(data.sales / data.activeCustomers) : 0;
                    return (
                      <tr key={idx} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-4 text-slate-500 font-bold">{data.dateStr}</td>
                        <td className="py-3 px-4 text-slate-900 font-extrabold">{data.sales.toLocaleString()} 원</td>
                        <td className="py-3 px-4 text-slate-500 font-bold">{data.activeCustomers} 명</td>
                        <td className="py-3 px-4 text-slate-900 font-extrabold text-right">{avgTicket.toLocaleString()} 원</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div>
  );
}