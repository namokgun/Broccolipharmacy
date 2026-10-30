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
    return rate >= 0 ? `+${rate}%` : `${rate}%`;
  };
  const getRateColor = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? "text-emerald-500" : "text-slate-400";
    return current >= previous ? "text-emerald-500" : "text-red-500";
  };

  const salesRate = calcRate(thisMonthSales, lastMonthSales);
  const consultRate = calcRate(thisMonthConsultations.length, lastMonthConsultations.length);
  const patientRate = calcRate(patients.length, patients.length - thisMonthPatients.length);
  const newPatientRate = calcRate(thisMonthPatients.length, lastMonthPatients.length);
  const dailyAvgRate = calcRate(dailyAverageSales, lastMonthDailyAvg);

  // 🟢 체질별 분류 (DB 컬럼명 다를 경우 대비)
  const constitutionCounts: Record<string, number> = {};
  patients.forEach(p => {
    let cType = p.constitution || p.sasang || p.body_type || p.type || p['체질'] || "";
    cType = cType.trim() !== "" ? cType : "미입력";
    constitutionCounts[cType] = (constitutionCounts[cType] || 0) + 1;
  });
  const totalPatientsCount = Math.max(1, patients.length);

  const donutColors = ["#14b8a6", "#f59e0b", "#3b82f6", "#8b5cf6", "#94a3b8", "#f43f5e", "#10b981"]; 
  const constitutionArray = Object.entries(constitutionCounts).sort((a, b) => b[1] - a[1]);

  // 일별 데이터 생성
  const dailySalesMap: Record<string, { sales: number, count: number, patientsSet: Set<string> }> = {};
  
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
    
    return { day, dateStr, sales, activeCustomers };
  });

  const sortedDailySales = Object.entries(dailySalesMap)
    .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
    .slice(0, 5);

  // 🟢 깔끔한 막대 차트 렌더링
  const renderBarChart = (type: "customer" | "sales") => {
    const maxVal = Math.max(...dailyChartData.map(d => type === "customer" ? d.activeCustomers : d.sales), 1);
    const barColor = type === "customer" ? "bg-[#94a3b8]" : "bg-[#d6d3d1]";
    const hoverColor = type === "customer" ? "group-hover:bg-[#64748b]" : "group-hover:bg-[#a8a29e]";

    return (
      <div className="relative w-full h-[220px] mt-6">
        {/* Y축 범례 */}
        <div className="absolute left-0 top-0 bottom-6 flex flex-col justify-between text-[10px] text-slate-400 w-10 text-right pr-2">
          <span>{type === "customer" ? maxVal : `${(maxVal / 10000).toFixed(0)}만`}</span>
          <span>{type === "customer" ? Math.round(maxVal/2) : `${(maxVal / 20000).toFixed(0)}만`}</span>
          <span>0</span>
        </div>

        {/* 차트 가이드라인 및 막대 */}
        <div className="absolute left-10 right-2 top-0 bottom-6 border-b border-slate-200">
          <div className="absolute w-full border-t border-slate-100 top-[50%]"></div>
          <div className="absolute w-full h-full flex items-end justify-between gap-[2px] sm:gap-1 px-1">
            {dailyChartData.map((d, i) => {
              const val = type === "customer" ? d.activeCustomers : d.sales;
              const heightPct = (val / maxVal) * 100;
              return (
                <div key={i} className="relative flex-1 h-full flex flex-col justify-end group">
                  {/* 툴팁 */}
                  <div className="absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 hidden group-hover:flex bg-slate-800 text-white text-[11px] px-2.5 py-1.5 rounded-lg whitespace-nowrap z-20 shadow-lg items-center font-bold">
                    {d.dateStr.slice(5)} <span className="mx-1.5 w-px h-3 bg-slate-500"></span> {val.toLocaleString()}{type === "customer" ? "명" : "원"}
                  </div>
                  {/* 막대 */}
                  <div 
                    className={`w-full ${barColor} ${hoverColor} transition-all duration-300 rounded-t-sm`} 
                    style={{ height: `${heightPct}%`, minHeight: val > 0 ? '4px' : '0' }}
                  ></div>
                </div>
              );
            })}
          </div>
        </div>

        {/* X축 날짜 */}
        <div className="absolute left-10 right-2 bottom-0 h-6 flex justify-between items-end text-[10px] text-slate-400 px-1">
          <span>10.01</span>
          <span>10.16</span>
          <span>10.31</span>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full space-y-5 pb-12 max-w-[1400px] mx-auto bg-slate-50 min-h-screen">
      
      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white p-5 rounded-xl shadow-xs border border-slate-100">
          <div className="text-xs font-bold text-slate-500 mb-2">총 고객 수</div>
          <div className="text-2xl font-extrabold text-slate-900 mb-2">{patients.length} <span className="text-sm font-bold text-slate-600">명</span></div>
          <div className="text-[11px] font-bold text-slate-400">지난달 대비 <span className={`ml-1 ${getRateColor(patients.length, patients.length - thisMonthPatients.length)}`}>{patientRate}</span></div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-xs border border-slate-100">
          <div className="text-xs font-bold text-slate-500 mb-2">이번 달 총 매출</div>
          <div className="text-2xl font-extrabold text-slate-900 mb-2 truncate">{thisMonthSales.toLocaleString()} <span className="text-sm font-bold text-slate-600">원</span></div>
          <div className="text-[11px] font-bold text-slate-400">지난달 대비 <span className={`ml-1 ${getRateColor(thisMonthSales, lastMonthSales)}`}>{salesRate}</span></div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-xs border border-slate-100">
          <div className="text-xs font-bold text-slate-500 mb-2">평균 일매출</div>
          <div className="text-2xl font-extrabold text-slate-900 mb-2 truncate">{dailyAverageSales.toLocaleString()} <span className="text-sm font-bold text-slate-600">원</span></div>
          <div className="text-[11px] font-bold text-slate-400">지난달 대비 <span className={`ml-1 ${getRateColor(dailyAverageSales, lastMonthDailyAvg)}`}>{dailyAvgRate}</span></div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-xs border border-slate-100">
          <div className="text-xs font-bold text-slate-500 mb-2">신규 등록 환자</div>
          <div className="text-2xl font-extrabold text-slate-900 mb-2">{thisMonthPatients.length} <span className="text-sm font-bold text-slate-600">명</span></div>
          <div className="text-[11px] font-bold text-slate-400">지난달 대비 <span className={`ml-1 ${getRateColor(thisMonthPatients.length, lastMonthPatients.length)}`}>{newPatientRate}</span></div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-xs border border-slate-100 col-span-2 md:col-span-1">
          <div className="text-xs font-bold text-slate-500 mb-2">총 상담 건수</div>
          <div className="text-2xl font-extrabold text-slate-900 mb-2">{thisMonthConsultations.length} <span className="text-sm font-bold text-slate-600">건</span></div>
          <div className="text-[11px] font-bold text-slate-400">지난달 대비 <span className={`ml-1 ${getRateColor(thisMonthConsultations.length, lastMonthConsultations.length)}`}>{consultRate}</span></div>
        </div>
      </div>

      {/* 막대 차트 영역 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-xs border border-slate-100 flex flex-col h-[340px]">
          <div className="flex justify-between items-center pb-2">
            <h3 className="text-[15px] font-bold text-slate-800 flex items-center gap-2">
              <span className="text-slate-500 text-lg">👥</span> 고객 수 추이
            </h3>
            <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400">
              <span className="w-2.5 h-2.5 bg-[#94a3b8] rounded-sm"></span> 고객 수(명)
            </div>
          </div>
          {renderBarChart("customer")}
        </div>

        <div className="bg-white p-6 rounded-xl shadow-xs border border-slate-100 flex flex-col h-[340px]">
          <div className="flex justify-between items-center pb-2">
            <h3 className="text-[15px] font-bold text-slate-800 flex items-center gap-2">
              <span className="text-slate-500 text-lg">💰</span> 매출 추이
            </h3>
            <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400">
              <span className="w-2.5 h-2.5 bg-[#d6d3d1] rounded-sm"></span> 매출(원)
            </div>
          </div>
          {renderBarChart("sales")}
        </div>
      </div>

      {/* 체질 도넛 차트 & 최근 매출 테이블 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        
        {/* 🟢 개선된 도넛 차트 */}
        <div className="lg:col-span-5 bg-white p-6 rounded-xl shadow-xs border border-slate-100 flex flex-col justify-between h-[340px]">
          <div className="flex justify-between items-center border-b border-slate-50 pb-3 mb-6">
            <h3 className="text-[15px] font-bold text-slate-800 flex items-center gap-2">
              <span className="text-slate-500 text-lg">🧬</span> 체질별 환자군 비율
            </h3>
          </div>
          
          <div className="flex-1 flex flex-row items-center px-2">
            {/* SVG 도넛 링 */}
            <div className="relative w-32 h-32 flex-shrink-0">
              <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                {/* 배경 링 */}
                <path className="text-slate-100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" />
                {/* 데이터 링 */}
                {(() => {
                  let offset = 0;
                  return constitutionArray.map(([name, count], idx) => {
                    const percent = (count / totalPatientsCount) * 100;
                    const strokeDasharray = `${percent} ${100 - percent}`;
                    const strokeDashoffset = -offset;
                    offset += percent;
                    return (
                      <path 
                        key={name}
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
                        fill="none" 
                        stroke={donutColors[idx % donutColors.length]} 
                        strokeWidth="4" 
                        strokeDasharray={strokeDasharray}
                        strokeDashoffset={strokeDashoffset}
                        className="transition-all duration-500"
                      />
                    );
                  });
                })()}
              </svg>
              {/* 중앙 텍스트 */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-[10px] text-slate-400 font-bold mb-0.5">총 고객수</span>
                <span className="text-xl font-extrabold text-slate-800">{patients.length}<span className="text-xs font-bold text-slate-600">명</span></span>
              </div>
            </div>

            {/* 우측 범례 리스트 */}
            <div className="flex flex-col gap-4 ml-8 flex-1">
              {constitutionArray.map(([name, count], idx) => {
                const percent = Math.round((count / totalPatientsCount) * 100);
                const color = donutColors[idx % donutColors.length];
                return (
                  <div key={name} className="flex items-center justify-between text-xs w-full">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }}></span>
                      <span className="font-bold text-slate-700">{name}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-extrabold text-slate-900 w-8 text-right">{percent}%</span>
                      <span className="font-bold text-slate-400 w-8 text-right">{count}명</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 최근 매출 현황 */}
        <div className="lg:col-span-7 bg-white p-6 rounded-xl shadow-xs border border-slate-100 flex flex-col justify-between h-[340px]">
          <div className="flex justify-between items-center border-b border-slate-50 pb-3 mb-2">
            <h3 className="text-[15px] font-bold text-slate-800 flex items-center gap-2">
              <span className="text-slate-500 text-lg">📄</span> 최근 매출 현황
            </h3>
            <Link href="/consultations#history" className="text-[11px] font-bold text-slate-400 hover:text-slate-800">
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
                {sortedDailySales.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-12 text-slate-400 font-bold">매출 데이터가 없습니다.</td>
                  </tr>
                ) : (
                  sortedDailySales.map(([dateStr, data], idx) => {
                    const avgTicket = data.count > 0 ? Math.round(data.sales / data.count) : 0;
                    return (
                      <tr key={idx} className="hover:bg-slate-50/50 transition">
                        <td className="py-3.5 px-4 text-slate-500 font-bold">{dateStr}</td>
                        <td className="py-3.5 px-4 text-slate-900 font-extrabold">{data.sales.toLocaleString()} 원</td>
                        <td className="py-3.5 px-4 text-slate-500 font-bold">{data.patientsSet.size} 명</td>
                        <td className="py-3.5 px-4 text-slate-900 font-extrabold text-right">{avgTicket.toLocaleString()} 원</td>
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