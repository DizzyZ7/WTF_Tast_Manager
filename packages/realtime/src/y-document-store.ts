import * as Y from "yjs";
import type { RealtimeEvent } from "./event-bus.js";

/**
 * Хранилище CRDT-документов Yjs.
 */
export class YDocumentStore {
  private readonly documents = new Map<string, Y.Doc>();

  /**
   * Возвращает существующий документ или создает новый.
   */
  public getDocument(documentId: string): Y.Doc {
    const existing = this.documents.get(documentId);
    if (existing !== undefined) {
      return existing;
    }

    const document = new Y.Doc();
    this.documents.set(documentId, document);
    return document;
  }

  /**
   * Применяет бинарный Yjs update и возвращает событие для распространения.
   */
  public applyUpdate(input: {
    readonly documentId: string;
    readonly update: Uint8Array;
    readonly actorId: string;
    readonly now: Date;
  }): RealtimeEvent {
    const document = this.getDocument(input.documentId);
    Y.applyUpdate(document, input.update);

    return {
      type: "yjs.update",
      documentId: input.documentId,
      actorId: input.actorId,
      occurredAt: input.now.toISOString(),
      updateBase64: Buffer.from(input.update).toString("base64url"),
    };
  }

  /**
   * Возвращает полный state update документа.
   */
  public encodeState(documentId: string): Uint8Array {
    return Y.encodeStateAsUpdate(this.getDocument(documentId));
  }
}
