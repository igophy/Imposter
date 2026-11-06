import { test, expect } from "@playwright/test";
import { dealRoles, newGroup } from "./helpers.js";

for (const [count, imposters] of [
  [3, 1],
  [7, 2],
  [10, 3],
  [15, 3]
]) {
  test(`complete round and replay: ${count} players, ${imposters} imposters`, async ({ page }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    await newGroup(page, count, imposters);
    const roles = await dealRoles(page, count);
    expect(roles.imposters).toHaveLength(imposters);
    await expect(page.locator("#play")).toBeVisible();
    await page.locator("#goToVoteBtn").click();
    await expect(page.locator("#showResultBtn")).toBeDisabled();
    for (const index of roles.imposters)
      await page.locator("#votePlayers input").nth(index).check();
    await page.locator("#showResultBtn").click();
    await expect(page.locator("#resultTitle")).toHaveText("Spillerne vant!");
    await expect(page.locator("#resultWord")).toHaveText(new RegExp(roles.word, "i"));
    await page.locator("#samePlayersBtn").click();
    await expect(page.locator("#handoff")).toBeVisible();
    const nextRoles = await dealRoles(page, count);
    expect(nextRoles.word).not.toBe(roles.word);
    expect(errors).toEqual([]);
  });
}

test("draft names survive back navigation and group size changes", async ({ page }) => {
  await page.goto("/");
  await page.locator("#goToNamesBtn").click();
  await page.locator("#player-0").fill("Åse");
  await page.locator("#player-3").fill("Bjørn");
  await page.locator("#backToSetupBtn").click();
  await page.locator("#playerCount").fill("3");
  await page.locator("#goToNamesBtn").click();
  await expect(page.locator("#player-0")).toHaveValue("Åse");
  await page.locator("#backToSetupBtn").click();
  await page.locator("#playerCount").fill("4");
  await page.locator("#goToNamesBtn").click();
  await expect(page.locator("#player-3")).toHaveValue("Bjørn");
});

test("duplicate names are rejected and HTML-looking names remain plain text", async ({ page }) => {
  await page.goto("/");
  await page.locator("#goToNamesBtn").click();
  await page.locator("#player-0").fill("Ada");
  await page.locator("#player-1").fill("ada");
  await page.locator("#startGameBtn").click();
  await expect(page.locator("#toast")).toContainText("ulike navn");
  const markup = '<b data-injected="yes">Ada</b>';
  await page.locator("#player-0").fill(markup);
  await page.locator("#player-1").fill("Bjørn");
  await page.locator("#startGameBtn").click();
  await expect(page.locator("#handoffName")).toHaveText(markup);
  await page.locator("#confirmPlayerBtn").click();
  await page.locator("#toggleRevealBtn").click();
  await expect(page.locator("#secretBox")).toContainText(markup);
  await expect(page.locator("[data-injected]")).toHaveCount(0);
});

test("hold can be repeated; focus and app loss always hide the secret", async ({ page }) => {
  await page.goto("/");
  await newGroup(page);
  await page.locator("#confirmPlayerBtn").click();
  await expect(page.locator("#nextPlayerBtn")).toBeHidden();
  const hold = page.locator("#holdRevealBtn");
  await hold.focus();
  await page.keyboard.down("Enter");
  await expect(page.locator("#secretBox .secret-word")).toBeVisible();
  await page.keyboard.press("Tab");
  await page.keyboard.up("Enter");
  await expect(page.locator("#secretBox .secret-word")).toHaveCount(0);
  await expect(page.locator("#nextPlayerBtn")).toBeVisible();
  for (let i = 0; i < 2; i++) {
    await hold.focus();
    await page.keyboard.down("Space");
    await expect(page.locator("#secretBox .secret-word")).toBeVisible();
    await page.keyboard.up("Space");
    await expect(page.locator("#secretBox .secret-word")).toHaveCount(0);
  }
  await page.locator("#toggleRevealBtn").click();
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(page.locator("#secretBox .secret-word")).toHaveCount(0);
  await page.locator("#toggleRevealBtn").click();
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect(page.locator("#secretBox .secret-word")).toHaveCount(0);
});

test("pointer hold hides on release and timed reveal expires", async ({ page }) => {
  await page.clock.install();
  await page.goto("/");
  await newGroup(page);
  await page.locator("#confirmPlayerBtn").click();
  const hold = page.locator("#holdRevealBtn");
  await hold.scrollIntoViewIfNeeded();
  const box = await hold.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(page.locator("#secretBox .secret-word")).toBeVisible();
  await page.mouse.up();
  await expect(page.locator("#secretBox .secret-word")).toHaveCount(0);
  await page.locator("#toggleRevealBtn").click();
  await page.clock.fastForward(8000);
  await expect(page.locator("#secretBox .secret-word")).toHaveCount(0);
});

test("both roles have identical styling and long names and words stay inside mobile width", async ({
  page
}) => {
  await page.addInitScript(() => {
    let first = true;
    Math.random = () => {
      if (first) {
        first = false;
        return 0.31;
      }
      return 0;
    };
  });
  await page.goto("/");
  await newGroup(page, 4, 1, ["ÆØÅ".repeat(13)]);
  const styles = [];
  for (let i = 0; i < 4; i++) {
    await page.locator("#confirmPlayerBtn").click();
    await page.locator("#toggleRevealBtn").click();
    if (i === 0) {
      await expect(page.locator("#secretBox .secret-word")).toHaveText("Datamaskin");
      expect(
        await page
          .locator("#secretBox .secret-word")
          .evaluate((el) => el.clientHeight < parseFloat(getComputedStyle(el).lineHeight) * 1.5)
      ).toBe(true);
    }
    styles.push(
      await page.locator("#reveal").evaluate((el) => ({
        background: getComputedStyle(el).backgroundColor,
        cardBackground: getComputedStyle(document.getElementById("secretBox")).backgroundColor,
        cardHeight: document.getElementById("secretBox").offsetHeight
      }))
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true
    );
    const contrast = await page.locator("#secretBox strong").evaluate((el) => ({
      text: getComputedStyle(el).color,
      bg: getComputedStyle(el.parentElement.parentElement).backgroundColor
    }));
    expect(contrast.text).not.toBe(contrast.bg);
    await page.locator("#toggleRevealBtn").click();
    await page.locator("#nextPlayerBtn").click();
  }
  expect(styles.every((style) => JSON.stringify(style) === JSON.stringify(styles[0]))).toBe(true);
});

test("refresh preserves the round but never reopens a secret", async ({ page }) => {
  await page.goto("/");
  await newGroup(page, 7, 2, ["Åse"]);
  await page.locator("#confirmPlayerBtn").click();
  await page.locator("#toggleRevealBtn").click();
  const firstSecret = await page.locator("#secretBox .secret-word").textContent();
  await page.evaluate(() => {
    for (const key of ["imposter_players", "imposter_category", "imposter_imposter_count"])
      localStorage.removeItem(key);
  });
  await page.reload();
  await expect(page.locator("#handoffName")).toHaveText("Åse");
  await expect(page.locator("#playerCount")).toHaveValue("7");
  await expect(page.locator("#imposterCount")).toHaveValue("2");
  await expect(page.locator("#categorySelect")).toHaveValue("Ting");
  await expect(page.locator("#secretBox .secret-word")).toHaveCount(0);
  await page.locator("#confirmPlayerBtn").click();
  await page.locator("#toggleRevealBtn").click();
  await expect(page.locator("#secretBox .secret-word")).toHaveText(firstSecret);
});

test("wall clock timer catches up after background time and stays paused", async ({ page }) => {
  await page.clock.install();
  await page.goto("/");
  await newGroup(page);
  await dealRoles(page);
  await page.locator("#timerStartBtn").click();
  await page.clock.fastForward(90_000);
  await expect(page.locator("#timerDisplay")).toHaveText("00:30");
  await page.locator("#timerStartBtn").click();
  await page.clock.fastForward(300_000);
  await expect(page.locator("#timerDisplay")).toHaveText("00:30");
  await page.reload();
  await expect(page.locator("#timerDisplay")).toHaveText("00:30");
  await page.locator("#timerStartBtn").click();
  await page.clock.fastForward(30_000);
  await expect(page.locator("#timerDisplay")).toHaveText("00:00");
  await expect(page.locator("#timerStartBtn")).toHaveText("Start på nytt");
  await page.locator("#timerSelect").selectOption("0");
  await expect(page.locator("#timerStartBtn")).toBeDisabled();
});

test("quick start uses edited names and a partial vote survives refresh", async ({ page }) => {
  await page.goto("/");
  await newGroup(page, 7, 2, ["Ada"]);
  await dealRoles(page, 7);
  await page.locator("#endRoundBtn").click();
  await page.locator("#confirmEndRoundBtn").click();
  await page.locator("#goToNamesBtn").click();
  await page.locator("#player-0").fill("Åse");
  await page.locator("#backToSetupBtn").click();
  await page.locator("#quickStartBtn").click();
  await expect(page.locator("#handoffName")).toHaveText("Åse");
  const roles = await dealRoles(page, 7);
  await page.locator("#goToVoteBtn").click();
  await page.locator("#votePlayers input").nth(roles.imposters[0]).check();
  await page.reload();
  await expect(page.locator("#voteProgress")).toHaveText("1 av 2 valgt");
  await expect(page.locator("#votePlayers input").nth(roles.imposters[0])).toBeChecked();
  await expect(page.locator("#showResultBtn")).toBeDisabled();
});

test("blocked storage still allows a full game", async ({ page }) => {
  await page.addInitScript(() => {
    for (const name of ["localStorage", "sessionStorage"])
      Object.defineProperty(window, name, {
        get() {
          throw new DOMException("Blocked", "SecurityError");
        }
      });
  });
  await page.goto("/");
  await newGroup(page);
  const roles = await dealRoles(page);
  await page.locator("#goToVoteBtn").click();
  await page.locator("#votePlayers input").nth(roles.imposters[0]).check();
  await page.locator("#showResultBtn").click();
  await expect(page.locator("#resultTitle")).toHaveText("Spillerne vant!");
});

test("incorrect accusation awards imposters the win, with votes adjustable before confirmation", async ({
  page
}) => {
  await page.goto("/");
  await newGroup(page, 7, 2);
  const roles = await dealRoles(page, 7);
  await page.locator("#goToVoteBtn").click();
  const innocent = Array.from({ length: 7 }, (_, i) => i).find((i) => !roles.imposters.includes(i));
  await page.locator("#votePlayers input").nth(roles.imposters[0]).check();
  await page.locator("#votePlayers input").nth(innocent).check();
  await expect(page.locator("#showResultBtn")).toBeEnabled();
  await page.locator("#votePlayers input").nth(innocent).uncheck();
  await expect(page.locator("#showResultBtn")).toBeDisabled();
  await page.locator("#votePlayers input").nth(innocent).check();
  await page.locator("#showResultBtn").click();
  await expect(page.locator("#resultTitle")).toHaveText("Impostorene vant!");
});

test("settings persist and saved group can be forgotten explicitly", async ({ page }) => {
  await page.goto("/");
  await page.locator("#setup [data-settings]").click();
  await page.locator("#themeSelect").selectOption("dark");
  await page.locator("#defaultTimerSelect").selectOption("60");
  await page.locator("#settingsDialog [data-close-dialog]").click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await newGroup(page, 3, 1, ["Ada", "Bjørn", "Åse"]);
  await dealRoles(page, 3);
  await expect(page.locator("#timerDisplay")).toHaveText("01:00");
  await page.locator("#endRoundBtn").click();
  await page.locator("#confirmEndRoundBtn").click();
  await expect(page.locator("#quickStartBtn")).toBeVisible();
  await page.locator("#setup [data-settings]").click();
  await page.locator("#forgetPlayersBtn").click();
  await page.reload();
  await expect(page.locator("#quickStartBtn")).toBeHidden();
  await page.locator("#goToNamesBtn").click();
  await expect(page.locator("#player-0")).toHaveValue("");
});
