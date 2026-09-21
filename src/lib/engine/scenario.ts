// Scenario Engine (docs/ARCHITECTURE.md §5).
//
// Grounds every answer in what's actually in Postgres for this destination.
// Never fills a gap with a plausible-sounding guess: the "insufficientData"
// list is populated from real zero-row categories, and the LLM (when
// configured) is instructed under an explicit system prompt not to invent
// statistics. Without a configured LLM, the engine still returns a fully
// grounded mechanical answer — just without narrative inference/
// recommendation text.

import { prisma } from "@/lib/prisma";
import { callClaude, isLLMConfigured } from "@/lib/llm/anthropic";

export interface ScenarioAnswer {
  facts: string[];
  evidence: string[];
  inferences: string[];
  hypotheses: string[];
  recommendations: string[];
  insufficientData: string[];
  llmAssisted: boolean;
}

interface CategorySummary {
  category: string;
  count: number;
  sources: string[];
}

async function summariseAvailableData(destinationId: string): Promise<CategorySummary[]> {
  const [
    visitorMetrics,
    accommodationMetrics,
    demandSignals,
    weatherForecasts,
    weatherObservations,
    publicHolidays,
    destinationEvents,
    capacityRecords,
    experiences,
  ] = await Promise.all([
    prisma.visitorMetric.findMany({ where: { destinationId }, include: { source: true } }),
    prisma.accommodationMetric.findMany({ where: { destinationId }, include: { source: true } }),
    prisma.demandSignal.findMany({ where: { destinationId }, include: { source: true } }),
    prisma.weatherForecast.findMany({ where: { destinationId }, include: { source: true } }),
    prisma.weatherObservation.findMany({ where: { destinationId }, include: { source: true } }),
    prisma.publicHoliday.findMany({ where: { destinationId }, include: { source: true } }),
    prisma.destinationEvent.findMany({ where: { destinationId }, include: { source: true } }),
    prisma.capacityRecord.findMany({ where: { destinationId }, include: { source: true } }),
    prisma.experience.findMany({ where: { destinationId }, include: { source: true, category: true } }),
  ]);

  const summarise = (label: string, rows: { source: { name: string } }[]): CategorySummary => ({
    category: label,
    count: rows.length,
    sources: [...new Set(rows.map((r) => r.source.name))],
  });

  return [
    summarise("Visitor metrics", visitorMetrics),
    summarise("Accommodation metrics", accommodationMetrics),
    summarise("Demand signals", demandSignals),
    summarise("Weather forecasts", weatherForecasts),
    summarise("Weather observations", weatherObservations),
    summarise("Public holidays", publicHolidays),
    summarise("Destination events", destinationEvents),
    summarise("Capacity records", capacityRecords),
    summarise("Experiences (reference)", experiences),
  ];
}

const SYSTEM_PROMPT = `You are a destination intelligence analyst for a visitor-economy platform.
You will be given a question and a JSON summary of the ONLY data currently
available for this destination (counts of rows by category and which
sources they came from). You must NEVER invent statistics, visitor numbers,
capacity figures, or behaviour that is not present in the JSON summary.
Respond with strict JSON only, no markdown fences, with these keys:
"facts" (string[] — plain restatements of what the JSON summary actually
contains, nothing more), "evidence" (string[] — which data source backs
each fact), "inferences" (string[] — reasoned interpretations clearly
derived from the facts, each explicitly marked as an inference in the
text), "hypotheses" (string[] — untested possibilities worth investigating,
explicitly marked as speculative), "recommendations" (string[] — concrete
next actions, each tied back to a fact or inference), "insufficientData"
(string[] — what additional data would be needed to answer the question
with confidence). If the available data cannot support any inference or
recommendation at all, say so plainly in those arrays rather than
speculating broadly.`;

export async function answerScenario(
  destinationId: string,
  question: string
): Promise<ScenarioAnswer> {
  const summary = await summariseAvailableData(destinationId);
  const emptyCategories = summary.filter((c) => c.count === 0);
  const populatedCategories = summary.filter((c) => c.count > 0);

  const mechanicalFacts = populatedCategories.map(
    (c) => `${c.category}: ${c.count} row(s) available.`
  );
  const mechanicalEvidence = populatedCategories.flatMap((c) =>
    c.sources.map((s) => `${c.category} sourced from: ${s}`)
  );
  const mechanicalInsufficient = emptyCategories.map(
    (c) => `No ${c.category.toLowerCase()} data has been connected or imported yet.`
  );

  if (!isLLMConfigured()) {
    return {
      facts: mechanicalFacts.length > 0 ? mechanicalFacts : ["No observation data is available yet for this destination."],
      evidence: mechanicalEvidence,
      inferences: [],
      hypotheses: [],
      recommendations: [
        "Configure ANTHROPIC_API_KEY to enable LLM-assisted structuring of inferences, hypotheses and recommendations from this data.",
      ],
      insufficientData: mechanicalInsufficient,
      llmAssisted: false,
    };
  }

  const userMessage = JSON.stringify({ question, availableData: summary });

  try {
    const raw = await callClaude({ system: SYSTEM_PROMPT, userMessage, maxTokens: 1500 });
    const parsed = JSON.parse(raw);
    return {
      facts: Array.isArray(parsed.facts) ? parsed.facts : mechanicalFacts,
      evidence: Array.isArray(parsed.evidence) ? parsed.evidence : mechanicalEvidence,
      inferences: Array.isArray(parsed.inferences) ? parsed.inferences : [],
      hypotheses: Array.isArray(parsed.hypotheses) ? parsed.hypotheses : [],
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
      insufficientData: Array.isArray(parsed.insufficientData)
        ? parsed.insufficientData
        : mechanicalInsufficient,
      llmAssisted: true,
    };
  } catch {
    // LLM call or JSON parse failed — fall back to the mechanical, fully
    // grounded answer rather than surfacing a broken/partial LLM response.
    return {
      facts: mechanicalFacts.length > 0 ? mechanicalFacts : ["No observation data is available yet for this destination."],
      evidence: mechanicalEvidence,
      inferences: [],
      hypotheses: [],
      recommendations: [],
      insufficientData: [
        ...mechanicalInsufficient,
        "The LLM-assisted structuring step failed for this request — see server logs.",
      ],
      llmAssisted: false,
    };
  }
}
