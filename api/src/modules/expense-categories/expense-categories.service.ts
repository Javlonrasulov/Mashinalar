import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

function baseSlugFromName(name: string): string {
  const t = name
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_')
    .replace(/[^A-Z0-9_]/g, '');
  return t.slice(0, 48) || 'CAT';
}

@Injectable()
export class ExpenseCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.expenseCategory.findMany({
      orderBy: [{ name: 'asc' }],
    });
  }

  async create(nameRaw: string) {
    const name = nameRaw.trim();
    if (!name) throw new ConflictException('Empty name');

    let slug = baseSlugFromName(name);
    let n = 0;
    for (;;) {
      const candidate = n === 0 ? slug : `${slug}_${n}`;
      const hit = await this.prisma.expenseCategory.findUnique({ where: { slug: candidate } });
      if (!hit) {
        slug = candidate;
        break;
      }
      n += 1;
      if (n > 200) {
        slug = `C_${Date.now()}`;
        break;
      }
    }

    try {
      return await this.prisma.expenseCategory.create({
        data: { name, slug },
      });
    } catch {
      throw new ConflictException('Could not create category');
    }
  }
}
