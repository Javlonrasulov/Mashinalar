import { BadRequestException, Injectable } from '@nestjs/common';
import { FuelKind, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { OsmFuelService } from '../osm-fuel/osm-fuel.service';
import { SavedFuelStationService } from '../saved-fuel-station/saved-fuel-station.service';

function mapFuelRow(r: {
  id: string;
  amount: Prisma.Decimal;
  fuelKind: FuelKind;
  unitPrice: Prisma.Decimal | null;
  volume: Prisma.Decimal | null;
  createdAt: Date;
  vehiclePhotoUrl: string | null;
  receiptPhotoUrl: string | null;
}) {
  return {
    id: r.id,
    amount: String(r.amount),
    fuelKind: r.fuelKind,
    unitPrice: r.unitPrice == null ? null : String(r.unitPrice),
    volume: r.volume == null ? null : String(r.volume),
    createdAt: r.createdAt.toISOString(),
    vehiclePhotoUrl: r.vehiclePhotoUrl ?? null,
    receiptPhotoUrl: r.receiptPhotoUrl ?? null,
  };
}

@Injectable()
export class FuelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly savedFuel: SavedFuelStationService,
    private readonly osmFuel: OsmFuelService,
  ) {}

  /** Haydovchi o‘zining so‘nggi zapravka (fuel) yozuvlari */
  async findMine(driverId: string, limitRaw?: string) {
    const n = limitRaw != null && limitRaw !== '' ? Number(limitRaw) : 50;
    const take = Number.isFinite(n) && n > 0 && n <= 100 ? Math.floor(n) : 50;
    const rows = await this.prisma.fuelReport.findMany({
      where: { driverId },
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true,
        amount: true,
        fuelKind: true,
        unitPrice: true,
        volume: true,
        createdAt: true,
        vehiclePhotoUrl: true,
        receiptPhotoUrl: true,
      },
    });
    return rows.map(mapFuelRow);
  }

  /**
   * Saqlangan (admin) yoki OSM (xarita qatlami) zapravka — qo‘lda qo‘shmasdan ham nom topiladi.
   */
  private async resolveNearestStation(
    lat: number,
    lon: number,
    savedStations: {
      id: string;
      name: string;
      latitude: Prisma.Decimal;
      longitude: Prisma.Decimal;
      radiusMeters: number;
    }[],
  ): Promise<{ label: string; savedId?: string } | null> {
    const nearest = await this.osmFuel.nearestFuelStation(lat, lon);
    if (!nearest.label) return null;
    const savedHit = this.savedFuel.matchNearestFromRows(
      lat,
      lon,
      savedStations,
    );
    return {
      label: nearest.label,
      savedId: savedHit?.id,
    };
  }

  async nearestFuelStation(lat: number, lon: number) {
    return this.osmFuel.nearestFuelStation(lat, lon);
  }

  /** Eski yozuvlar: stationLabel bo‘sh bo‘lsa, saqlangan zapravkadan to‘ldirish. */
  async backfillStationLabels(): Promise<{ updated: number; scanned: number }> {
    const [rows, stations] = await Promise.all([
      this.prisma.fuelReport.findMany({
        where: {
          stationLabel: null,
          latitude: { not: null },
          longitude: { not: null },
        },
        select: { id: true, latitude: true, longitude: true },
      }),
      this.prisma.savedFuelStation.findMany(),
    ]);

    let updated = 0;
    const updates: Promise<unknown>[] = [];
    for (const r of rows) {
      const lat = Number(r.latitude);
      const lon = Number(r.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      const hit = await this.resolveNearestStation(lat, lon, stations);
      if (!hit) continue;
      updated += 1;
      updates.push(
        this.prisma.fuelReport.update({
          where: { id: r.id },
          data: {
            stationLabel: hit.label,
            ...(hit.savedId ? { savedFuelStationId: hit.savedId } : {}),
          },
        }),
      );
    }
    if (updates.length) await Promise.all(updates);
    return { updated, scanned: rows.length };
  }

  /**
   * GPS ва харитада жойлашган сақланган заправкалар бўйича барча ёзувларни қайта белгилайди.
   * Радиус ичида — сақланган ном; акс холда OSM яқин нуқта номи.
   */
  private async resolveStationFieldsFromGps(
    lat: number,
    lon: number,
    stations: {
      id: string;
      name: string;
      latitude: Prisma.Decimal;
      longitude: Prisma.Decimal;
      radiusMeters: number;
    }[],
  ): Promise<{ stationLabel: string | null; savedFuelStationId: string | null }> {
    const savedHit = this.savedFuel.matchNearestFromRows(lat, lon, stations);
    if (savedHit) {
      const row = stations.find((s) => s.id === savedHit.id);
      const name = row?.name?.trim();
      if (name) {
        return { stationLabel: name, savedFuelStationId: savedHit.id };
      }
      const nearest = await this.osmFuel.nearestFuelStation(lat, lon);
      return {
        stationLabel: nearest?.label?.trim() || null,
        savedFuelStationId: savedHit.id,
      };
    }
    const nearest = await this.osmFuel.nearestFuelStation(lat, lon);
    if (!nearest?.label?.trim()) {
      return { stationLabel: null, savedFuelStationId: null };
    }
    return {
      stationLabel: nearest.label.trim(),
      savedFuelStationId: null,
    };
  }

  async resyncStationsFromGps(): Promise<{ updated: number; scanned: number }> {
    const [rows, stations] = await Promise.all([
      this.prisma.fuelReport.findMany({
        where: {
          latitude: { not: null },
          longitude: { not: null },
        },
        select: { id: true, latitude: true, longitude: true },
      }),
      this.prisma.savedFuelStation.findMany(),
    ]);

    let updated = 0;
    for (const r of rows) {
      const lat = Number(r.latitude);
      const lon = Number(r.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      const next = await this.resolveStationFieldsFromGps(lat, lon, stations);
      await this.prisma.fuelReport.update({
        where: { id: r.id },
        data: {
          stationLabel: next.stationLabel,
          savedFuelStationId: next.savedFuelStationId,
        },
      });
      updated += 1;
    }
    return { updated, scanned: rows.length };
  }

  async findAll(params?: {
    date?: string;
    from?: string;
    to?: string;
    fuelKind?: string;
  }) {
    const date = params?.date?.trim();
    const fromRaw = params?.from?.trim();
    const toRaw = params?.to?.trim();
    const kindRaw = params?.fuelKind?.trim().toUpperCase();

    let createdAt: { gte: Date; lt: Date } | undefined;
    let fuelKind: FuelKind | undefined;

    if (kindRaw === 'GAS' || kindRaw === 'PETROL') {
      fuelKind = kindRaw as FuelKind;
    }

    if (fromRaw && toRaw) {
      const gte = new Date(fromRaw);
      const lt = new Date(toRaw);
      if (
        Number.isFinite(gte.getTime()) &&
        Number.isFinite(lt.getTime()) &&
        lt > gte
      ) {
        createdAt = { gte, lt };
      }
    }

    if (!createdAt && date) {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
      if (m) {
        const y = Number(m[1]);
        const mo = Number(m[2]);
        const d = Number(m[3]);
        if (Number.isFinite(y) && Number.isFinite(mo) && Number.isFinite(d)) {
          const start = new Date(Date.UTC(y, mo - 1, d, 0, 0, 0, 0));
          const end = new Date(Date.UTC(y, mo - 1, d + 1, 0, 0, 0, 0));
          createdAt = { gte: start, lt: end };
        }
      }
    }

    const [rows, stations] = await Promise.all([
      this.prisma.fuelReport.findMany({
        orderBy: { createdAt: 'desc' },
        include: { vehicle: true, driver: true },
        where: {
          ...(createdAt ? { createdAt } : {}),
          ...(fuelKind ? { fuelKind } : {}),
        },
      }),
      this.prisma.savedFuelStation.findMany(),
    ]);

    const persistJobs: Promise<unknown>[] = [];
    const mapped = await Promise.all(
      rows.map(async (r) => {
      let stationLabel = r.stationLabel?.trim() || null;
      let resolvedId = r.savedFuelStationId;

      if (!stationLabel && r.savedFuelStationId) {
        const linked = stations.find((s) => s.id === r.savedFuelStationId);
        if (linked) stationLabel = linked.name;
      }

      if (!stationLabel && r.latitude != null && r.longitude != null) {
        const lat = Number(r.latitude);
        const lon = Number(r.longitude);
        if (Number.isFinite(lat) && Number.isFinite(lon)) {
          const hit = await this.resolveNearestStation(lat, lon, stations);
          if (hit) {
            stationLabel = hit.label;
            resolvedId = hit.savedId ?? null;
          }
        }
      }

      if (
        stationLabel &&
        (!r.stationLabel?.trim() ||
          r.savedFuelStationId !== resolvedId ||
          !r.savedFuelStationId)
      ) {
        const data: { stationLabel: string; savedFuelStationId?: string } = {
          stationLabel,
        };
        if (resolvedId) data.savedFuelStationId = resolvedId;
        persistJobs.push(
          this.prisma.fuelReport.update({ where: { id: r.id }, data }),
        );
      }

      return {
        id: r.id,
        amount: String(r.amount),
        fuelKind: r.fuelKind,
        unitPrice: r.unitPrice == null ? null : String(r.unitPrice),
        volume: r.volume == null ? null : String(r.volume),
        createdAt: r.createdAt.toISOString(),
        latitude: r.latitude == null ? null : String(r.latitude),
        longitude: r.longitude == null ? null : String(r.longitude),
        stationLabel,
        savedFuelStationId: r.savedFuelStationId ?? null,
        vehiclePhotoUrl: r.vehiclePhotoUrl ?? null,
        receiptPhotoUrl: r.receiptPhotoUrl ?? null,
        vehicle: {
          id: r.vehicle.id,
          plateNumber: r.vehicle.plateNumber,
          gasPricePerM3:
            r.vehicle.gasPricePerM3 == null
              ? null
              : String(r.vehicle.gasPricePerM3),
          petrolPricePerLiter:
            r.vehicle.petrolPricePerLiter == null
              ? null
              : String(r.vehicle.petrolPricePerLiter),
        },
        driver: {
          fullName: r.driver.fullName,
        },
      };
    }),
    );

    if (persistJobs.length) {
      await Promise.all(persistJobs);
    }

    return mapped;
  }

  private resolveUnitPrice(
    fuelKind: FuelKind,
    vehicle: {
      gasPricePerM3: Prisma.Decimal | null;
      petrolPricePerLiter: Prisma.Decimal | null;
    },
    unitPriceRaw?: number,
  ): number {
    if (unitPriceRaw != null && Number.isFinite(unitPriceRaw) && unitPriceRaw > 0) {
      return unitPriceRaw;
    }
    if (fuelKind === FuelKind.GAS) {
      const p =
        vehicle.gasPricePerM3 != null ? Number(vehicle.gasPricePerM3) : NaN;
      if (Number.isFinite(p) && p > 0) return p;
      throw new BadRequestException('fuel.gas_price_not_set');
    }
    const p =
      vehicle.petrolPricePerLiter != null
        ? Number(vehicle.petrolPricePerLiter)
        : NaN;
    if (Number.isFinite(p) && p > 0) return p;
    throw new BadRequestException('fuel.petrol_price_not_set');
  }

  async createFromDriver(params: {
    driverId: string;
    amount: number;
    fuelKind: FuelKind;
    unitPrice?: number;
    vehiclePhotoUrl?: string;
    receiptPhotoUrl?: string;
    latitude?: number;
    longitude?: number;
    actorUserId: string;
  }) {
    const driver = await this.prisma.driver.findUnique({
      where: { id: params.driverId },
      include: { vehicle: true },
    });
    if (!driver?.vehicleId || !driver.vehicle || driver.vehicle.deletedAt)
      throw new BadRequestException('No vehicle assigned');

    const unitPrice = this.resolveUnitPrice(
      params.fuelKind,
      driver.vehicle,
      params.unitPrice,
    );
    const volume = params.amount / unitPrice;
    if (!Number.isFinite(volume) || volume <= 0) {
      throw new BadRequestException('fuel.invalid_volume');
    }

    let savedFuelStationId: string | undefined;
    let stationLabel: string | undefined;
    if (
      params.latitude != null &&
      params.longitude != null &&
      Number.isFinite(params.latitude) &&
      Number.isFinite(params.longitude)
    ) {
      const savedStations = await this.prisma.savedFuelStation.findMany();
      const hit = await this.resolveNearestStation(
        params.latitude,
        params.longitude,
        savedStations,
      );
      if (hit) {
        stationLabel = hit.label;
        savedFuelStationId = hit.savedId;
      }
    }

    const row = await this.prisma.fuelReport.create({
      data: {
        vehicleId: driver.vehicleId,
        driverId: params.driverId,
        fuelKind: params.fuelKind,
        unitPrice,
        volume,
        amount: params.amount,
        vehiclePhotoUrl: params.vehiclePhotoUrl,
        receiptPhotoUrl: params.receiptPhotoUrl,
        latitude: params.latitude,
        longitude: params.longitude,
        savedFuelStationId,
        stationLabel,
      },
      include: { vehicle: true, driver: true },
    });

    const fuelCategory = await this.prisma.expenseCategory.findUnique({
      where: { slug: 'FUEL' },
    });
    if (!fuelCategory)
      throw new BadRequestException('FUEL expense category missing');
    await this.prisma.expense.create({
      data: {
        vehicleId: driver.vehicleId,
        categoryId: fuelCategory.id,
        amount: params.amount,
        note: `Fuel report ${row.id} (${params.fuelKind})`,
        spentAt: row.createdAt,
      },
    });

    await this.audit.log({
      actorUserId: params.actorUserId,
      action: 'fuel.create',
      entity: 'FuelReport',
      entityId: row.id,
      meta: { fuelKind: params.fuelKind, unitPrice, volume },
    });
    return row;
  }
}
