import test from "node:test";
import assert from "node:assert/strict";
import {
  createRound,
  createTimer,
  getMaxImposters,
  pauseTimer,
  playerNames,
  restoreSession,
  roundResult,
  secondsLeft,
  startTimer
} from "../../game.js";

const names = (count) => Array.from({ length: count }, (_, i) => `Spiller ${i + 1}`);
const makeRound = (count = 4, imposters = 1) =>
  createRound({
    players: names(count),
    imposterCount: imposters,
    category: "Ting",
    word: "Datamaskin"
  });

test("role counts, unique roles and valid starter at every supported group size", () => {
  for (let count = 3; count <= 15; count++) {
    for (let imposters = 1; imposters <= getMaxImposters(count); imposters++) {
      for (const random of [() => 0, () => 0.999999, Math.random]) {
        const round = createRound(
          { players: names(count), imposterCount: imposters, category: "Ting", word: "Datamaskin" },
          random
        );
        assert.equal(round.imposterIndexes.length, imposters);
        assert.equal(new Set(round.imposterIndexes).size, imposters);
        assert(round.imposterIndexes.every((i) => i >= 0 && i < count));
        assert(round.starterIndex >= 0 && round.starterIndex < count);
      }
    }
  }
});

test("invalid counts and indistinguishable names are rejected", () => {
  for (const count of [0, 2, 16]) assert.throws(() => playerNames(names(count)));
  assert.throws(() => playerNames(["Ada", " ada ", "Bjørn"]), /ulike navn/);
  assert.throws(() => playerNames(["Åse", "A\u030Ase", "Bjørn"]), /ulike navn/);
  assert.throws(() => playerNames(["x".repeat(41), "Ada", "Bjørn"]), /40 tegn/);
  for (const imposterCount of [0, -1, 1.5, 2, 4])
    assert.throws(() =>
      createRound({ players: names(4), imposterCount, category: "Ting", word: "Mobil" })
    );
  assert.deepEqual(playerNames(["  Ada  Lovelace ", "", "Bjørn"]), [
    "Ada Lovelace",
    "Spiller 2",
    "Bjørn"
  ]);
});

test("all imposters must be identified; duplicate and partial votes cannot reveal results", () => {
  const round = makeRound(10, 3);
  assert.equal(roundResult(round, [...round.imposterIndexes]).playersWin, true);
  const innocent = names(10)
    .map((_, i) => i)
    .find((i) => !round.imposterIndexes.includes(i));
  assert.equal(
    roundResult(round, [...round.imposterIndexes.slice(0, 2), innocent]).playersWin,
    false
  );
  assert.throws(() => roundResult(round, round.imposterIndexes.slice(0, 2)), /nøyaktig/);
  assert.throws(() => roundResult(round, [0, 0, 0]), /nøyaktig/);
  assert.throws(() => roundResult(round, [0, 1, 99]), /nøyaktig/);
});

test("timer follows elapsed wall time even when no callbacks run in the background", () => {
  let timer = startTimer(createTimer(120), 1000);
  assert.equal(secondsLeft(timer, 61_500), 60);
  timer = pauseTimer(timer, 61_500);
  assert.equal(secondsLeft(timer, 999_999), 60);
  timer = startTimer(timer, 900_000);
  assert.equal(secondsLeft(timer, 959_500), 0);
  assert.equal(secondsLeft(timer, 5_000_000), 0);
});

test("restoring a revealed role always returns to a private handoff", () => {
  const round = makeRound();
  round.phase = "reveal";
  round.currentIndex = 2;
  const restored = restoreSession({ schema: 1, round, timer: createTimer(120) });
  assert.equal(restored.round.phase, "handoff");
  assert.equal(restored.round.currentIndex, 2);
  assert.deepEqual(restored.round.imposterIndexes, round.imposterIndexes);
  assert.equal(restored.round.word, round.word);
});

test("malformed saved rounds are discarded without starting an invalid game", () => {
  const valid = { schema: 1, round: makeRound(), timer: createTimer(120) };
  for (const value of [
    null,
    [],
    {},
    { ...valid, schema: 9 },
    { ...valid, round: { ...valid.round, imposterIndexes: [99] } },
    { ...valid, round: { ...valid.round, category: "does not exist" } },
    { ...valid, round: { ...valid.round, word: "not in the deck" } },
    { ...valid, round: { ...valid.round, phase: "result", suspects: [] } },
    { ...valid, timer: { ...valid.timer, remainingMs: -1 } }
  ])
    assert.equal(restoreSession(value), null);
});
