import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { OilChangeController } from './oil-change.controller';
import { OilChangeService } from './oil-change.service';

@Module({
  imports: [AuditModule],
  controllers: [OilChangeController],
  providers: [OilChangeService],
  exports: [OilChangeService],
})
export class OilChangeModule {}
