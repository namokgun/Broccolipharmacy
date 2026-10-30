"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/app/lib/supabase";
import Link from "next/link";

export default function StatsPage() {
  const [patients, setPatients] = useState<any[]>([]);
  const [consultations, setConsultations] = useState<any[]>([]);
  const [currentDate, setCurrentDate] = useState<Date | null>(null);

  const [periodFilter, setPeriodFilter] = useState("6months");

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

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  // 선택 필터별 월 개수 산정 (3개월, 6개월, 1년)
  const monthCount = periodFilter === "3months" ? 3 : periodFilter === "1year" ? 12 : 6;

  // 월별 범주 목록 생성 (YYYY-MM)
  const monthlyBuckets: { yearMonth: string, label: string }[] = [];
  for (let i = monthCount - 1; i >= 0; i--) {
    const d = new Date(currentYear, currentMonth - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthlyBuckets.push({ yearMonth: ym, label });
  }

  // 이번 달 / 지난달 집계
  const thisYm = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
  const lastMonthDate = new Date(currentYear, currentMonth - 1, 1);
  const lastYm = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;

  const currentConsultations = consultations.filter(c => c.consult_date_str?.startsWith(thisYm));
  const prevConsultations = consultations.filter(c => c.consult_date_str?.startsWith(lastYm));

  const currentPatients = patients.filter(p => p.created_at?.startsWith(thisYm));
  const prevPatients = patients.filter(p => p.created_at?.startsWith(lastYm));

  const currentSales = currentConsultations.reduce((sum, c) => sum + (c.amount || 0), 0);
  const prevSales = prevConsultations.reduce((sum, c) => sum + (c.amount || 0), 0);

  const daysPassed = Math.max(1, currentDate.getDate());
  const dailyAverageSales = Math.round(currentSales / daysPassed);
  const lastMonthTotalDays = new Date(lastMonthDate.getFullYear(), lastMonthDate.getMonth() + 1, 0).getDate();
  const prevDailyAverageSales = Math.round(prevSales / lastMonthTotalDays);

  // 전월 대비 증감률 계산 공식: [(이번 달 값 - 지난 달 값) ÷ 지난 달 값] × 100
  const calcRateValue = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  const calcRateText = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? "+100%" : "0%";
    const rate = Math.round(((current - previous) / previous) * 100);
    return rate > 0 ? `+${rate}%` : `${rate}%`;
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

  // 체질별 환자군 집계
  const constitutionCounts: Record<string, number> = {};
  patients.forEach(p => {
    let cType = p.constitution || p.sasang || p.body_type || p.type || p['체질'] || "";
    cType = cType.trim() !== "" ? cType : "미입력";
    constitutionCounts[cType] = (constitutionCounts[cType] || 0) + 1;
  });
  const totalPatientsCount = Math.max(1, patients.length);
  const constitutionArray = Object.entries(constitutionCounts).sort((a, b) => b[1] - a[1]);
  const donutColors = ["#14b8a6", "#f59e0b", "#3b82f6", "#8b5cf6", "#94a3b8", "#f43f5e", "#10b981"]; 

  // 월별 차트 데이터 생성 (상담 수 기준)
  const monthlyChartData = monthlyBuckets.map((bucket, idx) => {
    const monthConsults = consultations.filter(c => c.consult_date_str?.startsWith(bucket.yearMonth));
    const sales = monthConsults.reduce((sum, c) => sum + (c.amount || 0), 0);
    const consultCount = monthConsults.length; // 🟢 상담 수 집계

    const prevBucketYm = monthlyBuckets[idx - 1]?.yearMonth;
    let prevSalesVal = 0;
    let prevConsultVal = 0;

    if (prevBucketYm) {
      const prevConsults = consultations.filter(c => c.consult_date_str?.startsWith(prevBucketYm));
      prevSalesVal = prevConsults.reduce((sum, c) => sum + (c.amount || 0), 0);
      prevConsultVal = prevConsults.length;
    }

    const sRate = calcRateValue(sales, prevSalesVal);
    const consultRateVal = calcRateValue(consultCount, prevConsultVal); // 🟢 상담 수 증감률

    return { 
      yearMonth: bucket.yearMonth, 
      label: bucket.label, 
      sales, 
      consultCount, 
      sRate, 
      consultRateVal 
    };
  });

  // 점과 선으로 이어진 SVG 차트 렌더링
  const renderSVGChart = (type: "consult" | "sales") => {
    const maxVal = Math.max(...monthlyChartData.map(d => type === "consult" ? d.consultCount : d.sales), 1);
    
    const barColor = type === "consult" ? "#94a3b8" : "#e5e5e5"; 
    const lineColor = type === "consult" ? "#334155" : "#78350f"; 

    // 점들의 X, Y 좌표 계산
    const points = monthlyChartData.map((d, i) => {
      const x = (i / Math.max(1, monthlyChartData.length - 1)) * 100;
      const rawRate = type === "consult" ? d.consultRateVal : d.sRate;
      const clampedRate = Math.max(-100, Math.min(100, rawRate));
      const y = 50 - (clampedRate / 2); // 0%가 중앙 50% 높이에 오도록 계산
      return { x, y, rawRate };
    });

    // 점 사이를 잇는 SVG Path 경로 문자열 생성
    const linePathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x}% ${p.y}%`).join(" ");

    return (
      <div className="relative w-full h-[240px] mt-4 select-none">
        
        {/* Y축 범례 */}
        <div className="absolute left-0 top-4 bottom-8 flex flex-col justify-between text-[10px] text-slate-400 w-10 text-right pr-1 z-0">
          <span>{type === "consult" ? maxVal : `${Math.round(maxVal / 10000)}만`}</span>
          <span>{type === "consult" ? Math.round(maxVal/2) : `${Math.round(maxVal / 20000)}만`}</span>
          <span>0</span>
        </div>
        <div className="absolute right-0 top-4 bottom-8 flex flex-col justify-between text-[10px] text-slate-400 w-8 pl-1 z-0">
          <span>+100%</span>
          <span>0%</span>
          <span>-100%</span>
        </div>

        {/* 차트 영역 */}
        <div className="absolute left-12 right-10 top-4 bottom-8 border-b border-slate-200">
          <svg className="w-full h-full overflow-visible" preserveAspectRatio="none">
            
            {/* 가이드 라인 (+100%, 0%) */}
            <line x1="0" y1="0%" x2="100%" y2="0%" stroke="#f1f5f9" strokeWidth="1" />
            <line x1="0" y1="50%" x2="100%" y2="50%" stroke="#e2e8f0" strokeDasharray="4" strokeWidth="1.5" />

            {/* 데이터 막대(Bar) */}
            {monthlyChartData.map((d, i) => {
              const x = points[i].x;
              const val = type === "consult" ? d.consultCount : d.sales;
              const heightPct = (val / maxVal) * 100; 
              const barWidth = 8;

              return (
                <g key={`bar-${i}`} className="group cursor-pointer">
                  {val > 0 && (
                    <rect 
                      x={`${x - (barWidth / 2)}%`} 
                      y={`${100 - heightPct}%`} 
                      width={`${barWidth}%`} 
                      height={`${heightPct}%`} 
                      fill={barColor} 
                      rx="3"
                      className="transition-all duration-300 group-hover:opacity-80"
                    />
                  )}
                </g>
              );
            })}

            {/* 점과 점 사이를 잇는 연결선 (Line) */}
            <path 
              d={linePathD} 
              fill="none" 
              stroke={lineColor} 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              className="transition-all duration-300"
            />

            {/* 증감률 점(Dots) & 툴팁 */}
            {monthlyChartData.map((d, i) => {
              const { x, y, rawRate } = points[i];
              const val = type === "consult" ? d.consultCount : d.sales;
              const barWidth = 8;

              return (
                <g key={`point-${i}`} className="group cursor-pointer">
                  <rect x={`${x - barWidth}%`} y="0" width={`${barWidth * 2}%`} height="100%" fill="transparent" />
                  
                  {/* 동그라미 점 */}
                  <circle 
                    cx={`${x}%`} 
                    cy={`${y}%`} 
                    r="4" 
                    fill="#ffffff" 
                    stroke={lineColor} 
                    strokeWidth="2.5" 
                    className="group-hover:r-[6] transition-all"
                  />
                  
                  {/* 호버 툴팁 */}
                  <g className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <rect x={`${x - 14}%`} y="-26" width="105" height="24" rx="4" fill="#1e293b" />
                    <text x={`${x}%`} y="-10" fill="white" fontSize="9" fontWeight="bold" textAnchor="middle">
                      {val.toLocaleString()}{type === "consult" ? "건" : "원"} ({rawRate > 0 ? `+${rawRate.toFixed(0)}%` : `${rawRate.toFixed(0)}%`})
                    </text>
                  </g>
                </g>
              );
            })}
          </svg>
        </div>

        {/* X축 월별 라벨 */}
        <div className="absolute left-12 right-10 bottom-0 h-6 flex justify-between items-end text-[10px] font-semibold text-slate-400">
          {monthlyChartData.map((d, idx) => (
            <span key={idx}>{d.label}</span>
          ))}
        </div>
      </div>
    );
  };

  const getFilterClass = (filterStr: string) => {
    return periodFilter === filterStr 
      ? "bg-slate-700 text-white shadow-md font-bold px-3 py-1.5 rounded-lg text-xs" 
      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 font-semibold px-3 py-1.5 rounded-lg text-xs transition-all";
  };

  return (
    <div className="w-full space-y-6 pb-12 max-w-[1400px] mx-auto bg-slate-50/50 min-h-screen">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white px-6 py-5 rounded-2xl shadow-sm border border-slate-200 gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">📊 통계 및 성과 분석 (월별)</h1>
          <p className="text-xs font-semibold text-slate-500 mt-1">상담 데이터를 기반으로 약국의 성과 및 전월 대비 증감률을 분석합니다.</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <button onClick={() => setPeriodFilter("3months")} className={getFilterClass("3months")}>최근 3개월</button>
          <button onClick={() => setPeriodFilter("6months")} className={getFilterClass("6months")}>최근 6개월</button>
          <button onClick={() => setPeriodFilter("1year")} className={getFilterClass("1year")}>최근 1년</button>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-500 mb-2">총 고객 수</span>
          <div className="text-2xl font-extrabold text-slate-900 mb-2">{patients.length} <span className="text-sm font-bold text-slate-500">명</span></div>
          <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1">전월 대비 <span className={`px-1.5 py-0.5 rounded ${getRateColor(patients.length, patients.length - currentPatients.length)}`}>{patientRate}</span></div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-500 mb-2">이번 달 총 매출</span>
          <div className="text-2xl font-extrabold text-slate-900 mb-2 truncate" title={`${currentSales.toLocaleString()}원`}>{currentSales.toLocaleString()} <span className="text-sm font-bold text-slate-500">원</span></div>
          <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1">전월 대비 <span className={`px-1.5 py-0.5 rounded ${getRateColor(currentSales, prevSales)}`}>{salesRate}</span></div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-500 mb-2">이번 달 일평균 매출</span>
          <div className="text-2xl font-extrabold text-slate-900 mb-2 truncate" title={`${dailyAverageSales.toLocaleString()}원`}>{dailyAverageSales.toLocaleString()} <span className="text-sm font-bold text-slate-500">원</span></div>
          <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1">전월 대비 <span className={`px-1.5 py-0.5 rounded ${getRateColor(dailyAverageSales, prevDailyAverageSales)}`}>{dailyAvgRate}</span></div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-500 mb-2">이번 달 신규 환자</span>
          <div className="text-2xl font-extrabold text-slate-900 mb-2">{currentPatients.length} <span className="text-sm font-bold text-slate-500">명</span></div>
          <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1">전월 대비 <span className={`px-1.5 py-0.5 rounded ${getRateColor(currentPatients.length, prevPatients.length)}`}>{newPatientRate}</span></div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between col-span-2 md:col-span-1">
          <span className="text-xs font-bold text-slate-500 mb-2">이번 달 상담 건수</span>
          <div className="text-2xl font-extrabold text-slate-900 mb-2">{currentConsultations.length} <span className="text-sm font-bold text-slate-500">건</span></div>
          <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1">전월 대비 <span className={`px-1.5 py-0.5 rounded ${getRateColor(currentConsultations.length, prevConsultations.length)}`}>{consultRate}</span></div>
        </div>
      </div>

      {/* 추이 차트 영역 (상담 수 추이 & 매출 추이) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col h-[340px]">
          <div className="flex justify-between items-center border-b border-slate-50 pb-3">
            <h3 className="text-[15px] font-extrabold text-slate-800 flex items-center gap-2">
              <span className="text-slate-400">📝</span> 월별 상담 수 추이
            </h3>
            <div className="flex items-center gap-3 text-[11px] font-bold text-slate-400">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-[#94a3b8] rounded-sm"></span> 상담 건수(건)</span>
              <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-[#334155]"></span> 전월 대비 증감률(%)</span>
            </div>
          </div>
          {renderSVGChart("consult")}
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col h-[340px]">
          <div className="flex justify-between items-center border-b border-slate-50 pb-3">
            <h3 className="text-[15px] font-extrabold text-slate-800 flex items-center gap-2">
              <span className="text-slate-400">💰</span> 월별 매출 추이
            </h3>
            <div className="flex items-center gap-3 text-[11px] font-bold text-slate-400">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-[#e5e5e5] rounded-sm"></span> 매출(원)</span>
              <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-[#78350f]"></span> 전월 대비 증감률(%)</span>
            </div>
          </div>
          {renderSVGChart("sales")}
        </div>
      </div>

      {/* 하단 비율 및 표 영역 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* 체질 분포 도넛 차트 */}
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

        {/* 월별 매출 현황 테이블 */}
        <div className="lg:col-span-7 bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between h-[340px]">
          <div className="flex justify-between items-center border-b border-slate-50 pb-3 mb-2">
            <h3 className="text-[15px] font-extrabold text-slate-800 flex items-center gap-2">
              <span className="text-slate-400">📄</span> 월별 최근 매출 현황
            </h3>
            <Link href="/consultations#history" className="text-[11px] font-bold text-slate-400 hover:text-slate-800 transition">
              더보기 →
            </Link>
          </div>
          
          <div className="overflow-x-auto flex-1 flex items-start mt-2">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4 font-bold rounded-tl-lg">년월</th>
                  <th className="py-3 px-4 font-bold">월 매출액</th>
                  <th className="py-3 px-4 font-bold">상담 건수</th>
                  <th className="py-3 px-4 font-bold text-right rounded-tr-lg">전월 대비 증감률</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {[...monthlyChartData].reverse().map((data, idx) => {
                  return (
                    <tr key={idx} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 text-slate-500 font-bold">{data.label}</td>
                      <td className="py-3 px-4 text-slate-900 font-extrabold">{data.sales.toLocaleString()} 원</td>
                      <td className="py-3 px-4 text-slate-500 font-bold">{data.consultCount} 건</td>
                      <td className="py-3 px-4 text-slate-900 font-extrabold text-right">
                        <span className={`px-1.5 py-0.5 rounded text-[11px] ${data.sRate > 0 ? "text-emerald-600 bg-emerald-50" : "text-slate-500 bg-slate-100"}`}>
                          {data.sRate > 0 ? `+${data.sRate.toFixed(1)}%` : `${data.sRate.toFixed(1)}%`}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div>
  );
}