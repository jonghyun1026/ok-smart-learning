import { AlertTriangle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type RationaleSection = { label: string; text: string };

/** 이 라벨이 포함되면 "사람이 반드시 확인" 성격의 섹션으로 보고 경고 스타일을 입힌다. */
const HUMAN_CHECK_KEYWORDS = ["사람 검증", "검증 필요", "플래그"];

/**
 * evaluation-agent가 근거를 "[근거 인용] ... [확인서류 대조] ... [등급 판단] ..." 형태로
 * 대괄호 라벨 + 본문을 이어붙여 쓰기 때문에(references/scoring-guide.md 근거 작성 원칙),
 * 화면에 그대로 뿌리면 줄바꿈 없는 벽글이 된다. 라벨 단위로 잘라 카드로 보여주기 위해 파싱한다.
 * 구버전 초안(대괄호 구조 없이 1~2문장)은 매치되는 라벨이 없으므로 null을 반환해 평문 표시로 폴백한다.
 */
function parseRationale(raw: string): RationaleSection[] | null {
  const matches = Array.from(raw.matchAll(/\[([^[\]]{2,40})\]/g));
  if (matches.length === 0) return null;
  const sections: RationaleSection[] = [];
  for (let i = 0; i < matches.length; i++) {
    const label = matches[i][1].trim();
    const start = matches[i].index! + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index! : raw.length;
    const text = raw.slice(start, end).trim();
    if (text) sections.push({ label, text });
  }
  return sections.length > 0 ? sections : null;
}

export function RationaleBlocks({ text, className }: { text: string; className?: string }) {
  const sections = parseRationale(text);
  if (!sections) {
    return (
      <p className={cn("whitespace-pre-line text-[12.5px] leading-5 text-brand-dark", className)}>{text}</p>
    );
  }
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {sections.map((s, idx) => {
        const flagged = HUMAN_CHECK_KEYWORDS.some((k) => s.label.includes(k));
        return (
          <div
            key={idx}
            className={cn(
              "rounded-lg p-2.5",
              flagged ? "border border-brand-amber/40 bg-[#FFF3DD]" : "bg-brand-bg"
            )}
          >
            <div
              className={cn(
                "mb-1 flex items-center gap-1 text-[11px] font-bold",
                flagged ? "text-brand-amber" : "text-brand"
              )}
            >
              {flagged ? <AlertTriangle size={11} /> : <Sparkles size={11} />}
              {s.label}
            </div>
            <p className="whitespace-pre-line text-[12.5px] leading-5 text-brand-dark">{s.text}</p>
          </div>
        );
      })}
    </div>
  );
}
