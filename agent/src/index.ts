import { Either, left, right } from "fp-ts/Either";
import { createActor, createMachine } from "xstate";

export const parsePort = (value: string): Either<Error, number> => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
    return left(new Error("Invalid port"));
  }

  return right(parsed);
};

const pingMachine = createMachine({
  id: "ping",
  initial: "idle",
  states: {
    idle: {
      on: { PING: "ok" },
    },
    ok: {
      type: "final",
    },
  },
});

export const runPingMachine = (): string => {
  const actor = createActor(pingMachine);
  actor.start();
  actor.send({ type: "PING" });
  return String(actor.getSnapshot().value);
};

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(runPingMachine());
}
