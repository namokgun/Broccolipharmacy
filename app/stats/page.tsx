"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/app/lib/supabase";
import Link from "next/link";

export default function StatsPage() {
  const [patients, setPatients] = useState<any[]>([]);
  const [consultations, setConsultations] = useState<any[]>([]);
  const [currentDate, setCurrentDate] = useState<Date | null>(null);

  // 기간 필터 상태 ("month", "lastMonth", "3months", "6months", "1year")
  const [periodFilter, setPeriodFilter] = useState("month");

  useEffect(() => {
    setCurrentDate(new Date());
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: pData } = await supabase.from("patients").select("*").order("created_at");
    if (pData) setPatients(pData);

    const { data: cData } = await supabase
      .from("consultations")
      .select("*, patients(name, phone, custom_id, gender, birth_year)")
      .order("created_at", { ascending: false });

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

  // 1. 이번 달 데이터 필터링
  const thisMonthConsultations = consultations.filter(c => {
    const dateStr = c.consult_date_str;
    if (!dateStr) return false;
    const [y, m] = dateStr.split('-').map(Number);
    return y === currentYear && m === (currentMonth + 1);
  });

  const thisMonthPatients = patients.filter(p => {
    const dateStr = p.created_at?.split('T')[0];
    if (!dateStr) return false;
    const [y, m] = dateStr.split('-').map(Number);
    return y === currentYear && m === (currentMonth + 1);
  });

  const thisMonthSales = thisMonthConsultations.reduce((sum, c) => sum + (c.amount || 0), 0);
  const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const currentDay = currentDate.getDate();
  const divisorDays = Math.max(1, currentDay);
  const dailyAverageSales = Math.round(thisMonthSales / divisorDays);

  // 2. 지난달 데이터 필터링 (전월 대비 비교용)
  const lastMonthDate = new Date(currentYear, currentMonth - 1, 1);
  const lastMonthYear = lastMonthDate.getFullYear();
  const lastMonthNum = lastMonthDate.getMonth() + 1;

  const lastMonthConsultations = consultations.filter(c => {
    const dateStr = c.consult_date_str;
    if (!dateStr) return false;
    const [y, m] = dateStr.split('-').map(Number);
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

  // 증감률 계산 함수
  const calcRate = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? "+100%" : "0%";
    const rate = Math.round(((current - previous) / previous) * 100);
    return rate >= 0 ? `+${rate}%` : `${rate}%`;
  };

  const salesRate = calcRate(thisMonthSales, lastMonthSales);
  const consultRate = calcRate(thisMonthConsultations.length, lastMonthConsultations.length);
  const patientRate = calcRate(patients.length, patients.length - thisMonthPatients.length);
  const newPatientRate = calcRate(thisMonthPatients.length, lastMonthPatients.length);
  const dailyAvgRate = calcRate(dailyAverageSales, lastMonthDailyAvg);

  // 체질별 환자군 비율 계산
  const constitutionCounts: Record<string, number> = {};
  patients.forEach(p => {
    const cType = p.constitution || "태음인"; // 기본값 태음인 가정
    constitutionCounts[cType] = (constitutionCounts[cType] || 0) + 1;
  });
  const totalPatientsCount = Math.max(1, patients.length);

  // 최근 매출 현황 일별 집계 (최근 5일)
  const dailySalesMap: Record<string, { sales: number, count: number, patientsSet: Set<string> }> = {};
  consultations.forEach(c => {
    const dateStr = c.consult_date_str;
    if (!dateStr) return;
    if (!dailySalesMap[dateStr]) {
      dailySalesMap[dateStr] = { sales: 0, count: 0, patientsSet: new Set() };
    }
    dailySalesMap[dateStr].sales += (c.amount || 0);
    dailySalesMap[dateStr].count += 1;
    if (c.patient_id) dailySalesMap[dateStr].patientsSet.add(c.patient_id);
  });

  const sortedDailySales = Object.entries(dailySalesMap)
    .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
    .slice(0, 5);

  const formatName = (p: any) => p?.custom_id ? `${p.name} (${p.custom_id})` : p?.name;

  return (
    <div className="w-full space-y-6 pb-12 max-w-[1400px] mx-auto">
      
      {/* 상단 헤더 및 기간 필터 탭 */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white px-6 py-4 rounded-2xl shadow-xs border border-slate-100 gap-4">
        <div>
          <h1 className="text-lg font-extrabold text-slate-900">📊 통계 및 성과 분석</h1>
          <p className="text-xs text-slate-500 mt-0.5">상담 데이터를 기반으로 약국의 건강관리 성과와 지난달 대비 증감률을 확인합니다.</p>
        </div>

        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-600">
          <button 
            onClick={() => setPeriodFilter("month")} 
            className={`px-3 py-1.5 rounded-lg transition ${periodFilter === "month" ? "bg-white text-slate-900 shadow-xs" : "hover:text-slate-900"}`}
          >
            이번 달
          </button>
          <button 
            onClick={() => setPeriodFilter("lastMonth")} 
            className={`px-3 py-1.5 rounded-lg transition ${periodFilter === "lastMonth" ? "bg-white text-slate-900 shadow-xs" : "hover:text-slate-900"}`}
          >
            지난달
          </button>
          <button 
            onClick={() => setPeriodFilter("3months")} 
            className={`px-3 py-1.5 rounded-lg transition ${periodFilter === "3months" ? "bg-white text-slate-900 shadow-xs" : "hover:text-slate-900"}`}
          >
            3개월
          </button>
          <button 
            onClick={() => setPeriodFilter("6months")} 
            className={`px-3 py-1.5 rounded-lg transition ${periodFilter === "6months" ? "bg-white text-slate-900 shadow-xs" : "hover:text-slate-900"}`}
          >
            6개월
          </button>
          <button 
            onClick={() => setPeriodFilter("1year")} 
            className={`px-3 py-1.5 rounded-lg transition ${periodFilter === "1year" ? "bg-white text-slate-900 shadow-xs" : "hover:text-slate-900"}`}
          >
            1년
          </button>
        </div>
      </div>

      {/* 📊 상단 핵심 지표 요약 카드 (5개 배치 + 지난달 대비 증감률 강조) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        
        {/* 총 고객 수 */}
        <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-100 flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-400">총 고객 수</span>
          <div className="my-2">
            <span className="text-2xl font-extrabold text-slate-900">{patients.length} 명</span>
          </div>
          <div className="text-[11px] font-bold text-teal-700 flex items-center gap-1">
            <span>지난달 대비</span>
            <span className="bg-teal-50 px-1.5 py-0.5 rounded text-teal-800">↑ {patientRate}</span>
          </div>
        </div>

        {/* 총 매출 */}
        <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-100 flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-400">총 매출</span>
          <div className="my-2">
            <span className="text-xl font-extrabold text-teal-900 truncate" title={`${thisMonthSales.toLocaleString()}원`}>
              {thisMonthSales.toLocaleString()} 원
            </span>
          </div>
          <div className="text-[11px] font-bold text-teal-700 flex items-center gap-1">
            <span>지난달 대비</span>
            <span className="bg-teal-50 px-1.5 py-0.5 rounded text-teal-800">↑ {salesRate}</span>
          </div>
        </div>

        {/* 평균 일매출 */}
        <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-100 flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-400">평균 일매출</span>
          <div className="my-2">
            <span className="text-xl font-extrabold text-purple-900 truncate" title={`${dailyAverageSales.toLocaleString()}원`}>
              {dailyAverageSales.toLocaleString()} 원
            </span>
          </div>
          <div className="text-[11px] font-bold text-teal-700 flex items-center gap-1">
            <span>지난달 대비</span>
            <span className="bg-teal-50 px-1.5 py-0.5 rounded text-teal-800">↑ {dailyAvgRate}</span>
          </div>
        </div>

        {/* 신규 고객 수 */}
        <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-100 flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-400">신규 고객 수</span>
          <div className="my-2">
            <span className="text-2xl font-extrabold text-slate-900">{thisMonthNewPatients.length} 명</span>
          </div>
          <div className="text-[11px] font-bold text-teal-700 flex items-center gap-1">
            <span>지난달 대비</span>
            <span className="bg-teal-50 px-1.5 py-0.5 rounded text-teal-800">↑ {newPatientRate}</span>
          </div>
        </div>

        {/* 총 상담 건수 */}
        <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-100 flex flex-col justify-between col-span-2 md:col-span-1">
          <span className="text-xs font-bold text-slate-400">총 상담 건수</span>
          <div className="my-2">
            <span className="text-2xl font-extrabold text-slate-900">{thisMonthConsultations.length} 건</span>
          </div>
          <div className="text-[11px] font-bold text-teal-700 flex items-center gap-1">
            <span>지난달 대비</span>
            <span className="bg-teal-50 px-1.5 py-0.5 rounded text-teal-800">↑ {consultRate}</span>
          </div>
        </div>

      </div>

      {/* 📈 중단 영역: 고객 수 추이 및 매출 추이 그래프 영역 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* 고객 수 추이 */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between h-[340px]">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-extrabold text-slate-900">👥 고객 수 추이</h3>
            <span className="text-xs font-bold text-slate-400">전월 대비 증감률 포함</span>
          </div>
          <div className="flex-1 flex items-center justify-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
            <p className="text-xs font-semibold text-slate-400">선택된 기간의 고객 누적 및 증가 추이 그래프</p>
          </div>
        </div>

        {/* 매출 추이 */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between h-[340px]">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-extrabold text-slate-900">💰 매출 추이</h3>
            <span className="text-xs font-bold text-slate-400">일별/월별 매출 흐름</span>
          </div>
          <div className="flex-1 flex items-center justify-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
            <p className="text-xs font-semibold text-slate-400">선택된 기간의 매출 및 성장세 그래프</p>
          </div>
        </div>

      </div>

      {/* 📋 하단 영역: 체질별 환자군 비율 & 최근 매출 현황 (주요 제품 판매 제외 완료) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* 좌측: 체질별 환자군 비율 (4컬럼) */}
        <div className="lg:col-span-5 bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between h-[320px]">
          <div className="flex justify-between items-center border-b pb-3">
            <h3 className="text-sm font-extrabold text-slate-900">🧬 체질별 환자군 비율</h3>
            <span className="text-xs font-bold text-slate-500">총 {patients.length}명</span>
          </div>

          <div className="space-y-3 my-auto">
            {Object.entries(constitutionCounts).map(([constitution, count], idx) => {
              const percent = Math.round((count / totalPatientsCount) * 100);
              const colors = ["bg-teal-700", "bg-teal-500", "bg-purple-600", "bg-blue-600"];
              const barColor = colors[idx % colors.length];

              return (
                <div key={constitution} className="space-y-1">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-800">{constitution}</span>
                    <span className="text-slate-600">{percent}% ({count}명)</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className={`${barColor} h-full rounded-full transition-all duration-500`} style={{ width: `${percent}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 우측: 최근 매출 현황 (7컬럼 - 주요 제품 판매 제외하고 넓게 배치) */}
        <div className="lg:col-span-7 bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between h-[320px]">
          <div className="flex justify-between items-center border-b pb-3">
            <h3 className="text-sm font-extrabold text-slate-900">📄 최근 매출 현황</h3>
            <Link href="/consultations#history" className="text-xs font-bold text-teal-800 hover:underline">
              더보기 →
            </Link>
          </div>

          <div className="overflow-x-auto flex-1 flex items-center">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b">
                <tr>
                  <th className="p-3 font-bold">날짜</th>
                  <th className="p-3 font-bold">매출액</th>
                  <th className="p-3 font-bold">방문 고객수</th>
                  <th className="p-3 font-bold text-right">평균 객단가</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedDailySales.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-slate-400">매출 데이터가 없습니다.</td>
                  </tr>
                ) : (
                  sortedDailySales.map(([dateStr, data], idx) => {
                    const avgTicket = data.count > 0 ? Math.round(data.sales / data.count) : 0;
                    return (
                      <tr key={idx} className="hover:bg-slate-50/80 transition">
                        <td className="p-3 font-semibold text-slate-700 whitespace-nowrap">{dateStr}</td>
                        <td className="p-3 font-bold text-teal-900 whitespace-nowrap">{data.sales.toLocaleString()}원</td>
                        <td className="p-3 text-slate-600 whitespace-nowrap">{data.patientsSet.size}명</td>
                        <td className="p-3 font-bold text-purple-900 text-right whitespace-nowrap">{avgTicket.toLocaleString()}원</td>
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