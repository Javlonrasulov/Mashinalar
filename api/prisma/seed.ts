import { Prisma, PrismaClient, TaskStatus, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function ensureDefaultExpenseCategories() {
  const rows = [
    { id: 'cm_exp_cat_fuel', slug: 'FUEL', name: 'Ёқилғи' },
    { id: 'cm_exp_cat_repair', slug: 'REPAIR', name: 'Таъмир' },
    { id: 'cm_exp_cat_oil', slug: 'OIL', name: 'Мой' },
    { id: 'cm_exp_cat_other', slug: 'OTHER', name: 'Бошқа' },
  ];
  for (const r of rows) {
    await prisma.expenseCategory.upsert({
      where: { slug: r.slug },
      update: { name: r.name },
      create: { id: r.id, slug: r.slug, name: r.name },
    });
  }
}

async function main() {
  await ensureDefaultExpenseCategories();
  const passwordHash = await bcrypt.hash('Admin123!', 10);

  const admin = await prisma.user.upsert({
    where: { login: 'admin' },
    update: {},
    create: {
      login: 'admin',
      passwordHash,
      role: UserRole.ADMIN,
    },
  });

  const driverUser = await prisma.user.upsert({
    where: { login: 'driver1' },
    update: {},
    create: {
      login: 'driver1',
      passwordHash: await bcrypt.hash('Driver123!', 10),
      role: UserRole.DRIVER,
    },
  });

  const vehicle = await prisma.vehicle.upsert({
    where: { plateNumber: '01A001AA' },
    update: {},
    create: {
      name: 'Test mashina',
      model: 'Sprinter',
      plateNumber: '01A001AA',
      initialKm: 10000,
      oilChangeIntervalKm: 10000,
      lastOilChangeKm: 10000,
      lastOilChangeAt: new Date(),
      insuranceStartDate: new Date(),
      insuranceEndDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  });

  const driver = await prisma.driver.upsert({
    where: { userId: driverUser.id },
    update: {},
    create: {
      userId: driverUser.id,
      fullName: 'Test Haydovchi',
      phone: '+998901234567',
      vehicleId: vehicle.id,
    },
  });

  // Add realistic data so dashboards/lists are not all 0 during testing.
  const now = Date.now();

  const locationPointsCount = await prisma.locationPoint.count({
    where: { vehicleId: vehicle.id },
  });
  if (locationPointsCount === 0) {
    await prisma.locationPoint.createMany({
      data: Array.from({ length: 12 }).map((_, i) => ({
        vehicleId: vehicle.id,
        driverId: driver.id,
        latitude: new Prisma.Decimal('41.3110810'),
        longitude: new Prisma.Decimal('69.2405620'),
        accuracyM: 12 + i,
        speed: i * 3.2,
        heading: (i * 25) % 360,
        recordedAt: new Date(now - (12 - i) * 60 * 60 * 1000),
      })),
    });
  }

  const fuelReportsCount = await prisma.fuelReport.count({
    where: { vehicleId: vehicle.id },
  });
  if (fuelReportsCount === 0) {
    await prisma.fuelReport.createMany({
      data: [
        {
          vehicleId: vehicle.id,
          driverId: driver.id,
          amount: new Prisma.Decimal('350000'),
          currency: 'UZS',
          latitude: new Prisma.Decimal('41.3130000'),
          longitude: new Prisma.Decimal('69.2420000'),
          createdAt: new Date(now - 3 * 24 * 60 * 60 * 1000),
        },
        {
          vehicleId: vehicle.id,
          driverId: driver.id,
          amount: new Prisma.Decimal('420000'),
          currency: 'UZS',
          latitude: new Prisma.Decimal('41.3200000'),
          longitude: new Prisma.Decimal('69.2500000'),
          createdAt: new Date(now - 1 * 24 * 60 * 60 * 1000),
        },
      ],
    });
  }

  const dailyKmCount = await prisma.dailyKmReport.count({
    where: { vehicleId: vehicle.id },
  });
  if (dailyKmCount === 0) {
    const today = new Date();
    const day0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    await prisma.dailyKmReport.createMany({
      data: [
        {
          vehicleId: vehicle.id,
          driverId: driver.id,
          reportDate: new Date(day0.getTime() - 2 * 24 * 60 * 60 * 1000),
          startKm: new Prisma.Decimal('10000'),
          endKm: new Prisma.Decimal('10140'),
          createdAt: new Date(now - 2 * 24 * 60 * 60 * 1000),
        },
        {
          vehicleId: vehicle.id,
          driverId: driver.id,
          reportDate: new Date(day0.getTime() - 1 * 24 * 60 * 60 * 1000),
          startKm: new Prisma.Decimal('10140'),
          endKm: new Prisma.Decimal('10310'),
          createdAt: new Date(now - 1 * 24 * 60 * 60 * 1000),
        },
      ],
    });
  }

  const tasksCount = await prisma.task.count({
    where: { vehicleId: vehicle.id },
  });
  if (tasksCount === 0) {
    await prisma.task.createMany({
      data: [
        {
          vehicleId: vehicle.id,
          driverId: driver.id,
          title: 'Mashina yuvish',
          deadlineAt: new Date(now + 2 * 24 * 60 * 60 * 1000),
          status: TaskStatus.PENDING,
          note: 'Yuvib bo‘lgach rasm yuboring',
        },
        {
          vehicleId: vehicle.id,
          driverId: driver.id,
          title: 'Tex ko‘rik hujjatlari',
          deadlineAt: new Date(now + 1 * 24 * 60 * 60 * 1000),
          status: TaskStatus.SUBMITTED,
          submittedAt: new Date(now - 3 * 60 * 60 * 1000),
          proofText: 'Hujjatlar tayyor',
        },
        {
          vehicleId: vehicle.id,
          driverId: driver.id,
          title: 'G‘ildirak bosimini tekshirish',
          deadlineAt: new Date(now - 1 * 24 * 60 * 60 * 1000),
          status: TaskStatus.APPROVED,
          submittedAt: new Date(now - 26 * 60 * 60 * 1000),
          reviewedAt: new Date(now - 24 * 60 * 60 * 1000),
          proofText: 'Hammasi joyida',
        },
      ],
    });
  }

  const expensesCount = await prisma.expense.count({
    where: { vehicleId: vehicle.id },
  });
  if (expensesCount === 0) {
    const [cRepair, cOil, cOther] = await Promise.all([
      prisma.expenseCategory.findUniqueOrThrow({ where: { slug: 'REPAIR' } }),
      prisma.expenseCategory.findUniqueOrThrow({ where: { slug: 'OIL' } }),
      prisma.expenseCategory.findUniqueOrThrow({ where: { slug: 'OTHER' } }),
    ]);
    await prisma.expense.createMany({
      data: [
        {
          vehicleId: vehicle.id,
          categoryId: cRepair.id,
          amount: new Prisma.Decimal('250000'),
          currency: 'UZS',
          note: 'Mayda ta’mirlash',
          spentAt: new Date(now - 4 * 24 * 60 * 60 * 1000),
          createdAt: new Date(now - 4 * 24 * 60 * 60 * 1000),
        },
        {
          vehicleId: vehicle.id,
          categoryId: cOil.id,
          amount: new Prisma.Decimal('600000'),
          currency: 'UZS',
          note: 'Moy almashtirish',
          spentAt: new Date(now - 10 * 24 * 60 * 60 * 1000),
          createdAt: new Date(now - 10 * 24 * 60 * 60 * 1000),
        },
        {
          vehicleId: vehicle.id,
          categoryId: cOther.id,
          amount: new Prisma.Decimal('90000'),
          currency: 'UZS',
          note: 'Avtoturargoh',
          spentAt: new Date(now - 1 * 24 * 60 * 60 * 1000),
          createdAt: new Date(now - 1 * 24 * 60 * 60 * 1000),
        },
      ],
    });
  }

  console.log('Seed OK:', { admin: admin.login, driver: driverUser.login });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
