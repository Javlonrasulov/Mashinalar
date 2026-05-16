/**
 * Kun KM: noto‘g‘ri kiritilgan KM ni tuzatish (bir martalik).
 *
 * Misol (prod serverda):
 *   cd /opt/mashina-prod/api
 *   node scripts/fix-daily-km-value.mjs --plate "01 208 ZKA" --from 536489 --to 53648 --apply
 *
 * Avval dry-run (default):
 *   node scripts/fix-daily-km-value.mjs --plate "01 208 ZKA" --from 536489 --to 53648
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function parseArgs(argv) {
  const out = { plate: '01 208 ZKA', from: 536489, to: 53648, apply: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') out.apply = true;
    else if (a === '--plate' && argv[i + 1]) out.plate = argv[++i];
    else if (a === '--from' && argv[i + 1]) out.from = Number(argv[++i]);
    else if (a === '--to' && argv[i + 1]) out.to = Number(argv[++i]);
  }
  return out;
}

function normPlate(s) {
  return s.replace(/\s+/g, '').toUpperCase();
}

async function main() {
  const { plate, from, to, apply } = parseArgs(process.argv);
  if (!Number.isFinite(from) || !Number.isFinite(to)) {
    console.error('Invalid --from or --to');
    process.exit(1);
  }

  const targetNorm = normPlate(plate);
  const vehicles = await prisma.vehicle.findMany({
    select: { id: true, plateNumber: true, initialKm: true },
  });
  const vehicle = vehicles.find((v) => normPlate(v.plateNumber) === targetNorm);
  if (!vehicle) {
    console.error(`Vehicle not found for plate "${plate}" (normalized: ${targetNorm})`);
    console.error(
      'Similar:',
      vehicles
        .filter((v) => v.plateNumber.includes('208') || v.plateNumber.toUpperCase().includes('ZKA'))
        .map((v) => v.plateNumber)
        .slice(0, 15),
    );
    process.exit(1);
  }

  const initialKm = Number(vehicle.initialKm);
  const reports = await prisma.dailyKmReport.findMany({
    where: { vehicleId: vehicle.id },
    orderBy: { reportDate: 'asc' },
  });

  const matches = reports.filter((r) => {
    const s = Number(r.startKm);
    const e = r.endKm == null ? null : Number(r.endKm);
    return s === from || e === from;
  });

  if (!matches.length) {
    console.log(`No report with KM=${from} for ${vehicle.plateNumber}`);
    console.log('Recent reports:');
    for (const r of reports.slice(-8)) {
      console.log(
        `  ${r.reportDate.toISOString().slice(0, 10)} start=${r.startKm} end=${r.endKm ?? '—'} id=${r.id}`,
      );
    }
    process.exit(1);
  }

  console.log(`Vehicle: ${vehicle.plateNumber} (${vehicle.id})`);
  console.log(`Mode: ${apply ? 'APPLY' : 'DRY-RUN'}`);
  console.log(`Change: ${from} → ${to}\n`);

  for (const r of matches) {
    const patchStart = Number(r.startKm) === from;
    const patchEnd = r.endKm != null && Number(r.endKm) === from;
    const nextStart = patchStart ? to : Number(r.startKm);
    const nextEnd = patchEnd ? to : r.endKm == null ? null : Number(r.endKm);

    if (nextStart < initialKm) {
      console.error(`  SKIP ${r.id}: start ${nextStart} < initial ${initialKm}`);
      continue;
    }
    if (nextEnd != null && nextEnd < nextStart) {
      console.error(`  SKIP ${r.id}: end ${nextEnd} < start ${nextStart}`);
      continue;
    }

    console.log(
      `  ${r.reportDate.toISOString().slice(0, 10)} id=${r.id}`,
      `start: ${patchStart ? `${from}→${to}` : r.startKm}`,
      `end: ${patchEnd ? `${from}→${to}` : r.endKm ?? '—'}`,
    );

    if (apply) {
      const data = {};
      if (patchStart) data.startKm = to;
      if (patchEnd) data.endKm = to;
      await prisma.dailyKmReport.update({ where: { id: r.id }, data });
      console.log('    ✓ updated');
    }
  }

  if (!apply) console.log('\nRe-run with --apply to write changes.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
