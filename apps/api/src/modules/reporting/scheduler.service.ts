import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EmailService } from './email.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);
  constructor(private readonly emailService: EmailService) {}

  // Every Monday at 7:00 AM Jamaica time (UTC-5 = 12:00 UTC)
  @Cron('0 12 * * 1', { timeZone: 'America/Jamaica' })
  async sendWeeklyCollectionsReport() {
    this.logger.log('Triggering weekly collections report...');
    const recipients = (process.env.REPORT_RECIPIENTS || 'sedley@civictrace.gov.jm')
      .split(',').map((r: string) => r.trim()).filter(Boolean);
    try {
      await this.emailService.sendWeeklyReport(recipients);
      this.logger.log('Weekly report dispatched');
    } catch (err) {
      this.logger.error('Weekly report failed:', err);
    }
  }
}
