import type { Server as HttpServer } from "node:http";
import { WebSocket, WebSocketServer, type RawData } from "ws";
import { z } from "zod";
import type { RealtimeEventBus, Unsubscribe } from "./event-bus.js";
import { YDocumentStore } from "./y-document-store.js";

const clientMessageSchema = z.object({
  type: z.literal("yjs.update"),
  documentId: z.string().min(1).max(256),
  actorId: z.string().min(1).max(256),
  updateBase64: z.string().min(1),
});

/**
 * Опции WebSocket realtime server.
 */
export interface RealtimeServerOptions {
  /** HTTP server, к которому подключается WebSocket server. */
  readonly server: HttpServer;
  /** URL path для WebSocket upgrade. */
  readonly path?: string;
  /** Event bus для межпроцессного распространения. */
  readonly eventBus: RealtimeEventBus;
  /** Yjs document store. */
  readonly documentStore?: YDocumentStore;
  /** Источник времени для тестируемости. */
  readonly clock?: () => Date;
}

/**
 * Запущенный realtime server.
 */
export interface RealtimeServer {
  /** Закрывает WebSocket server и подписки. */
  close(): Promise<void>;
}

/**
 * Подключает WebSocket/Yjs realtime server к HTTP server.
 */
export function attachRealtimeServer(options: RealtimeServerOptions): RealtimeServer {
  const documentStore = options.documentStore ?? new YDocumentStore();
  const clock = options.clock ?? (() => new Date());
  const server = new WebSocketServer({ server: options.server, path: options.path ?? "/realtime" });
  const documentClients = new Map<string, Set<WebSocket>>();
  const unsubscribers = new Map<string, Unsubscribe>();

  server.on("connection", (socket, request) => {
    const documentId = documentIdFromUrl(request.url ?? "");
    if (documentId === null) {
      socket.close(1008, "documentId is required");
      return;
    }

    const clients = documentClients.get(documentId) ?? new Set<WebSocket>();
    clients.add(socket);
    documentClients.set(documentId, clients);

    const state = documentStore.encodeState(documentId);
    socket.send(
      JSON.stringify({
        type: "yjs.sync",
        documentId,
        updateBase64: Buffer.from(state).toString("base64url"),
      }),
    );

    if (!unsubscribers.has(documentId)) {
      void options.eventBus
        .subscribe(documentId, (event) => {
          const receivers = documentClients.get(event.documentId) ?? new Set<WebSocket>();
          const payload = JSON.stringify(event);
          for (const receiver of receivers) {
            if (receiver.readyState === WebSocket.OPEN) {
              receiver.send(payload);
            }
          }
        })
        .then((unsubscribe) => {
          unsubscribers.set(documentId, unsubscribe);
        });
    }

    socket.on("message", (data) => {
      const message = parseClientMessage(data);
      if (message.documentId !== documentId) {
        socket.close(1008, "document mismatch");
        return;
      }

      const event = documentStore.applyUpdate({
        documentId: message.documentId,
        update: Buffer.from(message.updateBase64, "base64url"),
        actorId: message.actorId,
        now: clock(),
      });
      void options.eventBus.publish(event);
    });

    socket.on("close", () => {
      clients.delete(socket);
      if (clients.size === 0) {
        documentClients.delete(documentId);
      }
    });
  });

  return {
    async close(): Promise<void> {
      await Promise.all([...unsubscribers.values()].map((unsubscribe) => unsubscribe()));
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error !== undefined) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    },
  };
}

function documentIdFromUrl(url: string): string | null {
  const parsed = new URL(url, "http://localhost");
  return parsed.searchParams.get("documentId");
}

function parseClientMessage(data: RawData): z.infer<typeof clientMessageSchema> {
  const text = rawDataToText(data);
  return clientMessageSchema.parse(JSON.parse(text));
}

function rawDataToText(data: RawData): string {
  if (Array.isArray(data)) {
    return Buffer.concat(data).toString("utf8");
  }

  if (Buffer.isBuffer(data)) {
    return data.toString("utf8");
  }

  return Buffer.from(data).toString("utf8");
}
