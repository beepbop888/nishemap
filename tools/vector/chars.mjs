/* Персонаж описан ОДИН раз как данные. Каждый стиль — отдельный рендерер над этими данными.
   Так десять стилей рисуют одних и тех же людей, и сравнение честное. */
export const CHARS = [
  { id:'student',   name:'Студент',    price:0,    hat:'ushanka', hairCol:'#3a3129', beard:null,
    prop:'stakan',  skin:'light', cloth:'#4f6f8f', accent:'#c8492f', eyes:'tired' },
  { id:'babushka',  name:'Бабушка',    price:0,    hat:'platok',  hairCol:'#c9c2b6', beard:null,
    prop:'avoska',  skin:'pale',  cloth:'#7d6a8f', accent:'#b8465c', eyes:'old' },
  { id:'kurier',    name:'Курьер',     price:0,    hat:'cap',     hairCol:'#2e2723', beard:null,
    prop:'box',     skin:'tan',   cloth:'#2f6b4f', accent:'#f0c948', eyes:'driven' },
  { id:'doshikovod',name:'Дошиковод',  price:50,   hat:null,      hairCol:'#2e2723', beard:null,
    prop:'doshik',  skin:'light', cloth:'#5a6b7d', accent:'#d4402e', eyes:'happy' },
  { id:'shaurmaster',name:'Шаурмастер',price:100,  hat:'cap',     hairCol:'#2e2723', beard:'full',
    prop:'shaurma', skin:'tan',   cloth:'#c8492f', accent:'#f2f1ee', eyes:'happy' },
  { id:'gopnik',    name:'Гопник',     price:175,  hat:'kepka',   hairCol:'#2e2723', beard:null,
    prop:'semki',   skin:'light', cloth:'#1f1f22', accent:'#f2f1ee', eyes:'sly' },
  { id:'dvornik',   name:'Дворник',    price:250,  hat:'ushanka', hairCol:'#4a3f37', beard:'mous',
    prop:'metla',   skin:'tan',   cloth:'#ee7a1e', accent:'#5b452e', eyes:'calm' },
  { id:'hokkeist',  name:'Хоккеист',   price:400,  hat:'helmet',  hairCol:'#2e2723', beard:null,
    prop:'klyushka',skin:'light', cloth:'#1f4b8f', accent:'#c8322a', eyes:'driven' },
  { id:'kosmonavt', name:'Космонавт',  price:850,  hat:'helmet2', hairCol:'#2e2723', beard:null,
    prop:'zvezda',  skin:'light', cloth:'#dcd8cf', accent:'#d9a326', eyes:'awe' },
  { id:'tsar',      name:'Царь',       price:1100, hat:'crown',   hairCol:'#3a332c', beard:'full',
    prop:'skipetr', skin:'light', cloth:'#8a1f2e', accent:'#e8b93c', eyes:'proud' },
  { id:'oligarh',   name:'Олигарх',    price:1350, hat:'tophat',  hairCol:'#3a332c', beard:'mous',
    prop:'ruble',   skin:'light', cloth:'#4a3a55', accent:'#e8b93c', eyes:'sly' },
  { id:'zolotoy',   name:'Золотой нищеброд', price:1650, hat:'ushanka_gold', hairCol:'#3a332c', beard:'full',
    prop:'ruble',   skin:'light', cloth:'#d9a326', accent:'#c8322a', eyes:'happy' },
];
export const SKIN = { light:'#f2cba4', pale:'#f8e0d2', tan:'#d29b6e', deep:'#a3703f' };
/* уровень редкости → подложка и обод */
export const TIER = (p) => p === 0 ? 0 : p < 300 ? 1 : p < 900 ? 2 : 3;
