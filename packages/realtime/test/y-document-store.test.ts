import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { YDocumentStore } from "../src/y-document-store.js";

describe("YDocumentStore", () => {
  it("применяет Yjs update и кодирует состояние документа", () => {
    const source = new Y.Doc();
    source.getText("body").insert(0, "hello");
    const update = Y.encodeStateAsUpdate(source);
    const store = new YDocumentStore();

    const event = store.applyUpdate({
      documentId: "issue:1",
      update,
      actorId: "user-1",
      now: new Date("2026-05-19T10:00:00.000Z"),
    });

    const target = new Y.Doc();
    Y.applyUpdate(target, store.encodeState("issue:1"));

    expect(target.getText("body").toJSON()).toBe("hello");
    expect(event).toMatchObject({
      type: "yjs.update",
      documentId: "issue:1",
      actorId: "user-1",
    });
    expect(event.updateBase64).toBe(Buffer.from(update).toString("base64url"));
  });
});
