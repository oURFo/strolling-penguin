import type { PenguinSave } from './penguin'

export const CHRISTMAS_STARS = {
  'christmas-star-red': {color: 0xff526a, size: 1.1},
  'christmas-star-green': {color: 0x48e698, size: 0.9},
  'christmas-star-blue': {color: 0x61baff, size: 1.32},
  'christmas-star-white': {color: 0xfff9ed, size: 0.72},
} as const
export const isChristmasStar = (kind: string): kind is keyof typeof CHRISTMAS_STARS =>
  Object.hasOwn(CHRISTMAS_STARS, kind)
export const isInventoryBuilding = (kind: BuildKind) => kind === 'christmas-wheel' || kind === 'otter-statue' || isChristmasStar(kind)

export const BUILDINGS = {
  'christmas-star-red': {name: '聖誕星星（紅）', category: '裝飾', size: 0, radius: 0, capacity: 0, cost: 0},
  'christmas-star-green': {name: '聖誕星星（綠）', category: '裝飾', size: 0, radius: 0, capacity: 0, cost: 0},
  'christmas-star-blue': {name: '聖誕星星（藍）', category: '裝飾', size: 0, radius: 0, capacity: 0, cost: 0},
  'christmas-star-white': {name: '聖誕星星（白）', category: '裝飾', size: 0, radius: 0, capacity: 0, cost: 0},
  'small-igloo': {name: '小型雪屋', category: '住宅', size: 2, radius: 1, capacity: 5, cost: 10},
  'medium-igloo': {name: '中型雪屋', category: '住宅', size: 3, radius: 1.5, capacity: 12, cost: 30},
  sign: {name: '告示牌', category: '裝飾', size: 0, radius: .25, capacity: 0, cost: 3},
  planter: {name: '小花盆', category: '裝飾', size: 0, radius: .24, capacity: 0, cost: 3},
  sculpture: {name: '冰塊雕像', category: '裝飾', size: 0, radius: .37, capacity: 0, cost: 5},
  'otter-statue': {name: '水瀨雕像', category: '裝飾', size: 2, radius: 1, capacity: 0, cost: 0},
  fountain: {name: '噴冰塊池', category: '裝飾', size: 0, radius: .63, capacity: 0, cost: 20},
  'snow-lamp': {name: '雪地燈', category: '裝飾', size: 0, radius: .23, capacity: 0, cost: 5},
  'tall-lamp': {name: '高路燈', category: '裝飾', size: 0, radius: .27, capacity: 0, cost: 6},
  'christmas-tree': {name: '聖誕樹', category: '裝飾', size: 0, radius: .53, capacity: 0, cost: 50},
  'christmas-gifts': {name: '聖誕小飾品', category: '裝飾', size: 0, radius: .32, capacity: 0, cost: 8},
  'santa-sleigh': {name: '聖誕老人雪橇', category: '裝飾', size: 0, radius: .59, capacity: 0, cost: 15},
  'snow-machine': {name: '噴雪機', category: '裝飾', size: 0, radius: .4, capacity: 0, cost: 50},
  fishing: {name: '釣魚池', category: '功能', size: 2, radius: .82, capacity: 0, cost: 20},
  filter: {name: '海水過濾器', category: '功能', size: 1, radius: .39, capacity: 0, cost: 25},
  school: {name: '企鵝學校', category: '功能', size: 3, radius: 1.5, capacity: 0, cost: 100},
  laboratory: {name: '企鵝實驗室', category: '功能', size: 3, radius: 1.5, capacity: 0, cost: 150},
  'christmas-wheel': {name: '聖誕摩天輪', category: '功能', size: 4, depth: 2, radius: 2, capacity: 0, cost: 0},
  'fish-stall': {name: '烤魚攤', category: '功能', size: 1, depth: 2, radius: .94, capacity: 0, cost: 50},
  'ice-stall': {name: '刨冰攤', category: '功能', size: 1, depth: 2, radius: .94, capacity: 0, cost: 50},
} as const
export type BuildKind = keyof typeof BUILDINGS
export type BuildCategory = (typeof BUILDINGS)[BuildKind]['category']
export type StallKind = 'fish-stall' | 'ice-stall'
export const isStall = (kind?: BuildKind): kind is StallKind => kind === 'fish-stall' || kind === 'ice-stall'
export const rotatesOnGrid = (kind?: BuildKind) => isStall(kind) || kind === 'christmas-wheel'
export const WHEEL_PERIOD = 18
export const WHEEL_SEATS = 6
export const WHEEL_RADIUS = 3.65
export const WHEEL_HEIGHT = 4.35

export function wheelBoardingDistance(building: Building, position: Cell) {
  const center = buildingCenter(building)
  const angle = (building.rotation ?? 0) * Math.PI / 4
  const x = center.x + Math.sin(angle) * 3.1 / TERRITORY_TILE
  const y = center.y + Math.cos(angle) * 3.1 / TERRITORY_TILE
  return Math.hypot(position.x - x, position.y - y) * TERRITORY_TILE
}

export function wheelCabinPosition(time: number, seat: number) {
  const orbit = (time / WHEEL_PERIOD + seat / WHEEL_SEATS) * Math.PI * 2
  return {x: Math.sin(orbit) * WHEEL_RADIUS, y: WHEEL_HEIGHT - Math.cos(orbit) * WHEEL_RADIUS}
}
export type BuildSubcategory = '一般' | '聖誕節' | '攤販'
export const BUILD_SUBCATEGORIES: Record<BuildCategory, readonly BuildSubcategory[]> = {
  住宅: ['一般'], 功能: ['一般', '攤販'], 裝飾: ['一般', '聖誕節'],
}
export const buildingSubcategory = (kind: BuildKind): BuildSubcategory =>
  isStall(kind) ? '攤販' : kind === 'christmas-tree' || kind === 'christmas-gifts' || kind === 'santa-sleigh' || kind === 'snow-machine' ? '聖誕節' : '一般'
export type Cell = {x: number, y: number}
export type Building = Cell & {id: number, kind?: BuildKind, rotation?: number, residents: PenguinSave[], stallPaidThrough?: number, inventoryItem?: string}
export const buildingKind = (building: Building): BuildKind => building.kind ?? 'small-igloo'
export const buildingInfo = (building: Building) => BUILDINGS[buildingKind(building)]
export function buildingFootprint(kind: BuildKind, rotation = 0) {
  const info = BUILDINGS[kind]
  const width = info.size, depth = 'depth' in info ? info.depth : width
  return rotation % 4 === 2 ? {width: depth, depth: width} : {width, depth}
}
export const TERRITORY_TILE = 3.1
// Local model units: half width, half depth, then optional forward offset.
type CollisionPart = readonly [halfWidth: number, halfDepth: number, forward?: number, box?: true]
const collisionParts: Record<BuildKind, readonly CollisionPart[]> = {
  'christmas-star-red': [],
  'christmas-star-green': [],
  'christmas-star-blue': [],
  'christmas-star-white': [],
  'small-igloo': [[2.49, 2.23], [.87, 1.04, 1.78]],
  'medium-igloo': [[3.66, 3.28], [1.28, 1.53, 2.62]],
  sign: [[.64, .13, .13, true]], planter: [[.42, .42]],
  sculpture: [[.69, .56, 0, true]], fountain: [[1.85, 1.38]],
  'otter-statue': [[2.43, 2.08]],
  'snow-lamp': [[.31, .31]], 'tall-lamp': [[.36, .36]],
  'christmas-tree': [[1.62, 1.62]], 'christmas-gifts': [[.72, .64, .11, true]],
  'santa-sleigh': [[.81, 1.45, -.04, true]], 'snow-machine': [[.74, .69, 0, true]],
  fishing: [[2.48, 1.94]], filter: [[.89, .82, 0, true], [.23, .22, .89]],
  school: [[3.24, 2.14, 0, true], [.89, .33, 2.42, true]],
  laboratory: [[2.95, 2.35, 0, true]],
  'fish-stall': [[1.32, 2.53, 0, true]], 'ice-stall': [[1.32, 2.53, 0, true]],
  'christmas-wheel': [[4.35, 2.15, 0, true]],
}

export function propBlocks(building: Pick<Building, 'kind' | 'rotation' | 'x' | 'y'>,
  x: number, y: number, fromX = x, fromY = y) {
  const kind = building.kind ?? 'small-igloo'
  const rotation = building.rotation ?? 0
  const {width, depth} = buildingFootprint(kind, rotation)
  const cx = building.x + width / 2, cy = building.y + depth / 2
  const dx = (x - cx) * TERRITORY_TILE, dy = (y - cy) * TERRITORY_TILE
  if (Math.abs(dx) > 6 || Math.abs(dy) > 6) return false
  const angle = rotation * Math.PI / 4
  const cos = Math.cos(angle), sin = Math.sin(angle)
  const lx = dx * cos - dy * sin, ly = dx * sin + dy * cos
  const fx = (fromX - cx) * TERRITORY_TILE, fy = (fromY - cy) * TERRITORY_TILE
  const previousX = fx * cos - fy * sin, previousY = fx * sin + fy * cos
  const margin = .20
  for (const [halfWidth, halfDepth, forward = 0, box] of collisionParts[kind]) {
    const distance = (px: number, py: number) => {
      const u = Math.abs(px) / (halfWidth + margin)
      const v = Math.abs(py - forward) / (halfDepth + margin)
      return box ? Math.max(u, v) : u * u + v * v
    }
    const next = distance(lx, ly)
    // Allow an animal already inside a collider to move outward.
    if (next < 1 && next <= distance(previousX, previousY)) return true
  }
  return false
}
export const buildingCenter = (building: Building) => {
  const {width, depth} = buildingFootprint(buildingKind(building), building.rotation)
  return {x: building.x + width / 2, y: building.y + depth / 2}
}
