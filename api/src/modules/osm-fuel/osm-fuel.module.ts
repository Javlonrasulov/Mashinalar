import { Module } from '@nestjs/common';
import { SavedFuelStationModule } from '../saved-fuel-station/saved-fuel-station.module';
import { OsmFuelController } from './osm-fuel.controller';
import { OsmFuelService } from './osm-fuel.service';

@Module({
  imports: [SavedFuelStationModule],
  controllers: [OsmFuelController],
  providers: [OsmFuelService],
  exports: [OsmFuelService],
})
export class OsmFuelModule {}
