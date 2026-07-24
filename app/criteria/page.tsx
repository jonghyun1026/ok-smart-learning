import { Award, Coins, ListChecks } from "lucide-react";
import { getCriteriaData } from "@/lib/scoring";
import { getAreaColor } from "@/lib/area-colors";
import { ProgressBar } from "@/components/ui/progress-bar";
import { PageHero } from "@/components/ui/page-hero";
import { KpiTile } from "@/components/ui/kpi-tile";

export const dynamic = "force-dynamic";

export default async function CriteriaPage() {
  const criteria = await getCriteriaData();
  const scoreAreas = criteria.areas.filter((a) => a.type === "score");

  const tiebreak = criteria.settings.tiebreakAreaCodes
    .map((code) => criteria.areas.find((a) => a.code === code)?.name ?? code)
    .join(" → ");

  return (
    <main className="mx-auto flex w-full max-w-[1560px] flex-col gap-7 px-4 pb-16 pt-6 sm:px-6 lg:px-7">
      <PageHero
        eyebrow="세부평가기준"
        title="세부 평가기준표"
        description={
          <>
            기술평가 {criteria.technicalTotalPoints}점 + 가격평가 {criteria.priceTotalPoints}점 ={" "}
            {criteria.grandTotalPoints}점. 협상적격자 기준은 총점{" "}
            {criteria.settings.negotiationThreshold}점 이상이며, 동점 시 {tiebreak} 순으로 재비교합니다.
          </>
        }
      />

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiTile
          icon={Award}
          label="기술평가 합계"
          value={criteria.technicalTotalPoints}
          unit="점"
          sub="제안서 기술평가 배점"
          accent="#F55000"
          soft="#FFF1E9"
        />
        <KpiTile
          icon={Coins}
          label="가격평가 합계"
          value={criteria.priceTotalPoints}
          unit="점"
          sub="입찰가격 환산 배점"
          accent="#E39400"
          soft="#FFF7DF"
        />
        <KpiTile
          icon={ListChecks}
          label="전체 평가항목"
          value={criteria.items.length}
          unit="개"
          sub="필수자격 게이트 포함"
          accent="#55474A"
          soft="#F0EDEC"
        />
      </section>

      <div className="flex flex-col gap-4">
        {criteria.areas.map((area) => {
          const colorIndex = scoreAreas.findIndex((a) => a.code === area.code);
          const color = area.type === "score" ? getAreaColor(colorIndex) : "#8A7F86";
          return (
            <section
              key={area.code}
              className="w-full overflow-hidden rounded-card border border-brand-border bg-white shadow-card"
            >
              <div
                className="flex items-center justify-between gap-3 border-b border-brand-border p-4 px-5"
                style={{ backgroundColor: `${color}12` }}
              >
                <div className="flex items-center gap-2.5">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-[15px] font-black tracking-[-0.01em] text-brand-brown">
                    {area.type === "pass_fail" ? `${area.name} (Pass/Fail)` : area.name}
                  </span>
                </div>
                <span className="text-[13px] font-black whitespace-nowrap" style={{ color }}>
                  {area.type === "pass_fail" ? "게이트(Pass/Fail)" : `영역 배점 ${area.maxPoints}점`}
                </span>
              </div>

              <div className="flex flex-col">
                {area.items.map((item) => (
                  <div
                    key={item.itemNo}
                    className="flex items-center gap-4 border-t border-brand-border p-3.5 px-5 transition-colors first:border-t-0 hover:bg-brand-hoverSoft"
                  >
                    <div className="w-14 shrink-0 text-[13px] font-black text-brand-muted">
                      {item.itemNo}
                    </div>
                    <div className="flex flex-1 flex-col gap-1.5">
                      <div className="text-sm leading-5 text-brand-dark">
                        {item.itemName}
                        {item.itemType === "price" && (
                          <span className="text-brand-muted">
                            {" "}
                            ({criteria.priceTotalPoints} × 최저입찰가 ÷ 해당업체입찰가, 소수 둘째자리
                            반올림, 상한 {criteria.priceTotalPoints}점)
                          </span>
                        )}
                      </div>
                      {item.itemType !== "pass_fail" && typeof item.maxPoints === "number" && (
                        <ProgressBar
                          value={item.maxPoints}
                          max={area.maxPoints || 1}
                          colorHex={color}
                          className="max-w-[200px]"
                        />
                      )}
                    </div>
                    <div className="w-20 shrink-0 text-right text-sm font-bold text-brand-dark">
                      {item.itemType === "pass_fail" ? "P/F" : `${item.maxPoints}점`}
                    </div>
                    <div className="w-[220px] shrink-0 text-xs leading-[17px] text-brand-muted">
                      {item.docReference || "-"}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}

        <div className="flex items-center rounded-card border border-brand-border bg-brand-highlight p-4 px-5 shadow-card">
          <div className="flex-1 text-[15px] font-black text-brand-brown">
            합계 (기술 {criteria.technicalTotalPoints}점 + 가격 {criteria.priceTotalPoints}점)
          </div>
          <div className="text-lg font-black text-brand whitespace-nowrap">
            {criteria.grandTotalPoints}점
          </div>
        </div>
      </div>
    </main>
  );
}
