import { Module } from '@nestjs/common';
import { OsmFuelController } from './osm-fuel.controller';
import { OsmFuelService } from './osm-fuel.service';

@Module({
  controllers: [OsmFuelController],
  providers: [OsmFuelService],
  exports: [OsmFuelService],
})
export class OsmFuelModule {}
