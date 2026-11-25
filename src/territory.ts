import type { Penguin, PenguinSave } from './penguin'
import type { WebGLRenderer } from 'three'
import { TerritoryWorld, TERRITORY_TILE } from './territory-world'
import { bindCameraZoom } from './camera-zoom'
import { BUILDINGS, buildingInfo, buildingKind, propBlocks, type Building, type BuildKind, type Cell } from './buildings'

export const TERRITORY_WIDTH = 30
export const TERRITORY_HEIGHT = 24
const WIDTH = TERRITORY_WIDTH
const HEIGHT = TERRITORY_HEIGHT
export type TerritorySave = {coins: number, houses: Building[], position?: Cell, pondGrid?: true}
const speciesNames = {penguin: '企鵝', seal: '海豹', mammoth: '長毛象', 'saber-tooth': '劍齒虎'}
const clampWalk = (value: number, maximum: number) => Math.max(.39, Math.min(maximum - .39, value))
const turn = (rotation = 0) => (rotation + 1) % 8

export class TerritoryState {
  readonly pondGrid = true
  coins: number
  houses: Building[]
  position: Cell

  get residentCount() {
    return this.houses.reduce((total, house) => total + house.residents.length, 0)
  }

  constructor(saved?: TerritorySave) {
    this.coins = Number.isSafeInteger(saved?.coins) ? Math.max(0, saved!.coins) : 0
    this.houses = Array.isArray(saved?.houses) ? saved.houses : []
    const savedPosition = saved?.position
    const house = this.houses[0]
    this.position = savedPosition && Number.isFinite(savedPosition.x) && Number.isFinite(savedPosition.y)
      ? {x: clampWalk(savedPosition.x, WIDTH), y: clampWalk(savedPosition.y, HEIGHT)}
      : house ? {x: house.x + 1, y: clampWalk(house.y + 2.7, HEIGHT)} : {x: WIDTH / 2, y: HEIGHT / 2}
    if (!saved?.pondGrid) this.migratePonds()
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
    return !this.houses.some(h => {
      const {size, capacity} = buildingInfo(h)
      return capacity ? this.touchesPlayer(h, size, x, y) : propBlocks(h, x, y, from?.x, from?.y)
    })
  }

  private touchesPlayer(cell: Cell, size: number, x: number, y: number) {
    return x > cell.x - .24 && x < cell.x + size + .24 && y > cell.y - .20 && y < cell.y + size + .25
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

  fits({x, y}: Cell, kind: BuildKind, moving?: Building) {
    const {size, radius} = BUILDINGS[kind]
    if (!size) return x >= radius && x <= WIDTH - radius && y >= radius && y <= HEIGHT - radius
    return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && x <= WIDTH - size && y >= 0 && y <= HEIGHT - size
      && !this.houses.some(h => {
        const other = buildingInfo(h).size
        return h !== moving && other > 0 && x < h.x + other && x + size > h.x && y < h.y + other && y + size > h.y
      })
  }

  place(cell: Cell, kind: BuildKind, moving?: Building, rotation = moving?.rotation ?? 0) {
    if (!this.canPlace(cell, kind, moving)) return false
    if (moving) {
      Object.assign(moving, cell, {rotation})
    } else {
      const cost = BUILDINGS[kind].cost
      if (this.coins < cost) return false
      const id = 1 + this.houses.reduce((max, house) => Math.max(max, house.id), 0)
      this.houses.push({...cell, id, kind, rotation, residents: []})
      this.coins -= cost
    }
    return true
  }

  rotate(house: Building) {
    house.rotation = turn(house.rotation)
  }

  canPlace(cell: Cell, kind: BuildKind, moving?: Building) {
    const {x, y} = this.position
    const {size} = BUILDINGS[kind]
    return this.fits(cell, kind, moving) && (!size || !this.touchesPlayer(cell, size, x, y))
  }

  recycle(house: Building, returnMember: (saved: PenguinSave) => void) {
    this.houses = this.houses.filter(h => h !== house)
    for (const member of house.residents) returnMember(member)
    this.coins += buildingInfo(house).cost
  }
}

const element = <E extends HTMLElement>(id: string) => document.getElementById(id) as E

export class Territory {
  private board = element('plot')
  private page = element('territory')
  private view = element('territory-view')
  private cameraDistance = element<HTMLInputElement>('territory-camera-distance')
  private zoom = bindCameraZoom(this.cameraDistance, element<HTMLOutputElement>('territory-camera-percent'),
    'strolling-penguin-territory-camera')
  private world?: TerritoryWorld
  private spots = new Map<Building, HTMLButtonElement>()
  private cursor?: Cell
  private keys = new Set<string>()
  private drag?: {id: number, startX: number, startY: number, x: number, y: number}
  private hint = element('territory-hint')
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
  private editing = false
  private placement?: BuildKind | Building
  private category = '住宅'
  private rotation = 0
  private selected?: Building

  constructor(readonly state: TerritoryState, private team: () => Penguin[],
    private storeMember: (member: Penguin) => PenguinSave | undefined,
    private returnMember: (saved: PenguinSave) => void, private save: () => void,
    private renderer: WebGLRenderer, private player: Penguin,
    private activateAudio: () => void, private stepAudio: () => void) {
    this.enableMovement()
    this.roster.addEventListener('close', () => this.portraitObserver.disconnect())
    element('build-territory').onclick = () => {
      this.showCatalog()
      this.buildMenu.showModal()
    }
    for (const tab of element('build-categories').querySelectorAll('button')) {
      tab.onclick = () => {
        this.category = tab.textContent ?? '住宅'
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
      this.rotation = turn(this.rotation)
      this.updateRotation()
      this.selectCell(this.cursor)
    }
    element('move-igloo').onclick = () => {
      this.placement = this.selected
      this.rotation = this.selected?.rotation ?? 0
      this.editMenu.close()
      this.render()
      this.view.focus()
    }
    element('rotate-igloo').onclick = () => {
      if (!this.selected) return
      this.state.rotate(this.selected)
      this.changed()
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
    this.view.prepend(this.renderer.domElement)
    this.editing = false
    this.placement = undefined
    this.render()
  }

  close() {
    this.keys.clear()
    this.drag = undefined
    if (this.page.hidden && this.editMenu.open) this.editMenu.close()
  }

  private enableMovement() {
    const movement = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])
    window.addEventListener('keydown', event => {
      if (this.page.hidden || this.menuOpen() || event.target === this.cameraDistance || !movement.has(event.code) ||
        event.altKey || event.ctrlKey || event.metaKey) return
      event.preventDefault()
      if (!event.repeat) this.activateAudio()
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
    return this.buildMenu.open || this.roster.open
  }

  private get placementKind(): BuildKind | undefined {
    return typeof this.placement === 'string' ? this.placement : this.placement && buildingKind(this.placement)
  }

  private get moving() {
    return typeof this.placement === 'object' ? this.placement : undefined
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
    if (Math.hypot(dx, dy) > .065) {
      const pace = 3.45 * .75 / TERRITORY_TILE
      this.state.walk(dx * dt * pace, dy * dt * pace)
    }
    if (!this.world) return
    if (this.world.render(this.view, position, position.x - x, position.y - y, dt, this.zoom.scale)) this.stepAudio()
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

  private updateCoins() {
    for (const id of ['snow-coins', 'territory-coins']) element(id).textContent = String(this.state.coins)
  }

  private showCatalog() {
    const items = element('build-items')
    items.replaceChildren()
    for (const tab of element('build-categories').querySelectorAll('button')) {
      tab.setAttribute('aria-pressed', String(tab.textContent === this.category))
    }
    for (const kind of Object.keys(BUILDINGS) as BuildKind[]) {
      const info = BUILDINGS[kind]
      if (info.category !== this.category) continue
      const card = document.createElement('button')
      card.className = 'build-card'
      if (info.capacity) {
        const icon = document.createElement('span')
        icon.className = 'igloo-icon'
        icon.setAttribute('aria-hidden', 'true')
        card.append(icon)
      }
      const label = document.createElement('span')
      label.textContent = info.name
      const detail = document.createElement('small')
      const footprint = `${info.size} × ${info.size} 格`
      detail.textContent = info.capacity ? `${footprint} · 可住 ${info.capacity} 位`
        : info.size ? `${footprint} · ${kind === 'fishing' ? '可釣魚' : '可接水喝'}` : '可觀看 · 自由放置'
      label.append(detail)
      const price = document.createElement('strong')
      price.textContent = info.cost + ' 金幣'
      card.append(label, price)
      card.disabled = this.state.coins < info.cost
      card.onclick = () => {
        this.buildMenu.close()
        this.placement = kind
        this.rotation = 0
        this.render()
        this.view.focus()
      }
      items.append(card)
    }
    if (!items.children.length) items.textContent = '目前沒有功能建築。'
  }

  private changed() {
    this.render()
    this.save()
  }

  private selectCell(cell?: Cell) {
    this.cursor = cell
    const kind = this.placementKind
    if (kind) this.world?.select(kind, cell, !!cell && this.state.canPlace(cell, kind, this.moving), this.rotation)
  }

  private pointAt(x: number, y: number) {
    const kind = this.placementKind
    return kind && this.world?.cellAt(x, y, this.view.getBoundingClientRect(), BUILDINGS[kind].size > 0)
  }

  private placeSelected() {
    const kind = this.placementKind
    if (!this.cursor || !kind) return
    if (!this.state.place(this.cursor, kind, this.moving, this.rotation)) return
    this.placement = undefined
    this.changed()
  }

  private updateRotation() {
    const placement = element('rotate-placement')
    placement.hidden = this.placement === undefined
    placement.textContent = `旋轉 45° · ${this.rotation * 45}°`
    element('rotate-igloo').textContent = `旋轉 45° · ${(this.selected?.rotation ?? 0) * 45}°`
    if (this.selected) {
      const info = buildingInfo(this.selected)
      this.editMenu.querySelector('h2')!.textContent = '編輯' + info.name
      element('move-igloo').textContent = '移動' + info.name
      element('recycle-igloo').textContent = `回收 · 還 ${info.cost} 金幣`
    }
  }

  private render() {
    const placing = this.placement !== undefined
    const kind = this.placementKind
    const info = kind && BUILDINGS[kind]
    this.board.replaceChildren()
    this.spots.clear()
    this.cursor = undefined
    this.world?.showGrid(info ? info.size > 0 : this.editing)
    this.world?.syncHouses(this.state.houses, this.moving?.id)
    this.updateRotation()
    this.editButton.textContent = placing ? '取消放置' : this.editing ? '完成編輯' : '編輯領地'
    this.editButton.setAttribute('aria-pressed', String(this.editing))
    this.hint.textContent = info ? info.size ? `選擇${info.name}左上角，需要 ${info.size} × ${info.size} 格。` : `選擇${info.name}的位置，可與建物重疊。`
      : this.editing ? '點建物或裝飾可移動、旋轉或回收。'
      : this.state.houses.length ? '用方向鍵、WASD 或拖曳散步。點兩下雪屋管理住戶。' : '可在領地散步，或點右下角「建設」放置雪屋。'
    for (const house of this.state.houses) {
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

  private showRoster(house: Building) {
    const info = buildingInfo(house)
    this.roster.querySelector('h2')!.textContent = info.name
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
