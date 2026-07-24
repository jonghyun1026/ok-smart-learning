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
    <header className="sticky top-0 z-40 w-full border-b border-brand-border/80 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-[68px] max-w-[1560px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-7">
        <div className="flex min-w-0 items-center gap-4">
          {/* 원본 로고 파일이 1959x351(약 5.58:1 비율)이라 width/height를 실제
              비율에 맞춰 지정하고 object-contain으로 렌더링해 찌그러짐을 방지한다. */}
          <Image
            src="/logo-wide.png"
            alt="OK금융그룹"
            width={134}
            height={24}
            priority
            className="h-6 w-auto shrink-0 object-contain"
          />
          <div className="hidden h-5 w-px bg-brand-border sm:block" />
          <span className="hidden truncate text-[14px] font-bold text-brand-brown sm:block">
            OK학당 스마트러닝 위탁운영 계약 평가시스템
          </span>
        </div>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex min-h-[34px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-control border border-brand-borderStrong bg-white px-3 text-[12px] font-extrabold text-brand-brown transition-[transform,color,border-color] duration-150 hover:-translate-y-px hover:border-brand hover:text-brand disabled:opacity-40"
        >
          <LogOut size={13} />
          {loggingOut ? "로그아웃 중..." : "로그아웃"}
        </button>
      </div>
      <nav className="mx-auto flex max-w-[1560px] gap-1 overflow-x-auto px-3 sm:px-5 lg:px-6">
        {TABS.map((tab) => {
          const active = tab.href === "/" ? pathname === "/" : pathname?.startsWith(tab.href);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "-mb-px flex items-center gap-2 whitespace-nowrap border-b-[3px] px-3 py-3.5 text-[13.5px] font-bold transition-colors",
                active
                  ? "border-brand text-brand"
                  : "border-transparent text-brand-muted hover:text-brand-brown"
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
