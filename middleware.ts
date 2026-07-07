import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, verifySessionCookieValue } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  const authenticated = await verifySessionCookieValue(token);
  if (authenticated) {
    return NextResponse.next();
  }

  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}

// 로그인 페이지·로그인 API·정적 자산(_next, 확장자가 있는 public 파일)은 게이트에서 제외한다.
// RFP·세부평가기준 안내 docx는 의도적으로 공개 다운로드 대상이라 확장자 파일 전체를 제외했다.
export const config = {
  matcher: ["/((?!login|api/login|api/logout|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
