import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { Store } from "../../src/ui/store.js";

describe("Store", () => {
  test("starts with the initial value", () => {
    const store = new Store({ hp: 1, name: "a" });
    assert.deepEqual(store.get(), { hp: 1, name: "a" });
  });

  test("set shallow-merges the patch and keeps the other values", () => {
    const store = new Store({ hp: 1, name: "a" });
    store.set({ hp: 0.5 });
    assert.deepEqual(store.get(), { hp: 0.5, name: "a" });
  });

  test("set makes a new object instead of mutating the old one", () => {
    const store = new Store({ hp: 1 });
    const before = store.get();
    store.set({ hp: 0 });
    assert.notEqual(store.get(), before);
    assert.equal(before.hp, 1);
  });

  test("listeners hear about a change", () => {
    const store = new Store({ hp: 1 });
    let calls = 0;
    store.subscribe(() => calls++);
    store.set({ hp: 0.5 });
    store.set({ hp: 0.25 });
    assert.equal(calls, 2);
  });

  test("setting the same values notifies nobody and keeps the same object", () => {
    const list = [1, 2];
    const store = new Store({ hp: 1, list });
    const before = store.get();
    let calls = 0;
    store.subscribe(() => calls++);
    store.set({ hp: 1, list });
    store.set({});
    assert.equal(calls, 0);
    assert.equal(store.get(), before);
  });

  test("an equal but new object counts as a change (the comparison is by identity)", () => {
    const store = new Store({ list: [1, 2] });
    let calls = 0;
    store.subscribe(() => calls++);
    store.set({ list: [1, 2] });
    assert.equal(calls, 1);
  });

  test("NaN to NaN is not a change", () => {
    const store = new Store({ value: NaN });
    let calls = 0;
    store.subscribe(() => calls++);
    store.set({ value: NaN });
    assert.equal(calls, 0);
  });

  test("one changed value among unchanged ones still notifies", () => {
    const store = new Store({ a: 1, b: 2 });
    let calls = 0;
    store.subscribe(() => calls++);
    store.set({ a: 1, b: 3 });
    assert.equal(calls, 1);
    assert.deepEqual(store.get(), { a: 1, b: 3 });
  });

  test("listeners see the new value when called", () => {
    const store = new Store({ hp: 1 });
    let seen = -1;
    store.subscribe(() => { seen = store.get().hp; });
    store.set({ hp: 0.3 });
    assert.equal(seen, 0.3);
  });

  test("unsubscribing stops the notifications, for that listener only", () => {
    const store = new Store({ hp: 1 });
    let first = 0, second = 0;
    const off = store.subscribe(() => first++);
    store.subscribe(() => second++);
    off();
    store.set({ hp: 0 });
    assert.equal(first, 0);
    assert.equal(second, 1);
  });

  test("subscribe works unbound, as useSyncExternalStore calls it", () => {
    const store = new Store({ hp: 1 });
    const { subscribe } = store;
    let calls = 0;
    const off = subscribe(() => calls++);
    store.set({ hp: 0 });
    off();
    store.set({ hp: 1 });
    assert.equal(calls, 1);
  });

  test("reset goes back to the initial value, telling listeners", () => {
    const store = new Store({ hp: 1, name: "a" });
    let calls = 0;
    store.subscribe(() => calls++);
    store.set({ hp: 0.5, name: "b" });
    store.reset();
    assert.deepEqual(store.get(), { hp: 1, name: "a" });
    assert.equal(calls, 2);
  });
});
