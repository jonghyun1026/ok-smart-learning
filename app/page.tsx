import { Download, Target, ShieldCheck, CalendarClock, Users } from "lucide-react";
import scheduleData from "@/data/schedule.json";
import { getCriteriaData } from "@/lib/scoring";
import { getAreaColor } from "@/lib/area-colors";
import { ProgressBar } from "@/components/ui/progress-bar";

export const dynamic = "force-dynamic";

const RFP_FILE_HREF = "/OK금융그룹_2026-2027년_스마트러닝_위탁운영_제안요청서.docx";
const CRITERIA_GUIDE_FILE_HREF = "/OK학당_스마트러닝_위탁운영_세부평가기준_안내(2026~2027년).docx";

const BIZ_INFO = [
  {
    label: "사업명",
    value: "2026~2027년 OK학당 스마트러닝 교육 위탁운영 용역",
  },
  { label: "계약기간", value: "2026.9.1 ~ 2027.8.31" },
  {
    label: "교육대상인원",
    value: "연간 약 1,800명 (예상수강인원, 계약 후 추가인원 협의)",
  },
  {
    label: "위탁범위",
    value: "콘텐츠 제공 · 온라인 러닝플랫폼 제공 · 운영/수강관리 · 교육결과 제공 · 부가서비스",
  },
  {
    label: "선정방식",
    value: "공개경쟁입찰 (제안서 기술평가 80% + 입찰가격 평가 20%)",
  },
];

function computeDeadlineDday(): { label: string; date: string } {
  const deadlinePhase =
    scheduleData.phases.find((p) => p.label.includes("입찰공고 마감")) ?? scheduleData.phases[1];
  const deadline = new Date(`${deadlinePhase.date}T00:00:00+09:00`);
  const today = new Date();
  const diffDays = Math.ceil((deadline.getTime() - today.getTime()) / 86400000);
  const label = diffDays > 0 ? `D-${diffDays}` : diffDays === 0 ? "D-DAY" : `D+${Math.abs(diffDays)}`;
  return { label, date: deadlinePhase.date };
}

export default async function OverviewPage() {
  const criteria = await getCriteriaData();
  const scoreAreas = criteria.areas.filter((a) => a.type === "score");
  const dday = computeDeadlineDday();

  const statTiles = [
    {
      icon: Target,
      label: "총 배점",
      value: `${criteria.grandTotalPoints}점`,
      sub: `기술 ${criteria.technicalTotalPoints} + 가격 ${criteria.priceTotalPoints}`,
    },
    {
      icon: ShieldCheck,
      label: "협상적격 기준",
      value: `${criteria.settings.negotiationThreshold}점`,
      sub: "총점 이상 AND 필수자격 Pass",
    },
    {
      icon: CalendarClock,
      label: "입찰공고 마감",
      value: dday.label,
      sub: dday.date.replaceAll("-", "."),
    },
    {
      icon: Users,
      label: "교육대상인원",
      value: "약 1,800명",
      sub: "연간 예상수강인원",
    },
  ];

  return (
    <main className="flex flex-col gap-6 px-8 py-10 md:px-16">
      {/* Hero */}
      <section className="rounded-2xl bg-gradient-to-br from-[#2A232A] to-brand-dark2 p-9 shadow-sm">
        <p className="text-[13px] font-bold text-brand-light">OK금융그룹 인재개발팀</p>
        <h1 className="mt-2 text-[26px] font-black leading-snug text-white">
          2026~2027년 OK학당 스마트러닝 교육 위탁운영 용역
        </h1>
        <p className="mt-2 text-[14px] text-[#D8CFD3]">
          현 계약기간 2025.9.1 ~ 2026.8.31 · 계약 종료 전 신규 계약(공개경쟁입찰) 절차 진행 중
        </p>
      </section>

      {/* Highlight stat tiles */}
      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {statTiles.map((tile) => (
          <div
            key={tile.label}
            className="flex flex-col gap-3 rounded-xl border border-brand-border bg-white p-5"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-highlight text-brand">
              <tile.icon size={18} />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[12px] font-semibold text-brand-muted">{tile.label}</span>
              <span className="text-xl font-black text-brand-dark">{tile.value}</span>
              <span className="text-[11px] text-brand-muted">{tile.sub}</span>
            </div>
          </div>
        ))}
      </section>

      {/* 문서 다운로드 */}
      <section className="flex flex-col gap-4 rounded-xl border border-brand-border bg-white p-5 sm:flex-row">
        <div className="flex flex-1 items-center justify-between gap-4 rounded-lg bg-brand-bg p-4">
          <div className="flex flex-col gap-1">
            <div className="text-[15px] font-bold text-brand-dark whitespace-nowrap">
              평가 기준 안내 RFP (참고용)
            </div>
            <p className="text-[13px] text-brand-muted">
              제안요청서(RFP) 원문 전체를 다운로드하여 확인할 수 있습니다.
            </p>
          </div>
          <a
            href={RFP_FILE_HREF}
            download
            className="flex shrink-0 items-center gap-2 rounded-lg bg-brand px-5 py-3 text-sm font-bold text-white hover:bg-brand/90"
          >
            <Download size={16} />
            RFP 원문 다운로드
          </a>
        </div>
        <div className="flex flex-1 items-center justify-between gap-4 rounded-lg bg-brand-bg p-4">
          <div className="flex flex-col gap-1">
            <div className="text-[15px] font-bold text-brand-dark whitespace-nowrap">
              세부 평가기준 안내
            </div>
            <p className="text-[13px] text-brand-muted">
              배점·확인서류가 정리된 세부 평가기준 안내 문서를 다운로드할 수 있습니다.
            </p>
          </div>
          <a
            href={CRITERIA_GUIDE_FILE_HREF}
            download
            className="flex shrink-0 items-center gap-2 rounded-lg border border-brand bg-white px-5 py-3 text-sm font-bold text-brand hover:bg-brand-highlight"
          >
            <Download size={16} />
            세부평가기준 다운로드
          </a>
        </div>
      </section>

      {/* 사업 정보 */}
      <h2 className="text-xl font-bold text-brand-dark">사업 정보</h2>
      <section className="w-full overflow-hidden rounded-xl border border-brand-border bg-white">
        {BIZ_INFO.map((row, i) => (
          <div key={row.label} className={`flex ${i > 0 ? "border-t border-brand-border" : ""}`}>
            <div className="w-40 shrink-0 bg-brand-bg p-4 text-sm font-bold text-brand-dark">
              {row.label}
            </div>
            <div className="flex-1 p-4 text-sm leading-5 text-brand-dark">{row.value}</div>
          </div>
        ))}
      </section>

      {/* 입찰 일정 */}
      <h2 className="text-xl font-bold text-brand-dark">입찰 일정</h2>
      <section className="w-full overflow-hidden rounded-xl border border-brand-border bg-white">
        <div className="flex bg-brand-dark p-3 px-4">
          <div className="w-[220px] shrink-0 text-[13px] font-bold text-white">일정</div>
          <div className="flex-1 text-[13px] font-bold text-white">내용</div>
        </div>
        {scheduleData.phases.map((phase, i) => (
          <div
            key={phase.date}
            className={`flex border-t border-brand-border p-3 px-4 ${
              i % 2 === 1 ? "bg-brand-alt" : "bg-white"
            }`}
          >
            <div className="w-[220px] shrink-0 text-sm font-bold text-brand-dark">
              {phase.prefix ?? ""}
              {phase.date.replaceAll("-", ".")}
            </div>
            <div className="flex-1 text-sm leading-5 text-brand-dark">{phase.label}</div>
          </div>
        ))}
      </section>

      {/* 평가 구성 비율 */}
      <h2 className="text-xl font-bold text-brand-dark">평가 구성 비율</h2>
      <section className="w-full rounded-xl border border-brand-border bg-white p-6">
        <div className="flex h-4 w-full overflow-hidden rounded-full">
          {scoreAreas.map((area, i) => (
            <div
              key={area.code}
              style={{
                width: `${(area.maxPoints / (criteria.grandTotalPoints || 1)) * 100}%`,
                backgroundColor: getAreaColor(i),
              }}
              title={`${area.name} ${area.maxPoints}점`}
            />
          ))}
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3">
          {scoreAreas.map((area, i) => (
            <div key={area.code} className="flex items-center gap-2 text-[13px]">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: getAreaColor(i) }}
              />
              <span className="font-semibold text-brand-dark">{area.name}</span>
              <span className="ml-auto font-bold text-brand-muted">{area.maxPoints}점</span>
            </div>
          ))}
        </div>
      </section>

      {/* 평가 배점 구성 */}
      <div className="flex w-full items-center justify-between">
        <h2 className="text-xl font-bold text-brand-dark">평가 배점 구성</h2>
        <span className="text-[13px] font-bold text-brand">
          세부 항목은 [세부평가기준] 탭에서 확인
        </span>
      </div>
      <section className="w-full overflow-hidden rounded-xl border border-brand-border bg-white">
        <div className="flex bg-brand-dark p-3 px-4">
          <div className="w-[60px] shrink-0 text-[13px] font-bold text-white">#</div>
          <div className="flex-1 text-[13px] font-bold text-white">평가영역</div>
          <div className="w-[160px] shrink-0 text-right text-[13px] font-bold text-white">배점</div>
        </div>
        {criteria.areas.map((area, i) => {
          const colorIndex = scoreAreas.findIndex((a) => a.code === area.code);
          const color = area.type === "score" ? getAreaColor(colorIndex) : "#8A7F86";
          return (
            <div
              key={area.code}
              className={`flex items-center gap-4 border-t border-brand-border p-3 px-4 ${
                i % 2 === 1 ? "bg-brand-alt" : "bg-white"
              }`}
            >
              <div className="w-[60px] shrink-0">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
              </div>
              <div className="flex flex-1 flex-col gap-1.5">
                <span className="text-sm font-bold text-brand-dark">{area.name}</span>
                {area.type === "score" && (
                  <ProgressBar
                    value={area.maxPoints}
                    max={criteria.grandTotalPoints || 1}
                    colorHex={color}
                    className="max-w-[220px]"
                  />
                )}
              </div>
              <div className="w-[160px] shrink-0 text-right text-sm font-bold text-brand-dark">
                {area.type === "pass_fail" ? "게이트(Pass/Fail)" : `${area.maxPoints}점`}
              </div>
            </div>
          );
        })}
        <div className="flex items-center border-t border-brand-border bg-brand p-3.5 px-4">
          <div className="w-[60px] shrink-0" />
          <div className="flex-1 text-[15px] font-black text-white">
            합계 (기술 {criteria.technicalTotalPoints}점 + 가격 {criteria.priceTotalPoints}점)
          </div>
          <div className="w-[160px] shrink-0 text-right text-base font-black text-white">
            {criteria.grandTotalPoints}점
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-6 flex w-full flex-col gap-1.5 rounded-xl bg-brand-bg p-8">
        <div className="text-[13px] font-bold text-brand-dark">
          OK금융그룹 인재개발팀 · 문의: 박종현 사원 / jhyun.park@okfngroup.com / 02-3704-9791
        </div>
        <p className="text-xs text-brand-muted">
          본 시스템은 오프라인으로 접수된 제출자료를 평가·비교하기 위한 내부용 도구이며,
          배점·가격산식·동점규칙은 담당자 최종 검수 후 확정됩니다.
        </p>
      </footer>
    </main>
  );
}
