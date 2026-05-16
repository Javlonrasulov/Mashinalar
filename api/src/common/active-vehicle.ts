import { Prisma } from '@prisma/client';

/** Faol (o‘chirilmagan) mashinalar uchun Prisma filter. */
export const ACTIVE_VEHICLE_WHERE: Prisma.VehicleWhereInput = {
  deletedAt: null,
};
