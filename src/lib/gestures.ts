export type Point = { x: number; y: number; z?: number };
export type Gesture = 'palm' | 'peace' | 'fist';
export const gestures: {id: Gesture; name: string; symbol: string; action: string; instruction: string}[] = [
  { id: 'palm', name: 'Открытая ладонь', symbol: '✋', action: 'Низкая нота', instruction: 'Выпрями четыре пальца и поверни ладонь к камере.' },
  { id: 'peace', name: 'Два пальца', symbol: '✌️', action: 'Высокая нота', instruction: 'Выпрями указательный и средний пальцы, остальные согни.' },
  { id: 'fist', name: 'Кулак', symbol: '✊', action: 'Ритмический удар', instruction: 'Согни все четыре пальца в кулак.' },
];
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0));
export function classifyHand(points: Point[], expected?: Gesture): { gesture: Gesture | null; hint: string } {
  if (points.length !== 21) return { gesture: null, hint: 'Покажи одну руку целиком, включая запястье.' };
  const scale = distance(points[0], points[9]);
  if (scale < .085) return { gesture: null, hint: 'Поднеси руку ближе: кисть слишком маленькая в кадре.' };
  if (points.some(p => p.x < .025 || p.x > .975 || p.y < .025 || p.y > .975)) return { gesture: null, hint: 'Перемести руку в центр кадра, чтобы все пальцы были видны.' };
  if (Math.abs(points[5].x - points[17].x) < scale * .23) return { gesture: null, hint: 'Поверни ладонь к камере — сейчас виден только её край.' };
  const fingers = [8, 12, 16, 20].map(tip => {
    const ratio = distance(points[tip], points[0]) / Math.max(distance(points[tip - 2], points[0]), .001);
    return ratio > 1.23 ? 'open' : ratio < 1.04 ? 'closed' : 'bent';
  });
  let gesture: Gesture | null = null;
  if (fingers.every(f => f === 'open')) gesture = 'palm';
  else if (fingers.every(f => f === 'closed')) gesture = 'fist';
  else if (fingers[0] === 'open' && fingers[1] === 'open' && fingers[2] === 'closed' && fingers[3] === 'closed') gesture = 'peace';
  const target = expected ?? (fingers.filter(f => f === 'open').length >= 3 ? 'palm' : 'peace');
  const wanted = target === 'palm' ? ['open','open','open','open'] : target === 'fist' ? ['closed','closed','closed','closed'] : ['open','open','closed','closed'];
  const names = ['указательный палец', 'средний палец', 'безымянный палец', 'мизинец'];
  const mismatch = fingers.findIndex((f, i) => f !== wanted[i]);
  const hint = mismatch >= 0 ? `${wanted[mismatch] === 'open' ? 'Выпрями' : 'Согни'} ${names[mismatch]}, чтобы сыграть нужный звук.` : 'Отлично! Удержи жест на мгновение.';
  return { gesture, hint };
}
export const melody: Gesture[] = ['palm', 'peace', 'fist', 'palm', 'fist', 'peace', 'palm', 'peace', 'fist'];
