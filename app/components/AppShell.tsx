"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { supabase } from "@/app/lib/supabase";
import Sidebar from "@/components/Sidebar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === "/login";

  useEffect(() => {
    // 로그인 페이지에서는 세션 체크를 하지 않음 (무한 루프 방지)
    if (isLoginPage) return;

    // 1. 처음 접속 시 세션 확인
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push("/login");
      }
    });

    // 2. 실시간 세션 만료 및 로그아웃 감지
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        router.push("/login");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router, pathname, isLoginPage]);

  // 로그인 페이지일 때는 사이드바 없이 본문만 렌더링
  if (isLoginPage) {
    return <main className="w-full min-h-screen bg-slate-50">{children}</main>;
  }

  // 로그인된 상태 (CRM 메인 레이아웃)
  return (
    <>
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 w-full md:pl-64">
        <main className="flex-1 w-full min-h-screen pt-16 pb-24 md:py-8 md:px-8 px-3 bg-slate-50">
          {children}
        </main>
      </div>
    </>
  );
}