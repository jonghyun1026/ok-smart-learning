/**
 * 단일 공유 계정(ID/PW) 로그인 게이트. docs/schema.md 범위(인증 없음)를 벗어나
 * 최소한의 접근 통제를 추가하되, 사용자별 계정·권한 구분은 하지 않는다
 * (CLAUDE.md "인증 관련 주의사항" 참조 — 실 운영 전 정식 인증 체계로 교체 필요).
 *
 * middleware.ts(Edge 런타임)와 Route Handler(Node 런타임) 양쪽에서 공용으로 써야 하므로
 * Node 전용 `crypto` 모듈 대신 양쪽 다 지원하는 Web Crypto API(`crypto.subtle`)로 세션
 * 쿠키에 HMAC 서명을 붙인다. 세션 자체는 서버에 저장하지 않고(무상태) "만료시각.서명"
 * 형태의 값을 쿠키에 넣어 매 요청마다 서명만 재검증한다.
 */

export const AUTH_COOKIE_NAME = "ok_hakdang_auth";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7일
export const AUTH_COOKIE_MAX_AGE_SECONDS = Math.floor(SESSION_TTL_MS / 1000);

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET 환경변수가 설정되지 않았습니다. .env.local을 확인하세요.");
  }
  return secret;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sign(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return toBase64Url(new Uint8Array(sigBuf));
}

/** 로그인 성공 시 쿠키에 담을 값(만료시각 + 서명)을 생성한다. */
export async function createSessionCookieValue(): Promise<string> {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = String(expiresAt);
  const signature = await sign(payload);
  return `${payload}.${signature}`;
}

/** 쿠키 값의 서명과 만료시각을 검증한다. */
export async function verifySessionCookieValue(value: string | undefined | null): Promise<boolean> {
  if (!value) return false;
  const dotIndex = value.lastIndexOf(".");
  if (dotIndex <= 0) return false;
  const payload = value.slice(0, dotIndex);
  const signature = value.slice(dotIndex + 1);
  const expected = await sign(payload);
  if (expected !== signature) return false;
  const expiresAt = Number(payload);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;
  return true;
}

/** 입력한 ID/PW가 .env.local의 ADMIN_USERNAME/ADMIN_PASSWORD와 일치하는지 확인한다. */
export function checkCredentials(username: string, password: string): boolean {
  const validUsername = process.env.ADMIN_USERNAME;
  const validPassword = process.env.ADMIN_PASSWORD;
  return Boolean(validUsername && validPassword && username === validUsername && password === validPassword);
}
