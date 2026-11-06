import { test, expect } from "@playwright/test";
import { dealRoles, newGroup, testSite } from "./helpers.js";

async function installed(page) {
  await page.waitForFunction(() => navigator.serviceWorker.controller);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
}

async function update(page) {
  return page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    const finished = new Promise((resolve) =>
      registration.addEventListener(
        "updatefound",
        () => {
          const worker = registration.installing;
          worker.addEventListener("statechange", () => {
            if (["installed", "redundant"].includes(worker.state)) resolve(worker.state);
          });
        },
        { once: true }
      )
    );
    await registration.update();
    return finished;
  });
}

test("an existing classic worker can install the update before any page refresh", async ({
  page,
  context
}) => {
  const site = await testSite({ legacy: true });
  try {
    let navigations = 0;
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) navigations++;
    });
    await page.goto(site.url);
    // The old app reloads on its first controllerchange. Wait for that documented
    // navigation rather than racing a page.evaluate against the outgoing document.
    await expect.poll(() => navigations).toBe(2);
    await page.waitForLoadState("load");
    await installed(page);
    await expect(page).toHaveTitle("Legacy Impostor");
    site.deploy("2");
    expect(await update(page)).toBe("installed");
    await expect(page).toHaveTitle("Legacy Impostor");
    const reload = page.waitForEvent("framenavigated", {
      predicate: (frame) => frame === page.mainFrame()
    });
    await page.evaluate(async () =>
      (await navigator.serviceWorker.getRegistration()).waiting.postMessage({
        type: "SKIP_WAITING"
      })
    );
    await reload;
    await page.waitForLoadState("load");
    await expect(page.locator("#appVersion")).toContainText("test-2");
    expect(await page.evaluate(() => caches.keys())).not.toContain("impostor-shell-legacy");
    await context.setOffline(true);
    await page.reload();
    await newGroup(page);
    await expect(page.locator("#handoff")).toBeVisible();
  } finally {
    await site.close();
  }
});

test("first installation does not reload and a complete round works offline under a subpath", async ({
  page,
  context
}) => {
  const site = await testSite();
  try {
    let navigations = 0;
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) navigations++;
    });
    await page.goto(site.url);
    await installed(page);
    expect(navigations).toBe(1);
    await context.setOffline(true);
    await page.reload();
    await newGroup(page);
    const roles = await dealRoles(page);
    await page.locator("#goToVoteBtn").click();
    await page.locator("#votePlayers input").nth(roles.imposters[0]).check();
    await page.locator("#showResultBtn").click();
    await expect(page.locator("#resultTitle")).toHaveText("Spillerne vant!");
    expect(await page.locator("#result").evaluate((el) => getComputedStyle(el).display)).toBe(
      "flex"
    );
  } finally {
    await site.close();
  }
});

test("updates wait through an active round, respect Later and preserve unrelated caches", async ({
  page,
  context
}) => {
  const site = await testSite();
  try {
    await page.goto(site.url);
    await installed(page);
    await page.evaluate(async () => {
      const cache = await caches.open("other-app-cache");
      await cache.put("/other-app", new Response("keep me"));
    });
    await newGroup(page);
    site.deploy("2");
    expect(await update(page)).toBe("installed");
    await expect(page.locator("#handoff")).toBeVisible();
    await expect(page.locator("#appMessage")).toBeHidden();
    const roles = await dealRoles(page);
    await page.locator("#goToVoteBtn").click();
    await page.locator("#votePlayers input").nth(roles.imposters[0]).check();
    await page.locator("#showResultBtn").click();
    await expect(page.locator("#appMessageTitle")).toHaveText("Ny versjon er klar");
    await page.locator("#appMessageSecondary").click();
    expect(
      await page.evaluate(
        async () => (await navigator.serviceWorker.getRegistration()).waiting?.state
      )
    ).toBe("installed");
    await page.locator("#result [data-settings]").click();
    await page.locator("#checkUpdatesBtn").click();
    await expect(page.locator("#appMessageTitle")).toHaveText("Ny versjon er klar");
    const reload = page.waitForEvent("framenavigated", {
      predicate: (frame) => frame === page.mainFrame()
    });
    await page.locator("#appMessagePrimary").click();
    await reload;
    await page.waitForLoadState("load");
    await expect(page.locator("#appVersion")).toContainText("test-2");
    const keys = await page.evaluate(() => caches.keys());
    expect(keys).toContain("other-app-cache");
    expect(keys).toContain("impostor-shell-test-2");
    expect(keys).not.toContain("impostor-shell-test-1");
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator("#resultTitle")).toHaveText("Spillerne vant!");
  } finally {
    await site.close();
  }
});

test("failed precache retains the installed version and its offline assets", async ({
  page,
  context
}) => {
  const site = await testSite();
  try {
    await page.goto(site.url);
    await installed(page);
    site.deploy("2", "/icon.svg");
    expect(await update(page)).toBe("redundant");
    await expect(page.locator("#appMessage")).toBeHidden();
    expect(await page.evaluate(() => caches.keys())).toContain("impostor-shell-test-1");
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator("#appVersion")).toContainText("test-1");
    await newGroup(page);
    await expect(page.locator("#handoff")).toBeVisible();
  } finally {
    await site.close();
  }
});

test("an update accepted in another tab does not reload an active round", async ({
  page,
  context
}) => {
  const site = await testSite();
  try {
    await page.goto(site.url);
    await installed(page);
    await newGroup(page);
    const other = await context.newPage();
    await other.goto(site.url);
    await installed(other);
    site.deploy("2");
    expect(await update(other)).toBe("installed");
    await expect(other.locator("#appMessageTitle")).toHaveText("Ny versjon er klar");
    let reloaded = false;
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) reloaded = true;
    });
    const reload = other.waitForEvent("framenavigated", {
      predicate: (frame) => frame === other.mainFrame()
    });
    await other.locator("#appMessagePrimary").click();
    await reload;
    await expect(page.locator("#handoff")).toBeVisible();
    expect(reloaded).toBe(false);
    await other.close();
  } finally {
    await site.close();
  }
});
