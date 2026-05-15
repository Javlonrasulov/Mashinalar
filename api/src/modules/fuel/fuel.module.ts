import { Module } from '@nestjs/common';
import { SavedFuelStationModule } from '../saved-fuel-station/saved-fuel-station.module';
import { FuelController } from './fuel.controller';
import { FuelService } from './fuel.service';

@Module({
  imports: [SavedFuelStationModule],
  controllers: [FuelController],
  providers: [FuelService],
})
export class FuelModule {}
