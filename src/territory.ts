import type { Penguin, PenguinSave } from './penguin'
import type { WebGLRenderer } from 'three'
import { TerritoryWorld, TERRITORY_TILE } from './territory-world'
import { bindCameraZoom } from './camera-zoom'
import { ITEMS, type ItemId } from './items'
import { BUILDINGS, BUILD_SUBCATEGORIES, buildingFootprint, buildingInfo, buildingKind, buildingSubcategory, isStall, isInventoryBuilding, rotatesOnGrid, propBlocks, wheelBoardingDistance,
  type Building, type BuildCategory, type BuildKind, type BuildSubcategory, type Cell, type StallKind } from './buildings'

export const TERRITORY_WIDTH = 30
export const TERRITORY_HEIGHT = 24
const WIDTH = TERRITORY_WIDTH
const HEIGHT = TERRITORY_HEIGHT
const STALL_HOUR = 60 * 60 * 1000
export type TerritorySave = {coins: number, houses: Building[], position?: Cell, pondGrid?: true, inventory?: Partial<Record<ItemId, number>>}
const speciesNames = {penguin: '企鵝', seal: '海豹', mammoth: '長毛象', 'saber-tooth': '劍齒虎'}
const clampWalk = (value: number, maximum: number) => Math.max(.39, Math.min(maximum - .39, value))
const turn = (rotation = 0, kind?: BuildKind) => (rotation + (rotatesOnGrid(kind) ? 2 : 1)) % 8

export class TerritoryState {
  readonly pondGrid = true
  coins: number
  houses: Building[]
  position: Cell
  inventory: Partial<Record<ItemId, number>>

  get residentCount() {
    return this.houses.reduce((total, house) => total + house.residents.length, 0)
  }

  constructor(saved?: TerritorySave) {
    this.inventory = {...saved?.inventory}
    this.coins = Number.isSafeInteger(saved?.coins) ? Math.max(0, saved!.coins) : 0
    this.houses = Array.isArray(saved?.houses) ? saved.houses : []
    const savedPosition = saved?.position
    const house = this.houses[0]
    this.position = savedPosition && Number.isFinite(savedPosition.x) && Number.isFinite(savedPosition.y)
      ? {x: clampWalk(savedPosition.x, WIDTH), y: clampWalk(savedPosition.y, HEIGHT)}
      : house ? {x: house.x + 1, y: clampWalk(house.y + 2.7, HEIGHT)} : {x: WIDTH / 2, y: HEIGHT / 2}
    if (!saved?.pondGrid) this.migratePonds()
    const stalls = new Set<StallKind>()
    this.houses = this.houses.filter(house => {
      if (!isStall(house.kind)) return true
      if (stalls.has(house.kind)) {
        this.coins += BUILDINGS[house.kind].cost
        return false
      }
      stalls.add(house.kind)
      return true
    })
  }

  private migratePonds() {
    const ponds = this.houses.filter(house => house.kind === 'fishing')
    this.houses = this.houses.filter(house => house.kind !== 'fishing')
    for (const pond of ponds) {
      let spot: Cell | undefined
      let distance = Infinity
      for (let y = 0; y <= HEIGHT - 2; y++) for (let x = 0; x <= WIDTH - 2; x++) {
        const gap = (x + 1 - pond.x) ** 2 + (y + 1 - pond.y) ** 2
        if (gap >= distance || !this.canPlace({x, y}, 'fishing')) continue
        spot = {x, y}
        distance = gap
      }
      if (spot) this.houses.push({...pond, ...spot})
      else this.coins += BUILDINGS.fishing.cost
    }
  }

  walk(dx: number, dy: number) {
    const {position} = this
    const x = clampWalk(position.x + dx, WIDTH)
    if (this.walkable(x, position.y, position)) position.x = x
    const y = clampWalk(position.y + dy, HEIGHT)
    if (this.walkable(position.x, y, position)) position.y = y
  }

  private walkable(x: number, y: number, from?: Cell) {
    return !this.houses.some(h => propBlocks(h, x, y, from?.x, from?.y))
  }

  enterAtCenter() {
    const x = WIDTH / 2, y = HEIGHT / 2
    if (this.walkable(x, y)) {
      this.position = {x, y}
      return
    }
    for (let distance = .5; distance < Math.hypot(WIDTH, HEIGHT); distance += .5) {
      for (let i = 0; i < 16; i++) {
        const angle = i * Math.PI / 8
        const px = clampWalk(x + Math.sin(angle) * distance, WIDTH)
        const py = clampWalk(y + Math.cos(angle) * distance, HEIGHT)
        if (!this.walkable(px, py)) continue
        this.position = {x: px, y: py}
        return
      }
    }
  }

  fits({x, y}: Cell, kind: BuildKind, moving?: Building, rotation = moving?.rotation ?? 0) {
    const {width, depth} = buildingFootprint(kind, rotation)
    const {radius} = BUILDINGS[kind]
    if (!width) return x >= radius && x <= WIDTH - radius && y >= radius && y <= HEIGHT - radius
    return (!rotatesOnGrid(kind) || rotation % 2 === 0) && Number.isInteger(x) && Number.isInteger(y) &&
      x >= 0 && x <= WIDTH - width && y >= 0 && y <= HEIGHT - depth
      && !this.houses.some(h => {
        const other = buildingFootprint(buildingKind(h), h.rotation)
        return h !== moving && other.width > 0 &&
          x < h.x + other.width && x + width > h.x && y < h.y + other.depth && y + depth > h.y
      })
  }

  place(cell: Cell, kind: BuildKind, moving?: Building, rotation = moving?.rotation ?? 0, item?: ItemId) {
    if (!this.canPlace(cell, kind, moving, rotation)) return false
    if (moving) {
      Object.assign(moving, cell, {rotation})
    } else {
      if (item ? ITEMS[item].building !== kind || !this.itemCount(item) : isInventoryBuilding(kind)) return false
      const cost = item ? 0 : BUILDINGS[kind].cost
      if (this.coins < cost) return false
      const id = 1 + this.houses.reduce((max, house) => Math.max(max, house.id), 0)
      const building: Building = {...cell, id, kind, rotation, residents: [], inventoryItem: item}
      if (isStall(kind)) building.stallPaidThrough = Date.now()
      this.houses.push(building)
      this.coins -= cost
      if (item) this.inventory[item] = this.itemCount(item) - 1
    }
    return true
  }

  rotate(house: Building) {
    const kind = buildingKind(house)
    const rotation = turn(house.rotation, kind)
    if (rotatesOnGrid(kind) && !this.canPlace(house, kind, house, rotation)) return false
    house.rotation = rotation
    return true
  }

  canPlace(cell: Cell, kind: BuildKind, moving?: Building, rotation = moving?.rotation ?? 0) {
    const {x, y} = this.position
    return (!!moving || !this.ownsStall(kind)) && this.fits(cell, kind, moving, rotation) &&
      (!BUILDINGS[kind].size || !propBlocks({...cell, kind, rotation}, x, y))
  }

  ownsStall(kind: BuildKind) {
    return isStall(kind) && this.houses.some(house => house.kind === kind)
  }

  recycle(house: Building, returnMember: (saved: PenguinSave) => void) {
    if (!this.houses.includes(house)) return
    this.settleStallIncome()
    this.houses = this.houses.filter(h => h !== house)
    for (const member of house.residents) returnMember(member)
    const item = house.inventoryItem
    if (item && Object.hasOwn(ITEMS, item)) {
      const id = item as ItemId
      this.inventory[id] = this.itemCount(id) + 1
    } else this.coins += buildingInfo(house).cost
  }

  itemCount(item: ItemId) {
    const count = this.inventory[item] ?? 0
    return Number.isSafeInteger(count) && count > 0 ? count : 0
  }

  sellItem(item: ItemId) {
    if (!this.itemCount(item)) return false
    this.inventory[item] = this.itemCount(item) - 1
    this.coins += ITEMS[item].sellPrice
    return true
  }

  settleStallIncome(now = Date.now()) {
    let income = 0
    for (const stall of this.houses) {
      if (!isStall(stall.kind)) continue
      const paidThrough = stall.stallPaidThrough
      if (paidThrough === undefined || !Number.isSafeInteger(paidThrough) || paidThrough <= 0) {
        stall.stallPaidThrough = now
        continue
      }
      const hours = Math.floor((now - paidThrough) / STALL_HOUR)
      if (hours <= 0) continue
      stall.stallPaidThrough = paidThrough + hours * STALL_HOUR
      income += hours
    }
    this.coins += income
    return income
  }
}

const element = <E extends HTMLElement>(id: string) => document.getElementById(id) as E

export class Territory {
  private board = element('plot')
  private page = element('territory')
  private view = element('territory-view')
  private cameraDistance = element<HTMLInputElement>('territory-camera-distance')
  private cameraAngle = element<HTMLInputElement>('territory-camera-angle')
  private zoom = bindCameraZoom(this.cameraDistance, element<HTMLOutputElement>('territory-camera-percent'),
    'strolling-penguin-territory-camera')
  private world?: TerritoryWorld
  private spots = new Map<Building, HTMLButtonElement>()
  private cursor?: Cell
  private keys = new Set<string>()
  private drag?: {id: number, startX: number, startY: number, x: number, y: number}
  private hint = element('territory-hint')
  private interact = element<HTMLButtonElement>('building-interact')
  private buildMenu = element<HTMLDialogElement>('build-menu')
  private editMenu = element<HTMLDialogElement>('igloo-edit')
  private roster = element<HTMLDialogElement>('igloo-roster')
  private portraits = new WeakMap<HTMLImageElement, {saved: PenguinSave, leader: boolean}>()
  private portraitObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue
      const image = entry.target as HTMLImageElement
      const request = this.portraits.get(image)
      if (request && this.world) image.src = this.world.portrait(request.saved, request.leader)
      this.portraitObserver.unobserve(image)
    }
  }, {root: this.roster})
  private editButton = element<HTMLButtonElement>('edit-territory')
  private residentsButton = element<HTMLButtonElement>('edit-residents')
  private editing = false
  private placement?: BuildKind | Building
  private placementItem?: ItemId
  private category: BuildCategory = '住宅'
  private subcategory: BuildSubcategory = '一般'
  private rotation = 0
  private selected?: Building

  constructor(readonly state: TerritoryState, private team: () => Penguin[],
    private storeMember: (member: Penguin) => PenguinSave | undefined,
    private returnMember: (saved: PenguinSave) => void, private save: () => void,
    private renderer: WebGLRenderer, private player: Penguin,
    private activateAudio: () => void, private stepAudio: () => void, private visiting = false) {
    this.enableMovement()
    this.interact.onclick = () => {
      const wheel = this.nearbyWheel()
      if (!wheel || !this.world?.boardWheel(wheel)) return
      this.interact.hidden = true
      this.hint.textContent = '搭乘中 · 按方向鍵、WASD 或拖曳即可下車。'
      this.view.focus()
    }
    const angleKey = 'strolling-penguin-territory-camera-angle'
    try {
      const value = localStorage.getItem(angleKey)
      if (value !== null) this.cameraAngle.value = value
    } catch { /* Continue without storage. */ }
    const updateAngle = () => {
      const degrees = this.cameraAngle.value + '°'
      element<HTMLOutputElement>('territory-angle-value').value = degrees
      this.cameraAngle.setAttribute('aria-valuetext', degrees)
    }
    updateAngle()
    this.cameraAngle.addEventListener('input', updateAngle)
    this.cameraAngle.addEventListener('change', () => {
      try { localStorage.setItem(angleKey, this.cameraAngle.value) } catch { /* Continue without storage. */ }
    })
    this.roster.addEventListener('close', () => this.portraitObserver.disconnect())
    this.residentsButton.onclick = () => {
      const first = this.residentialBuildings()[0]
      if (first) this.showRoster(first)
    }
    element('build-territory').onclick = () => {
      this.showCatalog()
      this.buildMenu.showModal()
    }
    for (const tab of element('build-categories').querySelectorAll('button')) {
      tab.onclick = () => {
        this.category = tab.textContent as BuildCategory
        this.subcategory = '一般'
        this.showCatalog()
      }
    }
    for (const tab of element('build-subcategories').querySelectorAll('button')) {
      tab.onclick = () => {
        this.subcategory = tab.textContent as BuildSubcategory
        this.showCatalog()
      }
    }
    this.editButton.onclick = () => {
      if (this.editMenu.open) this.editMenu.close()
      if (this.placement) this.placement = undefined
      else this.editing = !this.editing
      this.render()
    }
    element('rotate-placement').onclick = () => {
      this.rotation = turn(this.rotation, this.placementKind)
      this.updateRotation()
      this.selectCell(this.cursor)
    }
    element('move-igloo').onclick = () => {
      this.placement = this.selected
      this.placementItem = undefined
      this.rotation = this.selected?.rotation ?? 0
      this.editMenu.close()
      this.render()
      this.view.focus()
    }
    element('rotate-igloo').onclick = () => {
      if (!this.selected) return
      if (this.state.rotate(this.selected)) this.changed()
      else this.hint.textContent = '旋轉後的格子被佔用，請先移動攤位。'
    }
    element('recycle-igloo').onclick = () => {
      if (!this.selected) return
      this.state.recycle(this.selected, this.returnMember)
      this.selected = undefined
      this.editMenu.close()
      this.changed()
    }
    this.updateCoins()
  }

  open() {
    this.state.enterAtCenter()
    this.world ??= new TerritoryWorld(this.renderer, this.player, WIDTH, HEIGHT)
    this.world.reenter()
    this.world.leaveWheel()
    this.view.prepend(this.renderer.domElement)
    this.editing = false
    this.placement = undefined
    this.render()
  }

  inventoryThumbnail(item: ItemId) {
    this.world ??= new TerritoryWorld(this.renderer, this.player, WIDTH, HEIGHT)
    return this.world.buildingThumbnail(ITEMS[item].building)
  }

  capture() {
    if (!this.page.hidden) return this.world?.capture()
  }

  close() {
    this.keys.clear()
    this.drag = undefined
    if (this.page.hidden && this.editMenu.open) this.editMenu.close()
  }

  useInventoryItem(item: ItemId) {
    if (this.page.hidden || !this.state.itemCount(item)) return false
    this.placementItem = item
    this.placement = ITEMS[item].building
    this.rotation = 0
    this.render()
    return true
  }

  sellInventoryItem(item: ItemId) {
    if (!this.state.sellItem(item)) return false
    this.updateCoins()
    this.save()
    return true
  }

  private enableMovement() {
    const movement = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])
    window.addEventListener('keydown', event => {
      if (this.page.hidden || this.menuOpen() || event.target === this.cameraDistance ||
          event.target === this.cameraAngle || !movement.has(event.code) ||
        event.altKey || event.ctrlKey || event.metaKey) return
      event.preventDefault()
      if (!event.repeat) this.activateAudio()
      if (this.world?.riding) this.stopRide()
      this.keys.add(event.code)
    })
    window.addEventListener('keyup', event => this.keys.delete(event.code))
    window.addEventListener('blur', () => this.close())
    this.view.addEventListener('wheel', event => {
      if (!this.menuOpen()) this.zoom.wheel(event)
    }, {passive: false})
    this.view.addEventListener('pointerdown', event => {
      if (this.drag || event.button !== 0 || this.placement || (event.target as HTMLElement).closest('button')) return
      if (event.pointerType === 'mouse') this.activateAudio()
      this.view.setPointerCapture(event.pointerId)
      this.drag = {id: event.pointerId, startX: event.clientX, startY: event.clientY, x: 0, y: 0}
    })
    this.view.addEventListener('pointermove', event => {
      if (this.placement) {
        this.selectCell(this.pointAt(event.clientX, event.clientY))
        return
      }
      if (!this.drag || event.pointerId !== this.drag.id) return
      this.drag.x = (event.clientX - this.drag.startX) / 40
      this.drag.y = (event.clientY - this.drag.startY) / 40
    })
    this.view.addEventListener('click', event => {
      if (!this.placement || (event.target as HTMLElement).closest('button')) return
      this.selectCell(this.pointAt(event.clientX, event.clientY))
      this.placeSelected()
    })
    this.view.addEventListener('keydown', event => {
      const kind = this.placementKind
      if (event.target !== this.view || event.key !== 'Enter' || !kind) return
      const setback = Math.max(3, BUILDINGS[kind].size + 1)
      this.selectCell(this.cursor ?? {x: Math.floor(this.state.position.x), y: Math.floor(this.state.position.y - setback)})
      this.placeSelected()
    })
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      this.view.addEventListener(type, event => {
        if ((event as PointerEvent).pointerId === this.drag?.id) {
          if (type === 'pointerup') this.activateAudio()
          this.drag = undefined
        }
      })
    }
  }

  private menuOpen() {
    return this.buildMenu.open || this.roster.open || element<HTMLDialogElement>('inventory').open ||
      element<HTMLDialogElement>('instructions').open || element<HTMLDialogElement>('territory-share').open
  }

  private get placementKind(): BuildKind | undefined {
    return typeof this.placement === 'string' ? this.placement : this.placement && buildingKind(this.placement)
  }

  private get moving() {
    return typeof this.placement === 'object' ? this.placement : undefined
  }

  private nearbyWheel() {
    if (this.editing || this.placement || this.menuOpen() || this.world?.riding) return
    let nearest: Building | undefined
    let distance = 2.2
    for (const house of this.state.houses) {
      if (house.kind !== 'christmas-wheel') continue
      const gap = wheelBoardingDistance(house, this.state.position)
      if (gap > distance) continue
      nearest = house
      distance = gap
    }
    return nearest
  }

  private stopRide() {
    this.world?.leaveWheel()
    this.hint.textContent = '已下車。用方向鍵、WASD 或拖曳散步。'
  }

  tick(dt: number) {
    if (this.page.hidden) return
    const {position} = this.state
    const pressed = (a: string, b: string) => Number(this.keys.has(a) || this.keys.has(b))
    let dx = pressed('KeyD', 'ArrowRight') - pressed('KeyA', 'ArrowLeft') + (this.drag?.x ?? 0)
    let dy = pressed('KeyS', 'ArrowDown') - pressed('KeyW', 'ArrowUp') + (this.drag?.y ?? 0)
    const length = Math.max(1, Math.hypot(dx, dy))
    dx /= length
    dy /= length
    if (this.menuOpen()) {
      this.keys.clear()
      this.drag = undefined
      dx = dy = 0
    }
    const x = position.x
    const y = position.y
    const angle = this.cameraAngle.valueAsNumber * Math.PI / 180
    if (Math.hypot(dx, dy) > .065) {
      if (this.world?.riding) this.stopRide()
      const pace = 3.45 * .75 / TERRITORY_TILE
      this.state.walk((dx * Math.cos(angle) + dy * Math.sin(angle)) * dt * pace,
        (dy * Math.cos(angle) - dx * Math.sin(angle)) * dt * pace)
    }
    if (!this.world) return
    this.interact.hidden = !this.nearbyWheel()
    if (this.world.render(this.view, position, position.x - x, position.y - y, dt, this.zoom.scale, angle)) this.stepAudio()
    for (const [house, spot] of this.spots) {
      const point = this.world.project(house)
      spot.hidden = !point.visible
      spot.style.left = point.x + 'px'
      spot.style.top = point.y + 'px'
      spot.style.width = point.size + 'px'
      spot.style.height = point.size * .78 + 'px'
    }
  }

  addCoins(amount: number, save = true) {
    this.state.coins += amount
    this.updateCoins()
    if (save) this.save()
  }

  settleStallIncome() {
    if (!this.state.settleStallIncome()) return
    this.updateCoins()
    this.save()
  }

  private updateCoins() {
    const income = this.state.houses.filter(house => isStall(house.kind)).length
    for (const scene of ['snow', 'territory']) {
      element(scene + '-coins').textContent = String(this.state.coins)
      element(scene + '-income').textContent = `每小時 +${income} 金幣`
    }
  }

  private showCatalog() {
    const items = element('build-items')
    items.replaceChildren()
    for (const tab of element('build-categories').querySelectorAll('button')) {
      tab.setAttribute('aria-pressed', String(tab.textContent === this.category))
    }
    for (const tab of element('build-subcategories').querySelectorAll('button')) {
      const subcategory = tab.textContent as BuildSubcategory
      tab.hidden = !BUILD_SUBCATEGORIES[this.category].includes(subcategory)
      tab.setAttribute('aria-pressed', String(subcategory === this.subcategory))
    }
    for (const kind of Object.keys(BUILDINGS) as BuildKind[]) {
      const info = BUILDINGS[kind]
      if (isInventoryBuilding(kind) || info.category !== this.category || buildingSubcategory(kind) !== this.subcategory) continue
      const card = document.createElement('button')
      card.className = 'build-card'
      const image = document.createElement('img')
      image.className = 'build-thumbnail'
      image.alt = ''
      image.width = image.height = 208
      const thumbnail = this.world?.buildingThumbnail(kind)
      if (thumbnail) image.src = thumbnail
      const label = document.createElement('span')
      label.textContent = info.name
      const detail = document.createElement('small')
      const {width, depth} = buildingFootprint(kind)
      const footprint = `${width} × ${depth} 格`
      detail.textContent = info.capacity ? `${footprint} · 可住 ${info.capacity} 位`
        : info.size ? `${footprint} · ${kind === 'school' ? '自動呼喚掉隊夥伴' : kind === 'fishing' ? '可釣魚' : kind === 'filter' ? '可接水喝' : '每小時 +1 金幣'}`
        : kind === 'christmas-tree' ? '可休息、看燈 · 自由放置'
        : kind === 'snow-machine' ? '小企鵝可玩雪 · 自由放置'
        : kind === 'snow-lamp' || kind === 'tall-lamp' ? '夜間照明 · 自由放置' : '可觀看 · 自由放置'
      label.append(detail)
      const price = document.createElement('strong')
      const coin = document.createElement('span')
      coin.className = 'penguin-coin'
      coin.setAttribute('aria-hidden', 'true')
      const owned = this.state.ownsStall(kind)
      if (owned) price.textContent = '已擁有'
      else price.append(coin, info.cost + ' 金幣')
      card.append(image, label, price)
      card.disabled = owned || this.state.coins < info.cost
      card.onclick = () => {
        this.buildMenu.close()
        this.placement = kind
        this.placementItem = undefined
        this.rotation = 0
        this.render()
        this.view.focus()
      }
      items.append(card)
    }
  }

  private changed() {
    this.render()
    this.save()
  }

  private selectCell(cell?: Cell) {
    this.cursor = cell
    const kind = this.placementKind
    if (kind) this.world?.select(kind, cell, !!cell && this.state.canPlace(cell, kind, this.moving, this.rotation), this.rotation)
  }

  private pointAt(x: number, y: number) {
    const kind = this.placementKind
    return kind && this.world?.cellAt(x, y, this.view.getBoundingClientRect(), BUILDINGS[kind].size > 0)
  }

  private placeSelected() {
    const kind = this.placementKind
    if (!this.cursor || !kind) return
    if (!this.state.place(this.cursor, kind, this.moving, this.rotation, this.placementItem)) return
    this.placement = undefined
    this.placementItem = undefined
    this.changed()
  }

  private updateRotation() {
    const placement = element('rotate-placement')
    placement.hidden = this.placement === undefined
    placement.textContent = `旋轉 ${rotatesOnGrid(this.placementKind) ? 90 : 45}° · ${this.rotation * 45}°`
    element('rotate-igloo').textContent = `旋轉 ${rotatesOnGrid(this.selected?.kind) ? 90 : 45}° · ${(this.selected?.rotation ?? 0) * 45}°`
    if (this.selected) {
      const info = buildingInfo(this.selected)
      this.editMenu.querySelector('h2')!.textContent = '編輯' + info.name
      element('move-igloo').textContent = '移動' + info.name
      element('recycle-igloo').textContent = this.selected.inventoryItem ? '回收 · 返還背包' : `回收 · 還 ${info.cost} 金幣`
    }
  }

  private render() {
    const placing = this.placement !== undefined
    this.residentsButton.disabled = placing || this.editing || !this.residentialBuildings().length
    const kind = this.placementKind
    if (placing || this.editing) this.world?.leaveWheel()
    const info = kind && BUILDINGS[kind]
    const footprint = kind && buildingFootprint(kind, this.rotation)
    this.board.replaceChildren()
    this.spots.clear()
    this.cursor = undefined
    this.world?.showGrid(info ? info.size > 0 : this.editing)
    this.world?.syncHouses(this.state.houses, this.moving?.id)
    this.updateRotation()
    this.editButton.textContent = placing ? '取消放置' : this.editing ? '完成編輯' : '編輯領地'
    this.editButton.setAttribute('aria-pressed', String(this.editing))
    this.hint.textContent = info ? footprint && footprint.width ? `選擇${info.name}左上角，需要 ${footprint.width} × ${footprint.depth} 格。` : `選擇${info.name}的位置，可與建物重疊。`
      : this.editing ? '點建物或裝飾可移動、旋轉或回收。'
      : this.state.houses.length ? '用方向鍵、WASD 或拖曳散步。點兩下雪屋管理住戶。' : '可在領地散步，或點右下角「建設」放置雪屋。'
    if (this.visiting) this.hint.textContent = '正在參觀分享的領地，可自由散步、旋轉鏡頭及縮放。'
    for (const house of this.state.houses) {
      if (this.visiting) break
      if (placing) break
      const node = document.createElement('button')
      const info = buildingInfo(house)
      if (!info.capacity && !this.editing) continue
      node.className = 'plot-igloo'
      node.classList.toggle('plot-decoration', !info.size)
      const location = info.size ? `，第 ${house.y + 1} 列第 ${house.x + 1} 格` : ''
      const occupancy = info.capacity ? `，${house.residents.length} 位住戶` : ''
      node.setAttribute('aria-label', info.name + location + occupancy)
      node.onclick = e => {
        this.selected = house
        if (this.editing) {
          this.updateRotation()
          if (!this.editMenu.open) this.editMenu.show()
        }
        else if (e.detail === 0) this.showRoster(house)
      }
      node.ondblclick = () => { if (!this.editing && !placing) this.showRoster(house) }
      this.board.append(node)
      this.spots.set(house, node)
    }
    this.updateCoins()
  }

  private residentialBuildings() {
    return this.state.houses.filter(house => buildingInfo(house).capacity > 0).sort((a, b) => a.id - b.id)
  }

  private showRoster(house: Building) {
    const info = buildingInfo(house)
    const homes = this.residentialBuildings()
    const index = homes.indexOf(house)
    const next = element<HTMLButtonElement>('next-igloo')
    next.disabled = homes.length < 2
    next.onclick = () => this.showRoster(homes[(index + 1) % homes.length])
    element('igloo-roster-title').textContent = info.name
    element('igloo-house-number').textContent = `第 ${index + 1} / ${homes.length} 間`
    element('igloo-hint').textContent = '領隊會留在隊伍中。'
    const render = () => {
      const residents = element('igloo-residents')
      const team = element('igloo-team')
      this.portraitObserver.disconnect()
      residents.replaceChildren()
      team.replaceChildren()
      const members = this.team()
      element('igloo-capacity').textContent = `${house.residents.length} / ${info.capacity}`
      element('igloo-team-count').textContent = String(members.length)
      const row = (list: HTMLElement, saved: PenguinSave, leader: boolean, label: string, action: string, callback: () => void) => {
        const item = document.createElement('li')
        const button = document.createElement('button')
        const name = document.createElement('span')
        const image = document.createElement('img')
        image.className = 'roster-portrait'
        image.alt = ''
        this.portraits.set(image, {saved, leader})
        name.textContent = label
        button.textContent = action
        button.onclick = callback
        item.append(image, name, button)
        list.append(item)
        this.portraitObserver.observe(image)
        return button
      }
      if (!house.residents.length) {
        const empty = document.createElement('li')
        empty.className = 'roster-empty'
        empty.textContent = '目前沒有住戶'
        residents.append(empty)
      }
      house.residents.forEach((resident, i) => row(residents, resident, false, `${speciesNames[resident.species ?? 'penguin']} ${i + 1}`, '加入隊伍', () => {
        this.returnMember(resident)
        house.residents.splice(i, 1)
        this.changed()
        render()
      }))
      members.forEach((member, i) => {
        const button = row(team, member.snapshot(), i === 0, i === 0 ? '玩家企鵝' : `${speciesNames[member.species]} · 第 ${i + 1} 位`, '入住雪屋', () => {
          if (house.residents.length >= info.capacity) return
          const stored = this.storeMember(member)
          if (!stored) return
          house.residents.push(stored)
          this.changed()
          render()
        })
        button.disabled = i === 0 || house.residents.length >= info.capacity
      })
    }
    render()
    if (!this.roster.open) this.roster.showModal()
  }
}
