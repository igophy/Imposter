import test from "node:test";
import assert from "node:assert/strict";
import { CATEGORIES, WORD_BANK, drawWord, wordsFor } from "../../words.js";
import { safeStorage } from "../../storage.js";

test("mixed category is exactly the union of all categories", () => {
  assert.deepEqual(new Set(wordsFor("Blandet")), new Set(Object.values(WORD_BANK).flat()));
  assert(wordsFor("Blandet").length > 150);
});

test("decks do not repeat before exhaustion or immediately across the deck boundary", () => {
  for (const category of CATEGORIES) {
    const words = wordsFor(category);
    let used = [];
    for (let i = 0; i < words.length; i++) {
      const draw = drawWord(category, used, () => 0);
      assert(!used.includes(draw.word));
      used = draw.used;
    }
    assert.equal(new Set(used).size, words.length);
    assert.notEqual(drawWord(category, used, () => 0.99999).word, used.at(-1));
  }
});

test("invalid and stale word history is safely ignored", () => {
  assert(wordsFor("Ting").includes(drawWord("Ting", ["old removed word"]).word));
  assert(wordsFor("Mat").includes(drawWord("Mat", { invalid: true }).word));
  assert.throws(() => drawWord("unknown"));
});

test("blocked storage falls back to memory including deletes", () => {
  const storage = safeStorage(() => {
    throw new Error("SecurityError");
  });
  assert.equal(storage.read("names", "empty"), "empty");
  storage.write("names", ["Ada", "Bjørn", "Åse"]);
  assert.deepEqual(storage.read("names"), ["Ada", "Bjørn", "Åse"]);
  storage.remove("names");
  assert.equal(storage.read("names", "empty"), "empty");
  assert.equal(storage.available, false);
});

test("quota errors do not lose the current group's settings; legacy plain strings still load", () => {
  const area = {
    getItem: (key) => (key === "app_theme" ? "dark" : '["old name"]'),
    setItem() {
      throw new Error("QuotaExceededError");
    },
    removeItem() {
      throw new Error("Blocked");
    }
  };
  const storage = safeStorage(() => area);
  assert.equal(storage.read("app_theme"), "dark");
  storage.write("players", ["Ada", "Bjørn", "Åse"]);
  assert.deepEqual(storage.read("players"), ["Ada", "Bjørn", "Åse"]);
  storage.remove("players");
  assert.equal(storage.read("players", null), null);
  assert.equal(storage.available, false);
});
