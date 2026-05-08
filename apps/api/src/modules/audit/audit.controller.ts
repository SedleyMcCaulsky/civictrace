import { Controller, Get, Query, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { RequirePermissions } from '../../shared/guards/permissions.guard';

@ApiTags('Audit')
@ApiBearerAuth()
@Controller('audit')
export class AuditController {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  @Get('logs')
  @RequirePermissions('audit:read')
  @ApiOperation({ summary: 'Query audit log with filters' })
  @ApiQuery({ name: 'entityType', required: false })
  @ApiQuery({ name: 'actorId', required: false })
  @ApiQuery({ name: 'action', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getLogs(
    @Query('entityType') entityType?: string,
    @Query('actorId') actorId?: string,
    @Query('action') action?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 50,
  ) {
    const conditions: string[] = [];
    const params: any[] = [];
    let i = 1;

    if (entityType) { conditions.push(`entity_type = $${i++}`); params.push(entityType); }
    if (actorId) { conditions.push(`actor_id = $${i++}::uuid`); params.push(actorId); }
    if (action) { conditions.push(`action = $${i++}::audit.action_type`); params.push(action); }
    if (from) { conditions.push(`occurred_at >= $${i++}::timestamptz`); params.push(from); }
    if (to) { conditions.push(`occurred_at <= $${i++}::timestamptz`); params.push(to); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (Number(page) - 1) * Number(limit);

    const [logs, count] = await Promise.all([
      this.db.query(
        `SELECT id, actor_email, actor_role, action, entity_type, entity_id,
                composite_key, description, changed_fields, ip_address,
                occurred_at, checksum
         FROM audit.audit_log
         ${where}
         ORDER BY occurred_at DESC
         LIMIT $${i++} OFFSET $${i++}`,
        [...params, limit, offset],
      ),
      this.db.query(
        `SELECT COUNT(*) as total FROM audit.audit_log ${where}`,
        params,
      ),
    ]);

    return {
      data: logs,
      pagination: {
        total: parseInt(count[0].total),
        page: Number(page),
        limit: Number(limit),
      },
    };
  }

  @Get('entity/:id')
  @RequirePermissions('audit:read')
  @ApiOperation({ summary: 'Get full audit timeline for a specific entity' })
  async getEntityTimeline(@Param('id', ParseUUIDPipe) id: string) {
    return this.db.query(
      `SELECT id, actor_email, actor_role, action, entity_type,
              composite_key, description, previous_value, new_value,
              changed_fields, ip_address, device_fingerprint,
              occurred_at, checksum
       FROM audit.audit_log
       WHERE entity_id = $1::uuid
       ORDER BY occurred_at ASC`,
      [id],
    );
  }

  @Get('composite/:key')
  @RequirePermissions('audit:read')
  @ApiOperation({ summary: 'Get audit trail by composite key' })
  async getByCompositeKey(@Param('key') key: string) {
    return this.db.query(
      `SELECT id, actor_email, action, entity_type, description, occurred_at, checksum
       FROM audit.audit_log
       WHERE composite_key = $1
       ORDER BY occurred_at DESC`,
      [key],
    );
  }
}
