import { Module } from '@nestjs/common';
import { OsmFuelModule } from '../osm-fuel/osm-fuel.module';
import { SavedFuelStationModule } from '../saved-fuel-station/saved-fuel-station.module';
import { FuelController } from './fuel.controller';
import { FuelService } from './fuel.service';
import { FuelReconciliationService } from './fuel-reconciliation.service';

@Module({
  imports: [SavedFuelStationModule, OsmFuelModule],
  controllers: [FuelController],
  providers: [FuelService, FuelReconciliationService],
})
export class FuelModule {}
