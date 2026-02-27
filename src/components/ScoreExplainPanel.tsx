"use client";

import { Info } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { riskFlagLabel } from "@/lib/riskFlags";

export interface ExplainComponentRow {
  key: string;
  label: string;
  value: number | string;
  weight: number;
  contribution: number;
}

export interface ExplainSectionView {
  score: number | null;
  formula: string;
  components: ExplainComponentRow[];
  reasons: string[];
  riskFlags: string[];
}

interface ScoreExplainPanelProps {
  title: string;
  section: ExplainSectionView;
}

function formatDisplayValue(value: number | string): string {
  if (typeof value === "string") return value;
  return Number.isFinite(value) ? value.toString() : "N/A";
}

function formatWeight(value: number): string {
  return Number(value).toFixed(2);
}

function formatContribution(value: number): string {
  return Number(value).toFixed(4);
}

export function ScoreExplainPanel({ title, section }: ScoreExplainPanelProps) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="h-7 w-7"
        aria-label={`${title} 計算說明`}
        onClick={() => setOpen((prev) => !prev)}
      >
        <Info className="h-4 w-4" />
      </Button>

      {open && (
        <div className="mt-3 space-y-3 rounded-md border bg-muted/20 p-3 text-xs">
          <div>
            <div className="mb-1 font-semibold">公式</div>
            <div className="rounded bg-background px-2 py-1 leading-relaxed">{section.formula || "N/A"}</div>
          </div>

          <div>
            <div className="mb-1 font-semibold text-neutral-300">組成項目</div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[360px] border-collapse">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-1 pr-2">項目</th>
                    <th className="py-1 pr-2">原始值</th>
                    <th className="py-1 pr-2">權重</th>
                    <th className="py-1 pr-2">貢獻</th>
                  </tr>
                </thead>
                <tbody>
                  {section.components.map((component) => (
                    <tr key={component.key} className="border-b/50">
                      <td className="py-1 pr-2">{component.label || component.key}</td>
                      <td className="py-1 pr-2">{formatDisplayValue(component.value)}</td>
                      <td className="py-1 pr-2">{formatWeight(component.weight)}</td>
                      <td className="py-1 pr-2">{formatContribution(component.contribution)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <div className="mb-1 font-semibold text-neutral-300">判定依據</div>
            <ul className="list-disc space-y-1 pl-4 text-neutral-400">
              {(section.reasons.length > 0 ? section.reasons : ["N/A"]).map((reason, index) => (
                <li key={`${reason}-${index}`}>{reason || "N/A"}</li>
              ))}
            </ul>
          </div>

          <div className="pt-2 border-t border-neutral-800">
            <div className="mb-1 font-semibold text-rose-400">風險標記</div>
            <ul className="list-disc space-y-1 pl-4 text-rose-300/80">
              {(section.riskFlags.length > 0 ? section.riskFlags : ["無"]).map((risk, index) => (
                <li key={`${risk}-${index}`}>{riskFlagLabel(risk)}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
