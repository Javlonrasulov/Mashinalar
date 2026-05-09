import { promises as fs } from 'fs';
import { dirname, join, extname, basename } from 'path';
import sharp = require('sharp');

export const IMAGE_MAX_DIMENSION = 1920;
export const IMAGE_JPEG_QUALITY = 80;

/**
 * Diskdagi rasmni o'rniga siqilgan JPEG bilan almashtiradi.
 * - max o'lcham: 1920px (uzun tomon)
 * - JPEG quality: 80 (mozjpeg)
 * - EXIF orientation hisobga olinadi
 *
 * Agar fayl rasm bo'lmasa yoki sharp uni qayta ishlay olmasa,
 * jim o'tib ketadi va asl fayl saqlanadi.
 *
 * Qaytaradi: yangi fayl absolyut yo'li (ba'zan kengaytma .jpg ga
 * o'zgaradi). Agar siqish bekor qilingan bo'lsa, asl yo'lni qaytaradi.
 */
export async function compressImageInPlace(filePath: string): Promise<string> {
  try {
    const original = await fs.readFile(filePath);
    if (original.length === 0) return filePath;

    const compressed = await sharp(original, { failOn: 'none' })
      .rotate()
      .resize({
        width: IMAGE_MAX_DIMENSION,
        height: IMAGE_MAX_DIMENSION,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: IMAGE_JPEG_QUALITY, mozjpeg: true })
      .toBuffer();

    if (compressed.length === 0) return filePath;
    if (compressed.length >= original.length) return filePath;

    const ext = extname(filePath).toLowerCase();
    if (ext === '.jpg' || ext === '.jpeg') {
      await fs.writeFile(filePath, compressed);
      return filePath;
    }

    const dir = dirname(filePath);
    const stem = basename(filePath, ext);
    const newPath = join(dir, `${stem}.jpg`);
    await fs.writeFile(newPath, compressed);
    if (newPath !== filePath) {
      await fs.unlink(filePath).catch(() => undefined);
    }
    return newPath;
  } catch (e) {
    console.warn(
      '[image-compress] skip',
      filePath,
      (e as Error)?.message || e,
    );
    return filePath;
  }
}

/** Agar siqilgan natija fayl nomini o'zgartirsa, multer file obyektini ham yangilaydi. */
export async function compressMulterFile(
  file: Express.Multer.File | undefined,
): Promise<void> {
  if (!file?.path) return;
  const newPath = await compressImageInPlace(file.path);
  if (newPath !== file.path) {
    file.path = newPath;
    file.filename = basename(newPath);
  }
}

/** FileFieldsInterceptor natijasini parallel siqadi. */
export async function compressMulterFiles(
  files: Record<string, Express.Multer.File[] | undefined> | undefined,
): Promise<void> {
  if (!files) return;
  const all: Express.Multer.File[] = [];
  for (const arr of Object.values(files)) {
    if (arr) all.push(...arr);
  }
  await Promise.all(all.map((f) => compressMulterFile(f)));
}
