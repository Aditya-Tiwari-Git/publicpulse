import { test, expect } from "@playwright/test";
async function enter(page: import("@playwright/test").Page, role = "admin") {
  await page.goto("/");
  if (role === "surveyor")
    await page
      .getByRole("button", { name: "Field surveyor", exact: true })
      .click();
  await page.getByRole("button", { name: `Explore ${role} demo` }).click();
}
async function go(page: import("@playwright/test").Page, path: string) {
  await page.evaluate((path) => {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, path);
}
test("workspace renders without runtime errors or horizontal overflow", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await enter(page);
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `artifacts/overview-${info.project.name}.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
test("public survey works without workspace login and stays within the mobile viewport", async ({ page }, info) => {
  const calls: string[] = [];
  await page.route("https://publicpulse-e2e.supabase.co/functions/v1/api", async (route) => {
    const body = route.request().postDataJSON();
    calls.push(body.action);
    if (body.action === "public-survey") return route.fulfill({ json: { survey: {
      id: "10000000-0000-4000-8000-000000000001", title: "Community services survey", description: "A short voluntary survey.", status: "published", version: 1,
      questions: [
        { id: "consent", type: "single", label: "May I ask a few questions?", hi: "क्या मैं कुछ प्रश्न पूछ सकता/सकती हूँ?", options: ["I agree to participate", "I decline"], required: true, section: "Consent" },
        { id: "state", type: "geography", label: "State or Union Territory", hi: "राज्य या केंद्र शासित प्रदेश", required: true, section: "Area" },
        { id: "district", type: "geography", label: "District", hi: "ज़िला", required: true, section: "Area" },
      ], rules: [],
    }, geographies: [
      { id: "20000000-0000-4000-8000-000000000001", name: "Test UT", level: "state", parent_id: null },
      { id: "20000000-0000-4000-8000-000000000002", name: "Test District", level: "district", parent_id: "20000000-0000-4000-8000-000000000001" },
    ] } });
    if (body.action === "submit-public-response") return route.fulfill({ json: { ok: true } });
    return route.fulfill({ status: 400, json: { error: "Unexpected e2e action" } });
  });
  await page.goto("/survey/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
  await expect(page.getByRole("heading", { name: "Community services survey" })).toBeVisible();
  await page.getByRole("radio", { name: "I agree to participate" }).check();
  await page.locator("select").nth(0).selectOption({ label: "Test UT" });
  await page.locator("select").nth(1).selectOption({ label: "Test District" });
  await page.getByRole("button", { name: "Review answers" }).click();
  await page.getByRole("button", { name: "Submit response" }).click();
  await expect(page.getByRole("heading", { name: "Thank you" })).toBeVisible();
  expect(calls.filter((x) => x === "public-survey").length).toBeGreaterThanOrEqual(1);
  expect(calls.filter((x) => x === "submit-public-response")).toHaveLength(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
test("admin creates a one-time public URL and downloadable QR code", async ({ page }) => {
  await page.route("https://publicpulse-e2e.supabase.co/functions/v1/api", async (route) => {
    const body = route.request().postDataJSON();
    if (body.action === "list-public-links") return route.fulfill({ json: [] });
    if (body.action === "create-public-link") return route.fulfill({ json: { ok: true } });
    return route.fulfill({ status: 400, json: { error: "Unexpected e2e action" } });
  });
  await enter(page);
  await go(page, "/surveys");
  await page.getByRole("button", { name: "Create public link", exact: true }).first().click();
  await page.getByRole("button", { name: "Generate secure link", exact: true }).click();
  await expect(page.getByRole("img", { name: "QR code for the public survey" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Download QR code" })).toBeVisible();
  await expect(page.getByLabel("Public URL")).toHaveValue(/\/survey\/[A-Za-z0-9_-]{43}$/);
});
test("admin can inspect insights, publish a survey version, and save a dashboard", async ({
  page,
}) => {
  await enter(page);
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Total responses", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Create survey", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Survey builder", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Survey title", exact: true })
    .fill("Market services pulse");
  await page.getByRole("button", { name: "Short text", exact: true }).click();
  await page
    .getByRole("button", { name: "Publish version", exact: true })
    .click();
  await expect(
    page.getByText("Survey published as version 1", { exact: true }),
  ).toBeVisible();
  await go(page, "/dashboards");
  await expect(
    page.getByRole("heading", { name: "Dashboard studio" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add widget", exact: true }).click();
  await page.getByLabel("Widget title").fill("Community count");
  await page.getByLabel("Chart type").selectOption("kpi");
  await page.getByRole("button", { name: "Apply widget" }).click();
  await page.getByRole("button", { name: "Save layout" }).click();
  await expect(
    page.getByText("Dashboard layout saved", { exact: true }),
  ).toBeVisible();
  const menu = page.getByRole("button", { name: "Open navigation" });
  if (await menu.isVisible()) await menu.click();
  await page.getByTitle("Sign out").click();
  await expect(
    page.getByRole("heading", { name: "Let’s listen better." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Explore admin demo" }).click();
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
});
test("surveyor gets only assigned collection, can decline, and cannot open admin modules", async ({
  page,
}) => {
  await enter(page, "surveyor");
  await expect(
    page.getByRole("heading", { name: "Hello, Priya." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Start interview" }).first().click();
  await expect(page.getByText("Consent", { exact: true })).toBeVisible();
  await page.getByText("I decline", { exact: true }).click();
  await page.getByRole("button", { name: "Record decline" }).click();
  await expect(
    page.getByRole("heading", { name: "Thank you for listening." }),
  ).toBeVisible();
  await go(page, "/users");
  await expect(
    page.getByRole("heading", { name: "Hello, Priya." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Field team", exact: true }),
  ).not.toBeVisible();
});
test("required validation, bilingual collection and offline queue survive navigation", async ({
  page,
  context,
}) => {
  await enter(page, "surveyor");
  await page.getByRole("button", { name: "Start interview" }).first().click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByText("This question is required.")).toBeVisible();
  await page.getByRole("button", { name: "हिन्दी" }).click();
  await expect(
    page.getByText(
      "क्या मैं आपके क्षेत्र की सार्वजनिक सेवाओं के बारे में कुछ प्रश्न पूछ सकता/सकती हूँ?",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "English", exact: true }).click();
  await page.getByText("I decline", { exact: true }).click();
  await context.setOffline(true);
  await page.getByRole("button", { name: "Record decline" }).click();
  await expect(
    page.getByRole("heading", { name: "Safely saved on this device." }),
  ).toBeVisible();
  await context.setOffline(false);
  await go(page, "/sync");
  await expect(page.getByText("pending", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sync pending interviews" }).click();
  await expect(page.getByText("synced", { exact: true })).toBeVisible();
});
test("surveyor completes a consented branched interview and reviews before submission", async ({
  page,
}) => {
  await enter(page, "surveyor");
  await page.getByRole("button", { name: "Start interview" }).first().click();
  await page.getByText("I agree to participate", { exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByLabel("State or Union Territory", { exact: true })
    .selectOption("Maharashtra");
  await page.getByLabel("District", { exact: true }).selectOption("Pune");
  await page.getByRole("radio", { name: "Urban", exact: true }).check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("checkbox", { name: "Roads", exact: true }).check();
  await page.getByRole("radio", { name: "Roads", exact: true }).check();
  await expect(
    page.getByText("What road issue have you experienced?", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("What type of water problem?", { exact: true }),
  ).not.toBeVisible();
  await page.getByRole("checkbox", { name: "Potholes", exact: true }).check();
  await page.getByRole("button", { name: "5 out of 5", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("radio", { name: "Somewhat satisfied", exact: true })
    .first()
    .check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("radio", { name: "No", exact: true }).check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("button", { name: "Review answers", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Let’s check the details." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Confirm & submit", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Thank you for listening." }),
  ).toBeVisible();
  await go(page, "/history");
  await expect(
    page.getByRole("heading", { name: "Your survey history" }),
  ).toBeVisible();
});
