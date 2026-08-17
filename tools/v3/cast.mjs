/* КАНОН. Список восстановлен по репозиторию (коммит 99f9ba1^) — это то, о чём договаривались:
   три архетипа в мужской и женской версии бесплатно, дальше лестница за монеты.
   Ничего отсюда не удаляем без явного согласия. */
export const CANON = [
  /* --- бесплатные: 3 архетипа × 2 пола --- */
  { id:'student_m', n:'Студент',     d:'живу на дошике до стипендии', p:0, s:'m', hat:'beanie', hair:'#3a3129', top:'hoodie', c1:'#4f6f8f', c2:'#3a566e', face:'tired', build:'slim' },
  { id:'student_f', n:'Студентка',   d:'живу на дошике до стипендии', p:0, s:'f', hat:'none',   hair:'#2e2723', top:'hoodie', c1:'#c2506b', c2:'#9c3b52', face:'happy', build:'slim', hairF:'bob', buds:1 },
  { id:'office_m',  n:'Офисный',     d:'обед за свой счёт, увы',      p:0, s:'m', hat:'none',   hair:'#3a2f28', top:'blazer', c1:'#3f4d63', c2:'#2c3646', face:'tired', build:'norm' },
  { id:'office_f',  n:'Офисная',     d:'обед за свой счёт, увы',      p:0, s:'f', hat:'none',   hair:'#3a2f28', top:'blazer', c1:'#3f4d63', c2:'#2c3646', face:'tired', build:'norm', hairF:'tail' },
  { id:'zapas_m',   n:'Запасливый',  d:'у меня всё с собой',          p:0, s:'m', hat:'cap',    hair:'#4a3f37', top:'vest',   c1:'#7d8f5a', c2:'#5e6f42', face:'calm',  build:'wide', mous:1 },
  { id:'zapas_f',   n:'Запасливая',  d:'у меня всё с собой',          p:0, s:'f', hat:'bandana',hair:'#5a3a2a', top:'vest',   c1:'#7d8f5a', c2:'#5e6f42', face:'calm',  build:'norm', hairF:'bun' },
  /* --- за монеты --- */
  { id:'doshik_m',      n:'Дошиковод',      d:'кипяток — мой шеф-повар',     p:50,  s:'m', hat:'none', hair:'#2e2723', top:'tee',    c1:'#5a6b7d', c2:'#44525f', face:'happy', build:'slim' },
  { id:'doshik_f',      n:'Дошиководка',    d:'кипяток — мой шеф-повар',     p:50,  s:'f', hat:'none', hair:'#2e2723', top:'tee',    c1:'#5a6b7d', c2:'#44525f', face:'happy', build:'slim', hairF:'bun' },
  { id:'shaurmaster',   n:'Шаурмастер',     d:'знает лучший лаваш в городе', p:150, s:'m', hat:'cook', hair:'#2e2723', top:'apronW', c1:'#c8492f', c2:'#9c3521', face:'happy', build:'wide', beard:'full' },
  { id:'shaurmaster_f', n:'Шаурмастерица',  d:'знает лучший лаваш в городе', p:150, s:'f', hat:'cook', hair:'#2e2723', top:'apronW', c1:'#c8492f', c2:'#9c3521', face:'happy', build:'norm', hairF:'bun' },
  { id:'tsar',          n:'Царь столовой',  d:'компот наливают без очереди', p:275, s:'m', hat:'monomah', hair:'#3a332c', top:'barmy', c1:'#8a1f2e', c2:'#661621', face:'proud', build:'wide', beard:'full' },
  { id:'tsar_f',        n:'Царица столовой',d:'компот наливают без очереди', p:275, s:'f', hat:'kokoshnik', hair:'#3a332c', top:'barmy', c1:'#8a1f2e', c2:'#661621', face:'proud', build:'norm', hairF:'long' },
  { id:'kosmonavt',     n:'Космонавт',      d:'ел борщ в невесомости',       p:425, s:'m', hat:'space', hair:'#2e2723', top:'suit',  c1:'#dcd8cf', c2:'#b9b4a9', face:'awe',   build:'norm' },
  { id:'oligarkh',      n:'Олигарх',        d:'берёт добавку не глядя',      p:650, s:'m', hat:'tophat', hair:'#3a332c', top:'fur',  c1:'#4a3a55', c2:'#372a40', face:'sly',   build:'norm', mous:1 },
  { id:'oligarkh_f',    n:'Олигархиня',     d:'берёт добавку не глядя',      p:650, s:'f', hat:'none',  hair:'#241f1b', top:'fur',   c1:'#4a3a55', c2:'#372a40', face:'sly',   build:'norm', hairF:'long', shades:1 },
  { id:'legenda',       n:'Легенда района', d:'его цены цитируют в чатах',   p:900, s:'m', hat:'ushanka', hair:'#8a8278', top:'vest', c1:'#6b6257', c2:'#4e463d', face:'proud', build:'wide', beard:'full', hc:['#5b452e','#3f2f1f','#7a5f42'] },
  { id:'zoloto',        n:'Золотой нищеброд', d:'200 мест на карте. выше только звёзды', p:1650, s:'m', hat:'ushanka', hair:'#3a332c', top:'gold', c1:'#d9a326', c2:'#a97c16', face:'happy', build:'norm', beard:'full', hc:['#d9a326','#a97c16','#f0d98a'], star:1 },
];

/* ПРЕДЛОЖЕНИЕ, не канон. Ты просил персонажей из сегодняшней Москвы —
   вот кандидаты. В приложение не идут, пока не скажешь. */
export const PROPOSED = [
  { id:'samokat', n:'Самокатчик',    d:'жёлтый шлем, вечно спешит',  p:100, s:'m', hat:'helmetS', hair:'#2e2723', top:'wind',  c1:'#e8b93c', c2:'#b8901f', face:'driven', build:'norm' },
  { id:'pvz',     n:'Пункт выдачи',  d:'знает все размеры наизусть', p:125, s:'f', hat:'none',    hair:'#3a2f28', top:'polo',  c1:'#8a2fa0', c2:'#6a2380', face:'tired',  build:'norm', hairF:'tail', badge:1 },
  { id:'itshnik', n:'Айтишник',      d:'обед не отходя от ноутбука', p:225, s:'m', hat:'none',    hair:'#4a3f37', top:'hoodie',c1:'#2a2f3a', c2:'#1b1f26', face:'calm',   build:'slim', beard:'short', cans:1 },
  { id:'barista', n:'Бариста',       d:'кофе с собой и булка',       p:75,  s:'f', hat:'bandana', hair:'#5a3a2a', top:'apron', c1:'#2b2b2b', c2:'#1a1a1a', face:'happy',  build:'norm', hairF:'bun' },
];

export const CAST = CANON;
export const SKIN = { m:'#f0c6a0', f:'#f6d6bd' };
export const TIER = (p) => p === 0 ? 0 : p < 200 ? 1 : p < 700 ? 2 : 3;
export const TBG  = ['#efece4', '#f0e4d2', '#e2e7ec', '#f7e7b4'];
export const TRIM = ['#b9b1a1', '#b87d3e', '#8b98a5', '#c9a23f'];
