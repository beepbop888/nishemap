/* Каст НищеMap. Бабушка убрана. Добавлены современные московские типажи:
   самокатчик, пункт выдачи, айтишник, бариста — то, что реально видно в городе сейчас.
   Предметов-иконок внутри аватара НЕТ: узнаваемость держат силуэт, убор, одежда и лицо. */
export const CAST = [
  /* ---- бесплатные: 3 мужских, 3 женских ---- */
  { id:'student',  n:'Студент',    p:0,  s:'m', hat:'beanie',  hair:'#3a3129', top:'hoodie',  c1:'#4f6f8f', c2:'#3a566e', face:'tired',  build:'slim' },
  { id:'kurier',   n:'Курьер',     p:0,  s:'m', hat:'cap',     hair:'#2e2723', top:'zip',     c1:'#2f6b4f', c2:'#1f4a36', face:'driven', build:'norm', pack:1 },
  { id:'rabotyaga',n:'Работяга',   p:0,  s:'m', hat:'none',    hair:'#4a3f37', top:'vest',    c1:'#ee7a1e', c2:'#c05f10', face:'calm',   build:'wide', mous:1 },
  { id:'studentka',n:'Студентка',  p:0,  s:'f', hat:'none',    hair:'#2e2723', top:'hoodie',  c1:'#c2506b', c2:'#9c3b52', face:'happy',  build:'slim', hairF:'bob',  buds:1 },
  { id:'ofisnaya', n:'Офисная',    p:0,  s:'f', hat:'none',    hair:'#3a2f28', top:'blazer',  c1:'#3f4d63', c2:'#2c3646', face:'tired',  build:'norm', hairF:'tail' },
  { id:'barista',  n:'Бариста',    p:0,  s:'f', hat:'bandana', hair:'#5a3a2a', top:'apron',   c1:'#2b2b2b', c2:'#1a1a1a', face:'happy',  build:'norm', hairF:'bun' },
  /* ---- за монеты ---- */
  { id:'doshikovod',n:'Дошиковод', p:50,  s:'m', hat:'none',   hair:'#2e2723', top:'tee',     c1:'#5a6b7d', c2:'#44525f', face:'happy',  build:'slim' },
  { id:'samokat',  n:'Самокатчик', p:75,  s:'m', hat:'helmetS',hair:'#2e2723', top:'wind',    c1:'#e8b93c', c2:'#b8901f', face:'driven', build:'norm' },
  { id:'shaurmaster',n:'Шаурмастер',p:100,s:'m', hat:'cook',   hair:'#2e2723', top:'apronW',  c1:'#c8492f', c2:'#9c3521', face:'happy',  build:'wide', beard:'full' },
  { id:'pvz',      n:'Пункт выдачи',p:125,s:'f', hat:'none',   hair:'#3a2f28', top:'polo',    c1:'#8a2fa0', c2:'#6a2380', face:'tired',  build:'norm', hairF:'tail', badge:1 },
  { id:'gopnik',   n:'Гопник',     p:175, s:'m', hat:'kepka',  hair:'#2e2723', top:'track',   c1:'#1f1f22', c2:'#0f0f11', face:'sly',    build:'norm' },
  { id:'itshnik',  n:'Айтишник',   p:225, s:'m', hat:'none',   hair:'#4a3f37', top:'hoodie',  c1:'#2a2f3a', c2:'#1b1f26', face:'calm',   build:'slim', beard:'short', cans:1 },
  { id:'dvornik',  n:'Дворник',    p:250, s:'m', hat:'ushanka',hair:'#4a3f37', top:'vest',    c1:'#ee7a1e', c2:'#c05f10', face:'proud',  build:'wide', mous:1, hc:['#5b452e','#3f2f1f','#7a5f42'] },
  { id:'hokkeist', n:'Хоккеист',   p:400, s:'m', hat:'hockey', hair:'#2e2723', top:'jersey',  c1:'#1f4b8f', c2:'#143a6b', face:'driven', build:'wide' },
  { id:'figuristka',n:'Фигуристка',p:400, s:'f', hat:'none',   hair:'#3a2f28', top:'skate',   c1:'#5b7fa8', c2:'#43607f', face:'happy',  build:'slim', hairF:'bun', tiara:1 },
  { id:'balerina', n:'Балерина',   p:600, s:'f', hat:'none',   hair:'#2e2723', top:'tutu',    c1:'#f4e3ea', c2:'#dcc3cd', face:'calm',   build:'slim', hairF:'bun' },
  { id:'kosmonavt',n:'Космонавт',  p:850, s:'m', hat:'space',  hair:'#2e2723', top:'suit',    c1:'#dcd8cf', c2:'#b9b4a9', face:'awe',    build:'norm' },
  { id:'tsar',     n:'Царь',       p:1100,s:'m', hat:'monomah',hair:'#3a332c', top:'barmy',   c1:'#8a1f2e', c2:'#661621', face:'proud',  build:'wide', beard:'full' },
  { id:'oligarh',  n:'Олигарх',    p:1350,s:'m', hat:'tophat', hair:'#3a332c', top:'fur',     c1:'#4a3a55', c2:'#372a40', face:'sly',    build:'norm', mous:1 },
  { id:'oligarhinya',n:'Олигархиня',p:1350,s:'f',hat:'none',   hair:'#241f1b', top:'fur',     c1:'#4a3a55', c2:'#372a40', face:'sly',    build:'norm', hairF:'long', shades:1 },
  { id:'zolotoy',  n:'Золотой нищеброд',p:1650,s:'m',hat:'ushanka',hair:'#3a332c',top:'gold', c1:'#d9a326', c2:'#a97c16', face:'happy',  build:'norm', beard:'full', hc:['#d9a326','#a97c16','#f0d98a'], star:1 },
];
export const SKIN = { m:'#f0c6a0', f:'#f6d6bd' };
export const TIER = (p) => p === 0 ? 0 : p < 200 ? 1 : p < 700 ? 2 : 3;
export const TBG  = ['#efece4', '#f0e4d2', '#e2e7ec', '#f7e7b4'];
export const TRIM = ['#b9b1a1', '#b87d3e', '#8b98a5', '#c9a23f'];
