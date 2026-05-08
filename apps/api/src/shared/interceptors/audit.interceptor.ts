import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { Request } from 'express';

const AUDITED_METHODS = ['POST', 'PATCH', 'PUT', 'DELETE'];

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, url, ip, headers } = request;
    const user = (request as any).user;

    if (!AUDITED_METHODS.includes(method)) {
      return next.handle();
    }

    const startBody = JSON.stringify(request.body);

    return next.handle().pipe(
      tap(async (responseData) => {
        try {
          const urlParts = url.replace('/api/v1/', '').split('/');
          const entityType = urlParts[0] || 'unknown';
          const entityId = urlParts[1] || null;

          const actionMap: Record<string, string> = {
            POST: 'CREATE',
            PATCH: 'UPDATE',
            PUT: 'UPDATE',
            DELETE: 'DELETE',
          };

          const gpsLat = headers['x-gps-lat']
            ? parseFloat(headers['x-gps-lat'] as string)
            : null;
          const gpsLng = headers['x-gps-lng']
            ? parseFloat(headers['x-gps-lng'] as string)
            : null;

          await this.dataSource.query(
            `SELECT audit.write_audit_log(
              $1, $2, $3, $4,
              $5::audit.action_type,
              $6, $7::uuid, $8, $9,
              $10::jsonb, $11::jsonb, $12::text[],
              $13::inet, $14, $15::uuid, $16,
              $17, $18,
              $19::uuid, $20::uuid, $21
            )`,
            [
              user?.sub || null,
              user?.email || null,
              user?.role || null,
              false,
              actionMap[method] || 'UPDATE',
              entityType,
              entityId,
              null,
              `${method} ${url}`,
              startBody !== '{}' ? startBody : null,
              responseData ? JSON.stringify(responseData) : null,
              null,
              ip,
              headers['user-agent'] || null,
              headers['x-device-id'] || null,
              headers['x-device-fingerprint'] || null,
              gpsLat,
              gpsLng,
              headers['x-request-id'] || null,
              null,
              null,
            ],
          );
        } catch (err) {
          console.error('[AuditInterceptor] Failed to write audit log:', err.message);
        }
      }),
    );
  }
}
