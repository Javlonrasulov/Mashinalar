# android-driver

Kotlin (Android Native) driver ilovasi — backend (`api/`) bilan mos ishlaydi.

## Backend base URL

`BASE_URL` flavor orqali boshqariladi:

- `prod` -> `https://mashina.liderplast.uz/`
- `dev` -> `https://dev.mashina.liderplast.uz/`

API chaqiriqlari avtomatik `api/...` prefiksi bilan yuboriladi.

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

1) Android Studio:
- **File → Open** → `Mashinalar/android-driver`
- Gradle Sync tugashini kuting
- Emulator yarating (Pixel / API 34+)

2) Run:
- Top-bar’dan kerakli variantni tanlang:
  - `prodDebug`
  - `devDebug`
- **Run ▶** bosing

3) APK build:
```bash
./gradlew assembleProdDebug
./gradlew assembleDevDebug
```

APK fayllar:
- `app/build/outputs/apk/prod/debug/app-prod-debug.apk`
- `app/build/outputs/apk/dev/debug/app-dev-debug.apk`

### Real telefonda “Serverga ulanib bo‘lmadi” / Logcat: `SocketTimeoutException`

Bu odatda **internet yoki server javobi** bilan bog‘liq bo‘ladi. Domenlar:

- `https://mashina.liderplast.uz`
- `https://dev.mashina.liderplast.uz`

6) Login (seed):
- `driver1` / `Driver123!`

