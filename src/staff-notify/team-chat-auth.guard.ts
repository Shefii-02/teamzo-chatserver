import { CanActivate, ExecutionContext, ForbiddenException, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { MysqlService } from '../core/mysql.service';
import { StaffAuthService } from '../core/staff-auth.service';
import { TeamChatAccessService } from './team-chat-access.service';
import type { TeamChatRights } from './team-chat-access.service';
import type { TeamUser } from './team-chat-query.service';

export type TeamChatRequest = Request & { teamUser: TeamUser; teamRights: TeamChatRights };

/**
 * Same Laravel JWT the apps already hold, verified locally with the shared JWT_SECRET (like the /staff socket). Identity + company come from
 * the users table (cached 30 s); whether the plan includes Team chat and the role may use it is asked of Laravel (TeamChatAccessService).
 */
@Injectable()
export class TeamChatAuthGuard implements CanActivate {
  private readonly cache = new Map<number, { at: number; user: TeamUser | null }>();

  constructor(
    private readonly auth: StaffAuthService,
    private readonly db: MysqlService,
    private readonly access: TeamChatAccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<TeamChatRequest>();
    const h = req.headers.authorization;
    // Only a genuinely bad / expired token is a 401 (the apps refresh or sign out on it). A server that is not configured
    // must NOT look like "your session is invalid", or every client would log itself out — report 503 so they fall back.
    if (!process.env.JWT_SECRET) throw new ServiceUnavailableException('Team chat auth is not configured on this server');
    const userId = this.auth.verifyToken(typeof h === 'string' && h.startsWith('Bearer ') ? h.slice(7) : undefined);

    const hit = this.cache.get(userId);
    if (hit && Date.now() - hit.at < 30_000) {
      if (!hit.user) throw new ForbiddenException('Account is not active');
      req.teamUser = hit.user;
      req.teamRights = await this.access.assertUseHttp(hit.user.id);
      return true;
    }
    const rows = await this.db.query<{ id: number; company_id: number | null; name: string; is_active: number }>(
      'SELECT id, company_id, name, is_active FROM users WHERE id = ? LIMIT 1', [userId]);
    const r = rows[0];
    const user = r && r.is_active && r.company_id ? { id: Number(r.id), companyId: Number(r.company_id), name: r.name } : null;
    this.cache.set(userId, { at: Date.now(), user });
    if (!user) throw new ForbiddenException('Account is not active');
    req.teamUser = user;
    req.teamRights = await this.access.assertUseHttp(user.id);   // the plan includes Team chat and the role may use it
    return true;
  }
}
