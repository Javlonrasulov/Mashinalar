# Distribyutor — mashinalar monitoring

Loyiha papkasi: `Desktop/Mashinalar`

- `api` — NestJS + Prisma (PostgreSQL) + JWT + WebSocket (`/tracking`) + REST
- `admin` — React + TypeScript + Vite + Tailwind CSS 4 (LiderPlast uslubidagi kartochkalar / slate palette)
- Android (keyin): Kotlin

## Talablar

- Node.js 20+
- PostgreSQL 14+ (mahalliy yoki Docker)
- Redis TZ da keltirilgan; hozircha ixtiyoriy (keyingi bosqichda kesh / navbatlar uchun qo‘shiladi)

## PostgreSQL (Docker)

```bash
docker run --name mashinalar-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=mashinalar -p 5432:5432 -d postgres:16
```

## API

```bash
cd api
copy .env.example .env
# DATABASE_URL ni o‘zgartiring
npx prisma migrate dev --name init
npx prisma db seed
npm run start:dev
```

- Health: `GET http://localhost:3000/health`
- Admin login (seed): `admin` / `Admin123!`
- Haydovchi (seed): `driver1` / `Driver123!` (admin panel faqat `ADMIN` rolli bilan kiradi)
- Yuklangan fayllar: `api/uploads` (URL: `/uploads/...`)

## Admin panel

```bash
cd admin
copy .env.example .env
npm run dev
```

Brauzer: `http://localhost:5173`

`VITE_API_URL` — API manzili (default `http://localhost:3000`).

## Real-time joylashuv

- Driver: `POST /tracking/locations/batch` (JWT, role `DRIVER`)
- Admin xarita: `GET /tracking/live`; tarix: `GET /tracking/history?vehicleId=&from=&to=`
- WebSocket (faqat admin): namespace `/tracking`, `auth: { token: "<JWT>" }`, event `location`

## Keyingi qadamlar (Android)

- Kotlin driver ilovasi: background location, offline queue, multipart upload (zapravka / km / vazifa).
