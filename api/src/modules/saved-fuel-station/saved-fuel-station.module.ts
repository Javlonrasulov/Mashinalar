import { Module } from '@nestjs/common';
import { SavedFuelStationController } from './saved-fuel-station.controller';
import { SavedFuelStationService } from './saved-fuel-station.service';

@Module({
  controllers: [SavedFuelStationController],
  providers: [SavedFuelStationService],
  exports: [SavedFuelStationService],
})
export class SavedFuelStationModule {}
