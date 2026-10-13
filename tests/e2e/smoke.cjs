/* eslint-disable @typescript-eslint/no-require-imports -- plain Node CommonJS script */
// End-to-end smoke test of the Phase 1 customer journey and isolation
// guarantees against a running server (uses a fresh pair of accounts each run).
//
//   PORT=3100 npm start          # in another terminal, against a seeded dev DB
//   BASE_URL=http://localhost:3100 node tests/e2e/smoke.cjs [screenshot-dir]
//
// Requires the `playwright` package (local or global install).
const path = require("path");
const fs = require("fs");
const os = require("os");
const { execSync } = require("child_process");
let playwright;
try {
  playwright = require("playwright");
} catch {
  playwright = require(path.join(execSync("npm root -g").toString().trim(), "playwright"));
}
const { chromium } = playwright;
const BASE = process.env.BASE_URL || "http://localhost:3100";
const SHOTS = process.argv[2] || fs.mkdtempSync(path.join(os.tmpdir(), "smoke-"));
const results = [];
const check = (name, ok, extra = "") => { results.push(`${ok ? "PASS" : "FAIL"} ${name} ${extra}`); };

(async () => {
  const browser = await chromium.launch();
  const stamp = Date.now();
  const ownerEmail = `owner${stamp}@example.com`;
  const otherEmail = `other${stamp}@example.com`;

  // --- Owner: sign up, create workspace
  const ctxA = await browser.newContext();
  const a = await ctxA.newPage();
  await a.goto(`${BASE}/app/anything`);
  check("unauthenticated workspace → login", a.url().includes("/login"), a.url());
  await a.goto(`${BASE}/`);
  await a.screenshot({ path: `${SHOTS}/01-landing.png`, fullPage: true });
  check("landing shows plans", (await a.textContent("body")).includes("Pilot"));

  await a.goto(`${BASE}/signup`);
  await a.fill("#f-name", "Aroha Owner");
  await a.fill("#f-email", ownerEmail);
  await a.fill("#f-password", "short");
  await a.click("button[type=submit]");
  await a.waitForSelector("text=Use at least 12 characters");
  check("weak password rejected server-side, input kept", (await a.inputValue("#f-email")) === ownerEmail);
  await a.fill("#f-password", "a sufficiently long passphrase");
  await a.click("button[type=submit]");
  await a.waitForURL("**/workspaces");
  const cookies = await ctxA.cookies();
  const sess = cookies.find((c) => c.name.includes("tip_session"));
  check("session cookie httpOnly + lax", sess && sess.httpOnly && sess.sameSite === "Lax", JSON.stringify(sess && { n: sess.name, h: sess.httpOnly, s: sess.sameSite }));

  await a.fill("#f-name", "Lakeside Adventures Ltd");
  await a.click("text=Create workspace");
  await a.waitForURL("**/app/lakeside-adventures-ltd**");
  const orgUrl = a.url().replace(/\/$/, "");
  await a.screenshot({ path: `${SHOTS}/02-overview-no-licence.png`, fullPage: true });
  check("no-licence banner", (await a.textContent("body")).includes("No licence yet"));

  // Website before licence → refused
  await a.goto(`${orgUrl}/integrations`);
  await a.fill("#f-domain", "lakeside.example.com");
  await a.click("text=Add website");
  await a.waitForSelector("p[role=alert]");
  check("connect refused without licence", (await a.textContent("p[role=alert]")).includes("active licence"));

  // Start pilot
  await a.goto(`${orgUrl}/settings/licence`);
  await a.click("text=Start 30-day pilot");
  await a.waitForSelector("text=Pilot ends");
  check("pilot started", true);

  // Profile
  await a.goto(`${orgUrl}/onboarding/profile`);
  await a.fill("#f-website", "not a url");
  await a.click("text=Save business profile");
  await a.waitForSelector("#f-website-err");
  check("profile URL validated", true);
  await a.fill("#f-website", "https://lakeside.example.com");
  await a.fill("#f-products", "Guided kayak tours\nGeothermal walks");
  await a.fill("#f-competitors", "Competitor A, Competitor B");
  await a.click("text=Save business profile");
  await a.waitForSelector("text=Business profile saved.");
  await a.reload();
  check("profile persisted", (await a.inputValue("#f-products")).includes("Geothermal walks"));
  await a.screenshot({ path: `${SHOTS}/03-profile.png`, fullPage: true });

  // Knowledge
  await a.goto(`${orgUrl}/onboarding/knowledge`);
  await a.fill("#f-culturalGuidelines", "Use correct macrons: Māori, Rotorua place names.");
  await a.click("text=Save business knowledge");
  await a.waitForSelector("text=Business knowledge saved.");
  check("knowledge saved", true);

  // Website connection
  await a.goto(`${orgUrl}/integrations`);
  await a.fill("#f-domain", "http://127.0.0.1");
  await a.click("text=Add website");
  await a.waitForSelector("text=Enter a public website domain");
  check("SSRF-style domain rejected", true);
  await a.fill("#f-domain", "https://Lakeside.Example.com/tours");
  await a.click("text=Add website");
  await a.waitForSelector("text=lakeside.example.com saved");
  await a.reload();
  await a.screenshot({ path: `${SHOTS}/04-connections.png`, fullPage: true });
  check("website connection listed", (await a.textContent("body")).includes("Saved — awaiting first sync"));

  // Brand
  await a.goto(`${orgUrl}/brands`);
  await a.fill("#f-name", "Lakeside Kayaks");
  await a.click("text=Add brand");
  await a.waitForSelector("text=Brand added.");
  await a.fill("#f-name", "Second Brand");
  await a.click("text=Add brand");
  await a.waitForSelector("p[role=alert]");
  check("brand limit enforced (pilot = 1)", (await a.textContent("p[role=alert]")).includes("allows up to 1"));

  // Validation + activation pages
  await a.goto(`${orgUrl}/onboarding/validation`);
  await a.click("text=I understand these limitations");
  await a.waitForSelector("text=Validation step recorded.");
  await a.goto(`${orgUrl}/onboarding/activation`);
  await a.screenshot({ path: `${SHOTS}/05-activation.png`, fullPage: true });
  check("activation disabled honestly", await a.isDisabled("text=Activate scheduled workflows"));

  // --- Other user: cannot see owner's workspace; cannot reach admin
  const ctxB = await browser.newContext();
  const b = await ctxB.newPage();
  await b.goto(`${BASE}/signup`);
  await b.fill("#f-name", "Other Person");
  await b.fill("#f-email", otherEmail);
  await b.fill("#f-password", "another long passphrase");
  await b.click("button[type=submit]");
  await b.waitForURL("**/workspaces");
  let r = await b.goto(orgUrl);
  check("non-member gets 404 for other tenant", r.status() === 404, String(r.status()));
  r = await b.goto(`${BASE}/admin`);
  check("customer gets 404 for /admin", r.status() === 404, String(r.status()));
  r = await b.goto(`${BASE}/destination`);
  check("customer gets 404 for /destination", r.status() === 404, String(r.status()));
  r = await b.request.get(`${BASE}/api/data-sources`);
  check("legacy data-sources API locked", r.status() === 404, String(r.status()));
  r = await b.request.post(`${BASE}/api/connectors/run`);
  check("legacy connector run API refused", r.status() === 403, String(r.status()));

  // Owner adds other as viewer; viewer can't edit
  await a.goto(`${orgUrl}/settings/team`);
  await a.fill("#f-email", otherEmail);
  await a.click("text=Add member");
  await a.waitForSelector("text=Member added.");
  r = await b.goto(orgUrl);
  check("viewer can open workspace after being added", r.status() === 200, String(r.status()));
  await b.goto(`${orgUrl}/onboarding/profile`);
  check("viewer sees no save button", (await b.locator("text=Save business profile").count()) === 0);

  // Logout invalidates session
  await a.goto(`${orgUrl}`);
  await a.click("text=Sign out");
  await a.waitForURL("**/login");
  await a.goto(orgUrl);
  check("after logout, redirected to login", a.url().includes("/login"));

  console.log(JSON.stringify({ ownerEmail, otherEmail, orgUrl }));
  console.log(results.join("\n"));
  await browser.close();
  if (results.some((r) => r.startsWith("FAIL"))) process.exit(1);
})().catch((e) => { console.log(results.join("\n")); console.error(e); process.exit(1); });
