#!/bin/sh
# Топ-10 по РЕАЛЬНЫМ монетам (журнал coin_ledger, а не localStorage).
# Токен — в .supabase_token (в .gitignore). Владельцу, не приложению.
cd "$(dirname "$0")/.." || exit 1
python3 -c "
import json,io,urllib.request
tok=io.open('.supabase_token',encoding='utf-8').read().strip()
q='select device, coins, pending, items, photos, updates, burned, last_seen from public.coin_top limit 10'
req=urllib.request.Request('https://api.supabase.com/v1/projects/svfnjfpawljkdcehzkgv/database/query',
    data=json.dumps({'query':q}).encode(),
    headers={'Authorization':'Bearer '+tok,'Content-Type':'application/json',
             'User-Agent':'curl/8.7.1'})
rows=json.load(urllib.request.urlopen(req,timeout=30))
if not rows: print('журнал пуст — монет пока никто не заработал'); raise SystemExit
print(f\"{'#':<3}{'устройство':<40}{'монет':>7}{'зреют':>7}{'цен':>6}{'фото':>6}{'сгорело':>9}\")
for i,r in enumerate(rows,1):
    print(f\"{i:<3}{(r['device'] or '')[:38]:<40}{r['coins'] or 0:>7}{r['pending'] or 0:>7}\"
          f\"{r['items'] or 0:>6}{r['photos'] or 0:>6}{r['burned'] or 0:>9}\")
"
