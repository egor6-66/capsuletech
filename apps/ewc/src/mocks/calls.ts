/**
 * Моки экстренных карточек — 200 записей для проверки DataTable scroll + DnD
 * + остальных интерактивных слоёв workspace'а.
 *
 * Координаты — случайные точки в bounding-box Санкт-Петербурга
 * (примерно 59.83–60.05 lat × 30.10–30.55 lng).
 *
 * Deterministic RNG через линейный конгруэнтный seed — одинаковые моки
 * между перезагрузками (без drift при HMR). Если понадобится разнообразие —
 * измени `SEED`.
 */

const SEED = 42;
let rngState = SEED;
const rand = (): number => {
  // mulberry32-light — достаточно для UX-моков.
  rngState = (rngState * 1664525 + 1013904223) | 0;
  return ((rngState >>> 0) % 1_000_000) / 1_000_000;
};

const randomInRange = (min: number, max: number): number => min + rand() * (max - min);

// SPb bounding box (центральные районы + ближайшие пригороды).
const SPB_LAT = [59.83, 60.05] as const;
const SPB_LNG = [30.1, 30.55] as const;

const FIRST_NAMES = [
  'Алексей',
  'Мария',
  'Иван',
  'Ольга',
  'Дмитрий',
  'Анна',
  'Сергей',
  'Татьяна',
  'Михаил',
  'Екатерина',
  'Андрей',
  'Наталья',
  'Павел',
  'Светлана',
  'Виктор',
];
const LAST_NAMES = [
  'Иванов',
  'Петров',
  'Сидоров',
  'Смирнов',
  'Кузнецов',
  'Попов',
  'Васильев',
  'Соколов',
  'Михайлов',
  'Новиков',
  'Фёдоров',
  'Морозов',
  'Волков',
  'Алексеев',
  'Лебедев',
];

const DESCRIPTIONS = [
  'ДТП на перекрёстке, есть пострадавшие',
  'Возгорание в подвале жилого дома',
  'Утечка газа в квартире',
  'Подозрительный предмет на остановке',
  'Прорыв трубы холодного водоснабжения',
  'Падение крупного ветки на припаркованную машину',
  'Конфликт между жильцами с угрозой здоровью',
  'Ребёнок застрял в лифте',
  'Пожилому человеку плохо на улице',
  'Кошка на дереве, не может слезть',
  'Прорыв канализации',
  'Срабатывание сигнализации в магазине',
  'Возгорание автомобиля во дворе',
  'Затопление подвала после ливня',
  'Подозрение на отравление угарным газом',
];

const pick = <T>(list: readonly T[]): T => list[Math.floor(rand() * list.length)];

const padTwo = (n: number): string => (n < 10 ? `0${n}` : `${n}`);

const makeIsoDate = (i: number): string => {
  // Распределяем карточки за последние 30 дней.
  const offsetMinutes = Math.floor(rand() * 60 * 24 * 30);
  const d = new Date(Date.now() - offsetMinutes * 60 * 1000);
  return `${d.getUTCFullYear()}-${padTwo(d.getUTCMonth() + 1)}-${padTwo(d.getUTCDate())}T${padTwo(
    d.getUTCHours(),
  )}:${padTwo(d.getUTCMinutes())}:00Z`;
};

const makePhone = (): string => {
  const a = 900 + Math.floor(rand() * 99);
  const b = 100 + Math.floor(rand() * 899);
  const c = 10 + Math.floor(rand() * 89);
  const d = 10 + Math.floor(rand() * 89);
  return `+7 (${a}) ${b}-${padTwo(c)}-${padTwo(d)}`;
};

export interface ICallMock {
  id: string;
  applicant: { name: string; phone: string };
  location: { lng: number; lat: number };
  description: string;
  createdAt: string;
}

export const CALLS_MOCK: ICallMock[] = Array.from({ length: 200 }, (_, i) => ({
  id: `call-${String(i + 1).padStart(4, '0')}`,
  applicant: {
    name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
    phone: makePhone(),
  },
  location: {
    lng: Number(randomInRange(SPB_LNG[0], SPB_LNG[1]).toFixed(5)),
    lat: Number(randomInRange(SPB_LAT[0], SPB_LAT[1]).toFixed(5)),
  },
  description: pick(DESCRIPTIONS),
  createdAt: makeIsoDate(i),
}));
