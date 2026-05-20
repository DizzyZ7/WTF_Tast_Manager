import { describe, expect, it } from "vitest";
import { InMemoryRealtimeEventBus } from "../src/event-bus.js";

describe("InMemoryRealtimeEventBus", () => {
  it("публикует события подписчикам документа", async () => {
    const bus = new InMemoryRealtimeEventBus();
    const received: string[] = [];

    const unsubscribe = await bus.subscribe("issue:1", (event) => {
      received.push(event.actorId);
    });

    await bus.publish({
      type: "presence.joined",
      documentId: "issue:1",
      actorId: "user-1",
      occurredAt: "2026-05-19T10:00:00.000Z",
    });
    await unsubscribe();
    await bus.publish({
      type: "presence.joined",
      documentId: "issue:1",
      actorId: "user-2",
      occurredAt: "2026-05-19T10:00:00.000Z",
    });

    expect(received).toEqual(["user-1"]);
  });
});
