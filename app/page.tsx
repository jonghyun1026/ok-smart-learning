import { Download, Target, ShieldCheck, CalendarClock, Users } from "lucide-react";
import scheduleData from "@/data/schedule.json";
import { getCriteriaData } from "@/lib/scoring";
import { getAreaColor } from "@/lib/area-colors";
import { ProgressBar } from "@/components/ui/progress-bar";
import { PageHero } from "@/components/ui/page-hero";
import { SectionTitle } from "@/components/ui/section-title";
import { KpiTile } from "@/components/ui/kpi-tile";
import { Card } from "@/components/ui/card";

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

const SHELL = "mx-auto flex w-full max-w-[1560px] flex-col gap-7 px-4 pb-16 pt-6 sm:px-6 lg:px-7";

export default async function OverviewPage() {
  const criteria = await getCriteriaData();
  const scoreAreas = criteria.areas.filter((a) => a.type === "score");
  const dday = computeDeadlineDday();

  return (
    <main className={SHELL}>
      <PageHero
        eyebrow="OK금융그룹 인재개발팀"
        title="2026~2027년 OK학당 스마트러닝 교육 위탁운영 용역"
        description="현 계약기간 2025.9.1 ~ 2026.8.31 · 계약 종료 전 신규 계약(공개경쟁입찰) 절차 진행 중입니다. 아래에서 사업 개요·일정·평가 배점을 확인하고 관련 문서를 내려받을 수 있습니다."
        actions={
          <>
            <a
              href={RFP_FILE_HREF}
              download
              className="inline-flex min-h-[42px] items-center gap-2 rounded-control border border-brand bg-brand px-4 text-sm font-extrabold text-white shadow-primary transition-[transform,background-color] duration-150 hover:-translate-y-px hover:bg-brand-deep"
            >
              <Download size={16} />
              RFP 원문 다운로드
            </a>
            <a
              href={CRITERIA_GUIDE_FILE_HREF}
              download
              className="inline-flex min-h-[42px] items-center gap-2 rounded-control border border-brand-borderStrong bg-white px-4 text-sm font-extrabold text-brand-brown transition-[transform,border-color] duration-150 hover:-translate-y-px hover:border-brand hover:text-brand"
            >
              <Download size={16} />
              세부평가기준 안내
            </a>
          </>
        }
      />

      {/* 핵심 지표 */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiTile
          icon={Target}
          label="총 배점"
          value={criteria.grandTotalPoints}
          unit="점"
          sub={`기술 ${criteria.technicalTotalPoints} + 가격 ${criteria.priceTotalPoints}`}
          accent="#F55000"
          soft="#FFF1E9"
        />
        <KpiTile
          icon={ShieldCheck}
          label="협상적격 기준"
          value={criteria.settings.negotiationThreshold}
          unit="점"
          sub="총점 이상 AND 필수자격 Pass"
          accent="#18875E"
          soft="#E7F4EE"
        />
        <KpiTile
          icon={CalendarClock}
          label="입찰공고 마감"
          value={dday.label}
          sub={dday.date.replaceAll("-", ".")}
          accent="#E39400"
          soft="#FFF7DF"
        />
        <KpiTile
          icon={Users}
          label="교육대상인원"
          value="약 1,800명"
          sub="연간 예상수강인원"
          accent="#55474A"
          soft="#F0EDEC"
        />
      </section>

      {/* 사업 정보 */}
      <SectionTitle icon={Target}>사업 정보</SectionTitle>
      <Card className="overflow-hidden">
        {BIZ_INFO.map((row, i) => (
          <div key={row.label} className={`flex ${i > 0 ? "border-t border-brand-border" : ""}`}>
            <div className="w-40 shrink-0 bg-brand-alt p-4 text-[13px] font-black text-brand-brown">
              {row.label}
            </div>
            <div className="flex-1 p-4 text-sm leading-6 text-brand-dark">{row.value}</div>
          </div>
        ))}
      </Card>

      {/* 입찰 일정 */}
      <SectionTitle icon={CalendarClock}>입찰 일정</SectionTitle>
      <Card className="overflow-hidden">
        <div className="flex border-b border-brand-border bg-brand-alt p-3 px-4">
          <div className="w-[220px] shrink-0 text-[11px] font-black uppercase tracking-wide text-brand-muted">
            일정
          </div>
          <div className="flex-1 text-[11px] font-black uppercase tracking-wide text-brand-muted">
            내용
          </div>
        </div>
        {scheduleData.phases.map((phase, i) => (
          <div
            key={phase.date}
            className={`flex border-t border-brand-border p-3 px-4 transition-colors hover:bg-brand-hoverSoft ${
              i % 2 === 1 ? "bg-brand-alt/40" : "bg-white"
            }`}
          >
            <div className="w-[220px] shrink-0 text-sm font-bold text-brand-brown">
              {phase.displayDate ??
                (phase.dateStart
                  ? `${phase.dateStart.replaceAll("-", ".")} ~ ${phase.date.replaceAll("-", ".")}`
                  : `${phase.prefix ?? ""}${phase.date.replaceAll("-", ".")}`)}
            </div>
            <div className="flex-1 text-sm leading-6 text-brand-dark">{phase.label}</div>
          </div>
        ))}
      </Card>

      {/* 평가 구성 비율 */}
      <SectionTitle icon={ShieldCheck}>평가 구성 비율</SectionTitle>
      <Card className="p-6">
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
              <span className="font-bold text-brand-brown">{area.name}</span>
              <span className="ml-auto font-black text-brand-muted">{area.maxPoints}점</span>
            </div>
          ))}
        </div>
      </Card>

      {/* 평가 배점 구성 */}
      <SectionTitle icon={Target} aside="세부 항목은 [세부평가기준] 탭에서 확인">
        평가 배점 구성
      </SectionTitle>
      <Card className="overflow-hidden">
        <div className="flex border-b border-brand-border bg-brand-alt p-3 px-4">
          <div className="w-[60px] shrink-0 text-[11px] font-black uppercase tracking-wide text-brand-muted">
            #
          </div>
          <div className="flex-1 text-[11px] font-black uppercase tracking-wide text-brand-muted">
            평가영역
          </div>
          <div className="w-[160px] shrink-0 text-right text-[11px] font-black uppercase tracking-wide text-brand-muted">
            배점
          </div>
        </div>
        {criteria.areas.map((area, i) => {
          const colorIndex = scoreAreas.findIndex((a) => a.code === area.code);
          const color = area.type === "score" ? getAreaColor(colorIndex) : "#8A7F86";
          return (
            <div
              key={area.code}
              className={`flex items-center gap-4 border-t border-brand-border p-3 px-4 transition-colors hover:bg-brand-hoverSoft ${
                i % 2 === 1 ? "bg-brand-alt/40" : "bg-white"
              }`}
            >
              <div className="w-[60px] shrink-0">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: color }}
                />
              </div>
              <div className="flex flex-1 flex-col gap-1.5">
                <span className="text-sm font-bold text-brand-brown">{area.name}</span>
                {area.type === "score" && (
                  <ProgressBar
                    value={area.maxPoints}
                    max={criteria.grandTotalPoints || 1}
                    colorHex={color}
                    className="max-w-[220px]"
                  />
                )}
              </div>
              <div className="w-[160px] shrink-0 text-right text-sm font-black text-brand-brown">
                {area.type === "pass_fail" ? "게이트(Pass/Fail)" : `${area.maxPoints}점`}
              </div>
            </div>
          );
        })}
        <div className="flex items-center border-t border-brand-border bg-brand-highlight p-3.5 px-4">
          <div className="w-[60px] shrink-0" />
          <div className="flex-1 text-[15px] font-black text-brand-brown">
            합계 (기술 {criteria.technicalTotalPoints}점 + 가격 {criteria.priceTotalPoints}점)
          </div>
          <div className="w-[160px] shrink-0 text-right text-base font-black text-brand">
            {criteria.grandTotalPoints}점
          </div>
        </div>
      </Card>

      {/* Footer */}
      <footer className="mt-4 flex w-full flex-col gap-1.5 rounded-card border border-brand-border bg-brand-alt p-8">
        <div className="text-[13px] font-bold text-brand-brown">
          OK금융그룹 인재개발팀 · 문의: 박종현 사원 / jhyun.park@okfngroup.com / 02-3704-9791
        </div>
        <p className="text-xs leading-relaxed text-brand-muted">
          본 시스템은 오프라인으로 접수된 제출자료를 평가·비교하기 위한 내부용 도구이며, 배점·가격산식·동점규칙은
          담당자 최종 검수 후 확정됩니다.
        </p>
      </footer>
    </main>
  );
}
