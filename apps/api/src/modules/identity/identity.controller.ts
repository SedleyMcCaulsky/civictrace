import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IdentityService } from './identity.service';
import { LoginDto } from './dto/login.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { Public } from '../../shared/auth/jwt-auth.guard';
import { RequirePermissions } from '../../shared/guards/permissions.guard';

@ApiTags('Identity')
@Controller()
export class IdentityController {
  constructor(private readonly identityService: IdentityService) {}

  @Public()
  @Post('auth/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login and receive JWT tokens' })
  async login(@Body() dto: LoginDto) {
    return this.identityService.login(dto);
  }

  @Get('auth/me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  async getMe(@Request() req: any) {
    return req.user;
  }

  @Get('users')
  @RequirePermissions('users:read')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all users' })
  async getUsers(
    @Query('region') region?: string,
    @Query('roleType') roleType?: string,
  ) {
    return this.identityService.getUsers({ region, roleType });
  }

  @Post('users')
  @RequirePermissions('users:create')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new user' })
  async createUser(@Body() dto: CreateUserDto, @Request() req: any) {
    return this.identityService.createUser(dto, req.user.sub);
  }

  @Get('users/roles')
  @RequirePermissions('users:read')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all roles' })
  async getRoles() {
    return this.identityService.getRoles();
  }

  @Patch('users/:id/deactivate')
  @RequirePermissions('users:deactivate')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Deactivate a user account' })
  async deactivateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
  ) {
    return this.identityService.deactivateUser(id, req.user.sub);
  }
  @Post(':id/unlock')
  @RequirePermissions('users:manage')
  @ApiOperation({ summary: 'Unlock a locked account' })
  async unlockAccount(@Param('id') id: string, @Request() req: any) {
    return this.identityService.unlockAccount(id, req.user.sub);
  }

  @Public()
  @Post('auth/forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset email' })
  async forgotPassword(@Body('email') email: string) {
    return this.identityService.requestPasswordReset(email);
  }

  @Public()
  @Post('auth/reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with token' })
  async resetPassword(@Body('token') token: string, @Body('password') password: string) {
    return this.identityService.resetPassword(token, password);
  }

  @Post('auth/logout')
  @ApiOperation({ summary: 'Logout and revoke session' })
  async logout(@Body('refreshToken') refreshToken: string, @Request() req: any) {
    if (refreshToken) await this.identityService.revokeSession(refreshToken, 'LOGOUT');
    return { message: 'Logged out' };
  }

  @Post('auth/logout-all')
  @ApiOperation({ summary: 'Logout from all devices' })
  async logoutAll(@Request() req: any) {
    return this.identityService.revokeAllSessions(req.user.sub, 'LOGOUT_ALL');
  }

  @Get('auth/sessions')
  @ApiOperation({ summary: 'Get active sessions for current user' })
  async getSessions(@Request() req: any) {
    return this.identityService.getUserSessions(req.user.sub);
  }

  @Post('users/:id/revoke-sessions')
  @RequirePermissions('users:manage')
  @ApiOperation({ summary: 'Admin: revoke all sessions for a user' })
  async revokeUserSessions(@Param('id') id: string) {
    return this.identityService.revokeAllSessions(id, 'ADMIN_REVOKE');
  }

}
