import { ForbiddenException, Injectable, Logger } from '@nestjs/common';

export interface TeamChatRights {
  use: boolean;
  groups: boolean;
  moderate: boolean;
}

/**
 * Team chat is a plan feature with its own permissions, and Laravel is the single source of truth for both (plan, add-ons,
 * complimentary validity, role permissions). This asks Laravel — `POST /internal/team-chat-access` — and caches the answer for a
 * minute, so the socket commands and Node's REST endpoints enforce exactly what the Laravel routes do.
 * If Laravel cannot be reached the last answer is reused; with no answer at all access is refused. With no INTERNAL_API_KEY
 * configured nothing can be verified, so (like the push hand-off) the check is skipped.
 */
@Injectable()
export class TeamChatAccessService {
  private readonly logger = new Logger(TeamChatAccessService.name);
  private readonly cache = new Map<number, { at: number; rights: TeamChatRights }>();
  private static readonly TTL_MS = 60_000;

  async rights(staffId: number): Promise<TeamChatRights> {
    const key = process.env.INTERNAL_API_KEY;
    if (!key) return { use: true, groups: true, moderate: false };

    const hit = this.cache.get(staffId);
    if (hit && Date.now() - hit.at < TeamChatAccessService.TTL_MS) return hit.rights;

    try {
      const base = (process.env.LARAVEL_INTERNAL_URL || process.env.LARAVEL_URL || 'https://api.teamzo.io').replace(/\/$/, '');
      const res = await fetch(`${base}/api/v1/internal/team-chat-access`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json', 'x-internal-key': key },
        body: JSON.stringify({ user_id: staffId }),
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = (await res.json()) as Partial<TeamChatRights>;
      const rights = { use: !!j.use, groups: !!j.groups, moderate: !!j.moderate };
      this.cache.set(staffId, { at: Date.now(), rights });
      if (this.cache.size > 5000) this.cache.clear();
      return rights;
    } catch (e) {
      this.logger.warn(`team-chat access check failed for ${staffId}: ${(e as Error).message}`);
      return hit?.rights ?? { use: false, groups: false, moderate: false };
    }
  }

  async assertUse(staffId: number): Promise<void> {
    if (!(await this.rights(staffId)).use) throw new Error('Team chat is not available for your account (plan or permission).');
  }

  /** For the REST guard — a 403 with the same wording. */
  async assertUseHttp(staffId: number): Promise<TeamChatRights> {
    const r = await this.rights(staffId);
    if (!r.use) throw new ForbiddenException('Team chat is not available for your account (plan or permission).');
    return r;
  }
}
