# android-driver

Kotlin (Android Native) driver ilovasi — backend (`api/`) bilan mos ishlaydi.

## Backend base URL

`BASE_URL` endi BuildConfig orqali boshqariladi (static emas).

- **Emulator**: `BuildConfig.EMULATOR_BASE_URL` → `http://10.0.2.2:3000`
- **Real device**: `BuildConfig.DEVICE_BASE_URL` → default `http://192.168.1.102:3000` (o‘zgartiriladi)

### local.properties orqali o‘zgartirish (tavsiya)
`android-driver/local.properties` ichiga qo‘shing:

- `MASHINALAR_DEVICE_BASE_URL=http://192.168.1.102:3000`

`NetworkModule` runtime’da qurilma emulator ekanini aniqlab (emulator vs real device) mos URL tanlaydi.

## Auth (auto-login + token expiry)

- JWT token `DataStore`da saqlanadi (`TokenStore`).
- App ochilganda token bo‘lsa `GET /auth/me` bilan tekshiriladi.
- Token eskirgan bo‘lsa (401/403) token avtomatik o‘chiriladi va UI login’ga qaytadi.

## Tracking qanday ishlaydi (hozirgi skeleton)

- `TrackingForegroundService` (`requestLocationUpdates`) lokatsiyani ~10–30s da olib `Room` queue’ga `PENDING` qilib yozadi.
- Internet bo‘lsa darhol `UploadLocationsWorker` (OneTime) trigger qilinadi.
- `UploadLocationsWorker` queue’dagi `PENDING` pointlarni `/tracking/locations/batch` ga batch qilib yuboradi.
- Internet bo‘lmasa — queue’da qoladi, internet kelganda yuboriladi.

Tracking start/stop:
- Home screen’da `Tracking` switch bor. O‘chirilsa foreground service to‘xtaydi.

## Eslatma (Gradle wrapper)

Bu repoda binary fayl qo‘shmaslik sabab `gradle-wrapper.jar` commit qilinmagan bo‘lishi mumkin.
Android Studio’da `android-driver/` ni ochib, “Gradle sync” qiling — wrapper avtomatik generate bo‘ladi.

## Android Studio’da build/run (Windows)

1) Backend’ni ishga tushiring:
- `api/` ichida `npm run start:dev` (Postgres ishlayotgan bo‘lsin)

2) Android Studio:
- **File → Open** → `Mashinalar/android-driver`
- Gradle Sync tugashini kuting
- Emulator yarating (Pixel / API 34+)

3) Run:
- Top-bar’dan **app** konfiguratsiyasini tanlang
- **Run ▶** bosing

4) Base URL:
- Emulator: avtomatik `http://10.0.2.2:3000`
- Real device: `local.properties`dagi `MASHINALAR_DEVICE_BASE_URL` bilan (masalan `http://192.168.1.102:3000`)

### Real telefonda “Serverga ulanib bo‘lmadi” / Logcat: `SocketTimeoutException`

Bu **login noto‘g‘ri** emas — ilova **kompyuterdagi API**ga tarmoq orqali yetib olmayapti.

1. **Kompyuter IPv4 manzilini tekshiring** (Windows: `ipconfig` → Wireless LAN adapter → IPv4). Telefon va kompyuter **bir xil Wi‑Fi**da bo‘lishi kerak.
2. `android-driver/local.properties` ichida URLni shu IPga moslang, keyin **Rebuild**:
   - `MASHINALAR_DEVICE_BASE_URL=http://<SIZNING_IP>:3000`
3. `api/` da server ishlayotganini tekshiring: `npm run start:dev` (port **3000**).
4. **Windows Firewall**: kiruvchi ulanishlarda **3000** (yoki `node.exe`) uchun ruxsat bering.
5. Telefonda brauzerda `http://<SIZNING_IP>:3000/` ochib ko‘ring — kamida ulanish bor-yo‘qligini tekshiradi.

6) Login (seed):
- `driver1` / `Driver123!`

