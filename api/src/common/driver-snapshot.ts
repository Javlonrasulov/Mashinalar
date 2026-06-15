/** Haydovchi o‘chirilgandan keyin tarix yozuvlarida ism ko‘rsatish. */
export function resolveDriverSnapshot(
  driver: { fullName: string; phone?: string | null; user?: { login: string } } | null,
  driverFullName: string | null | undefined,
  driverPhone?: string | null,
): { fullName: string; phone: string; user?: { login: string } } {
  if (driver) {
    return {
      fullName: driver.fullName,
      phone: driver.phone ?? '',
      user: driver.user,
    };
  }
  return {
    fullName: driverFullName ?? '—',
    phone: driverPhone ?? '',
    user: { login: '—' },
  };
}
