import type { Response } from "express";
import { env } from "../config/env";

export interface SseEventEnvelope {
  id: string;
  event: string;
  data: unknown;
}

type SseClient = {
  userId: string;
  response: Response;
};

export class InMemorySseBroker {
  private readonly clients = new Map<string, SseClient>();

  public subscribe(userId: string, response: Response) {
    const clientId = crypto.randomUUID();
    this.clients.set(clientId, {
      userId,
      response
    });

    const heartbeat = setInterval(() => {
      response.write(`event: ping\n`);
      response.write(`data: {"ok":true}\n\n`);
    }, env.SSE_HEARTBEAT_INTERVAL_MS);

    return () => {
      clearInterval(heartbeat);
      this.clients.delete(clientId);
    };
  }

  public publishToUser(userId: string, event: string, data: unknown) {
    const envelope: SseEventEnvelope = {
      id: crypto.randomUUID(),
      event,
      data
    };

    for (const client of this.clients.values()) {
      if (client.userId !== userId) {
        continue;
      }

      client.response.write(`id: ${envelope.id}\n`);
      client.response.write(`event: ${event}\n`);
      client.response.write(`data: ${JSON.stringify(envelope.data)}\n\n`);
    }
  }
}

export const sseBroker = new InMemorySseBroker();
