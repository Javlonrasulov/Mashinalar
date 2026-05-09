/**
 * Bir martalik skript: mavjud `uploads/` papkasidagi barcha rasmlarni siqadi.
 *
 * - Har bir faylni JPEG quality 80, max 1920px ga keltiradi
 * - Agar fayl rasm bo'lmasa yoki siqilgani kattaroq chiqsa, asl saqlanadi
 * - Kengaytma .jpg ga o'zgartirilsa, DB dagi `*Url` maydonlari ham yangilanadi
 *
 * Ishga tushirish:
 *   cd /opt/mashina-prod/api
 *   node -r ts-node/register scripts/compress-existing-uploads.ts
 *   # yoki: npx ts-node scripts/compress-existing-uploads.ts
 */

import { promises as fs } from 'fs';
import { join, basename, extname } from 'path';
import { PrismaClient } from '@prisma/client';
import { compressImageInPlace } from '../src/common/upload/image-compress';

const UPLOAD_DIR = join(process.cwd(), 'uploads');

const prisma = new PrismaClient();

async function main() {
  console.log('[migrate] uploads dir:', UPLOAD_DIR);
  let files: string[];
  try {
    files = await fs.readdir(UPLOAD_DIR);
  } catch {
    console.log('[migrate] uploads dir does not exist, nothing to do');
    return;
  }

  let totalBefore = 0;
  let totalAfter = 0;
  let processed = 0;
  let renamed = 0;
  let skipped = 0;
  const renames = new Map<string, string>();

  for (const f of files) {
    const abs = join(UPLOAD_DIR, f);
    let stat;
    try {
      stat = await fs.stat(abs);
    } catch {
      continue;
    }
    if (!stat.isFile()) continue;

    const before = stat.size;
    totalBefore += before;

    const newPath = await compressImageInPlace(abs);
    let after = before;
    try {
      after = (await fs.stat(newPath)).size;
    } catch {
      after = before;
    }
    totalAfter += after;

    if (newPath !== abs) {
      renamed++;
      renames.set(`/uploads/${f}`, `/uploads/${basename(newPath)}`);
    }

    if (after === before && newPath === abs) {
      skipped++;
    } else {
      processed++;
    }

    if ((processed + skipped) % 50 === 0) {
      console.log(
        `[migrate] processed=${processed} skipped=${skipped} renamed=${renamed} ` +
          `before=${(totalBefore / 1024 / 1024).toFixed(1)}MB after=${(totalAfter / 1024 / 1024).toFixed(1)}MB`,
      );
    }
  }

  console.log('--- file compression done ---');
  console.log(`processed: ${processed}`);
  console.log(`skipped:   ${skipped}`);
  console.log(`renamed:   ${renamed}`);
  console.log(
    `before:    ${(totalBefore / 1024 / 1024).toFixed(1)} MB\n` +
      `after:     ${(totalAfter / 1024 / 1024).toFixed(1)} MB\n` +
      `freed:     ${((totalBefore - totalAfter) / 1024 / 1024).toFixed(1)} MB`,
  );

  if (renames.size === 0) {
    console.log('[migrate] no DB updates needed');
    await prisma.$disconnect();
    return;
  }

  console.log(`[migrate] updating ${renames.size} URL(s) in DB...`);

  let dbUpdates = 0;

  for (const [oldUrl, newUrl] of renames) {
    dbUpdates += (
      await prisma.task.updateMany({
        where: { proofPhotoUrl: oldUrl },
        data: { proofPhotoUrl: newUrl },
      })
    ).count;
    dbUpdates += (
      await prisma.fuelReport.updateMany({
        where: { vehiclePhotoUrl: oldUrl },
        data: { vehiclePhotoUrl: newUrl },
      })
    ).count;
    dbUpdates += (
      await prisma.fuelReport.updateMany({
        where: { receiptPhotoUrl: oldUrl },
        data: { receiptPhotoUrl: newUrl },
      })
    ).count;
    dbUpdates += (
      await prisma.oilChangeReport.updateMany({
        where: { photoUrl: oldUrl },
        data: { photoUrl: newUrl },
      })
    ).count;
    dbUpdates += (
      await prisma.dailyKmReport.updateMany({
        where: { startOdometerUrl: oldUrl },
        data: { startOdometerUrl: newUrl },
      })
    ).count;
    dbUpdates += (
      await prisma.dailyKmReport.updateMany({
        where: { endOdometerUrl: oldUrl },
        data: { endOdometerUrl: newUrl },
      })
    ).count;
  }

  console.log(`[migrate] db rows updated: ${dbUpdates}`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});

// keep imports referenced for ts (extname, join used inline)
void extname;
void join;
