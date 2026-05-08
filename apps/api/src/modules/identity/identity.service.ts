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
              u.region, u.password_hash, r.name as role_name, r.role_type
       FROM identity.user u
       JOIN identity.role r ON r.id = u.role_id
       WHERE u.email = $1 AND u.deleted_at IS NULL LIMIT 1`,
      [dto.email.toLowerCase()],
    );
    const user = result[0];
    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (!user.is_active) throw new UnauthorizedException('Account is deactivated');
    if (!user.password_hash) throw new UnauthorizedException('Account not configured');
    const valid = await bcrypt.compare(dto.password, user.password_hash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');
    const permissions = await this.db.query<any[]>(
      `SELECT p.code FROM identity.role_permission rp
       JOIN identity.permission p ON p.id = rp.permission_id
       JOIN identity.role r ON r.id = rp.role_id
       JOIN identity.user u ON u.role_id = r.id WHERE u.id = $1`,
      [user.id],
    );
    const permissionCodes = permissions.map((p: any) => p.code);
    await this.db.query(`UPDATE identity.user SET last_login_at = NOW() WHERE id = $1`, [user.id]);
    const payload: any = { sub: user.id, email: user.email, role: user.role_name, roleType: user.role_type, permissions: permissionCodes, isMobile: false, deviceId: null };
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign({ sub: user.id } as any, { secret: this.configService.get<string>('jwt.refreshSecret') } as any);
    return { accessToken, refreshToken, user: { id: user.id, email: user.email, fullName: user.full_name, role: user.role_name, permissions: permissionCodes, isFieldOfficer: user.is_field_officer, region: user.region } };
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
}
