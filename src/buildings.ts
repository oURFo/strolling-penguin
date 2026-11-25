import type { PenguinSave } from './penguin'

export const BUILDINGS = {
  'small-igloo': {name: '小型雪屋', category: '住宅', size: 2, radius: 1, capacity: 5, cost: 10},
  'medium-igloo': {name: '中型雪屋', category: '住宅', size: 3, radius: 1.5, capacity: 12, cost: 30},
  sign: {name: '告示牌', category: '裝飾', size: 0, radius: .25, capacity: 0, cost: 3},
  planter: {name: '小花盆', category: '裝飾', size: 0, radius: .24, capacity: 0, cost: 3},
  sculpture: {name: '冰塊雕像', category: '裝飾', size: 0, radius: .37, capacity: 0, cost: 5},
  fountain: {name: '噴冰塊池', category: '裝飾', size: 0, radius: .63, capacity: 0, cost: 20},
  fishing: {name: '釣魚池', category: '功能', size: 2, radius: .82, capacity: 0, cost: 20},
  filter: {name: '海水過濾器', category: '功能', size: 1, radius: .39, capacity: 0, cost: 25},
} as const
export type BuildKind = keyof typeof BUILDINGS
export type Cell = {x: number, y: number}
export type Building = Cell & {id: number, kind?: BuildKind, rotation?: number, residents: PenguinSave[]}
export const buildingKind = (building: Building): BuildKind => building.kind ?? 'small-igloo'
export const buildingInfo = (building: Building) => BUILDINGS[buildingKind(building)]
export const propBlocks = (building: Building, x: number, y: number, fromX = x, fromY = y) => {
  const {size, radius} = buildingInfo(building)
  const cx = building.x + size / 2, cy = building.y + size / 2
  const distance = (x - cx) ** 2 + (y - cy) ** 2
  // An object can be moved onto an animal. Allow it to walk back out.
  return distance < (radius + .12) ** 2 && distance <= (fromX - cx) ** 2 + (fromY - cy) ** 2
}
export const buildingCenter = (building: Building) => {
  const half = buildingInfo(building).size / 2
  return {x: building.x + half, y: building.y + half}
}
