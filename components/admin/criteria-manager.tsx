"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import type { CriteriaArea, CriteriaData, CriteriaItem, CriteriaItemType } from "@/lib/scoring";
import { getAreaColor } from "@/lib/area-colors";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";

/**
 * 최초 RFP 설계 시 확정했던 영역별/전체 목표 배점 (data/criteria.json 스냅샷 기준).
 * DB에는 저장하지 않는 순수 참고값 — 관리자가 항목을 자유롭게 추가/삭제해 실제 합계가
 * 이 값과 달라져도 저장을 막지 않고 경고 배너만 보여준다.
 */
const ORIGINAL_GRAND_TOTAL_TARGET = 100;
const ORIGINAL_AREA_TARGETS: Record<string, number> = {
  GENERAL: 10,
  CONTENT: 25,
  OPERATION: 25,
  SYSTEM: 20,
  PRICE: 20,
};

type ItemDraft = { itemName: string; docReference: string; maxPoints: string };

function emptyDraft(item?: CriteriaItem): ItemDraft {
  return {
    itemName: item?.itemName ?? "",
    docReference: item?.docReference ?? "",
    maxPoints: item?.maxPoints != null ? String(item.maxPoints) : "",
  };
}

export function CriteriaManager({ onChanged }: { onChanged?: () => void }) {
  const [criteria, setCriteria] = useState<CriteriaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [thresholdInput, setThresholdInput] = useState("70");
  const [tiebreak1, setTiebreak1] = useState("");
  const [tiebreak2, setTiebreak2] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  const [editingAreaCode, setEditingAreaCode] = useState<string | null>(null);
  const [areaNameDraft, setAreaNameDraft] = useState("");

  const [editingItemNo, setEditingItemNo] = useState<string | null>(null);
  const [itemDraft, setItemDraft] = useState<ItemDraft>(emptyDraft());

  const [addingItemAreaCode, setAddingItemAreaCode] = useState<string | null>(null);
  const [newItemDraft, setNewItemDraft] = useState<ItemDraft>(emptyDraft());

  const [addingArea, setAddingArea] = useState(false);
  const [newAreaName, setNewAreaName] = useState("");
  const [newAreaType, setNewAreaType] = useState<CriteriaItemType>("score");

  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/criteria");
      const json = await res.json();
      if (json.data) {
        const data = json.data as CriteriaData;
        setCriteria(data);
        setThresholdInput(String(data.settings.negotiationThreshold));
        setTiebreak1(data.settings.tiebreakAreaCodes[0] ?? "");
        setTiebreak2(data.settings.tiebreakAreaCodes[1] ?? "");
      }
    } catch {
      setMessage({ type: "error", text: "평가기준을 불러오지 못했습니다." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const scoreAreas = useMemo(() => criteria?.areas.filter((a) => a.type === "score") ?? [], [criteria]);

  function applyResult(data: CriteriaData) {
    setCriteria(data);
    onChanged?.();
  }

  function showError(err: unknown, fallback: string) {
    setMessage({ type: "error", text: err instanceof Error ? err.message : fallback });
  }

  function areaColor(area: CriteriaArea) {
    if (area.type !== "score") return "#8A7F86";
    const idx = scoreAreas.findIndex((a) => a.code === area.code);
    return getAreaColor(idx);
  }

  // --- 평가 설정 저장 ---
  async function handleSaveSettings() {
    setSavingSettings(true);
    setMessage(null);
    try {
      const tiebreakAreaCodes = [tiebreak1, tiebreak2].filter(Boolean);
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          negotiationThreshold: Number(thresholdInput),
          tiebreakAreaCodes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "설정 저장에 실패했습니다.");
      applyResult(data.data as CriteriaData);
      setMessage({ type: "success", text: "평가 설정이 저장되었습니다." });
    } catch (err) {
      showError(err, "설정 저장 중 오류가 발생했습니다.");
    } finally {
      setSavingSettings(false);
    }
  }

  // --- 영역명 수정 ---
  function startEditArea(area: CriteriaArea) {
    setEditingAreaCode(area.code);
    setAreaNameDraft(area.name);
  }

  async function saveAreaName(code: string) {
    if (!areaNameDraft.trim()) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/criteria/areas/${encodeURIComponent(code)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ areaName: areaNameDraft.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "영역명 수정에 실패했습니다.");
      applyResult(data.data as CriteriaData);
      setEditingAreaCode(null);
    } catch (err) {
      showError(err, "영역명 수정 중 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }

  // --- 영역 삭제 ---
  async function deleteArea(area: CriteriaArea) {
    if (!window.confirm(`"${area.name}" 영역과 하위 항목 ${area.items.length}개를 모두 삭제합니다. 계속할까요?`)) {
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/criteria/areas/${encodeURIComponent(area.code)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "영역 삭제에 실패했습니다.");
      applyResult(data.data as CriteriaData);
      setMessage({ type: "success", text: `"${area.name}" 영역이 삭제되었습니다.` });
    } catch (err) {
      showError(err, "영역 삭제 중 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }

  // --- 항목 수정 ---
  function startEditItem(item: CriteriaItem) {
    setEditingItemNo(item.itemNo);
    setItemDraft(emptyDraft(item));
  }

  async function saveItem(item: CriteriaItem) {
    setBusy(true);
    setMessage(null);
    try {
      const body: Record<string, unknown> = {
        itemName: itemDraft.itemName.trim(),
        docReference: itemDraft.docReference,
      };
      if (item.itemType !== "pass_fail") {
        body.maxPoints = itemDraft.maxPoints === "" ? 0 : Number(itemDraft.maxPoints);
      }
      const res = await fetch(`/api/criteria/items/${encodeURIComponent(item.itemNo)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "항목 수정에 실패했습니다.");
      applyResult(data.data as CriteriaData);
      setEditingItemNo(null);
    } catch (err) {
      showError(err, "항목 수정 중 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }

  // --- 항목 삭제 ---
  async function deleteItem(item: CriteriaItem) {
    if (!window.confirm(`"${item.itemName}" 항목을 삭제할까요?`)) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/criteria/items/${encodeURIComponent(item.itemNo)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "항목 삭제에 실패했습니다.");
      applyResult(data.data as CriteriaData);
    } catch (err) {
      showError(err, "항목 삭제 중 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }

  // --- 항목 추가 ---
  function startAddItem(area: CriteriaArea) {
    setAddingItemAreaCode(area.code);
    setNewItemDraft(emptyDraft());
  }

  async function submitAddItem(area: CriteriaArea) {
    if (!newItemDraft.itemName.trim()) {
      setMessage({ type: "error", text: "항목명을 입력해주세요." });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/criteria/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          areaCode: area.code,
          itemName: newItemDraft.itemName.trim(),
          itemType: area.type === "pass_fail" ? "pass_fail" : area.items[0]?.itemType ?? "score",
          maxPoints: area.type === "pass_fail" ? null : Number(newItemDraft.maxPoints || 0),
          docReference: newItemDraft.docReference,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "항목 추가에 실패했습니다.");
      applyResult(data.data as CriteriaData);
      setAddingItemAreaCode(null);
    } catch (err) {
      showError(err, "항목 추가 중 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }

  // --- 영역 추가 ---
  async function submitAddArea() {
    if (!newAreaName.trim()) {
      setMessage({ type: "error", text: "영역명을 입력해주세요." });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/criteria/areas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ areaName: newAreaName.trim(), itemType: newAreaType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "영역 추가에 실패했습니다.");
      applyResult(data.data as CriteriaData);
      setAddingArea(false);
      setNewAreaName("");
      setNewAreaType("score");
      setMessage({ type: "success", text: "새 영역이 추가되었습니다. 항목을 추가/수정해주세요." });
    } catch (err) {
      showError(err, "영역 추가 중 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }

  if (loading || !criteria) {
    return <p className="text-sm text-brand-muted">평가기준을 불러오는 중...</p>;
  }

  const totalMismatch = criteria.grandTotalPoints !== ORIGINAL_GRAND_TOTAL_TARGET;

  return (
    <div className="flex flex-col gap-6">
      {/* 목표 총점 vs 실제 합계 배너 */}
      <div
        className={`flex items-center gap-3 rounded-card border p-4 shadow-card ${
          totalMismatch
            ? "border-brand-amber/40 bg-[#FFF3DD]"
            : "border-brand-green/30 bg-[#EAF6EC]"
        }`}
      >
        {totalMismatch ? (
          <AlertTriangle size={18} className="shrink-0 text-brand-amber" />
        ) : (
          <CheckCircle2 size={18} className="shrink-0 text-brand-green" />
        )}
        <p className="text-sm text-brand-dark">
          기준 총점(참고값) {ORIGINAL_GRAND_TOTAL_TARGET}점 vs 현재 전체 배점 합계{" "}
          <span className="font-black">{criteria.grandTotalPoints}점</span>
          {totalMismatch
            ? " — 값이 일치하지 않습니다. 저장은 계속 가능하며, 최종 확정 전 배점을 다시 확인해주세요."
            : " — 일치합니다."}
        </p>
      </div>

      {message && (
        <div
          className={`rounded-control p-3 text-sm font-semibold ${
            message.type === "success" ? "bg-[#EDF7F0] text-brand-green" : "bg-[#FBEEEC] text-brand-red"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* 평가 설정 카드 */}
      <section className="flex flex-col gap-4 rounded-card border border-brand-border bg-white p-6 shadow-card">
        <div className="text-base font-black tracking-[-0.01em] text-brand-brown">평가 설정</div>
        <div className="flex flex-col gap-5 md:flex-row">
          <div className="flex w-full flex-col gap-1.5 md:w-[220px]">
            <Label>협상적격 기준점수</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={thresholdInput}
              onChange={(e) => setThresholdInput(e.target.value)}
            />
          </div>
          <div className="flex w-full flex-col gap-1.5 md:w-[220px]">
            <Label>동점 재비교 1순위 영역</Label>
            <Select value={tiebreak1} onChange={(e) => setTiebreak1(e.target.value)}>
              <option value="">선택 안 함</option>
              {scoreAreas.map((a) => (
                <option key={a.code} value={a.code}>
                  {a.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex w-full flex-col gap-1.5 md:w-[220px]">
            <Label>동점 재비교 2순위 영역</Label>
            <Select value={tiebreak2} onChange={(e) => setTiebreak2(e.target.value)}>
              <option value="">선택 안 함</option>
              {scoreAreas.map((a) => (
                <option key={a.code} value={a.code}>
                  {a.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={handleSaveSettings} disabled={savingSettings}>
              <Save size={15} />
              {savingSettings ? "저장 중..." : "설정 저장"}
            </Button>
          </div>
        </div>
      </section>

      {/* 영역별 카드 */}
      {criteria.areas.map((area) => {
        const color = areaColor(area);
        const target = ORIGINAL_AREA_TARGETS[area.code];
        const hasTarget = typeof target === "number";
        const matchesTarget = hasTarget && target === area.maxPoints;

        return (
          <section key={area.code} className="w-full overflow-hidden rounded-card border border-brand-border bg-white shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-border p-4 px-5" style={{ backgroundColor: `${color}12` }}>
              <div className="flex items-center gap-2.5">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                {editingAreaCode === area.code ? (
                  <div className="flex items-center gap-1.5">
                    <Input
                      autoFocus
                      value={areaNameDraft}
                      onChange={(e) => setAreaNameDraft(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && saveAreaName(area.code)}
                      className="h-8 w-48 py-1"
                    />
                    <button onClick={() => saveAreaName(area.code)} disabled={busy} className="text-brand-green">
                      <CheckCircle2 size={18} />
                    </button>
                    <button onClick={() => setEditingAreaCode(null)} className="text-brand-muted">
                      <X size={18} />
                    </button>
                  </div>
                ) : (
                  <button className="flex items-center gap-1.5" onClick={() => startEditArea(area)}>
                    <span className="text-[15px] font-black tracking-[-0.01em] text-brand-brown">
                      {area.type === "pass_fail" ? `${area.name} (Pass/Fail)` : area.name}
                    </span>
                    <Pencil size={13} className="text-brand-muted" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-[13px] font-bold" style={{ color }}>
                  {area.type === "pass_fail" ? "게이트(Pass/Fail)" : `영역 배점 합계 ${area.maxPoints}점`}
                  {area.type === "score" && hasTarget ? (
                    matchesTarget ? (
                      <CheckCircle2 size={14} className="text-brand-green" />
                    ) : (
                      <span className="flex items-center gap-1 text-brand-amber">
                        <AlertTriangle size={14} />
                        (기준 {target}점)
                      </span>
                    )
                  ) : null}
                </span>
                <button
                  onClick={() => deleteArea(area)}
                  disabled={busy}
                  className="flex items-center gap-1 rounded-control border border-brand-red/30 px-2.5 py-1.5 text-[12px] font-bold text-brand-red transition-colors hover:bg-brand-red/10"
                >
                  <Trash2 size={13} />
                  영역 삭제
                </button>
              </div>
            </div>

            <div className="flex flex-col">
              {area.items.map((item) => (
                <div key={item.itemNo} className="flex items-center gap-4 border-t border-brand-border p-3.5 px-5 transition-colors hover:bg-brand-hoverSoft">
                  <div className="w-14 shrink-0 text-[13px] font-bold text-brand-muted">{item.itemNo}</div>

                  {editingItemNo === item.itemNo ? (
                    <>
                      <div className="flex flex-1 flex-col gap-1.5 sm:flex-row sm:items-center">
                        <Input
                          autoFocus
                          value={itemDraft.itemName}
                          onChange={(e) => setItemDraft((d) => ({ ...d, itemName: e.target.value }))}
                          placeholder="항목명"
                          className="sm:flex-1"
                        />
                        <Input
                          value={itemDraft.docReference}
                          onChange={(e) => setItemDraft((d) => ({ ...d, docReference: e.target.value }))}
                          placeholder="확인서류"
                          className="sm:w-[200px]"
                        />
                        {item.itemType !== "pass_fail" && (
                          <Input
                            type="number"
                            min={0}
                            value={itemDraft.maxPoints}
                            onChange={(e) => setItemDraft((d) => ({ ...d, maxPoints: e.target.value }))}
                            placeholder="배점"
                            className="sm:w-[90px]"
                          />
                        )}
                      </div>
                      <button onClick={() => saveItem(item)} disabled={busy} className="shrink-0 text-brand-green">
                        <CheckCircle2 size={18} />
                      </button>
                      <button onClick={() => setEditingItemNo(null)} className="shrink-0 text-brand-muted">
                        <X size={18} />
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="flex flex-1 flex-col gap-0.5">
                        <span className="text-sm text-brand-dark">{item.itemName}</span>
                        <span className="text-xs text-brand-muted">확인서류: {item.docReference || "-"}</span>
                      </div>
                      <div className="w-16 shrink-0 text-right text-sm font-bold text-brand-dark">
                        {item.itemType === "pass_fail" ? "P/F" : `${item.maxPoints}점`}
                      </div>
                      <button onClick={() => startEditItem(item)} className="shrink-0 text-brand-muted hover:text-brand-dark">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => deleteItem(item)} disabled={busy} className="shrink-0 text-brand-muted hover:text-brand-red">
                        <X size={17} />
                      </button>
                    </>
                  )}
                </div>
              ))}

              {addingItemAreaCode === area.code ? (
                <div className="flex items-center gap-4 border-t border-brand-border bg-brand-alt p-3.5 px-5">
                  <div className="w-14 shrink-0 text-[13px] font-bold text-brand-muted">新</div>
                  <div className="flex flex-1 flex-col gap-1.5 sm:flex-row sm:items-center">
                    <Input
                      autoFocus
                      value={newItemDraft.itemName}
                      onChange={(e) => setNewItemDraft((d) => ({ ...d, itemName: e.target.value }))}
                      placeholder="항목명"
                      className="sm:flex-1"
                    />
                    <Input
                      value={newItemDraft.docReference}
                      onChange={(e) => setNewItemDraft((d) => ({ ...d, docReference: e.target.value }))}
                      placeholder="확인서류"
                      className="sm:w-[200px]"
                    />
                    {area.type !== "pass_fail" && (
                      <Input
                        type="number"
                        min={0}
                        value={newItemDraft.maxPoints}
                        onChange={(e) => setNewItemDraft((d) => ({ ...d, maxPoints: e.target.value }))}
                        placeholder="배점"
                        className="sm:w-[90px]"
                      />
                    )}
                  </div>
                  <button onClick={() => submitAddItem(area)} disabled={busy} className="shrink-0 text-brand-green">
                    <CheckCircle2 size={18} />
                  </button>
                  <button onClick={() => setAddingItemAreaCode(null)} className="shrink-0 text-brand-muted">
                    <X size={18} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => startAddItem(area)}
                  className="flex items-center justify-center gap-1.5 border-t border-brand-border p-3 text-[13px] font-bold text-brand hover:bg-brand-alt"
                >
                  <Plus size={14} />
                  항목 추가
                </button>
              )}
            </div>
          </section>
        );
      })}

      {/* 새 영역 추가 */}
      {addingArea ? (
        <section className="flex flex-col gap-4 rounded-card border-2 border-dashed border-brand-borderStrong bg-white/60 p-5">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label>영역명</Label>
              <Input
                autoFocus
                value={newAreaName}
                onChange={(e) => setNewAreaName(e.target.value)}
                placeholder="예) 부가서비스부문"
              />
            </div>
            <div className="flex w-full flex-col gap-1.5 sm:w-[200px]">
              <Label>항목 유형</Label>
              <Select value={newAreaType} onChange={(e) => setNewAreaType(e.target.value as CriteriaItemType)}>
                <option value="score">점수(score)</option>
                <option value="pass_fail">Pass/Fail 게이트</option>
                <option value="price">가격 자동계산(price)</option>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAddingArea(false)}>
              취소
            </Button>
            <Button onClick={submitAddArea} disabled={busy}>
              영역 추가
            </Button>
          </div>
        </section>
      ) : (
        <button
          onClick={() => setAddingArea(true)}
          className="flex items-center justify-center gap-2 rounded-card border-2 border-dashed border-brand-borderStrong p-5 text-sm font-bold text-brand transition-colors hover:border-brand hover:bg-white"
        >
          <Plus size={16} />
          새 평가 영역 추가
        </button>
      )}
    </div>
  );
}
