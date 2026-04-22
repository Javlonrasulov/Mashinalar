import { BadRequestException, Inject, Injectable, forwardRef } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TrackingGateway } from './tracking.gateway';
import { BatchLocationDto } from './dto/batch-location.dto';

@Injectable()
export class TrackingService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => TrackingGateway))
    private readonly gateway: TrackingGateway,
  ) {}

  async ingest(driverId: string, dto: BatchLocationDto) {
    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
      include: { vehicle: true },
    });
    if (!driver?.vehicleId) throw new BadRequestException('Driver has no vehicle assigned');

    const vehicleId = driver.vehicleId;
    const rows: Prisma.LocationPointCreateManyInput[] = dto.points.map((p) => ({
      vehicleId,
      driverId,
      latitude: p.latitude,
      longitude: p.longitude,
      accuracyM: p.accuracyM,
      speed: p.speed,
      heading: p.heading,
      recordedAt: p.recordedAt ? new Date(p.recordedAt) : new Date(),
    }));

    if (!rows.length) return { inserted: 0 };

    /** Server receive time for `vehicle.lastLocationAt` (device clock / upload batch skew). */
    const receivedAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.locationPoint.createMany({ data: rows });
      const last = rows[rows.length - 1];
      await tx.vehicle.update({
        where: { id: vehicleId },
        data: {
          lastLatitude: last.latitude,
          lastLongitude: last.longitude,
          lastLocationAt: receivedAt,
        },
      });
    });

    const last = rows[rows.length - 1];
    this.gateway.emitLocation({
      vehicleId,
      driverId,
      latitude: Number(last.latitude),
      longitude: Number(last.longitude),
      recordedAt: receivedAt.toISOString(),
    });

    return { inserted: rows.length };
  }

  history(vehicleId: string, from: Date, to: Date) {
    return this.prisma.locationPoint.findMany({
      where: {
        vehicleId,
        recordedAt: { gte: from, lte: to },
      },
      orderBy: { recordedAt: 'asc' },
    });
  }

  async pathDistanceKm(vehicleId: string, from: Date, to: Date) {
    const pts = await this.history(vehicleId, from, to);
    if (pts.length < 2) return { km: 0, points: pts.length };

    let meters = 0;
    const R = 6371000;
    const toRad = (d: number) => (d * Math.PI) / 180;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const lat1 = toRad(Number(a.latitude));
      const lat2 = toRad(Number(b.latitude));
      const dLat = toRad(Number(b.latitude) - Number(a.latitude));
      const dLon = toRad(Number(b.longitude) - Number(a.longitude));
      const x =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
      meters += R * c;
    }
    return { km: meters / 1000, points: pts.length };
  }

  livePositions() {
    return this.prisma.vehicle.findMany({
      // Return all vehicles that have at least one known coordinate.
      // Online/offline is determined on the client by `lastLocationAt` freshness.
      where: { lastLatitude: { not: null }, lastLongitude: { not: null } },
      select: {
        id: true,
        name: true,
        plateNumber: true,
        lastLatitude: true,
        lastLongitude: true,
        lastLocationAt: true,
        drivers: {
          take: 1,
          select: { fullName: true, id: true },
        },
      },
    });
  }
}
