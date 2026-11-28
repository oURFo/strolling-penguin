import {BUILDINGS, type BuildKind, type CHRISTMAS_STARS} from './buildings.ts'

type BuildingItem = {category: '建築', name: string, description: string, sellPrice: number, building: BuildKind}
function christmasStar(building: keyof typeof CHRISTMAS_STARS): BuildingItem {
  return {
    category: '建築', name: BUILDINGS[building].name, sellPrice: 5, building,
    description: '從雪地寶箱找到的浮空星星，入夜會發光。可在企鵝領地自由放置與旋轉，回收時會返還背包。',
  }
}
export const ITEMS = {
  'otter-statue': {
    category: '建築', name: BUILDINGS['otter-statue'].name, sellPrice: 10, building: 'otter-statue',
    description: '一隻戴橘色圍巾、正面坐在冰底座上的水瀨雕像。可在企鵝領地使用，佔地 2×2 格。放置時消耗一件，回收後返還背包。',
  },
  'christmas-star-red': christmasStar('christmas-star-red'),
  'christmas-star-green': christmasStar('christmas-star-green'),
  'christmas-star-blue': christmasStar('christmas-star-blue'),
  'christmas-star-white': christmasStar('christmas-star-white'),
  'christmas-wheel': {
    category: '建築', name: '聖誕摩天輪', sellPrice: 50, building: 'christmas-wheel',
    description: '覆雪的摩天輪掛著閃爍的聖誕燈，領地夥伴可以搭乘一圈。佔地 4×2 格。可在企鵝領地使用，完成放置時消耗一件。回收建物時會返還至背包。',
  },
} as const satisfies Record<string, BuildingItem>
export type ItemId = keyof typeof ITEMS
