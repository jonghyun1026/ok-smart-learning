"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "로그인에 실패했습니다.");
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "로그인 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-bg px-4">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-[380px] flex-col gap-5 rounded-2xl border border-brand-border bg-white p-8 shadow-sm"
      >
        <div className="flex flex-col items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-wide.png" alt="OK금융그룹" className="h-6 w-auto object-contain" />
          <p className="text-center text-sm font-bold text-brand-dark">
            OK학당 스마트러닝 위탁운영 계약 평가시스템
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>아이디</Label>
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            autoComplete="username"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>비밀번호</Label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        {error && <p className="text-sm font-semibold text-brand-red">{error}</p>}
        <Button type="submit" disabled={loading} className="w-full justify-center py-3">
          {loading ? "로그인 중..." : "로그인"}
        </Button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
