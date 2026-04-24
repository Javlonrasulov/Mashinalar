#!/usr/bin/env bash
# Idempotent: proxies Socket.io (default /socket.io/) to the Mashinalar API with WebSocket headers.
set -euo pipefail

patch_one() {
  local f=$1 port=$2
  python3 - "$f" "$port" <<'PY'
import pathlib, re, sys
path = pathlib.Path(sys.argv[1])
port = sys.argv[2]
t = path.read_text(encoding="utf-8")
if "location /socket.io/" in t:
    print("skip", path)
    sys.exit(0)
snippet = f"""  location /socket.io/ {{
    proxy_pass http://127.0.0.1:{port}/socket.io/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }}

"""
pat = re.compile(
    r"(  location /uploads/ \{\n(?:.*\n)*?  \}\n)(\n    listen 443 ssl)",
    re.M,
)
newt, n = pat.subn(r"\1" + snippet + r"\2", t, count=1)
if n != 1:
    print("pattern miss", path)
    sys.exit(1)
path.write_text(newt, encoding="utf-8")
print("patched", path)
PY
}

patch_one /etc/nginx/sites-enabled/mashina-prod.conf 3101
patch_one /etc/nginx/sites-enabled/mashina-dev.conf 3102
nginx -t
systemctl reload nginx
echo "nginx reloaded OK"
