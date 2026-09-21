import Papa from "papaparse";
import type { AccessLevel, Confidence } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { IMPORT_TARGETS, type ImportTargetTable } from "./schemas";

export interface ImportRequest {
  destinationId: string;
  targetTable: ImportTargetTable;
  csvText: string;
  fileName: string;
  uploadedBy: string;
  dataSourceName: string;
  dataSourceOrganisation: string;
  geography: string;
  periodStart: Date;
  periodEnd: Date;
  confidence: Confidence;
  accessLevel: AccessLevel;
  notes?: string;
}

export interface RowRejection {
  rowNumber: number;
  errors: string[];
}

export interface ImportResult {
  importBatchId: string;
  rowCount: number;
  rejectedCount: number;
  rejections: RowRejection[];
}

/**
 * Parses, validates and commits a CSV import. Rejects the whole batch if
 * every row fails validation (nothing partially-written that a reviewer
 * didn't ask for); otherwise commits the valid rows and reports rejections
 * line-by-line rather than silently dropping them.
 */
export async function runImport(req: ImportRequest): Promise<ImportResult> {
  const target = IMPORT_TARGETS[req.targetTable];
  const parsed = Papa.parse<Record<string, string>>(req.csvText, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length > 0) {
    throw new Error(
      `CSV parse error: ${parsed.errors.map((e) => e.message).join("; ")}`
    );
  }

  const validRows: Record<string, unknown>[] = [];
  const rejections: RowRejection[] = [];

  parsed.data.forEach((row, index) => {
    const result = target.schema.safeParse(row);
    if (result.success) {
      validRows.push(result.data);
    } else {
      rejections.push({
        rowNumber: index + 2, // +1 for header row, +1 for 1-indexing
        errors: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
      });
    }
  });

  if (validRows.length === 0) {
    throw new Error(
      `No valid rows found. ${rejections.length} row(s) rejected: ` +
        rejections.slice(0, 5).map((r) => `line ${r.rowNumber}`).join(", ")
    );
  }

  const dataSource = await prisma.dataSource.upsert({
    where: {
      destinationId_name: {
        destinationId: req.destinationId,
        name: req.dataSourceName,
      },
    },
    update: {
      organisation: req.dataSourceOrganisation,
      dataType: req.targetTable,
    },
    create: {
      destinationId: req.destinationId,
      name: req.dataSourceName,
      organisation: req.dataSourceOrganisation,
      dataType: req.targetTable,
      defaultAccessLevel: req.accessLevel,
      connectorStatus: "MANUAL_IMPORT_ONLY",
    },
  });

  const governance = {
    geography: req.geography,
    periodStart: req.periodStart,
    periodEnd: req.periodEnd,
    confidence: req.confidence,
    accessLevel: req.accessLevel,
  };

  const importBatch = await prisma.$transaction(async (tx) => {
    switch (req.targetTable) {
      case "VisitorMetric":
        await tx.visitorMetric.createMany({
          data: validRows.map((r) => ({
            destinationId: req.destinationId,
            sourceId: dataSource.id,
            ...governance,
            ...(r as {
              metric: string;
              value: number;
              unit: string;
              originMarket?: string;
              isInternational?: boolean;
              visitorPurpose?: string;
            }),
          })),
        });
        break;
      case "AccommodationMetric":
        await tx.accommodationMetric.createMany({
          data: validRows.map((r) => ({
            destinationId: req.destinationId,
            sourceId: dataSource.id,
            ...governance,
            ...(r as {
              metric: string;
              value: number;
              unit: string;
              accommodationType?: string;
            }),
          })),
        });
        break;
      case "DemandSignal":
        await tx.demandSignal.createMany({
          data: validRows.map((r) => ({
            destinationId: req.destinationId,
            sourceId: dataSource.id,
            ...governance,
            ...(r as {
              signalType: string;
              topic: string;
              value: number;
              unit: string;
            }),
          })),
        });
        break;
    }

    return tx.importBatch.create({
      data: {
        destinationId: req.destinationId,
        dataSourceId: dataSource.id,
        targetTable: req.targetTable,
        uploadedBy: req.uploadedBy,
        fileName: req.fileName,
        rowCount: validRows.length,
        rejectedCount: rejections.length,
        geography: req.geography,
        periodStart: req.periodStart,
        periodEnd: req.periodEnd,
        confidence: req.confidence,
        accessLevel: req.accessLevel,
        notes: req.notes,
      },
    });
  });

  return {
    importBatchId: importBatch.id,
    rowCount: validRows.length,
    rejectedCount: rejections.length,
    rejections,
  };
}
