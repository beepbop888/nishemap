/* Бесплатная шестёрка — ровно та, о которой договаривались. Не трогаем.
   Платные: канон + московские типажи, почти все парами (м/ж). */
const F = (id, n, d, p, s, o) => ({ id, n, d, p, s, ...o });

export const FREE = [
  F('student_m','Студент','живу на дошике до стипендии',0,'m',{hat:'beanie',hair:'#3a3129',top:'hoodie',c1:'#4f6f8f',c2:'#3a566e',face:'tired',build:'slim'}),
  F('student_f','Студентка','живу на дошике до стипендии',0,'f',{hat:'none',hair:'#2e2723',top:'hoodie',c1:'#c2506b',c2:'#9c3b52',face:'happy',build:'slim',hairF:'bob',buds:1}),
  F('office_m','Офисный','обед за свой счёт, увы',0,'m',{hat:'none',hair:'#3a2f28',top:'blazer',c1:'#3f4d63',c2:'#2c3646',face:'tired',build:'norm'}),
  F('office_f','Офисная','обед за свой счёт, увы',0,'f',{hat:'none',hair:'#6b4a2f',top:'blazer',c1:'#5c6f8a',c2:'#3f4f66',face:'tired',build:'norm',hairF:'tail'}),
  F('zapas_m','Запасливый','у меня всё с собой',0,'m',{hat:'cap',hair:'#4a3f37',top:'vest',c1:'#7d8f5a',c2:'#5e6f42',face:'calm',build:'wide',mous:1}),
  F('zapas_f','Запасливая','у меня всё с собой',0,'f',{hat:'bandana',hair:'#5a3a2a',top:'vest',c1:'#8f9d6a',c2:'#6b7a4a',face:'calm',build:'norm',hairF:'bun'}),
];

/* Лестница: пара стоит одинаково, чтобы пол не был налогом. */
export const PAID = [
  F('doshik_m','Дошиковод','кипяток — мой шеф-повар',50,'m',{hat:'none',hair:'#2e2723',top:'tee',c1:'#5a6b7d',c2:'#44525f',face:'happy',build:'slim'}),
  F('doshik_f','Дошиководка','кипяток — мой шеф-повар',50,'f',{hat:'none',hair:'#2e2723',top:'tee',c1:'#7d6a8f',c2:'#5d4c6d',face:'happy',build:'slim',hairF:'bun'}),
  F('barista_f','Бариста','кофе с собой и булка',75,'f',{hat:'bandana',hair:'#5a3a2a',top:'apron',c1:'#2b2b2b',c2:'#1a1a1a',face:'happy',build:'norm',hairF:'bun'}),
  F('barista_m','Бариста','кофе с собой и булка',75,'m',{hat:'bandana',hair:'#2e2723',top:'apron',c1:'#2b2b2b',c2:'#1a1a1a',face:'happy',build:'slim',beard:'short'}),
  F('samokat_m','Самокатчик','вечно на две минуты опаздывает',100,'m',{hat:'helmetS',hair:'#2e2723',top:'wind',c1:'#e8b93c',c2:'#b8901f',face:'driven',build:'norm'}),
  F('samokat_f','Самокатчица','вечно на две минуты опаздывает',100,'f',{hat:'helmetS',hair:'#3a2f28',top:'wind',c1:'#e8b93c',c2:'#b8901f',face:'driven',build:'slim',hairF:'tail'}),
  F('pvz_f','Пункт выдачи','знает все размеры наизусть',125,'f',{hat:'none',hair:'#3a2f28',top:'polo',c1:'#8a2fa0',c2:'#6a2380',face:'tired',build:'norm',hairF:'tail',badge:1}),
  F('pvz_m','Пункт выдачи','знает все размеры наизусть',125,'m',{hat:'none',hair:'#2e2723',top:'polo',c1:'#8a2fa0',c2:'#6a2380',face:'tired',build:'norm',badge:1}),
  F('shaurmaster','Шаурмастер','знает лучший лаваш в городе',150,'m',{hat:'cook',hair:'#2e2723',top:'apronW',c1:'#c8492f',c2:'#9c3521',face:'happy',build:'wide',beard:'full'}),
  F('shaurmaster_f','Шаурмастерица','знает лучший лаваш в городе',150,'f',{hat:'cook',hair:'#2e2723',top:'apronW',c1:'#c8492f',c2:'#9c3521',face:'happy',build:'norm',hairF:'bun'}),
  F('itshnik_m','Айтишник','обед не отходя от ноутбука',225,'m',{hat:'none',hair:'#4a3f37',top:'hoodie',c1:'#2a2f3a',c2:'#1b1f26',face:'calm',build:'slim',beard:'short',cans:1}),
  F('itshnik_f','Айтишница','обед не отходя от ноутбука',225,'f',{hat:'none',hair:'#7a4a8f',top:'hoodie',c1:'#2a2f3a',c2:'#1b1f26',face:'calm',build:'slim',hairF:'bob',cans:1}),
  F('tsar','Царь столовой','компот наливают без очереди',275,'m',{hat:'monomah',hair:'#3a332c',top:'barmy',c1:'#8a1f2e',c2:'#661621',face:'proud',build:'wide',beard:'full'}),
  F('tsar_f','Царица столовой','компот наливают без очереди',275,'f',{hat:'kokoshnik',hair:'#3a332c',top:'barmy',c1:'#8a1f2e',c2:'#661621',face:'proud',build:'norm',hairF:'long'}),
  F('kosmonavt','Космонавт','ел борщ в невесомости',425,'m',{hat:'space',hair:'#2e2723',top:'suit',c1:'#dcd8cf',c2:'#b9b4a9',face:'awe',build:'norm'}),
  F('kosmonavt_f','Космонавтка','ела борщ в невесомости',425,'f',{hat:'space',hair:'#3a2f28',top:'suit',c1:'#dcd8cf',c2:'#b9b4a9',face:'awe',build:'slim'}),
  F('oligarkh','Олигарх','берёт добавку не глядя',650,'m',{hat:'tophat',hair:'#3a332c',top:'fur',c1:'#4a3a55',c2:'#372a40',face:'sly',build:'norm',mous:1}),
  F('oligarkh_f','Олигархиня','берёт добавку не глядя',650,'f',{hat:'none',hair:'#241f1b',top:'fur',c1:'#4a3a55',c2:'#372a40',face:'sly',build:'norm',hairF:'long',shades:1}),
  /* Легенде нужен сильный признак: седая борода, ушанка и КОЛОДКИ на груди — «ветеран района» */
  F('legenda','Легенда района','его цены цитируют в чатах',900,'m',{hat:'ushanka',hair:'#c9c2b6',top:'medals',c1:'#5a5248',c2:'#3f392f',face:'proud',build:'wide',beard:'full',hc:['#5b452e','#3f2f1f','#7a5f42']}),
  F('legenda_f','Легенда района','её цены цитируют в чатах',900,'f',{hat:'platok',hair:'#c9c2b6',top:'medals',c1:'#5a5248',c2:'#3f392f',face:'proud',build:'norm',hairF:'bun'}),
  F('zoloto','Золотой нищеброд','200 мест на карте. выше только звёзды',1650,'m',{hat:'ushanka',hair:'#3a332c',top:'gold',c1:'#d9a326',c2:'#a97c16',face:'happy',build:'norm',beard:'full',hc:['#d9a326','#a97c16','#f0d98a'],star:1}),
  F('zoloto_f','Золотая нищебродка','200 мест на карте. выше только звёзды',1650,'f',{hat:'ushanka',hair:'#3a332c',top:'gold',c1:'#d9a326',c2:'#a97c16',face:'happy',build:'norm',hairF:'long',hc:['#d9a326','#a97c16','#f0d98a'],star:1}),
];

export const CAST = [...FREE, ...PAID];
export const SKIN = { m:'#f0c6a0', f:'#f6d6bd' };
export const TIER = (p) => p === 0 ? 0 : p < 200 ? 1 : p < 700 ? 2 : 3;
export const TBG  = ['#efece4', '#f0e4d2', '#e2e7ec', '#f7e7b4'];
export const TRIM = ['#b9b1a1', '#b87d3e', '#8b98a5', '#c9a23f'];
