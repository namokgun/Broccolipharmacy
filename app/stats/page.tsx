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

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  // 이번 달 데이터
  const thisMonthConsultations = consultations.filter(c => {
    if (!c.consult_date_str) return false;
    const [y, m] = c.consult_date_str.split('-').map(Number);
    return y === currentYear && m === (currentMonth + 1);
  });

  const thisMonthPatients = patients.filter(p => {
    const dateStr = p.created_at?.split('T')[0];
    if (!dateStr) return false;
    const [y, m] = dateStr.split('-').map(Number);
    return y === currentYear && m === (currentMonth + 1);
  });

  const thisMonthSales = thisMonthConsultations.reduce((sum, c) => sum + (c.amount || 0), 0);
  const currentDay = currentDate.getDate();
  const divisorDays = Math.max(1, currentDay);
  const dailyAverageSales = Math.round(thisMonthSales / divisorDays);

  // 지난 달 데이터
  const lastMonthDate = new Date(currentYear, currentMonth - 1, 1);
  const lastMonthYear = lastMonthDate.getFullYear();
  const lastMonthNum = lastMonthDate.getMonth() + 1;

  const lastMonthConsultations = consultations.filter(c => {
    if (!c.consult_date_str) return false;
    const [y, m] = c.consult_date_str.split('-').map(Number);
    return y === lastMonthYear && m === lastMonthNum;
  });

  const lastMonthPatients = patients.filter(p => {
    const dateStr = p.created_at?.split('T')[0];
    if (!dateStr) return false;
    const [y, m] = dateStr.split('-').map(Number);
    return y === lastMonthYear && m === lastMonthNum;
  });

  const lastMonthSales = lastMonthConsultations.reduce((sum, c) => sum + (c.amount || 0), 0);
  const lastMonthDays = new Date(lastMonthYear, lastMonthNum, 0).getDate();
  const lastMonthDailyAvg = Math.round(lastMonthSales / lastMonthDays);

  const calcRate = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? "+100%" : "0%";
    const rate = Math.round(((current - previous) / previous) * 100);
    return rate >= 0 ? `↑ ${rate}%` : `↓ ${Math.abs(rate)}%`;
  };
  const getRateColor = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? "text-emerald-500" : "text-slate-400";
    return current >= previous ? "text-emerald-500" : "text-red-500";
  };

  // 🟢 누락되었던 5개의 증감률 계산 변수 복구 완료
  const salesRate = calcRate(thisMonthSales, lastMonthSales);
  const consultRate = calcRate(thisMonthConsultations.length, lastMonthConsultations.length);
  const patientRate = calcRate(patients.length, patients.length - thisMonthPatients.length);
  const newPatientRate = calcRate(thisMonthPatients.length, lastMonthPatients.length);
  const dailyAvgRate = calcRate(dailyAverageSales, lastMonthDailyAvg);

  // 체질별 분류 로직 (안전한 방어 코드 추가)
  const constitutionCounts: Record<string, number> = {};
  patients.forEach(p => {
    // constitution 컬럼이나 체질 컬럼이 있는지 모두 확인
    let cType = p.constitution || p['체질'] || "";
    cType = cType.trim() !== "" ? cType : "미입력";
    constitutionCounts[cType] = (constitutionCounts[cType] || 0) + 1;
  });
  const totalPatientsCount = Math.max(1, patients.length);

  // 도넛 차트 그라디언트 생성
  const donutColors = ["#14b8a6", "#f59e0b", "#3b82f6", "#8b5cf6", "#94a3b8"]; 
  const constitutionArray = Object.entries(constitutionCounts).sort((a, b) => b[1] - a[1]);
  let cumulativePercent = 0;
  const conicGradientParts = constitutionArray.map(([name, count], idx) => {
    const p = (count / totalPatientsCount) * 100;
    const color = donutColors[idx % donutColors.length];
    const part = `${color} ${cumulativePercent}% ${cumulativePercent + p}%`;
    cumulativePercent += p;
    return part;
  }).join(", ");

  // 일별 차트 데이터 생성
  const dailySalesMap: Record<string, { sales: number, count: number, patientsSet: Set<string> }> = {};
  const lastMonthDailySalesMap: Record<number, { sales: number, customers: number }> = {};
  
  // 지난달 일별 데이터 미리 세팅 (전월 대비 꺾은선용)
  lastMonthConsultations.forEach(c => {
    const day = parseInt(c.consult_date_str.split('-')[2]);
    if (!lastMonthDailySalesMap[day]) lastMonthDailySalesMap[day] = { sales: 0, customers: 0 };
    lastMonthDailySalesMap[day].sales += (c.amount || 0);
    lastMonthDailySalesMap[day].customers += 1;
  });

  thisMonthConsultations.forEach(c => {
    const dateStr = c.consult_date_str;
    if (!dateStr) return;
    if (!dailySalesMap[dateStr]) dailySalesMap[dateStr] = { sales: 0, count: 0, patientsSet: new Set() };
    dailySalesMap[dateStr].sales += (c.amount || 0);
    dailySalesMap[dateStr].count += 1;
    if (c.patient_id) dailySalesMap[dateStr].patientsSet.add(c.patient_id);
  });

  const dailyChartData = Array.from({ length: daysInCurrentMonth }, (_, i) => {
    const day = i + 1;
    const formattedMonth = String(currentMonth + 1).padStart(2, '0');
    const formattedDay = String(day).padStart(2, '0');
    const dateStr = `${currentYear}-${formattedMonth}-${formattedDay}`;
    
    const sales = dailySalesMap[dateStr]?.sales || 0;
    const activeCustomers = dailySalesMap[dateStr]?.patientsSet.size || 0;
    
    // 일별 전월 대비 증감률 계산 (-100% ~ +100% 리미트)
    const lmSales = lastMonthDailySalesMap[day]?.sales || 0;
    const lmCustomers = lastMonthDailySalesMap[day]?.customers || 0;
    
    let salesRatePercent = lmSales === 0 ? (sales > 0 ? 100 : 0) : ((sales - lmSales) / lmSales) * 100;
    let custRatePercent = lmCustomers === 0 ? (activeCustomers > 0 ? 100 : 0) : ((activeCustomers - lmCustomers) / lmCustomers) * 100;
    
    salesRatePercent = Math.max(-100, Math.min(100, salesRatePercent));
    custRatePercent = Math.max(-100, Math.min(100, custRatePercent));
    
    return { day, dateStr, sales, activeCustomers, salesRatePercent, custRatePercent };
  });

  const sortedDailySales = Object.entries(dailySalesMap)
    .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
    .slice(0, 5);

  // SVG 차트 렌더링 헬퍼 함수
  const renderSVGChart = (type: "customer" | "sales") => {
    const maxBar = Math.max(...dailyChartData.map(d => type === "customer" ? d.activeCustomers : d.sales), 1);
    const barColor = type === "customer" ? "#94a3b8" : "#d6d3d1"; 
    const lineColor = type === "customer" ? "#334155" : "#78350f"; 

    const points = dailyChartData.map((d, i) => {
      const x = (i / (daysInCurrentMonth - 1)) * 100;
      const rate = type === "customer" ? d.custRatePercent : d.salesRatePercent;
      const y = 50 - (rate / 100) * 40; 
      return `${x},${y}`;
    }).join(" ");

    return (
      <div className="relative w-full h-[220px] mt-4">
        {/* Y축 범례 (좌/우) */}
        <div className="absolute left-0 top-0 bottom-6 flex flex-col justify-between text-[9px] text-slate-400 w-8 text-right pr-2 border-r border-slate-100 z-10 bg-white">
          <span>{type === "customer" ? maxBar : `${(maxBar / 10000).toFixed(0)}만`}</span>
          <span>{type === "customer" ? Math.round(maxBar/2) : `${(maxBar / 20000).toFixed(0)}만`}</span>
          <span>0</span>
        </div>
        <div className="absolute right-0 top-0 bottom-6 flex flex-col justify-between text-[9px] text-slate-400 w-8 pl-2 border-l border-slate-100 z-10 bg-white">
          <span>100%</span>
          <span>0%</span>
          <span>-100%</span>
        </div>

        {/* 차트 영역 */}
        <div className="absolute left-8 right-8 top-0 bottom-6">
          <svg className="w-full h-full overflow-visible" preserveAspectRatio="none">
            {/* 가이드 라인 */}
            <line x1="0" y1="10%" x2="100%" y2="10%" stroke="#f1f5f9" strokeWidth="1" />
            <line x1="0" y1="50%" x2="100%" y2="50%" stroke="#e2e8f0" strokeDasharray="4" strokeWidth="1" />
            <line x1="0" y1="90%" x2="100%" y2="90%" stroke="#f1f5f9" strokeWidth="1" />
            
            {/* 막대 그래프 */}
            {dailyChartData.map((d, i) => {
              const x = (i / (daysInCurrentMonth - 1)) * 100;
              const val = type === "customer" ? d.activeCustomers : d.sales;
              const heightPct = (val / maxBar) * 80; 
              return (
                <rect key={`bar-${i}`} x={`${x - (100/daysInCurrentMonth/3)}%`} y={`${90 - heightPct}%`} width={`${100/daysInCurrentMonth/1.5}%`} height={`${heightPct}%`} fill={barColor} className="hover:opacity-80 transition cursor-pointer">
                  <title>{d.dateStr} : {val.toLocaleString()}{type === "customer" ? "명" : "원"}</title>
                </rect>
              );
            })}
            
            {/* 꺾은선 그래프 */}
            <polyline points={points.replace(/([0-9.]+),([0-9.]+)/g, "$1%,$2%")} fill="none" stroke={lineColor} strokeWidth="1.5" />
            
            {/* 점 (Dots) */}
            {dailyChartData.map((d, i) => {
              const x = (i / (daysInCurrentMonth - 1)) * 100;
              const rate = type === "customer" ? d.custRatePercent : d.salesRatePercent;
              const y = 50 - (rate / 100) * 40; 
              return (
                <circle key={`dot-${i}`} cx={`${x}%`} cy={`${y}%`} r="3" fill="white" stroke={lineColor} strokeWidth="1.5" className="hover:r-[5] transition cursor-pointer">
                  <title>전월비 증감률: {rate.toFixed(0)}%</title>
                </circle>
              );
            })}
          </svg>
        </div>

        {/* X축 날짜 (7일 간격 표시) */}
        <div className="absolute left-8 right-8 bottom-0 h-6 flex justify-between items-end text-[9px] text-slate-400">
          {dailyChartData.map((d, i) => {
            if (i === 0 || i === Math.floor(daysInCurrentMonth/2) || i === daysInCurrentMonth - 1) {
              return <span key={`x-${i}`} className="w-6 text-center -ml-3">{currentMonth+1}.{String(d.day).padStart(2,'0')}</span>;
            }
            return <span key={`x-${i}`} className="w-0 overflow-hidden hidden sm:inline-block"></span>;
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full space-y-6 pb-12 max-w-[1400px] mx-auto bg-slate-50 min-h-screen">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white px-6 py-4 rounded-xl shadow-xs border border-slate-200 gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">통계</h1>
          <p className="text-xs text-slate-500 mt-1">상담과 판매 데이터를 기반으로 약국의 건강관리 성과를 확인할 수 있습니다.</p>
        </div>
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-[11px] font-bold text-slate-500">
          <button onClick={() => setPeriodFilter("month")} className={`px-4 py-1.5 rounded transition ${periodFilter === "month" ? "bg-slate-500 text-white shadow-sm" : "hover:text-slate-800"}`}>이번 달</button>
          <button onClick={() => setPeriodFilter("lastMonth")} className={`px-4 py-1.5 rounded transition ${periodFilter === "lastMonth" ? "bg-slate-500 text-white shadow-sm" : "hover:text-slate-800"}`}>지난달</button>
          <button className="px-4 py-1.5 rounded hover:text-slate-800 transition">3개월</button>
          <button className="px-4 py-1.5 rounded hover:text-slate-800 transition">6개월</button>
          <button className="px-4 py-1.5 rounded hover:text-slate-800 transition">1년</button>
        </div>
      </div>

      {/* 상단 5개 요약 지표 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white p-5 rounded-xl shadow-xs border border-slate-200">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-slate-400 text-lg">👥</span>
            <span className="text-xs font-bold text-slate-600">총 고객 수</span>
          </div>
          <div className="text-2xl font-bold text-slate-900 mb-3">{patients.length} <span className="text-sm font-normal text-slate-500">명</span></div>
          <div className="text-[11px] font-bold text-slate-500">지난달 대비 <span className={`ml-1 ${getRateColor(patients.length, patients.length - thisMonthPatients.length)}`}>{patientRate}</span></div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-xs border border-slate-200">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-slate-400 text-lg">₩</span>
            <span className="text-xs font-bold text-slate-600">총 매출</span>
          </div>
          <div className="text-2xl font-bold text-slate-900 mb-3 truncate">{thisMonthSales.toLocaleString()} <span className="text-sm font-normal text-slate-500">원</span></div>
          <div className="text-[11px] font-bold text-slate-500">지난달 대비 <span className={`ml-1 ${getRateColor(thisMonthSales, lastMonthSales)}`}>{salesRate}</span></div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-xs border border-slate-200">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-slate-400 text-lg">📊</span>
            <span className="text-xs font-bold text-slate-600">평균 일매출</span>
          </div>
          <div className="text-2xl font-bold text-slate-900 mb-3 truncate">{dailyAverageSales.toLocaleString()} <span className="text-sm font-normal text-slate-500">원</span></div>
          <div className="text-[11px] font-bold text-slate-500">지난달 대비 <span className={`ml-1 ${getRateColor(dailyAverageSales, lastMonthDailyAvg)}`}>{dailyAvgRate}</span></div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-xs border border-slate-200">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-slate-400 text-lg">⭐</span>
            <span className="text-xs font-bold text-slate-600">신규 등록 환자</span>
          </div>
          <div className="text-2xl font-bold text-slate-900 mb-3">{thisMonthPatients.length} <span className="text-sm font-normal text-slate-500">명</span></div>
          <div className="text-[11px] font-bold text-slate-500">지난달 대비 <span className={`ml-1 ${getRateColor(thisMonthPatients.length, lastMonthPatients.length)}`}>{newPatientRate}</span></div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-xs border border-slate-200 col-span-2 md:col-span-1">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-slate-400 text-lg">📝</span>
            <span className="text-xs font-bold text-slate-600">총 상담 건수</span>
          </div>
          <div className="text-2xl font-bold text-slate-900 mb-3">{thisMonthConsultations.length} <span className="text-sm font-normal text-slate-500">건</span></div>
          <div className="text-[11px] font-bold text-slate-500">지난달 대비 <span className={`ml-1 ${getRateColor(thisMonthConsultations.length, lastMonthConsultations.length)}`}>{consultRate}</span></div>
        </div>
      </div>

      {/* 📈 혼합 차트 영역 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-xs border border-slate-200 flex flex-col h-[360px]">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-2">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <span className="text-slate-400">👥</span> 고객 수 추이
            </h3>
            <div className="flex items-center gap-3 text-[10px] text-slate-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-[#94a3b8] rounded-full"></span> 고객 수(명)</span>
              <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-[#334155]"></span> 전월 대비 증감률(%)</span>
            </div>
          </div>
          {renderSVGChart("customer")}
        </div>

        <div className="bg-white p-6 rounded-xl shadow-xs border border-slate-200 flex flex-col h-[360px]">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-2">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <span className="text-slate-400">💰</span> 매출 추이
            </h3>
            <div className="flex items-center gap-3 text-[10px] text-slate-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-[#d6d3d1] rounded-full"></span> 매출(원)</span>
              <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-[#78350f]"></span> 전월 대비 증감률(%)</span>
            </div>
          </div>
          {renderSVGChart("sales")}
        </div>
      </div>

      {/* 🧬 하단 영역: 체질 도넛 차트 & 최근 매출 테이블 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* 좌측: 도넛 차트 */}
        <div className="lg:col-span-5 bg-white p-6 rounded-xl shadow-xs border border-slate-200 flex flex-col justify-between h-[340px]">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <span className="text-slate-400">🧬</span> 체질별 환자군 비율
            </h3>
          </div>
          <div className="flex-1 flex items-center justify-between px-2 sm:px-6">
            <div className="relative w-36 h-36 flex-shrink-0 rounded-full flex items-center justify-center shadow-inner" style={{ background: `conic-gradient(${conicGradientParts})` }}>
              <div className="w-24 h-24 bg-white rounded-full flex flex-col items-center justify-center text-center shadow-sm">
                <span className="text-[10px] text-slate-400 font-semibold mb-0.5">총 고객수</span>
                <span className="text-lg font-extrabold text-slate-800">{patients.length}<span className="text-xs font-normal">명</span></span>
              </div>
            </div>
            <div className="flex flex-col gap-2.5 ml-6 flex-1 max-h-[220px] overflow-y-auto pr-1">
              {constitutionArray.map(([name, count], idx) => {
                const percent = Math.round((count / totalPatientsCount) * 100);
                const color = donutColors[idx % donutColors.length];
                return (
                  <div key={name} className="flex items-center justify-between text-xs w-full border-b border-slate-50 pb-1">
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }}></span>
                      <span className="font-bold text-slate-700 truncate">{name}</span>
                    </div>
                    <div className="flex items-center gap-3 ml-2 flex-shrink-0">
                      <span className="font-bold text-slate-800 w-8 text-right">{percent}%</span>
                      <span className="text-slate-400 w-10 text-right">{count}명</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 우측: 최근 매출 현황 */}
        <div className="lg:col-span-7 bg-white p-6 rounded-xl shadow-xs border border-slate-200 flex flex-col justify-between h-[340px]">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-2">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <span className="text-slate-400">📄</span> 최근 매출 현황
            </h3>
            <Link href="/consultations#history" className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1">
              더보기 <span>→</span>
            </Link>
          </div>
          <div className="overflow-x-auto flex-1 flex items-start mt-2">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="py-2.5 px-3 font-semibold rounded-tl-lg">날짜</th>
                  <th className="py-2.5 px-3 font-semibold">매출액</th>
                  <th className="py-2.5 px-3 font-semibold">방문 고객수</th>
                  <th className="py-2.5 px-3 font-semibold text-right rounded-tr-lg">평균 객단가</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedDailySales.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-12 text-slate-400 font-semibold">매출 데이터가 없습니다.</td>
                  </tr>
                ) : (
                  sortedDailySales.map(([dateStr, data], idx) => {
                    const avgTicket = data.count > 0 ? Math.round(data.sales / data.count) : 0;
                    return (
                      <tr key={idx} className="hover:bg-slate-50/50 transition">
                        <td className="py-3 px-3 text-slate-600 font-medium whitespace-nowrap">{dateStr}</td>
                        <td className="py-3 px-3 text-slate-900 font-bold whitespace-nowrap">{data.sales.toLocaleString()} 원</td>
                        <td className="py-3 px-3 text-slate-600 whitespace-nowrap">{data.patientsSet.size} 명</td>
                        <td className="py-3 px-3 text-slate-900 font-bold text-right whitespace-nowrap">{avgTicket.toLocaleString()} 원</td>
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