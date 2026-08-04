import { NextRequest, NextResponse } from "next/server";
import { exportReportCsv } from "../../backoffice/notas-fiscais/international-actions";

export async function GET(req: NextRequest) {
  const reportType = req.nextUrl.searchParams.get("type") ?? "landed_cost";
  try {
    const { csv, filename } = await exportReportCsv(reportType);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
