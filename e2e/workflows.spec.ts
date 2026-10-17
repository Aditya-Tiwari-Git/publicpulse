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
      "क्या हम आपके क्षेत्र की सार्वजनिक सेवाओं के बारे में कुछ प्रश्न पूछ सकते हैं?",
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
    .getByLabel("State / Union Territory", { exact: true })
    .selectOption("Maharashtra");
  await page.getByLabel("District", { exact: true }).selectOption("Pune");
  await page.getByRole("radio", { name: "Urban", exact: true }).check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("checkbox", { name: "Roads", exact: true }).check();
  await page.getByRole("radio", { name: "Roads", exact: true }).check();
  await expect(
    page.getByText("What type of road problem?", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("What type of water problem?", { exact: true }),
  ).not.toBeVisible();
  await page.getByRole("checkbox", { name: "Potholes", exact: true }).check();
  await page.getByRole("radio", { name: "Very serious", exact: true }).check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("radio", { name: "Somewhat satisfied", exact: true })
    .first()
    .check();
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
