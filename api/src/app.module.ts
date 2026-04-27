import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { DailyKmModule } from './modules/daily-km/daily-km.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { DriversModule } from './modules/drivers/drivers.module';
import { ExpenseCategoriesModule } from './modules/expense-categories/expense-categories.module';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { FuelModule } from './modules/fuel/fuel.module';
import { PrismaModule } from './prisma/prisma.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { TrackingModule } from './modules/tracking/tracking.module';
import { OsmFuelModule } from './modules/osm-fuel/osm-fuel.module';
import { OilChangeModule } from './modules/oil-change/oil-change.module';
import { VehicleCategoriesModule } from './modules/vehicle-categories/vehicle-categories.module';
import { VehiclesModule } from './modules/vehicles/vehicles.module';
import { StatsModule } from './modules/stats/stats.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuditModule,
    AuthModule,
    VehiclesModule,
    VehicleCategoriesModule,
    OilChangeModule,
    DriversModule,
    TrackingModule,
    OsmFuelModule,
    FuelModule,
    DailyKmModule,
    TasksModule,
    StatsModule,
    ExpenseCategoriesModule,
    ExpensesModule,
    DashboardModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
