import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';

import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import jwtConfig from './config/jwt.config';

import { DatabaseModule } from './shared/database/database.module';
import { AuditInterceptor } from './shared/interceptors/audit.interceptor';
import { JwtAuthGuard } from './shared/auth/jwt-auth.guard';
import { PermissionsGuard } from './shared/guards/permissions.guard';

import { IdentityModule } from './modules/identity/identity.module';
import { GisModule } from './modules/gis/gis.module';
import { ComplianceModule } from './modules/compliance/compliance.module';
import { ReportingModule } from './modules/reporting/reporting.module';
import { EvidenceModule } from './modules/evidence/evidence.module';
import { PropertyCaseModule } from './modules/property-case/property-case.module';
import { DeliveryModule } from './modules/delivery/delivery.module';
import { ReconciliationModule } from './modules/reconciliation/reconciliation.module';
import { AuditModule } from './modules/audit/audit.module';
import { TaxDriveModule } from './modules/tax-drive/tax-drive.module';
import { ComplianceAgentModule } from './modules/compliance-agent/compliance-agent.module';
import { SummonsModule } from './modules/summons/summons.module';
import { ComplianceOpsModule } from './modules/compliance-ops/compliance-ops.module';
import { AiModule } from './modules/ai/ai.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, jwtConfig],
      envFilePath: '.env',
    }),
    ThrottlerModule.forRoot([
      { name: 'medium', ttl: 10000, limit: 100 },
      { name: 'long',   ttl: 60000, limit: 300 },
    ]),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    DatabaseModule,
    IdentityModule,
    GisModule,
    ComplianceModule,
    ReportingModule,
    EvidenceModule,
    PropertyCaseModule,
    DeliveryModule,
    ReconciliationModule,
    AuditModule,
    TaxDriveModule,
    ComplianceAgentModule,
    SummonsModule,
    ComplianceOpsModule,
    AiModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
