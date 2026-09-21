// Nager.Date connector — free, keyless public holiday API.
// API contract: https://date.nager.at/api (GET /api/v3/PublicHolidays/{year}/{countryCode})
//
// Status: code-complete and contract-correct, but not exercised end-to-end
// in this build — this sandbox's outbound network policy blocks
// date.nager.at. See docs/CONNECTOR_STATUS.md.

import { prisma } from "@/lib/prisma";
import type { Connector, ConnectorContext, ConnectorRunResult } from "./types";

interface NagerHoliday {
  date: string;
  localName: string;
  name: string;
  countryCode: string;
  global: boolean;
  counties: string[] | null;
}

async function fetchHolidays(year: number, countryCode: string): Promise<NagerHoliday[]> {
  const res = await fetch(
    `https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode}`,
    { cache: "no-store" }
  );
  if (!res.ok) {
    throw new Error(`Nager.Date request failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export const holidaysConnector: Connector = {
  key: "nager-date",
  name: "Nager.Date",
  organisation: "date.nager.at",
  dataType: "public holidays",

  async run(ctx: ConnectorContext): Promise<ConnectorRunResult> {
    try {
      const thisYear = new Date().getFullYear();
      const [currentYear, nextYear] = await Promise.all([
        fetchHolidays(thisYear, "NZ"),
        fetchHolidays(thisYear + 1, "NZ"),
      ]);
      const holidays = [...currentYear, ...nextYear];

      const dataSource = await prisma.dataSource.upsert({
        where: { destinationId_name: { destinationId: ctx.destinationId, name: "Nager.Date" } },
        update: { connectorStatus: "CONNECTED" },
        create: {
          destinationId: ctx.destinationId,
          name: "Nager.Date",
          organisation: "date.nager.at",
          dataType: "public holidays",
          defaultAccessLevel: "PUBLIC",
          connectorStatus: "CONNECTED",
          connectorKey: "nager-date",
          url: "https://date.nager.at/",
        },
      });

      let rowsWritten = 0;
      for (const h of holidays) {
        const existing = await prisma.publicHoliday.findFirst({
          where: { destinationId: ctx.destinationId, name: h.name, date: new Date(h.date) },
        });
        if (existing) continue;

        await prisma.publicHoliday.create({
          data: {
            destinationId: ctx.destinationId,
            sourceId: dataSource.id,
            name: h.name,
            date: new Date(h.date),
            regional: !h.global,
            countiesOrRegions: h.counties ?? [],
            accessLevel: "PUBLIC",
            confidence: "VERIFIED",
          },
        });
        rowsWritten += 1;
      }

      return { ok: true, rowsWritten };
    } catch (err) {
      return {
        ok: false,
        rowsWritten: 0,
        error: err instanceof Error ? err.message : "Unknown connector error",
      };
    }
  },
};
