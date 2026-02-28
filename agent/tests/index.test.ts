import { isLeft, isRight } from "fp-ts/Either";
import { describe, expect, it } from "vitest";

import { parsePort, runPingMachine } from "../src/index.js";

describe("parsePort", () => {
  it("returns right for a valid port", () => {
    const result = parsePort("3000");
    expect(isRight(result)).toBe(true);
  });

  it("returns left for invalid port", () => {
    const result = parsePort("0");
    expect(isLeft(result)).toBe(true);
  });
});

describe("runPingMachine", () => {
  it("reaches final state", () => {
    expect(runPingMachine()).toBe("ok");
  });
});
