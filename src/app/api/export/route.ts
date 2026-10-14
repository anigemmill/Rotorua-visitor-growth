import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser, isStaff } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { toCsv } from "@/lib/csv";
import { EXPORTS, type ExportKey } from "@/lib/export";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !isStaff(user)) return NextResponse.json({ error: "Programme staff only." }, { status: 403 });
  const entity = req.nextUrl.searchParams.get("entity") ?? "";
  const format = req.nextUrl.searchParams.get("format") === "json" ? "json" : "csv";
  const stamp = new Date().toISOString().slice(0, 10);

  if (entity === "all") {
    const keys = (Object.keys(EXPORTS) as ExportKey[]).filter((k) => !EXPORTS[k].founderOnly || user.role === "FOUNDER");
    const data: Record<string, unknown> = { exportedAt: new Date().toISOString(), exportedBy: user.email, currency: "NZD excl. GST" };
    for (const k of keys) data[k] = await EXPORTS[k].load();
    await audit(user.id, "export", "all", null, `Full JSON export (${keys.length} datasets)`);
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: { "content-type": "application/json", "content-disposition": `attachment; filename="growth-os-export-${stamp}.json"`, "cache-control": "no-store" },
    });
  }

  if (!(entity in EXPORTS)) return NextResponse.json({ error: "Unknown dataset." }, { status: 400 });
  const def = EXPORTS[entity as ExportKey];
  if (def.founderOnly && user.role !== "FOUNDER") return NextResponse.json({ error: "Founder only." }, { status: 403 });
  const rows = (await def.load()) as Record<string, unknown>[];
  await audit(user.id, "export", entity, null, `Exported ${rows.length} ${entity} rows as ${format}`);
  const body = format === "json" ? JSON.stringify(rows, null, 2) : toCsv(rows);
  return new NextResponse(body, {
    headers: {
      "content-type": format === "json" ? "application/json" : "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${entity}-${stamp}.${format}"`,
      "cache-control": "no-store",
    },
  });
}
