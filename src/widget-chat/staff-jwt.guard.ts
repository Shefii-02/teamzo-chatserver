import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { StaffAuthService, StaffIdentity } from '../core/staff-auth.service';

export const WIDGET_CHAT_PERMISSION = 'widget_chat.handle';

export type StaffRequest = Request & { staff: StaffIdentity };

/** Laravel-JWT + `widget_chat.handle` check for the staff REST endpoints. */
@Injectable()
export class StaffJwtGuard implements CanActivate {
  constructor(private readonly auth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<StaffRequest>();
    const h = req.headers.authorization;
    const token = typeof h === 'string' && h.startsWith('Bearer ') ? h.slice(7) : undefined;
    req.staff = await this.auth.authorize(token, WIDGET_CHAT_PERMISSION);
    return true;
  }
}
