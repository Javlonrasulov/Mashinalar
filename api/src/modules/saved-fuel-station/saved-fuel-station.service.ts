import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DEFAULT_SAVED_FUEL_RADIUS_M } from './saved-fuel-station.constants';
import { CreateSavedFuelStationDto } from './dto/create-saved-fuel-station.dto';
import { UpdateSavedFuelStationDto } from './dto/update-saved-fuel-station.dto';

export type SavedFuelStationItem = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class SavedFuelStationService {
  constructor(private readonly prisma: PrismaService) {}

  private static haversineM(
    a: { lat: number; lon: number },
    b: { lat: number; lon: number },
  ): number {
    const R = 6371000;
    const toRad = (x: number) => (x * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLon = toRad(b.lon - a.lon);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const s =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
    return R * c;
  }

  private toItem(row: {
    id: string;
    name: string;
    latitude: Prisma.Decimal;
    longitude: Prisma.Decimal;
    radiusMeters: number;
    createdAt: Date;
    updatedAt: Date;
  }): SavedFuelStationItem {
    return {
      id: row.id,
      name: row.name,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      radiusMeters: row.radiusMeters,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async list(): Promise<SavedFuelStationItem[]> {
    const rows = await this.prisma.savedFuelStation.findMany({
      orderBy: { name: 'asc' },
    });
    return rows.map((r) => this.toItem(r));
  }

  async create(dto: CreateSavedFuelStationDto): Promise<SavedFuelStationItem> {
    const row = await this.prisma.savedFuelStation.create({
      data: {
        name: dto.name.trim(),
        latitude: dto.latitude,
        longitude: dto.longitude,
        radiusMeters: dto.radiusMeters ?? DEFAULT_SAVED_FUEL_RADIUS_M,
      },
    });
    return this.toItem(row);
  }

  async update(id: string, dto: UpdateSavedFuelStationDto): Promise<SavedFuelStationItem> {
    await this.ensureExists(id);
    const row = await this.prisma.savedFuelStation.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.latitude !== undefined ? { latitude: dto.latitude } : {}),
        ...(dto.longitude !== undefined ? { longitude: dto.longitude } : {}),
        ...(dto.radiusMeters !== undefined ? { radiusMeters: dto.radiusMeters } : {}),
      },
    });
    return this.toItem(row);
  }

  async remove(id: string): Promise<void> {
    await this.ensureExists(id);
    await this.prisma.savedFuelStation.delete({ where: { id } });
  }

  /**
   * Eng yaqin saqlangan zapravka (o‘z radiusi ichida).
   * Bir nechta mos kelsa — eng yaqini.
   */
  matchNearestFromRows(
    lat: number,
    lon: number,
    stations: {
      id: string;
      name: string;
      latitude: Prisma.Decimal;
      longitude: Prisma.Decimal;
      radiusMeters: number;
    }[],
  ): { id: string; name: string; distanceM: number } | null {
    let best: { id: string; name: string; distanceM: number } | null = null;
    let bestD = Infinity;
    for (const s of stations) {
      const d = SavedFuelStationService.haversineM(
        { lat, lon },
        { lat: Number(s.latitude), lon: Number(s.longitude) },
      );
      if (d <= s.radiusMeters && d < bestD) {
        bestD = d;
        best = {
          id: s.id,
          name: s.name,
          distanceM: Math.round(d),
        };
      }
    }
    return best;
  }

  async matchNearest(
    lat: number,
    lon: number,
  ): Promise<{ id: string; name: string; distanceM: number } | null> {
    const stations = await this.prisma.savedFuelStation.findMany();
    return this.matchNearestFromRows(lat, lon, stations);
  }

  private async ensureExists(id: string) {
    const n = await this.prisma.savedFuelStation.count({ where: { id } });
    if (!n) throw new NotFoundException('Saved fuel station not found');
  }
}
