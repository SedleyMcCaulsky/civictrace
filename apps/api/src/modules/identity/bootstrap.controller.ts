import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { IsString, IsEmail, MinLength } from 'class-validator';
import { Public } from '../../shared/auth/jwt-auth.guard';
import * as bcrypt from 'bcrypt';

class BootstrapDto {
  @IsEmail()
  email: string;
  @IsString()
  @MinLength(8)
  password: string;
  @IsString()
  adminKey: string;
}

@ApiTags('Bootstrap')
@Controller('bootstrap')
export class BootstrapController {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly jwtService: JwtService,
  ) {}

  @Public()
  @Post('setup-admin')
  @ApiOperation({ summary: 'One-time admin setup — remove after use' })
  async setupAdmin(@Body() dto: BootstrapDto) {
    if (dto.adminKey !== 'CIVICTRACE_SETUP_2026') {
      return { error: 'Invalid admin key' };
    }

    const result = await this.db.query(
      `SELECT u.id, u.email, u.full_name, r.name as role_name, r.role_type
       FROM identity.user u
       JOIN identity.role r ON r.id = u.role_id
       WHERE u.email = $1 AND u.deleted_at IS NULL`,
      [dto.email.toLowerCase()],
    );

    const user = result[0];
    if (!user) return { error: 'User not found' };

    const permissions = await this.db.query(
      `SELECT p.code FROM identity.role_permission rp
       JOIN identity.permission p ON p.id = rp.permission_id
       JOIN identity.role r ON r.id = rp.role_id
       JOIN identity.user u ON u.role_id = r.id
       WHERE u.id = $1`,
      [user.id],
    );

    const permissionCodes = permissions.map((p: any) => p.code);

    const payload: any = {
      sub: user.id,
      email: user.email,
      role: user.role_name,
      roleType: user.role_type,
      permissions: permissionCodes,
      isMobile: false,
      deviceId: null,
    };

    const token = this.jwtService.sign(payload);

    return {
      message: 'Token generated successfully',
      accessToken: token,
      user: { id: user.id, email: user.email, role: user.role_name },
    };
  }
}
