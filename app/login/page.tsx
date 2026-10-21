"use client";

import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError("이메일이나 비밀번호를 다시 확인해주세요.");
    } else {
      router.push("/");
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-slate-50 text-slate-800">
      <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-sm border border-slate-100">
        {/* 브랜드 헤더 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-teal-50 text-teal-800 font-bold text-xl mb-3 shadow-sm">
            🥦
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            브로콜리약국
          </h1>
          <p className="text-sm text-slate-400 mt-1">스마트 약국 CRM 케어데스크</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">이메일</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm text-slate-900"
              placeholder="pharmacist@broccoli.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm text-slate-900 font-bold tracking-widest"
              placeholder="••••••••"
              required
            />
          </div>

          {error && <p className="text-red-500 text-xs font-medium">{error}</p>}

          <button
            type="submit"
            className="w-full py-3.5 bg-teal-900 text-white rounded-xl hover:bg-teal-800 font-bold transition text-sm shadow-sm"
          >
            로그인하기
          </button>
        </form>
      </div>
    </div>
  );
}