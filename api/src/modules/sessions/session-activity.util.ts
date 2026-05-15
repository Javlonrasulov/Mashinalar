/** GPS / ping oralig‘i — shundan ko‘p bo‘lsa yangi segment. */
export const ACTIVITY_GAP_MS = 10 * 60 * 1000;

/** O‘zbekiston vaqti (UTC+5) bo‘yicha YYYY-MM-DD. */
const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;

export type ActivitySegmentDto = {
  startAt: string;
  endAt: string;
  durationMinutes: number;
};

export type ActivityDayDto = {
  date: string;
  totalMinutes: number;
  segments: ActivitySegmentDto[];
};

export function dateKeyTashkent(d: Date): string {
  const t = d.getTime() + TASHKENT_OFFSET_MS;
  return new Date(t).toISOString().slice(0, 10);
}

export function mergeActivitySegments(times: Date[]): ActivitySegmentDto[] {
  if (times.length === 0) return [];
  const sorted = [...times].sort((a, b) => a.getTime() - b.getTime());
  const clusters: { start: Date; end: Date }[] = [];
  let start = sorted[0];
  let end = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const t = sorted[i];
    if (t.getTime() - end.getTime() > ACTIVITY_GAP_MS) {
      clusters.push({ start, end });
      start = t;
      end = t;
    } else {
      end = t;
    }
  }
  clusters.push({ start, end });

  return clusters.map((c) => {
    const span = c.end.getTime() - c.start.getTime();
    const durationMinutes = Math.max(
      1,
      Math.round((span + ACTIVITY_GAP_MS) / 60_000),
    );
    return {
      startAt: c.start.toISOString(),
      endAt: c.end.toISOString(),
      durationMinutes,
    };
  });
}

export function groupSegmentsByDay(
  segments: ActivitySegmentDto[],
): ActivityDayDto[] {
  const byDay = new Map<string, ActivitySegmentDto[]>();
  for (const seg of segments) {
    const key = dateKeyTashkent(new Date(seg.startAt));
    const list = byDay.get(key) ?? [];
    list.push(seg);
    byDay.set(key, list);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, segs]) => {
      const totalMinutes = segs.reduce((s, x) => s + x.durationMinutes, 0);
      return {
        date,
        totalMinutes,
        segments: segs.sort((a, b) => a.startAt.localeCompare(b.startAt)),
      };
    });
}
