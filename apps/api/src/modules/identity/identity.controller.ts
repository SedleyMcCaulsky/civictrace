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

}
