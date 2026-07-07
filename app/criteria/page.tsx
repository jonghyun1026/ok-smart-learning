import { Award, Coins, ListChecks } from "lucide-react";
import { getCriteriaData } from "@/lib/scoring";
import { getAreaColor } from "@/lib/area-colors";
import { ProgressBar } from "@/components/ui/progress-bar";

export const dynamic = "force-dynamic";

export default async function CriteriaPage() {
  const criteria = await getCriteriaData();
  const scoreAreas = criteria.areas.filter((a) => a.type === "score");

  const statTiles = [
    { icon: Award, label: "기술평가 합계", value: `${criteria.technicalTotalPoints}점` },
    { icon: Coins, label: "가격평가 합계", value: `${criteria.priceTotalPoints}점` },
    { icon: ListChecks, label: "전체 평가항목", value: `${criteria.items.length}개` },
  ];

  return (
    <main className="flex flex-col gap-6 px-8 py-10 md:px-16">
      <div className="flex w-full items-center justify-between">
        <h1 className="text-xl font-bold text-brand-dark whitespace-nowrap">
          세부 평가기준표 (기술평가 {criteria.technicalTotalPoints}점 + 가격평가{" "}
          {criteria.priceTotalPoints}점 = {criteria.grandTotalPoints}점)
        </h1>
        <span className="text-[13px] text-brand-muted whitespace-nowrap">
          협상적격자 기준: 총점 {criteria.settings.negotiationThreshold}점 이상 (동점 시{" "}
          {criteria.settings.tiebreakAreaCodes
            .map((code) => criteria.areas.find((a) => a.code === code)?.name ?? code)
            .join(" → ")}{" "}
          순 재비교)
        </span>
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {statTiles.map((tile) => (
          <div
            key={tile.label}
            className="flex items-center gap-4 rounded-xl border border-brand-border bg-white p-5"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-highlight text-brand">
              <tile.icon size={20} />
            </div>
            <div className="flex flex-col">
              <span className="text-[12px] font-semibold text-brand-muted">{tile.label}</span>
              <span className="text-xl font-black text-brand-dark">{tile.value}</span>
            </div>
          </div>
        ))}
      </section>

      <div className="flex flex-col gap-4">
        {criteria.areas.map((area) => {
          const colorIndex = scoreAreas.findIndex((a) => a.code === area.code);
          const color = area.type === "score" ? getAreaColor(colorIndex) : "#8A7F86";
          return (
            <section
              key={area.code}
              className="w-full overflow-hidden rounded-xl border border-brand-border bg-white"
            >
              <div
                className="flex items-center justify-between gap-3 p-4 px-5"
                style={{ backgroundColor: `${color}14` }}
              >
                <div className="flex items-center gap-2.5">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-[15px] font-black text-brand-dark">
                    {area.type === "pass_fail" ? `${area.name} (Pass/Fail)` : area.name}
                  </span>
                </div>
                <span className="text-[13px] font-bold whitespace-nowrap" style={{ color }}>
                  {area.type === "pass_fail" ? "게이트(Pass/Fail)" : `영역 배점 ${area.maxPoints}점`}
                </span>
              </div>

              <div className="flex flex-col">
                {area.items.map((item) => (
                  <div
                    key={item.itemNo}
                    className="flex items-center gap-4 border-t border-brand-border p-3.5 px-5"
                  >
                    <div className="w-14 shrink-0 text-[13px] font-bold text-brand-muted">
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

        <div className="flex items-center rounded-xl bg-brand-dark p-3.5 px-5">
          <div className="flex-1 text-[15px] font-black text-white">
            합계 (기술 {criteria.technicalTotalPoints}점 + 가격 {criteria.priceTotalPoints}점)
          </div>
          <div className="text-base font-black text-brand-amber whitespace-nowrap">
            {criteria.grandTotalPoints}점
          </div>
        </div>
      </div>
    </main>
  );
}
