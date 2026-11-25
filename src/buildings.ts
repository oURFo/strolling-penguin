import type { PenguinSave } from './penguin'

export const BUILDINGS = {
  'small-igloo': {name: '小型雪屋', category: '住宅', size: 2, radius: 1, capacity: 5, cost: 10},
  'medium-igloo': {name: '中型雪屋', category: '住宅', size: 3, radius: 1.5, capacity: 12, cost: 30},
  sign: {name: '告示牌', category: '裝飾', size: 0, radius: .25, capacity: 0, cost: 3},
  planter: {name: '小花盆', category: '裝飾', size: 0, radius: .24, capacity: 0, cost: 3},
  sculpture: {name: '冰塊雕像', category: '裝飾', size: 0, radius: .37, capacity: 0, cost: 5},
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
  'fish-stall': {name: '烤魚攤', category: '功能', size: 1, depth: 2, radius: .94, capacity: 0, cost: 50},
  'ice-stall': {name: '刨冰攤', category: '功能', size: 1, depth: 2, radius: .94, capacity: 0, cost: 50},
} as const
export type BuildKind = keyof typeof BUILDINGS
export type BuildCategory = (typeof BUILDINGS)[BuildKind]['category']
export type StallKind = 'fish-stall' | 'ice-stall'
export const isStall = (kind?: BuildKind): kind is StallKind => kind === 'fish-stall' || kind === 'ice-stall'
export type BuildSubcategory = '一般' | '聖誕節' | '攤販'
export const BUILD_SUBCATEGORIES: Record<BuildCategory, readonly BuildSubcategory[]> = {
  住宅: ['一般'], 功能: ['一般', '攤販'], 裝飾: ['一般', '聖誕節'],
}
export const buildingSubcategory = (kind: BuildKind): BuildSubcategory =>
  isStall(kind) ? '攤販' : kind === 'christmas-tree' || kind === 'christmas-gifts' || kind === 'santa-sleigh' || kind === 'snow-machine' ? '聖誕節' : '一般'
export type Cell = {x: number, y: number}
export type Building = Cell & {id: number, kind?: BuildKind, rotation?: number, residents: PenguinSave[], stallPaidThrough?: number}
export const buildingKind = (building: Building): BuildKind => building.kind ?? 'small-igloo'
export const buildingInfo = (building: Building) => BUILDINGS[buildingKind(building)]
export function buildingFootprint(kind: BuildKind, rotation = 0) {
  const info = BUILDINGS[kind]
  const width = info.size, depth = 'depth' in info ? info.depth : width
  return rotation % 4 === 2 ? {width: depth, depth: width} : {width, depth}
}
export const propBlocks = (building: Building, x: number, y: number, fromX = x, fromY = y) => {
  if (isStall(building.kind) || building.kind === 'school') {
    const {width, depth} = buildingFootprint(building.kind, building.rotation)
    const penetration = (px: number, py: number) =>
      Math.min(px - building.x, building.x + width - px, py - building.y, building.y + depth - py)
    const next = penetration(x, y)
    return next > -.12 && next >= penetration(fromX, fromY)
  }
  const {radius} = buildingInfo(building)
  const {x: cx, y: cy} = buildingCenter(building)
  const distance = (x - cx) ** 2 + (y - cy) ** 2
  // An object can be moved onto an animal. Allow it to walk back out.
  return distance < (radius + .12) ** 2 && distance <= (fromX - cx) ** 2 + (fromY - cy) ** 2
}
export const buildingCenter = (building: Building) => {
  const {width, depth} = buildingFootprint(buildingKind(building), building.rotation)
  return {x: building.x + width / 2, y: building.y + depth / 2}
}
