import { Controller, Get, Logger } from '@nestjs/common';
import { AppService } from './app.service';
import { Cron, CronExpression } from '@nestjs/schedule';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  getHealth() { return { status: 'ok', timestamp: new Date().toISOString(), service: 'ValuGrid API' }; }

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  keepWarm() {
    Logger.log('Keep-warm ping — API is active', 'KeepWarm');
  }
}
