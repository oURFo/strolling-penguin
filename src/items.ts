import type {BuildKind} from './buildings'

type BuildingItem = {category: '建築', name: string, description: string, sellPrice: number, building: BuildKind}
export const ITEMS = {
  'christmas-wheel': {
    category: '建築', name: '聖誕摩天輪', sellPrice: 50, building: 'christmas-wheel',
    description: '覆雪的摩天輪掛著閃爍的聖誕燈，領地夥伴可以搭乘一圈。佔地 4×2 格。可在企鵝領地使用，完成放置時消耗一件。回收建物時會返還至背包。',
  },
} as const satisfies Record<string, BuildingItem>
export type ItemId = keyof typeof ITEMS
