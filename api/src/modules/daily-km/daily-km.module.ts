import { Module } from '@nestjs/common';
import { DailyKmController } from './daily-km.controller';
import { DailyKmService } from './daily-km.service';

@Module({
  controllers: [DailyKmController],
  providers: [DailyKmService],
})
export class DailyKmModule {}
