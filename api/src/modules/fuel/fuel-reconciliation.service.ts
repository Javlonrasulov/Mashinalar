import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FuelKind, Prisma } from '@prisma/client';
import { ACTIVE_VEHICLE_WHERE } from '../../common/active-vehicle';
import { PrismaService } from '../../prisma/prisma.service';

const TZ = 'Asia/Tashkent';

function tashkentYmd(d: Date): { y: number; m: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const get = (t: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === t)?.value);
  return { y: get('year'), m: get('month'), day: get('day') };
}

function rangeForUzbekistanMonth(y: number, mo: number): { start: Date; end: Date } {
  const pad = (n: number) => String(n).padStart(2, '0');
  const start = new Date(`${y}-${pad(mo)}-01T00:00:00+05:00`);
  const nextMo = mo === 12 ? 1 : mo + 1;
  const nextY = mo === 12 ? y + 1 : y;
  const end = new Date(`${nextY}-${pad(nextMo)}-01T00:00:00+05:00`);
  return { start, end };
}

function daysInCalendarMonth(y: number, mo: number): number {
  return new Date(y, mo, 0).getDate();
}

@Injectable()
export class FuelReconciliationService {
  constructor(private readonly prisma: PrismaService) {}

  async getMonthlyGrid(params: {
    savedFuelStationId: string;
    year: number;
    month: number;
    includeAllFleet?: boolean;
  }) {
    const { savedFuelStationId, year, month } = params;
    if (
      !Number.isInteger(year) ||
      year < 2000 ||
      year > 2100 ||
      !Number.isInteger(month) ||
      month < 1 ||
      month > 12
    ) {
      throw new BadRequestException('Invalid year or month');
    }

    const station = await this.prisma.savedFuelStation.findUnique({
      where: { id: savedFuelStationId },
    });
    if (!station) throw new NotFoundException('Saved station not found');

    const dim = daysInCalendarMonth(year, month);
    const { start, end } = rangeForUzbekistanMonth(year, month);

    const reports = await this.prisma.fuelReport.findMany({
      where: {
        fuelKind: FuelKind.GAS,
        createdAt: { gte: start, lt: end },
        volume: { not: null },
        OR: [
          { savedFuelStationId },
          { stationLabel: station.name },
        ],
      },
      select: {
        vehicleId: true,
        volume: true,
        createdAt: true,
        vehicle: { select: { plateNumber: true } },
      },
    });

    type Key = string;
    const sysSum = new Map<Key, Map<number, number>>();
    function addVol(vehicleId: string, day: number, v: number) {
      let m = sysSum.get(vehicleId);
      if (!m) {
        m = new Map<number, number>();
        sysSum.set(vehicleId, m);
      }
      m.set(day, (m.get(day) ?? 0) + v);
    }

    for (const r of reports) {
      const { y: ry, m: rm, day: rd } = tashkentYmd(r.createdAt);
      if (ry !== year || rm !== month || rd < 1 || rd > dim) continue;
      const vol = Number(r.volume);
      if (!Number.isFinite(vol) || vol <= 0) continue;
      addVol(r.vehicleId, rd, vol);
    }

    const actualRows = await this.prisma.fuelStationMonthActual.findMany({
      where: { savedFuelStationId, year, month },
      select: { vehicleId: true, day: true, actualM3: true },
    });

    const actMap = new Map<Key, Map<number, number>>();
    for (const a of actualRows) {
      if (a.day < 1 || a.day > dim) continue;
      let m = actMap.get(a.vehicleId);
      if (!m) {
        m = new Map();
        actMap.set(a.vehicleId, m);
      }
      m.set(a.day, Number(a.actualM3));
    }

    const vehicleIds = new Set<string>([...sysSum.keys(), ...actMap.keys()]);

    if (params.includeAllFleet) {
      const fleet = await this.prisma.vehicle.findMany({
        where: ACTIVE_VEHICLE_WHERE,
        select: { id: true },
      });
      for (const v of fleet) vehicleIds.add(v.id);
    }

    const vehiclesMeta = await this.prisma.vehicle.findMany({
      where: { id: { in: [...vehicleIds] } },
      select: { id: true, plateNumber: true },
      orderBy: { plateNumber: 'asc' },
    });

    const plateById = new Map(vehiclesMeta.map((v) => [v.id, v.plateNumber]));

    const vehicles = [...vehicleIds]
      .map((id) => ({
        id,
        plateNumber: plateById.get(id) ?? id,
      }))
      .sort((a, b) => a.plateNumber.localeCompare(b.plateNumber, 'uz'));

    return {
      savedStation: { id: station.id, name: station.name },
      year,
      month,
      daysInMonth: dim,
      vehicles: vehicles.map((v) => {
        const sm = sysSum.get(v.id);
        const am = actMap.get(v.id);
        const systemM3ByDay: (number | null)[] = [];
        const actualM3ByDay: (number | null)[] = [];
        const diffM3ByDay: (number | null)[] = [];
        for (let d = 1; d <= dim; d += 1) {
          const s = sm?.get(d);
          const a = am?.get(d);
          const sv = s != null && Number.isFinite(s) && s > 0 ? s : null;
          const av = a != null && Number.isFinite(a) && a > 0 ? a : null;
          systemM3ByDay.push(sv);
          actualM3ByDay.push(av);
          if (sv == null && av == null) {
            diffM3ByDay.push(null);
          } else if (sv == null && av != null) {
            diffM3ByDay.push(-av);
          } else if (sv != null && av == null) {
            diffM3ByDay.push(sv);
          } else {
            diffM3ByDay.push((sv as number) - (av as number));
          }
        }
        return {
          vehicleId: v.id,
          plateNumber: v.plateNumber,
          systemM3ByDay,
          actualM3ByDay,
          diffM3ByDay,
        };
      }),
    };
  }

  async upsertMonthActual(params: {
    savedFuelStationId: string;
    vehicleId: string;
    year: number;
    month: number;
    day: number;
    actualM3: number | null;
  }) {
    const { savedFuelStationId, vehicleId, year, month, day, actualM3 } =
      params;
    if (
      !Number.isInteger(year) ||
      year < 2000 ||
      !Number.isInteger(month) ||
      month < 1 ||
      month > 12 ||
      !Number.isInteger(day) ||
      day < 1
    ) {
      throw new BadRequestException('Invalid date');
    }
    const dim = daysInCalendarMonth(year, month);
    if (day > dim) throw new BadRequestException('Invalid day for month');

    const station = await this.prisma.savedFuelStation.findUnique({
      where: { id: savedFuelStationId },
    });
    if (!station) throw new NotFoundException('Saved station not found');

    const veh = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });
    if (!veh) throw new NotFoundException('Vehicle not found');

    if (actualM3 == null || !Number.isFinite(actualM3) || actualM3 < 0) {
      await this.prisma.fuelStationMonthActual.deleteMany({
        where: { savedFuelStationId, vehicleId, year, month, day },
      });
      return { ok: true, deleted: true };
    }

    await this.prisma.fuelStationMonthActual.upsert({
      where: {
        savedFuelStationId_vehicleId_year_month_day: {
          savedFuelStationId,
          vehicleId,
          year,
          month,
          day,
        },
      },
      create: {
        savedFuelStationId,
        vehicleId,
        year,
        month,
        day,
        actualM3,
      },
      update: { actualM3 },
    });
    return { ok: true, deleted: false };
  }

  async createVedomostSnapshot(params: {
    savedFuelStationId: string;
    year: number;
    month: number;
    includeAllFleet?: boolean;
  }) {
    const { savedFuelStationId, year, month } = params;
    const grid = await this.getMonthlyGrid({
      savedFuelStationId,
      year,
      month,
      includeAllFleet: params.includeAllFleet === true,
    });
    const payload: VedomostSnapshotPayload = {
      capturedAt: new Date().toISOString(),
      includeAllFleet: params.includeAllFleet === true,
      grid,
    };
    const row = await this.prisma.fuelVedomostSnapshot.create({
      data: {
        savedFuelStationId,
        year,
        month,
        payload: payload as unknown as Prisma.InputJsonValue,
      },
    });
    return {
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      payload,
    };
  }

  async listVedomostSnapshots(params: {
    savedFuelStationId: string;
    year: number;
    month: number;
  }) {
    const { savedFuelStationId, year, month } = params;
    if (
      !Number.isInteger(year) ||
      year < 2000 ||
      year > 2100 ||
      !Number.isInteger(month) ||
      month < 1 ||
      month > 12
    ) {
      throw new BadRequestException('Invalid year or month');
    }
    const rows = await this.prisma.fuelVedomostSnapshot.findMany({
      where: { savedFuelStationId, year, month },
      orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true, year: true, month: true },
    });
    return rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      year: r.year,
      month: r.month,
    }));
  }

  async updateVedomostSnapshot(
    id: string,
    params?: { includeAllFleet?: boolean },
  ) {
    const row = await this.prisma.fuelVedomostSnapshot.findUnique({
      where: { id },
    });
    if (!row) throw new NotFoundException('Snapshot not found');
    const prev = row.payload as unknown as VedomostSnapshotPayload;
    const includeAllFleet =
      params?.includeAllFleet ?? prev.includeAllFleet === true;
    const grid = await this.getMonthlyGrid({
      savedFuelStationId: row.savedFuelStationId,
      year: row.year,
      month: row.month,
      includeAllFleet,
    });
    const payload: VedomostSnapshotPayload = {
      capturedAt: new Date().toISOString(),
      includeAllFleet,
      grid,
    };
    await this.prisma.fuelVedomostSnapshot.update({
      where: { id },
      data: { payload: payload as unknown as Prisma.InputJsonValue },
    });
    return {
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      year: row.year,
      month: row.month,
      payload,
    };
  }

  async applyVedomostSnapshotToMonthActuals(id: string) {
    const row = await this.prisma.fuelVedomostSnapshot.findUnique({
      where: { id },
    });
    if (!row) throw new NotFoundException('Snapshot not found');
    const { grid } = row.payload as unknown as VedomostSnapshotPayload;
    const { savedFuelStationId } = row;
    const { year, month } = grid;
    let applied = 0;
    for (const v of grid.vehicles) {
      for (let day = 1; day <= grid.daysInMonth; day++) {
        const actualM3 = v.actualM3ByDay[day - 1] ?? null;
        await this.upsertMonthActual({
          savedFuelStationId,
          vehicleId: v.vehicleId,
          year,
          month,
          day,
          actualM3,
        });
        applied += 1;
      }
    }
    return { ok: true, applied };
  }

  async getVedomostSnapshot(id: string): Promise<{
    id: string;
    createdAt: string;
    payload: VedomostSnapshotPayload;
  }> {
    const row = await this.prisma.fuelVedomostSnapshot.findUnique({
      where: { id },
    });
    if (!row) throw new NotFoundException('Snapshot not found');
    return {
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      payload: row.payload as unknown as VedomostSnapshotPayload,
    };
  }
}

export type MonthlyGridDto = Awaited<
  ReturnType<FuelReconciliationService['getMonthlyGrid']>
>;

export type VedomostSnapshotPayload = {
  capturedAt: string;
  includeAllFleet: boolean;
  grid: MonthlyGridDto;
};
