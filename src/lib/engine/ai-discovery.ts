// AI Destination Discovery Engine (docs/ARCHITECTURE.md §5).
//
// Runs the destination's tracked prompt bank against a configured LLM and
// stores each response verbatim. Structured extraction (mention position,
// which experiences/competitors were named, factual issues) is deliberately
// left for a human reviewer to annotate afterwards via the review endpoint
// — auto-extracting those judgment calls from free text would risk
// presenting a guess as a fact, which the brief forbids. Only
// `destinationMentioned` is computed automatically, and only as a plain
// substring check, not an inference.

import { prisma } from "@/lib/prisma";
import { callClaude, isLLMConfigured } from "@/lib/llm/anthropic";

export interface RunAIDiscoveryResult {
  ranChecks: number;
  skipped: boolean;
  reason?: string;
}

export async function runAIDiscovery(
  destinationId: string,
  destinationName: string
): Promise<RunAIDiscoveryResult> {
  if (!isLLMConfigured()) {
    return {
      ranChecks: 0,
      skipped: true,
      reason: "ANTHROPIC_API_KEY is not configured — nothing was run.",
    };
  }

  const dataSource = await prisma.dataSource.upsert({
    where: { destinationId_name: { destinationId, name: "AI Discovery Engine (Claude)" } },
    update: { connectorStatus: "CONNECTED" },
    create: {
      destinationId,
      name: "AI Discovery Engine (Claude)",
      organisation: "Anthropic",
      dataType: "AI destination discovery check",
      defaultAccessLevel: "PARTNER",
      connectorStatus: "CONNECTED",
      connectorKey: "ai-discovery-claude",
    },
  });

  const prompts = await prisma.trackedPrompt.findMany({
    where: { destinationId, active: true },
  });

  let ranChecks = 0;
  for (const prompt of prompts) {
    const model = "claude-sonnet-5";
    const responseText = await callClaude({
      userMessage: prompt.prompt,
      maxTokens: 1024,
      model,
    });

    const destinationMentioned = responseText
      .toLowerCase()
      .includes(destinationName.toLowerCase());

    await prisma.aIVisibilityCheck.create({
      data: {
        destinationId,
        sourceId: dataSource.id,
        promptId: prompt.id,
        aiSystem: model,
        rawResponse: responseText,
        destinationMentioned,
        mentionPosition: null,
        experiencesRecommended: [],
        competitorsMentioned: [],
        citedSources: [],
        factualIssues: [],
        confidence: "MODELLED",
        accessLevel: "PARTNER",
      },
    });
    ranChecks += 1;
  }

  return { ranChecks, skipped: false };
}
