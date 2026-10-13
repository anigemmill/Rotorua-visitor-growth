// The Tourism Intelligence agent register. This is the authoritative,
// versioned definition of each agent's responsibilities and boundaries; the
// orchestration layer (Phase 3) executes workflows against it and the
// customer-facing Ecosystem page renders it so customers can see exactly what
// runs, on what data, and what needs their approval.
//
// Agents are code-controlled workflow steps with typed inputs/outputs — not
// free-roaming chat agents. They never call each other directly: the
// orchestrator routes work between them (docs/platform/AGENT_REGISTER.md).

import type { ProviderKey } from "@/lib/integrations/types";

export type AgentKey =
  | "master"
  | "website"
  | "search_visibility"
  | "social"
  | "trend"
  | "paid_campaigns"
  | "content_strategy"
  | "visitor_growth"
  | "pricing_revenue"
  | "results_learning"
  | "chief_of_staff";

export interface AgentDefinition {
  key: AgentKey;
  name: string;
  purpose: string;
  inputs: string[];
  outputs: string[];
  dependsOn: AgentKey[];
  /** Data the agent may read. Agents never hold provider credentials. */
  dataAccess: string[];
  /** Tools beyond read-only tenant data (e.g. web research). */
  tools: string[];
  /** Integrations that materially improve it; `requiredAny` means at least one is needed to run. */
  integrations: { requiredAny: ProviderKey[]; optional: ProviderKey[] };
  triggers: string[];
  /** Actions that always need human approval before anything happens. */
  approvalRequiredFor: string[];
  evaluation: string[];
  failureConditions: string[];
  plannedPhase: number;
}

export const EVIDENCE_LABELS = ["FACT", "INTERPRETATION", "RECOMMENDATION", "UNKNOWN"] as const;

export const WORKFLOW_STAGES = [
  "COLLECT",
  "VALIDATE",
  "DETECT",
  "INVESTIGATE",
  "VERIFY",
  "SYNTHESISE",
  "PRIORITISE",
  "RECOMMEND",
  "APPROVE",
  "MEASURE",
  "LEARN",
] as const;

const COMMON_FAILURES = [
  "Required data source disconnected, stale beyond its freshness threshold, or missing required metrics",
  "Model output fails schema validation after one repair attempt",
  "Any material claim lacks a source reference",
];

export const AGENTS: AgentDefinition[] = [
  {
    key: "master",
    name: "Master Intelligence",
    purpose: "Coordinates the ecosystem and maintains an evidence-based view of business performance.",
    inputs: ["Validated findings from specialist agents", "KPI baselines", "Open actions and outcomes"],
    outputs: ["Executive intelligence brief", "Investigation requests to specialists", "Escalations", "Information-gap list"],
    dependsOn: ["website", "search_visibility", "social", "trend", "paid_campaigns", "visitor_growth", "pricing_revenue"],
    dataAccess: ["Agent findings (this workspace)", "Business profile & knowledge", "KPI baselines"],
    tools: [],
    integrations: { requiredAny: ["website", "ga4", "search_console"], optional: [] },
    triggers: ["Weekly intelligence cycle", "Significant-change alert from a specialist"],
    approvalRequiredFor: [],
    evaluation: [
      "Every brief item traces to at least one specialist finding with sources",
      "No duplicated findings across sections",
      "Gaps are reported, not filled with assumptions",
    ],
    failureConditions: [...COMMON_FAILURES, "Fewer than one specialist produced a validated finding this cycle"],
    plannedPhase: 3,
  },
  {
    key: "website",
    name: "Website Intelligence",
    purpose: "Finds website issues and opportunities that affect engagement and conversion.",
    inputs: ["Crawl inventory & technical issues", "GA4 landing-page performance", "Search Console page data"],
    outputs: ["Technical issue list", "Booking-friction findings", "Improvements ranked by impact and effort"],
    dependsOn: [],
    dataAccess: ["Website inventory", "GA4 observations", "Search Console observations"],
    tools: [],
    integrations: { requiredAny: ["website"], optional: ["ga4", "search_console"] },
    triggers: ["After each website crawl", "Weekly cycle"],
    approvalRequiredFor: ["Any change to the customer's website (out of scope for initial release)"],
    evaluation: ["Broken-link and metadata findings match crawl ground truth on fixture sites", "Impact estimates labelled as estimates"],
    failureConditions: [...COMMON_FAILURES],
    plannedPhase: 3,
  },
  {
    key: "search_visibility",
    name: "Search & AI Visibility Intelligence",
    purpose: "Improves discoverability through search engines and AI-assisted discovery.",
    inputs: ["Search Console queries and pages", "Crawl inventory & structured data", "Tracked AI-discovery prompts"],
    outputs: ["Query and content gaps", "Structured-data and crawlability issues", "Evidence-based content recommendations"],
    dependsOn: [],
    dataAccess: ["Search Console observations", "Website inventory", "AI-discovery check results"],
    tools: ["Web search (public sources, allow-listed)"],
    integrations: { requiredAny: ["search_console", "website"], optional: ["ga4"] },
    triggers: ["Weekly cycle"],
    approvalRequiredFor: [],
    evaluation: [
      "AI visibility statements are labelled observed-sample vs. unmeasurable — never presented as rankings",
      "Query gaps verified against Search Console data",
    ],
    failureConditions: [...COMMON_FAILURES],
    plannedPhase: 3,
  },
  {
    key: "social",
    name: "Social Intelligence",
    purpose: "Measures connected-account social performance and identifies content opportunities.",
    inputs: ["Connected-account post and profile metrics", "Previous hypotheses and outcomes"],
    outputs: ["Theme and format performance", "Engagement-change alerts", "Content experiments"],
    dependsOn: [],
    dataAccess: ["Connected social observations"],
    tools: [],
    integrations: { requiredAny: ["instagram", "facebook_pages", "youtube"], optional: [] },
    triggers: ["Weekly cycle"],
    approvalRequiredFor: ["Publishing anything (future capability)"],
    evaluation: ["Only connected-account metrics are reported as metrics; public observations labelled as such"],
    failureConditions: [...COMMON_FAILURES],
    plannedPhase: 4,
  },
  {
    key: "trend",
    name: "Trend Intelligence",
    purpose: "Identifies timely, relevant tourism trends and opportunities from permitted public sources.",
    inputs: ["Business profile & audiences", "Permitted public sources"],
    outputs: ["Dated, sourced trend findings", "Act / watch / ignore recommendation per opportunity"],
    dependsOn: [],
    dataAccess: ["Business profile & knowledge"],
    tools: ["Web search", "Web fetch (untrusted content, isolated from instructions)"],
    integrations: { requiredAny: [], optional: [] },
    triggers: ["Weekly cycle"],
    approvalRequiredFor: [],
    evaluation: ["Every trend has a dated, credible source", "Speculation labelled INTERPRETATION or UNKNOWN"],
    failureConditions: [...COMMON_FAILURES, "Source content attempts to issue instructions (logged, discarded)"],
    plannedPhase: 3,
  },
  {
    key: "paid_campaigns",
    name: "Paid Campaign Intelligence",
    purpose: "Evaluates Google Ads and Meta Ads performance.",
    inputs: ["Ads spend, clicks, conversions, value", "Attribution settings per platform"],
    outputs: ["Material change alerts", "Tracking anomalies", "Recommended investigations and tests"],
    dependsOn: [],
    dataAccess: ["Google Ads observations", "Meta Ads observations"],
    tools: [],
    integrations: { requiredAny: ["google_ads", "meta_ads"], optional: ["ga4"] },
    triggers: ["Daily anomaly check", "Weekly cycle"],
    approvalRequiredFor: ["Any campaign, bid or budget change (not supported in initial release)"],
    evaluation: ["Never sums conversions across platforms with different attribution", "Anomaly detection tested on fixtures"],
    failureConditions: [...COMMON_FAILURES],
    plannedPhase: 4,
  },
  {
    key: "content_strategy",
    name: "Content Strategy Intelligence",
    purpose: "Turns verified intelligence into content plans, briefs and calendars.",
    inputs: ["Verified findings", "Audiences & objectives", "Brand tone, restrictions and cultural guidelines"],
    outputs: ["Content briefs", "Content calendar", "Mapping to pages and campaigns"],
    dependsOn: ["website", "search_visibility"],
    dataAccess: ["Agent findings", "Business knowledge"],
    tools: [],
    integrations: { requiredAny: ["website", "search_console"], optional: ["instagram", "youtube"] },
    triggers: ["After weekly synthesis"],
    approvalRequiredFor: ["Publishing any content"],
    evaluation: ["Briefs respect brand restrictions and cultural guidelines", "Each brief links to the finding that motivated it"],
    failureConditions: [...COMMON_FAILURES],
    plannedPhase: 3,
  },
  {
    key: "visitor_growth",
    name: "Visitor Growth Intelligence",
    purpose: "Identifies evidence-based opportunities to grow visitor numbers and bookings.",
    inputs: ["Search, website, campaign and booking findings", "Seasonal history"],
    outputs: ["Opportunities ranked by impact, effort and confidence", "Measurable experiments"],
    dependsOn: ["website", "search_visibility", "paid_campaigns"],
    dataAccess: ["Agent findings", "Booking observations (when connected)"],
    tools: [],
    integrations: { requiredAny: ["ga4", "booking_rezdy", "booking_csv"], optional: ["search_console", "google_ads"] },
    triggers: ["Weekly cycle"],
    approvalRequiredFor: [],
    evaluation: ["Distinguishes attributed bookings from bookings merely observed in the same period"],
    failureConditions: [...COMMON_FAILURES],
    plannedPhase: 5,
  },
  {
    key: "pricing_revenue",
    name: "Pricing & Revenue Intelligence",
    purpose: "Supports evidence-based pricing and commercial decisions.",
    inputs: ["Booking revenue, product mix, dates", "Cancellations and refunds"],
    outputs: ["Demand patterns (where data suffices)", "Pricing opportunities for review", "Tests with measurement criteria"],
    dependsOn: [],
    dataAccess: ["Booking observations"],
    tools: [],
    integrations: { requiredAny: ["booking_rezdy", "booking_csv"], optional: [] },
    triggers: ["Weekly cycle (only when booking data is connected)"],
    approvalRequiredFor: ["Any price change — never automated"],
    evaluation: ["Correlation never presented as causation", "Minimum sample sizes enforced before stating patterns"],
    failureConditions: [...COMMON_FAILURES],
    plannedPhase: 5,
  },
  {
    key: "results_learning",
    name: "Results & Learning",
    purpose: "Measures outcomes of approved actions and improves future recommendations.",
    inputs: ["Action register", "KPI baselines", "Post-implementation metrics"],
    outputs: ["Outcome measurements vs. baseline", "Lessons and data limitations", "Workflow improvement suggestions"],
    dependsOn: [],
    dataAccess: ["Action register", "All observations (this workspace)"],
    tools: [],
    integrations: { requiredAny: ["ga4", "search_console"], optional: [] },
    triggers: ["When an action's measurement window closes"],
    approvalRequiredFor: [],
    evaluation: ["Never marks an action successful without measured evidence against a stated baseline"],
    failureConditions: [...COMMON_FAILURES],
    plannedPhase: 3,
  },
  {
    key: "chief_of_staff",
    name: "Chief of Staff (Action Prioritisation)",
    purpose: "Turns findings into a practical, prioritised action plan.",
    inputs: ["Synthesised findings", "Constraints and objectives"],
    outputs: [
      "Prioritised actions with evidence, relevance, confidence, impact, effort, urgency, dependencies, next step and measurement",
    ],
    dependsOn: ["master"],
    dataAccess: ["Agent findings", "Action register", "Business profile"],
    tools: [],
    integrations: { requiredAny: [], optional: [] },
    triggers: ["After Master Intelligence synthesis"],
    approvalRequiredFor: ["Moving any action to Approved"],
    evaluation: ["Every action has all ten required fields", "Impact always labelled as an estimate"],
    failureConditions: [...COMMON_FAILURES],
    plannedPhase: 3,
  },
];

export function getAgent(key: AgentKey): AgentDefinition {
  return AGENTS.find((a) => a.key === key)!;
}
