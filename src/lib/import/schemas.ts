import { z } from "zod";

// Per-target-table row schemas for the manual CSV import pipeline
// (docs/ARCHITECTURE.md §4). Governance metadata (source, geography, time
// period, confidence, access level) is supplied once per batch by the
// uploading operator, not per row — see ImportBatch in prisma/schema.prisma.

const numeric = z.coerce.number().finite();
const optionalString = z
  .string()
  .optional()
  .transform((v) => (v === "" ? undefined : v));
const optionalBoolean = z
  .string()
  .optional()
  .transform((v) => {
    if (v === undefined || v === "") return undefined;
    return v.trim().toLowerCase() === "true" || v.trim() === "1";
  });

export const visitorMetricRowSchema = z.object({
  metric: z.string().min(1),
  value: numeric,
  unit: z.string().min(1),
  originMarket: optionalString,
  isInternational: optionalBoolean,
  visitorPurpose: optionalString,
});

export const accommodationMetricRowSchema = z.object({
  metric: z.string().min(1),
  value: numeric,
  unit: z.string().min(1),
  accommodationType: optionalString,
});

export const demandSignalRowSchema = z.object({
  signalType: z.string().min(1),
  topic: z.string().min(1),
  value: numeric,
  unit: z.string().min(1),
});

export const IMPORT_TARGETS = {
  VisitorMetric: {
    label: "Visitor metrics",
    schema: visitorMetricRowSchema,
    columns: ["metric", "value", "unit", "originMarket", "isInternational", "visitorPurpose"],
    example: "metric,value,unit,originMarket,isInternational,visitorPurpose\nvisitor_volume,12400,count,Australia,true,leisure",
  },
  AccommodationMetric: {
    label: "Accommodation metrics",
    schema: accommodationMetricRowSchema,
    columns: ["metric", "value", "unit", "accommodationType"],
    example: "metric,value,unit,accommodationType\noccupancy_rate,0.62,ratio,hotel",
  },
  DemandSignal: {
    label: "Demand signals",
    schema: demandSignalRowSchema,
    columns: ["signalType", "topic", "value", "unit"],
    example: "signalType,topic,value,unit\nsearch_trend,geothermal spa,78,index_0_100",
  },
} as const;

export type ImportTargetTable = keyof typeof IMPORT_TARGETS;
