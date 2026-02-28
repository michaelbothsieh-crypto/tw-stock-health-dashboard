import { SnapshotResponse } from "@/components/layout/types";

export type VerdictColor = "red" | "green" | "amber" | "slate";

export interface ActionPlaybook {
    /** 最終綜合評級 */
    verdict: string;
    /** 評級對應的語意色票 */
    verdictColor: VerdictColor;
    /** 具體操作 SOP，長度 2–3 */
    actionSteps: string[];
    /** 重要觀察對象，長度 1–2 */
    watchTargets: string[];
    /** 針對內部人轉讓的短評 (選填) */
    insiderComment?: string;
}

/**
 * 從 SnapshotResponse 推導出 ActionPlaybook。
 * 輸入已是伺服器端運算完畢的快照，本函式純粹做語意翻譯與步驟生成。
 */
export function generatePlaybook(snapshot: SnapshotResponse): ActionPlaybook {
    const { strategy, signals, consistency, crashWarning, keyLevels, predictions, shortTermVolatility } = snapshot;

    const trendScore = signals.trend.trendScore ?? 50;
    const flowScore = signals.flow.flowScore ?? 50;
    const confidence = strategy.confidence;
    const crashScore = crashWarning?.score ?? 0;
    const consistencyLevel = consistency.level;
    const direction = strategy.explain.direction;
    const marginChange = signals.flow.marginChange20D;

    // ── 1. 決定最終評級 ──────────────────────────────────────────────
    let verdict: string;
    let verdictColor: VerdictColor;

    if (crashScore >= 75) {
        verdict = "系統性風險規避";
        verdictColor = "green";
    } else if (direction === "偏多" && confidence >= 68 && consistencyLevel === "高一致性") {
        verdict = "強勢偏多";
        verdictColor = "red";
    } else if (direction === "偏多" && confidence >= 50) {
        verdict = "偏多觀察中";
        verdictColor = "red";
    } else if (direction === "偏空" && confidence >= 50) {
        verdict = "破線觀望";
        verdictColor = "green";
    } else if (direction === "偏空") {
        verdict = "偏空保守";
        verdictColor = "green";
    } else if (consistencyLevel === "低一致性") {
        verdict = "訊號分歧";
        verdictColor = "amber";
    } else {
        verdict = "區間震盪";
        verdictColor = "amber";
    }

    // ── 2. 生成操作 SOP ──────────────────────────────────────────────
    const actionSteps: string[] = [];

    if (crashScore >= 75) {
        actionSteps.push("1. 現金為王，全面降低持股比例至 20% 以下");
        actionSteps.push("2. 等待崩盤風險指標回落至 50 以下後再重新評估");
        actionSteps.push("3. 若已持有部位，逢反彈至壓力區立即減碼");
    } else if (verdict === "強勢偏多" || verdict === "偏多觀察中") {
        const support = keyLevels.supportLevel?.toFixed(1) ?? "--";
        const breakout = keyLevels.breakoutLevel?.toFixed(1) ?? "--";
        const isStrong = verdict === "強勢偏多";
        
        if (isStrong) {
            actionSteps.push(`1. 確認股價站穩月線支撐（${support} 元附近）後可分批佈局`);
        } else {
            actionSteps.push("1. 暫不主動加碼，等待一致性回升至中一致性以上");
        }

        if (marginChange !== null && marginChange > 5) {
            actionSteps.push("2. 留意融資大幅增加，控管槓桿，以現股優先");
        } else {
            actionSteps.push(`2. ${isStrong ? "等待" : "若"}突破轉強門檻（${breakout} 元）放量確認${isStrong ? "" : "後再介入"}`);
        }
        const stopLoss = keyLevels.invalidationLevel?.toFixed(1) ?? "--";
        actionSteps.push(`3. 嚴守失效門檻 ${stopLoss} 元為停損基準，跌破不戀戰`);
    } else if (verdict === "破線觀望" || verdict === "偏空保守") {
        actionSteps.push("1. 空手者繼續觀望，不進行任何多方佈局");
        actionSteps.push("2. 持有多單者逢反彈至月線壓力附近分批减碼");
        if (keyLevels.breakoutLevel) {
            actionSteps.push(`3. 重新翻多條件：站回 ${keyLevels.breakoutLevel.toFixed(1)} 元且成交量明顯放大`);
        }
    } else if (verdict === "訊號分歧") {
        actionSteps.push("1. 訊號分歧不是做多時機，保持空手或輕倉觀察");
        actionSteps.push("2. 等待技術面或籌碼面有一方出現明確方向再行動");
    } else {
        const support = keyLevels.supportLevel?.toFixed(1) ?? "--";
        const resistance = keyLevels.breakoutLevel?.toFixed(1) ?? "--";
        actionSteps.push(`1. 目前為區間整理格局，可於下緣（${support} 元）小量佈局`);
        actionSteps.push(`2. 靠近上緣（${resistance} 元）時分批獲利了結`);
    }

    // ── 3. 生成觀察重點 ──────────────────────────────────────────────
    const watchTargets: string[] = [];

    if (crashScore > 40 && crashScore < 75) {
        watchTargets.push(`留意系統風險指數（目前 ${crashScore.toFixed(0)}），若持續攀升至 75 須立刻降倉`);
    }

    if (watchTargets.length < 2) {
        const prob5d = predictions.upProb5D;
        if (flowScore < 45) {
            watchTargets.push("法人籌碼持續流出，緊盯外資是否出現連續買超訊號作為反轉參考");
        } else if (trendScore < 45) {
            watchTargets.push("技術面偏弱，觀察股價能否重新站回 20 日均線並確認量能配合");
        } else if (shortTermVolatility.volatilityScore > 70) {
            watchTargets.push(`波動性偏高（${shortTermVolatility.volatilityScore.toFixed(0)}%），注意隔夜跳空風險，勿持過重部位入夜`);
        } else if (prob5d > 60) {
            watchTargets.push(`5 日上漲機率 ${prob5d.toFixed(0)}% 偏高，可等待盤中回測短均後介入較安全`);
        } else {
            watchTargets.push("各指標均不極端，維持紀律，避免追高殺低");
        }
    }

    let insiderComment = "";
    if (snapshot.insiderTransfers && snapshot.insiderTransfers.length > 0) {
        const selling = snapshot.insiderTransfers.filter(t => t.type === "市場拋售");
        if (selling.length > 0) {
            const total = selling.reduce((s, i) => s + i.lots, 0);
            insiderComment = `大股東近期申報賣出共 ${total.toLocaleString()} 張，籌碼面出現防空訊號。`;
        }
    }

    return {
        verdict,
        verdictColor,
        actionSteps: actionSteps.slice(0, 3),
        watchTargets: watchTargets.slice(0, 2),
        insiderComment
    };
}
