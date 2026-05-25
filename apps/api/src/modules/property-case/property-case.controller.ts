import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PropertyCaseService } from './property-case.service';
import { CreateCaseDto } from './dto/create-case.dto';
import { SearchCasesDto } from './dto/search-cases.dto';
import { RequirePermissions } from '../../shared/guards/permissions.guard';

@ApiTags('Property Cases')
@ApiBearerAuth()
@Controller('cases')
export class PropertyCaseController {
  constructor(private readonly service: PropertyCaseService) {}

  @Post()
  @RequirePermissions('cases:create')
  @ApiOperation({ summary: 'Create a new property case with tax balances' })
  async createCase(@Body() dto: CreateCaseDto, @Request() req: any) {
    return this.service.createCase(dto, req.user.sub);
  }

  @Get()
  @RequirePermissions('cases:read')
  @ApiOperation({ summary: 'Search property cases' })
  async searchCases(@Query() dto: SearchCasesDto, @Request() req: any) {
    return this.service.searchCases(dto, req.user.organisationId);
  }

  @Get('areas')
  @RequirePermissions('cases:read')
  @ApiOperation({ summary: 'List all areas for dropdown' })
  async getAreas() {
    return this.service.getAreas();
  }

  @Get(':id')
  @RequirePermissions('cases:read')
  @ApiOperation({ summary: 'Get full case detail by ID' })
  async getCaseById(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getCaseById(id);
  }
}
