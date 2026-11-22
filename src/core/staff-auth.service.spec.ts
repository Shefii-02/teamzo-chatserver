import { ForbiddenException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { StaffAuthService } from './staff-auth.service';

describe('StaffAuthService.authorize', () => {
  const secret = 'test-secret';
  const token = jwt.sign({ sub: '3' }, secret, { algorithm: 'HS256', expiresIn: 60 });
  let svc: StaffAuthService;
  const realFetch = global.fetch;

  beforeEach(() => {
    process.env.JWT_SECRET = secret;
    process.env.INTERNAL_API_KEY = 'k';
    svc = new StaffAuthService();
    jest.spyOn((svc as any).log, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => { global.fetch = realFetch; jest.restoreAllMocks(); });

  const reply = (status: number, body: unknown = {}) => { global.fetch = jest.fn().mockResolvedValue({ ok: status >= 200 && status < 300, status, json: async () => body }) as any; };

  it('a bad JWT is still 401', async () => {
    await expect(svc.authorize('nope', 'widget_chat.handle')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('grants access when Laravel says can', async () => {
    reply(200, { can: true, company_id: 9, name: 'Ann' });
    await expect(svc.authorize(token, 'widget_chat.handle')).resolves.toEqual({ id: 3, companyId: 9, name: 'Ann' });
  });

  it('403 when Laravel says the staff member cannot', async () => {
    reply(200, { can: false, company_id: 9, name: 'Ann' });
    await expect(svc.authorize(token, 'widget_chat.handle')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('Laravel rejecting the internal key is a 503 (config), not a 401 on the agent', async () => {
    reply(401);
    await expect(svc.authorize(token, 'widget_chat.handle')).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect((svc as any).log.error).toHaveBeenCalledWith(expect.stringContaining('INTERNAL_API_KEY'));
  });

  it('Laravel unreachable → 503, but a recent grant is still served', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED')) as any;
    await expect(svc.authorize(token, 'widget_chat.handle')).rejects.toBeInstanceOf(ServiceUnavailableException);
    reply(200, { can: true, company_id: 9, name: 'Ann' });
    await svc.authorize(token, 'widget_chat.handle');
    (svc as any).cache.forEach((v: any) => { v.at = Date.now() - 120_000; });   // expire the cache so it re-asks
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED')) as any;
    await expect(svc.authorize(token, 'widget_chat.handle')).resolves.toMatchObject({ companyId: 9 });
  });
});
