"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { LayoutDashboard, ListChecks, Pencil, Settings, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", label: "평가개요", icon: LayoutDashboard },
  { href: "/criteria", label: "세부평가기준", icon: ListChecks },
  { href: "/evaluate", label: "평가입력", icon: Pencil },
  { href: "/admin", label: "관리자", icon: Settings },
];

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  // 로그인 화면 자체에는 상단 내비게이션을 노출하지 않는다.
  if (pathname === "/login") return null;

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <header className="w-full border-b border-brand-border bg-white">
      <div className="flex h-[76px] items-center justify-between px-8 md:px-16">
        <div className="flex items-center gap-5">
          {/* 원본 로고 파일이 1959x351(약 5.58:1 비율)이라 width/height를 실제
              비율에 맞춰 지정하고 object-contain으로 렌더링해 찌그러짐을 방지한다. */}
          <Image
            src="/logo-wide.png"
            alt="OK금융그룹"
            width={134}
            height={24}
            priority
            className="h-6 w-auto object-contain"
          />
          <div className="h-6 w-px bg-brand-border" />
          <span className="text-[16px] font-bold text-brand-dark whitespace-nowrap">
            OK학당 스마트러닝 위탁운영 계약 평가시스템
          </span>
        </div>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-brand-bg px-3.5 py-1.5 text-[12px] font-bold text-brand-muted transition-colors hover:bg-brand-highlight hover:text-brand disabled:opacity-50"
        >
          <LogOut size={13} />
          {loggingOut ? "로그아웃 중..." : "로그아웃"}
        </button>
      </div>
      <nav className="flex gap-1 px-8 md:px-14">
        {TABS.map((tab) => {
          const active = tab.href === "/" ? pathname === "/" : pathname?.startsWith(tab.href);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex items-center gap-2 px-3 py-4 text-sm font-bold border-b-[3px] -mb-px whitespace-nowrap transition-colors",
                active
                  ? "border-brand text-brand"
                  : "border-transparent text-brand-muted hover:text-brand-dark"
              )}
            >
              <Icon size={16} />
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
