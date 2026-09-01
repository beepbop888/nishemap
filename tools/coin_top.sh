#!/bin/sh
# Топ по РЕАЛЬНЫМ монетам (журнал coin_ledger), с именами из Telegram.
# Токен — в .supabase_token (в .gitignore). Владельцу, не приложению.
cd "$(dirname "$0")/.." || exit 1
python3 -c "
import json, io, urllib.request, sys
tok = io.open('.supabase_token', encoding='utf-8').read().strip()
n = sys.argv[1] if len(sys.argv) > 1 else '10'
q = ('select username, first_name, tg_id, who, coins, pending, spent, '
     'items, photos, reports, burned, opens from public.user_top limit ' + str(int(n)))
req = urllib.request.Request(
    'https://api.supabase.com/v1/projects/svfnjfpawljkdcehzkgv/database/query',
    data=json.dumps({'query': q}).encode(),
    headers={'Authorization': 'Bearer ' + tok, 'Content-Type': 'application/json',
             'User-Agent': 'curl/8.7.1'})
rows = json.load(urllib.request.urlopen(req, timeout=30))
if not rows:
    print('журнал пуст — монет пока никто не заработал'); raise SystemExit
h = ('#', 'кто', 'монет', 'зреют', 'потрачено', 'цен', 'фото', 'жалоб', 'сгорело', 'заходов')
print('%-3s%-22s%7s%7s%10s%6s%6s%7s%9s%9s' % h)
for i, r in enumerate(rows, 1):
    # без Telegram человек — только случайный device; показываем его хвост
    who = ('@' + r['username']) if r.get('username') else \
          (r.get('first_name') or ('?' + (r.get('who') or '')[-8:]))
    print('%-3d%-22s%7d%7d%10d%6d%6d%7d%9d%9s' % (
        i, who[:21], r['coins'] or 0, r['pending'] or 0, r['spent'] or 0,
        r['items'] or 0, r['photos'] or 0, r['reports'] or 0, r['burned'] or 0,
        r['opens'] if r.get('opens') is not None else '-'))
" "$@"
