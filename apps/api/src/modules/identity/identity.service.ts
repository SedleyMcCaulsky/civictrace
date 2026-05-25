import * as crypto from 'crypto';
import { Injectable, UnauthorizedException, ConflictException, NotFoundException, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class IdentityService {
  private readonly logger = new Logger(IdentityService.name);

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const result = await this.db.query<any[]>(
      `SELECT u.id, u.email, u.full_name, u.is_active, u.is_field_officer,
             u.region, u.organisation_id, u.password_hash, u.failed_login_attempts, u.locked_until, u.last_failed_at, r.name as role_name, r.role_type
      FROM identity.user u
       JOIN identity.role r ON r.id = u.role_id
       WHERE u.email = $1 AND u.deleted_at IS NULL LIMIT 1`,
      [dto.email.toLowerCase()],
    );
    const user = result[0];
    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (!user.is_active) throw new UnauthorizedException('Account is deactivated');
    if (!user.password_hash) throw new UnauthorizedException('Account not configured');

      // ── Account lockout check ─────────────────────────────────
      if (user.locked_until && new Date(user.locked_until) > new Date()) {
        const minutesLeft = Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / 60000);
        await this.db.query(
          `INSERT INTO audit.audit_log (actor_id, action, resource_type, resource_id, details, ip_address)
           VALUES (NULL, 'AUTH_BLOCKED', 'user', $1, $2, 'system')`,
          [user.id, JSON.stringify({ reason: 'Account locked', email: dto.email, minutesLeft })],
        ).catch(() => {});
        throw new UnauthorizedException(`Account locked. Try again in ${minutesLeft} minute${minutesLeft === 1 ? '' : 's'}.`);
      }
    const valid = await bcrypt.compare(dto.password, user.password_hash);
      if (!valid) {
        const attempts = (user.failed_login_attempts || 0) + 1;
        const lockout = attempts >= 5;
        await this.db.query(
          `UPDATE identity.user SET failed_login_attempts = $1, last_failed_at = NOW(),
           locked_until = CASE WHEN $2 THEN NOW() + INTERVAL '30 minutes' ELSE locked_until END
           WHERE id = $3`,
          [attempts, lockout, user.id],
        );
        await this.db.query(
          `INSERT INTO audit.audit_log (actor_id, action, resource_type, resource_id, details, ip_address)
           VALUES (NULL, $1, 'user', $2, $3, 'system')`,
          [lockout ? 'AUTH_ACCOUNT_LOCKED' : 'AUTH_FAILED', user.id,
           JSON.stringify({ email: dto.email, attempts, locked: lockout })],
        ).catch(() => {});
        if (lockout) throw new UnauthorizedException('Too many failed attempts. Account locked for 30 minutes.');
        const remaining = 5 - attempts;
        throw new UnauthorizedException(`Invalid credentials. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`);
      }
      // ── Reset on successful login ─────────────────────────────
      await this.db.query(
        `UPDATE identity.user SET failed_login_attempts = 0, locked_until = NULL, last_failed_at = NULL WHERE id = $1`,
        [user.id],
      );
    const permissions = await this.db.query<any[]>(
      `SELECT p.code FROM identity.role_permission rp
       JOIN identity.permission p ON p.id = rp.permission_id
       JOIN identity.role r ON r.id = rp.role_id
       JOIN identity.user u ON u.role_id = r.id WHERE u.id = $1`,
      [user.id],
    );
    const permissionCodes = permissions.map((p: any) => p.code);
    await this.db.query(`UPDATE identity.user SET last_login_at = NOW() WHERE id = $1`, [user.id]);
    const payload: any = { sub: user.id, email: user.email, role: user.role_name, roleType: user.role_type, permissions: permissionCodes, organisationId: user.organisation_id, isMobile: false, deviceId: null };
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign({ sub: user.id } as any, { secret: this.configService.get<string>('jwt.refreshSecret') } as any);
    return { accessToken, refreshToken, user: { id: user.id, email: user.email, fullName: user.full_name, role: user.role_name, permissions: permissionCodes, organisationId: user.organisation_id, isFieldOfficer: user.is_field_officer, region: user.region } };
  }

  async createUser(dto: CreateUserDto, actorId: string) {
    const existing = await this.db.query(`SELECT id FROM identity.user WHERE email = $1`, [dto.email.toLowerCase()]);
    if (existing[0]) throw new ConflictException(`Email already registered: ${dto.email}`);
    const passwordHash = await bcrypt.hash(dto.temporaryPassword, 12);
    const result = await this.db.query(
      `INSERT INTO identity.user (email, full_name, role_id, phone, region, employee_number, is_field_officer, password_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, email, full_name, role_id, is_active, created_at`,
      [dto.email.toLowerCase(), dto.fullName, dto.roleId, dto.phone || null, dto.region || null, dto.employeeNumber || null, dto.isFieldOfficer || false, passwordHash],
    );
    this.logger.log(`User created: ${result[0].email}`);
    return result[0];
  }

  async getUsers(filters: { region?: string; roleType?: string }) {
    let query = `SELECT u.id, u.email, u.full_name, u.region, u.is_active, u.is_field_officer, u.employee_number, u.last_login_at, r.name as role_name, r.role_type FROM identity.user u JOIN identity.role r ON r.id = u.role_id WHERE u.deleted_at IS NULL`;
    const params: any[] = [];
    if (filters.region) { params.push(filters.region); query += ` AND u.region = $${params.length}`; }
    if (filters.roleType) { params.push(filters.roleType); query += ` AND r.role_type = $${params.length}`; }
    return this.db.query(query + ` ORDER BY u.full_name ASC`, params);
  }

  async getRoles() {
    return this.db.query(`SELECT id, name, role_type, description FROM identity.role WHERE is_active = true ORDER BY name ASC`);
  }

  async deactivateUser(userId: string, actorId: string) {
    const result = await this.db.query(`SELECT id, email FROM identity.user WHERE id = $1 AND deleted_at IS NULL`, [userId]);
    if (!result[0]) throw new NotFoundException(`User not found: ${userId}`);
    await this.db.query(`UPDATE identity.user SET is_active = false, updated_at = NOW() WHERE id = $1`, [userId]);
    return { message: `User ${result[0].email} deactivated` };
  }
  async unlockAccount(userId: string, actorId: string) {
    await this.db.query(
      `UPDATE identity.user SET failed_login_attempts = 0, locked_until = NULL, last_failed_at = NULL WHERE id = $1`,
      [userId],
    );
    await this.db.query(
      `INSERT INTO audit.audit_log (actor_id, action, resource_type, resource_id, details, ip_address)
       VALUES ($1, 'AUTH_ACCOUNT_UNLOCKED', 'user', $2, $3, 'system')`,
      [actorId, userId, JSON.stringify({ unlockedBy: actorId })],
    ).catch(() => {});
    return { message: 'Account unlocked', userId };
  }

  // ── Forgot Password ───────────────────────────────────────────
  async requestPasswordReset(email: string) {
    const users = await this.db.query(
      `SELECT id, email, full_name FROM identity.user WHERE email = $1 AND deleted_at IS NULL`,
      [email.toLowerCase()],
    );
    // Always return success to prevent email enumeration
    if (!users[0]) return { message: 'If that email exists, a reset link has been sent.' };

    const user = users[0];
    const token = crypto.randomBytes(48).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Invalidate existing tokens
    await this.db.query(
      `UPDATE identity.password_reset_token SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL`,
      [user.id],
    );

    await this.db.query(
      `INSERT INTO identity.password_reset_token (user_id, token, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '1 hour')`,
      [user.id, hashedToken],
    );

    await this.db.query(
      `INSERT INTO audit.audit_log (actor_id, action, resource_type, resource_id, details, ip_address)
       VALUES ($1, 'AUTH_PASSWORD_RESET_REQUESTED', 'user', $1, $2, 'system')`,
      [user.id, JSON.stringify({ email })],
    ).catch(() => {});

    const resetUrl = `${process.env.WEB_URL || 'https://civictrace-web.vercel.app'}/reset-password?token=${token}`;
    this.logger.log(`Password reset requested for ${email}. URL: ${resetUrl}`);

    return {
      message: 'If that email exists, a reset link has been sent.',
      // Only expose token in dev for testing
      ...(process.env.NODE_ENV !== 'production' && { resetUrl }),
    };
  }

  async resetPassword(token: string, newPassword: string) {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const tokens = await this.db.query(
      `SELECT prt.*, u.email FROM identity.password_reset_token prt
       JOIN identity.user u ON u.id = prt.user_id
       WHERE prt.token = $1 AND prt.used_at IS NULL AND prt.expires_at > NOW()`,
      [hashedToken],
    );

    if (!tokens[0]) throw new Error('Invalid or expired reset token');

    const resetToken = tokens[0];
    const bcrypt = await import('bcrypt');
    const newHash = await bcrypt.hash(newPassword, 12);

    await this.db.query(
      `UPDATE identity.user SET password_hash = $1, updated_at = NOW(),
       failed_login_attempts = 0, locked_until = NULL WHERE id = $2`,
      [newHash, resetToken.user_id],
    );

    await this.db.query(
      `UPDATE identity.password_reset_token SET used_at = NOW() WHERE id = $1`,
      [resetToken.id],
    );

    // Revoke all sessions on password reset
    await this.db.query(
      `UPDATE identity.user_session SET is_revoked = TRUE, revoked_at = NOW(), revoked_reason = 'PASSWORD_RESET'
       WHERE user_id = $1`,
      [resetToken.user_id],
    );

    await this.db.query(
      `INSERT INTO audit.audit_log (actor_id, action, resource_type, resource_id, details, ip_address)
       VALUES ($1, 'AUTH_PASSWORD_RESET', 'user', $1, $2, 'system')`,
      [resetToken.user_id, JSON.stringify({ email: resetToken.email })],
    ).catch(() => {});

    return { message: 'Password reset successfully. Please log in.' };
  }

  // ── Session Management ────────────────────────────────────────
  async createSession(userId: string, refreshToken: string, userAgent?: string, ip?: string) {
    const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await this.db.query(
      `INSERT INTO identity.user_session (user_id, refresh_token_hash, user_agent, ip_address, expires_at)
       VALUES ($1, $2, $3, $4, NOW() + INTERVAL '30 days')
       ON CONFLICT (refresh_token_hash) DO UPDATE SET last_used_at = NOW()`,
      [userId, hash, userAgent || null, ip || null],
    );
  }

  async revokeSession(refreshToken: string, reason = 'LOGOUT') {
    const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await this.db.query(
      `UPDATE identity.user_session
       SET is_revoked = TRUE, revoked_at = NOW(), revoked_reason = $1
       WHERE refresh_token_hash = $2`,
      [reason, hash],
    );
  }

  async revokeAllSessions(userId: string, reason = 'FORCED_LOGOUT') {
    await this.db.query(
      `UPDATE identity.user_session
       SET is_revoked = TRUE, revoked_at = NOW(), revoked_reason = $1
       WHERE user_id = $2 AND is_revoked = FALSE`,
      [reason, userId],
    );
    return { message: 'All sessions revoked', userId };
  }

  async isSessionRevoked(refreshToken: string): Promise<boolean> {
    const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const sessions = await this.db.query(
      `SELECT is_revoked FROM identity.user_session WHERE refresh_token_hash = $1`,
      [hash],
    );
    if (!sessions[0]) return true; // Unknown session = revoked
    return sessions[0].is_revoked;
  }

  async getUserSessions(userId: string) {
    return this.db.query(
      `SELECT id, user_agent, ip_address, is_revoked, revoked_reason,
              last_used_at, expires_at, created_at
       FROM identity.user_session
       WHERE user_id = $1
       ORDER BY created_at DESC LIMIT 20`,
      [userId],
    );
  }

}
