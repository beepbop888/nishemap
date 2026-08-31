# Предзапусковый разбор — что нашли и что закрыто

Совет из шести проверяющих (RLS, экономика, воркер, клиент, злоупотребления,
корректность), каждого перепроверял скептик с установкой «опровергни».
Поднято 52 находки, выжило 45, отбито 7.

Полный список — в истории сессии. Здесь только то, что чинилось, и почему.

## Закрыто в 22_audit_p0.sql

| Дыра | Что было | Что стало |
|---|---|---|
| Купленный аватар ломал отправку цен | `sane_avatar` знал 17 аватаров, магазин продавал 28. Купил «Баристу» — и каждая твоя цена молча отбивалась | Список один: внешний ключ на `avatar_prices` |
| Кран монет `menu_photos` | anon слал строки пачками, каждая давала монету | 5 в сутки на устройство, 20 в минуту на всех |
| Кран монет `price_updates` | геофенс пропускал всё, чему не нашёл координат | не смогли проверить — не пускаем; 5 правок в сутки |
| Потолок начислений | не было | по видам: цены 20/сутки, фото 5, правки 5, жалобы 10 |
| `leaderboard` отдавал `device` | публичное представление показывало ключ, по которому читается чужой баланс | вместо ключа `md5(device)` |
| Три жалобы серили точку | один человек с тремя вкладками гасил любое место | автоматика убрана: решает только владелец |
| Жалобы без лимита | сколько угодно с одного устройства | одна на позицию, 20 в сутки, 30 в минуту на всех |

## Закрыто в воркере

- Карточка модерации строилась из текста, присланного сайтом, и подпись могла
  не совпадать с позицией, на которую действуют кнопки. Теперь для
  пользовательских точек подпись читается из базы, а id виден в сообщении.
- `item_id` подставлялся в HTML без экранирования.

## Закрыто в приложении

- Баланс вычитал покупки дважды: после первой покупки витрина показывала ноль
  и отказывалась продавать то, что сервер продал бы.
- Любой отказ сервера прятался за экраном «Принято» — цена исчезала молча.
  Повтор отправки к тому же терял `device` и отбивался всегда.
- Очередь для метро и подвалов помечала отправленным всё сразу и не досылала
  никогда ничего.

## Осталось (по убыванию важности)

- [high] leaderboard view (granted to anon) leaks every contributor's device id, defeating the 05_hardening column revoke
- [high] Unlimited coin minting: anon can insert menu_photos rows directly; each mints a coin with no rate limit
- [high] menu_photos is an uncapped coin faucet: 1 coin per insert, arbitrary item_id, no rate limit
- [high] price_updates coin faucet: geofence is skipped for any item_id that doesn't resolve, 1 coin per insert, no rate limit
- [high] /report is unauthenticated and the card's visible text is decoupled from the item_id its buttons act on — the owner is a confused deputy who can be made to hide any listing
- [high] price_updates is an unlimited coin faucet: 1 coin per HTTP request, no rate limit, geofence bypassable
- [high] Three unauthenticated POSTs grey out any item on the map; 594 grey out the entire seed map
- [high] The owner's moderation card is built from attacker-supplied text, never read from the database
- [high] Coin balance subtracts purchases twice — shop bricks itself after you spend about half your coins
- [high] Any rejected submission is silently dropped behind the «Принято» success screen — the retry omits `device`
- [high] The offline queue never sends anything — every entry is marked sent the moment it is created
