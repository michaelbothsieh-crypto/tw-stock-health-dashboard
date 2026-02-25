import { NextResponse } from "next/server";

export async function GET() {
    const latestReport = global._latestReport;

    if (!latestReport) {
        return NextResponse.json({ error: "No report generated yet." }, { status: 404 });
    }

    return NextResponse.json(latestReport);
}
