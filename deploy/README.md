# Mashina deploy (prod + dev) — bir serverda, aralashmasdan

Bu server uchun tavsiya etilgan deploy varianti `pm2 + nginx + local postgresql`.

Muhim xavfsizlik qoidalari:

- mavjud `liderplast-*` configlariga tegilmaydi
- `/var/www` ichidagi boshqa papkalarga tegilmaydi
- faqat yangi papkalar ishlatiladi: `/opt/mashina-prod` va `/opt/mashina-dev`
- prod va dev alohida portlarda ishlaydi: `3001` va `3002`

## 0) DNS
DNS’da allaqachon bor:

- `mashina.liderplast.uz` → server IP
- `dev.mashina.liderplast.uz` → server IP

## 1) Server talablari (Ubuntu)
- Node.js + npm
- pm2
- Nginx
- PostgreSQL

Tekshirish:
```bash
node -v
npm -v
pm2 -v
nginx -v
psql --version
```

## 2) Kodni serverga qo‘yish
```bash
git clone https://github.com/Javlonrasulov/Mashinalar.git /opt/mashina-prod
git clone https://github.com/Javlonrasulov/Mashinalar.git /opt/mashina-dev
```

## 3) PostgreSQL bazalar va foydalanuvchilar
```bash
sudo -u postgres psql
```

So‘ng `psql` ichida:
```sql
CREATE USER mashina_prod WITH PASSWORD 'CHANGE_ME_PROD';
CREATE DATABASE mashina_prod OWNER mashina_prod;

CREATE USER mashina_dev WITH PASSWORD 'CHANGE_ME_DEV';
CREATE DATABASE mashina_dev OWNER mashina_dev;
\q
```

## 4) API env fayllar
Shablonlar:
- `deploy/server/prod.api.env.example`
- `deploy/server/dev.api.env.example`

Serverda:
```bash
cp /opt/mashina-prod/deploy/server/prod.api.env.example /opt/mashina-prod/api/.env
cp /opt/mashina-dev/deploy/server/dev.api.env.example /opt/mashina-dev/api/.env

nano /opt/mashina-prod/api/.env
nano /opt/mashina-dev/api/.env
```

## 5) Dependency va build
```bash
cd /opt/mashina-prod/api && npm ci && npx prisma generate && npm run build && npx prisma migrate deploy
cd /opt/mashina-prod/admin && npm ci && VITE_API_URL=/api npm run build

cd /opt/mashina-dev/api && npm ci && npx prisma generate && npm run build && npx prisma migrate deploy
cd /opt/mashina-dev/admin && npm ci && VITE_API_URL=/api npm run build
```

## 6) PM2 bilan API’larni ko‘tarish
```bash
cp /opt/mashina-prod/deploy/server/ecosystem.config.cjs /root/mashina-ecosystem.config.cjs
pm2 start /root/mashina-ecosystem.config.cjs
pm2 save
pm2 startup
```

Tekshirish:
```bash
curl http://127.0.0.1:3001/health
curl http://127.0.0.1:3002/health
pm2 status
```

## 7) Nginx vhost
Shablonlar:
- `deploy/nginx/mashina-prod.conf`
- `deploy/nginx/mashina-dev.conf`

Shablonlarda `location /socket.io/` bor: brauzer `wss://.../socket.io/` ni to‘g‘ridan-to‘g‘ri API ga (WebSocket `Upgrade`) yo‘naltiradi; bo‘lmasa xarita sahifasida `socket.io` ulanishi yiqiladi.

Serverda:
```bash
cp /opt/mashina-prod/deploy/nginx/mashina-prod.conf /etc/nginx/sites-available/mashina-prod.conf
cp /opt/mashina-prod/deploy/nginx/mashina-dev.conf  /etc/nginx/sites-available/mashina-dev.conf

ln -s /etc/nginx/sites-available/mashina-prod.conf /etc/nginx/sites-enabled/mashina-prod.conf
ln -s /etc/nginx/sites-available/mashina-dev.conf  /etc/nginx/sites-enabled/mashina-dev.conf

nginx -t && systemctl reload nginx
```

## 8) SSL
```bash
apt update
apt install -y certbot python3-certbot-nginx

certbot --nginx -d mashina.liderplast.uz -d dev.mashina.liderplast.uz
```

## 9) Update qilish
```bash
cd /opt/mashina-prod && git pull
cd /opt/mashina-prod/api && npm ci && npx prisma generate && npm run build && npx prisma migrate deploy
cd /opt/mashina-prod/admin && npm ci && VITE_API_URL=/api npm run build

cd /opt/mashina-dev && git pull
cd /opt/mashina-dev/api && npm ci && npx prisma generate && npm run build && npx prisma migrate deploy
cd /opt/mashina-dev/admin && npm ci && VITE_API_URL=/api npm run build

pm2 restart mashina-api-prod mashina-api-dev
nginx -t && systemctl reload nginx
```

