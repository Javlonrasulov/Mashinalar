import { BadRequestException, Inject, Injectable, forwardRef } from '@nestjs/common';
import { LocationPoint, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TrackingGateway } from './tracking.gateway';
import { BatchLocationDto } from './dto/batch-location.dto';

/** GPS shovqinini kamaytirish: bundan yomonroq aniqlikdagi nuqtalar tahlildan chiqariladi. */
const MAX_ACCURACY_M = 100;
/** Bir joyda turgan deb hisoblash radiusi (metr). */
const DWELL_RADIUS_M = 120;
/** Minimal to‘xtash davomiyligi. */
const MIN_DWELL_MS = 10 * 60 * 1000;
/** Bir xil «tashrif joyi» klasterlari uchun radius (metr). */
const VISIT_CLUSTER_RADIUS_M = 200;

export type TrackingStopSegment = {
  startAt: string;
  endAt: string;
  durationSec: number;
  latitude: number;
  longitude: number;
  pointCount: number;
};

export type TrackingVisitedCluster = {
  latitude: number;
  longitude: number;
  totalStopSec: number;
  visitCount: number;
};

export type TrackingMapPoint = {
  latitude: number;
  longitude: number;
  recordedAt: string;
};

export type TrackingMapAnalytics = {
  gpsKm: number;
  odometerKm: number;
  odometerDays: number;
  pointsCount: number;
  pointsCountRaw: number;
  movingDurationSec: number;
  stoppedDurationSec: number;
  stopSegments: TrackingStopSegment[];
  visitedClusters: TrackingVisitedCluster[];
  startPoint: TrackingMapPoint | null;
  endPoint: TrackingMapPoint | null;
};

type InternalPt = { lat: number; lng: number; t: number };

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

  /**
   * Xarita tahlili: filtrlangan GPS masofa, Kun KM odometr, uzoq to‘xtashlar va klasterlar.
   */
  async mapAnalytics(vehicleId: string, from: Date, to: Date): Promise<TrackingMapAnalytics> {
    const raw = await this.history(vehicleId, from, to);
    const filtered = this.filterPointsForAnalytics(raw);
    const gpsKm = this.gpsPathKmInternal(filtered);
    const { km: odometerKm, daysCount: odometerDays } = await this.odometerKmInRange(vehicleId, from, to);
    const internal = this.toInternalPoints(filtered);
    const stopSegments = this.detectStopSegments(internal);
    const visitedClusters = this.clusterStopVisits(stopSegments);

    let movingDurationSec = 0;
    let stoppedDurationSec = 0;
    if (internal.length >= 2) {
      const spanMs = internal[internal.length - 1].t - internal[0].t;
      stoppedDurationSec = stopSegments.reduce((s, seg) => s + seg.durationSec, 0);
      movingDurationSec = Math.max(0, Math.floor(spanMs / 1000) - stoppedDurationSec);
    }

    const startPoint = this.toMapPoint(filtered[0]);
    const endPoint = this.toMapPoint(filtered[filtered.length - 1]);

    return {
      gpsKm,
      odometerKm,
      odometerDays,
      pointsCount: filtered.length,
      pointsCountRaw: raw.length,
      movingDurationSec,
      stoppedDurationSec,
      stopSegments,
      visitedClusters,
      startPoint,
      endPoint,
    };
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

  private utcDayStart(d: Date): Date {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
  }

  private filterPointsForAnalytics(rows: LocationPoint[]): LocationPoint[] {
    return rows.filter((p) => p.accuracyM == null || p.accuracyM <= MAX_ACCURACY_M);
  }

  private toInternalPoints(rows: LocationPoint[]): InternalPt[] {
    return rows.map((p) => ({
      lat: Number(p.latitude),
      lng: Number(p.longitude),
      t: p.recordedAt.getTime(),
    }));
  }

  private toMapPoint(p: LocationPoint | undefined): TrackingMapPoint | null {
    if (!p) return null;
    return {
      latitude: Number(p.latitude),
      longitude: Number(p.longitude),
      recordedAt: p.recordedAt.toISOString(),
    };
  }

  private haversineMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
    const R = 6371000;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const lat1 = toRad(aLat);
    const lat2 = toRad(bLat);
    const dLat = toRad(bLat - aLat);
    const dLon = toRad(bLng - aLng);
    const x =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
    return R * c;
  }

  private gpsPathKmInternal(rows: LocationPoint[]): number {
    if (rows.length < 2) return 0;
    let meters = 0;
    for (let i = 1; i < rows.length; i++) {
      const a = rows[i - 1];
      const b = rows[i];
      meters += this.haversineMeters(Number(a.latitude), Number(a.longitude), Number(b.latitude), Number(b.longitude));
    }
    return meters / 1000;
  }

  private async odometerKmInRange(
    vehicleId: string,
    from: Date,
    to: Date,
  ): Promise<{ km: number; daysCount: number }> {
    const fromDay = this.utcDayStart(from);
    const toDay = this.utcDayStart(to);
    const reports = await this.prisma.dailyKmReport.findMany({
      where: {
        vehicleId,
        reportDate: { gte: fromDay, lte: toDay },
        endKm: { not: null },
      },
      select: { startKm: true, endKm: true },
    });
    let km = 0;
    for (const r of reports) {
      if (r.endKm == null) continue;
      km += Number(r.endKm) - Number(r.startKm);
    }
    return { km: Math.max(0, km), daysCount: reports.length };
  }

  /**
   * Birinchi nuqtadan radius ichida qolgan ketma-ket nuqtalar oralig‘i;
   * vaqt oralig‘i MIN_DWELL_MS dan katta bo‘lsa — to‘xtash segmenti.
   */
  private detectStopSegments(pts: InternalPt[]): TrackingStopSegment[] {
    if (pts.length === 0) return [];
    const out: TrackingStopSegment[] = [];
    let i = 0;
    while (i < pts.length) {
      let j = i;
      while (j < pts.length && this.haversineMeters(pts[j].lat, pts[j].lng, pts[i].lat, pts[i].lng) <= DWELL_RADIUS_M) {
        j++;
      }
      j--;
      const durationMs = pts[j].t - pts[i].t;
      if (j > i && durationMs >= MIN_DWELL_MS) {
        const slice = pts.slice(i, j + 1);
        let sumLat = 0;
        let sumLng = 0;
        for (const p of slice) {
          sumLat += p.lat;
          sumLng += p.lng;
        }
        const n = slice.length;
        out.push({
          startAt: new Date(pts[i].t).toISOString(),
          endAt: new Date(pts[j].t).toISOString(),
          durationSec: Math.floor(durationMs / 1000),
          latitude: sumLat / n,
          longitude: sumLng / n,
          pointCount: n,
        });
        i = j + 1;
      } else {
        i++;
      }
    }
    return out;
  }

  private clusterStopVisits(segments: TrackingStopSegment[]): TrackingVisitedCluster[] {
    const clusters: TrackingVisitedCluster[] = [];
    for (const seg of segments) {
      let merged = false;
      for (const c of clusters) {
        const dM = this.haversineMeters(seg.latitude, seg.longitude, c.latitude, c.longitude);
        if (dM <= VISIT_CLUSTER_RADIUS_M) {
          const wOld = c.totalStopSec;
          const wNew = seg.durationSec;
          const sumW = wOld + wNew;
          if (sumW > 0) {
            c.latitude = (c.latitude * wOld + seg.latitude * wNew) / sumW;
            c.longitude = (c.longitude * wOld + seg.longitude * wNew) / sumW;
          }
          c.totalStopSec += seg.durationSec;
          c.visitCount += 1;
          merged = true;
          break;
        }
      }
      if (!merged) {
        clusters.push({
          latitude: seg.latitude,
          longitude: seg.longitude,
          totalStopSec: seg.durationSec,
          visitCount: 1,
        });
      }
    }
    return clusters.sort((a, b) => b.totalStopSec - a.totalStopSec);
  }
}
