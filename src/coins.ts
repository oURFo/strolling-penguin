import * as T from 'three'
import { random, type Snowfield } from './snow'

const REGION = 20
const CHANCE = .10
const coinMesh = new T.CylinderGeometry(.34, .34, .085, 24).rotateX(Math.PI / 2)
const rimMesh = new T.TorusGeometry(.274, .026, 8, 24)
const gold = new T.MeshStandardMaterial({color: 0xffc645, emissive: 0x7a3902, emissiveIntensity: .27, roughness: .41})
const rim = new T.MeshBasicMaterial({color: 0xffea91})

export function coinPosition(gx: number, gz: number, isWater: (x: number, z: number) => boolean) {
  const rng = random(Math.imul(gx, 0x7feb352d) ^ Math.imul(gz, 0x846ca68b) ^ 0xc0427837)
  if (rng() >= CHANCE) return
  for (let i = 0; i < 12; i++) {
    const x = gx * REGION + (rng() - .5) * 19
    const z = gz * REGION + (rng() - .5) * 19
    if (!isWater(x, z)) return {x, z}
  }
}

export class SnowCoins {
  readonly collected: Set<string>
  private coins = new Map<string, {x: number, z: number, model: T.Group}>()
  private checked = new Set<string>()
  private cellX?: number
  private cellZ?: number

  constructor(private scene: T.Scene, private snow: Snowfield, saved?: string[]) {
    this.collected = new Set(saved)
  }

  update(x: number, z: number, time: number) {
    const offset = this.snow.offset
    const cx = Math.floor((x + offset.x + REGION / 2) / REGION)
    const cz = Math.floor((z + offset.y + REGION / 2) / REGION)
    if (cx !== this.cellX || cz !== this.cellZ) {
      this.cellX = cx
      this.cellZ = cz
      const nearby = new Set<string>()
      for (let gz = cz - 2; gz <= cz + 2; gz++) for (let gx = cx - 2; gx <= cx + 2; gx++) {
        const key = gx + ',' + gz
        nearby.add(key)
        if (this.checked.has(key) || this.collected.has(key)) continue
        this.checked.add(key)
        const position = coinPosition(gx, gz, (px, pz) => this.snow.isWater(px - offset.x, pz - offset.y))
        if (!position) continue
        const model = new T.Group()
        const front = new T.Mesh(rimMesh, rim)
        const back = new T.Mesh(rimMesh, rim)
        front.position.z = .047
        back.position.z = -.047
        model.add(new T.Mesh(coinMesh, gold), front, back)
        this.scene.add(model)
        this.coins.set(key, {...position, model})
      }
      for (const key of this.checked) {
        if (nearby.has(key)) continue
        const coin = this.coins.get(key)
        if (coin) this.scene.remove(coin.model)
        this.coins.delete(key)
        this.checked.delete(key)
      }
    }
    let picked = 0
    for (const [key, coin] of this.coins) {
      const px = coin.x - offset.x
      const pz = coin.z - offset.y
      if ((px - x) ** 2 + (pz - z) ** 2 < 1.2 ** 2) {
        this.collected.add(key)
        this.scene.remove(coin.model)
        this.coins.delete(key)
        picked++
      } else {
        coin.model.position.set(px, this.snow.surface(px, pz) + .64 + Math.sin(time * 3 + px) * .09, pz)
        coin.model.rotation.set(.11, time * 1.8 + pz, 0)
      }
    }
    return picked
  }
}
