"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Sidebar() {
  const pathname = usePathname();

  // 메뉴 목록 (요청하신 대로 제품/판매/배송 제외, 큰 제목 없음)
  const menuItems = [
    { name: "대시보드", href: "/", icon: "🏠" },
    { name: "고객 관리", href: "/patients", icon: "👥" }, // 경로에 맞게 수정 가능
    { name: "상담 기록", href: "/consultations", icon: "📝" },
    { name: "피드백 관리", href: "/feedbacks", icon: "📌" },
    { name: "통계", href: "/stats", icon: "📊" },
    { name: "설정", href: "/settings", icon: "⚙️" },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col h-screen p-4 flex-shrink-0">
      {/* 로고 영역 (원하시는 타이틀이나 로고로 변경 가능) */}
      <div className="px-3 py-4 mb-2">
        <h1 className="text-lg font-extrabold text-teal-900 tracking-tight">🌿 약국 CRM</h1>
      </div>

      {/* 메뉴 리스트 */}
      <nav className="flex-1 space-y-1.5">
        {menuItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3.5 py-3 rounded-2xl text-sm font-bold transition ${
                isActive
                  ? "bg-teal-900 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}