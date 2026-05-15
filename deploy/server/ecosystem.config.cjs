const fs = require('fs');
const path = require('path');

/** Har bir muhit o‘z `.env` faylidan o‘qiladi (PM2 + Nest bir xil DATABASE_URL). */
function loadEnvFile(cwd) {
  const file = path.join(cwd, '.env');
  const out = { NODE_ENV: 'production', HOST: '127.0.0.1' };
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

const prodEnv = loadEnvFile('/opt/mashina-prod/api');
const devEnv = loadEnvFile('/opt/mashina-dev/api');

module.exports = {
  apps: [
    {
      name: 'mashina-api-prod',
      cwd: '/opt/mashina-prod/api',
      script: 'dist/src/main.js',
      interpreter: 'node',
      env: { ...prodEnv, PORT: prodEnv.PORT || '3101' },
    },
    {
      name: 'mashina-api-dev',
      cwd: '/opt/mashina-dev/api',
      script: 'dist/src/main.js',
      interpreter: 'node',
      env: { ...devEnv, PORT: devEnv.PORT || '3102' },
    },
  ],
};
