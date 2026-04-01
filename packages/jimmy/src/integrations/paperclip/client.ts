import { logger } from "../../shared/logger.js";
import type { PaperclipConfig, Session } from "../../shared/types.js";

/**
 * Paperclip integration client.
 * Pushes Jinn session data, costs, and org info to the Paperclip dashboard.
 */
export class PaperclipClient {
  private url: string;
  private syncInterval: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private pendingUpdates: SessionUpdate[] = [];

  constructor(config: PaperclipConfig) {
    this.url = config.url.replace(/\/$/, "");
    this.syncInterval = (config.syncInterval ?? 60) * 1000;
  }

  async start(): Promise<void> {
    const ok = await this.healthCheck();
    if (!ok) {
      logger.warn("[paperclip] Dashboard not reachable — sync will retry on next interval");
    } else {
      logger.info(`[paperclip] Connected to dashboard at ${this.url}`);
    }

    // Start periodic flush
    this.timer = setInterval(() => {
      this.flush().catch((err) => {
        logger.warn(`[paperclip] Flush failed: ${err instanceof Error ? err.message : String(err)}`);
      });
    }, this.syncInterval);
  }

  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    // Final flush
    await this.flush().catch(() => {});
    logger.info("[paperclip] Integration stopped");
  }

  /** Queue a session update for the next sync cycle */
  pushSessionUpdate(session: Session): void {
    this.pendingUpdates.push({
      sessionId: session.id,
      engine: session.engine,
      employee: session.employee,
      status: session.status,
      totalCost: session.totalCost,
      totalTurns: session.totalTurns,
      title: session.title,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
    });
  }

  /** Push org data to Paperclip */
  async syncOrg(employees: Map<string, { name: string; department: string; rank: string; engine: string }>): Promise<void> {
    const orgData = Array.from(employees.values()).map((e) => ({
      name: e.name,
      department: e.department,
      rank: e.rank,
      engine: e.engine,
    }));
    await this.post("/api/integrations/jinn/org", { employees: orgData });
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${this.url}/api/health`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  private async flush(): Promise<void> {
    if (this.pendingUpdates.length === 0) return;

    const batch = this.pendingUpdates.splice(0);
    try {
      await this.post("/api/integrations/jinn/sessions", { sessions: batch });
      logger.debug(`[paperclip] Flushed ${batch.length} session update(s)`);
    } catch (err) {
      // Put them back for retry
      this.pendingUpdates.unshift(...batch);
      throw err;
    }
  }

  private async post(path: string, body: unknown): Promise<void> {
    const res = await fetch(`${this.url}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      throw new Error(`Paperclip API ${path} returned ${res.status}`);
    }
  }
}

interface SessionUpdate {
  sessionId: string;
  engine: string;
  employee: string | null;
  status: string;
  totalCost: number;
  totalTurns: number;
  title: string | null;
  createdAt: string;
  lastActivity: string;
}
