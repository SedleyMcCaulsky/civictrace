import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ComplianceAgentService } from './compliance-agent.service';

@Injectable()
export class ComplianceAgentScheduler {
  private readonly logger = new Logger(ComplianceAgentScheduler.name);
  constructor(private readonly agentService: ComplianceAgentService) {}

  // Every night at 11:30 PM Jamaica time (UTC-5 = 04:30 UTC)
  @Cron('30 4 * * *', { timeZone: 'America/Jamaica' })
  async runNightlyCompliance() {
    this.logger.log('Nightly compliance agent triggered');
    try {
      const result = await this.agentService.runNightlyAgent();
      this.logger.log(`Agent complete: ${JSON.stringify(result)}`);
    } catch (err) {
      this.logger.error('Nightly agent failed:', err);
    }
  }
}
