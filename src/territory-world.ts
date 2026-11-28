import * as T from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { Penguin, type PenguinSave } from './penguin'
import { createAnimal } from './animals'
import { Footprints, Snowfield, SnowParticles } from './snow'
import { Residents } from './residents'
import { BUILDINGS, buildingCenter, buildingFootprint, buildingInfo, buildingKind, TERRITORY_TILE, WHEEL_SEATS, wheelCabinPosition, type BuildKind, type Building } from './buildings'
import { animateDecoration, decorationModel, lightPathLamp } from './decorations'

export { TERRITORY_TILE } from './buildings'
const WALK = 3.45 * .75
const ice = new T.MeshStandardMaterial({vertexColors: true, color: 0xe2faff, roughness: .44})
const mortar = new T.MeshStandardMaterial({color: 0x82abc3, roughness: .85})
const frost = new T.MeshStandardMaterial({color: 0xf0faff, roughness: .82})
const doorway = new T.MeshStandardMaterial({color: 0x29495c, roughness: .9})
const portalIce = new T.MeshStandardMaterial({color: 0xb1dbeb, roughness: .46})
const crystalIce = new T.MeshStandardMaterial({color: 0x8ed5ed, roughness: .31, flatShading: true})
const crystalTip = new T.MeshStandardMaterial({color: 0xd2f4fa, roughness: .38, flatShading: true})
const dome = new T.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2)
const entrance = new T.SphereGeometry(1, 20, 12)
const snowCap = new T.SphereGeometry(1, 32, 12, 0, Math.PI * 2, 0, .51)
const shard = new T.CylinderGeometry(.08, .25, 1, 5, 1).translate(0, .5, 0)
const archBlock = new T.BoxGeometry(.29, .32, .35)
const territoryClock = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Taipei', hour: '2-digit', hourCycle: 'h23',
})
const daylight = {
  sky: new T.Color(0xd9e8f6), ambient: new T.Color(0xf6f7ff), ground: new T.Color(0xa2bbce),
  sun: new T.Color(0xffe4ce), grid: new T.Color(0x5988a6),
}
const moonlight = {
  sky: new T.Color(0x172943), ambient: new T.Color(0x9ebfff), ground: new T.Color(0x4b6898),
  sun: new T.Color(0xb7d9ff), grid: new T.Color(0xc0e3ff),
}

function isTerritoryNight(now: number) {
  const hour = Number(territoryClock.format(now))
  return hour >= 18 || hour < 6
}

const previewNight = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) &&
  new URLSearchParams(location.search).get('lighting') === 'night'

function iceCourses() {
  const parts: T.BufferGeometry[] = []
  const colors = [0xd6eef7, 0xaccfe1, 0xbfe3ee, 0xe0f4f9, 0xa1cbdf].map(color => new T.Color(color))
  const edges = [.42, .64, .87, 1.10, 1.33, Math.PI / 2]
  const counts = [10, 14, 17, 19, 21]
  for (let course = 0; course < counts.length; course++) {
    const count = counts[course]
    const section = Math.PI * 2 / count
    for (let i = 0; i < count; i++) {
      const panel = new T.SphereGeometry(1, 4, 3, (i + (course % 2) * .5) * section + .014,
        section - .027, edges[course] + .010, edges[course + 1] - edges[course] - .022)
      const relief = (i * 13 + course * 17) % 7 * .004
      panel.scale(2.49 + relief, 2.13 + relief, 2.23 + relief)
      const color = colors[(i * 7 + course * 3) % colors.length]
      const tint = new Float32Array(panel.attributes.position.count * 3)
      for (let j = 0; j < tint.length; j += 3) {
        tint[j] = color.r
        tint[j + 1] = color.g
        tint[j + 2] = color.b
      }
      panel.setAttribute('color', new T.BufferAttribute(tint, 3))
      parts.push(panel)
    }
  }
  const geometry = mergeGeometries(parts)!
  parts.forEach(part => part.dispose())
  return geometry
}

const brickwork = iceCourses()

type PlotCell = {x: number, y: number}

export class TerritoryWorld {
  private scene = new T.Scene()
  private sky = new T.Color()
  private fog = new T.FogExp2(0xd9e8f6, .020)
  private ambient = new T.HemisphereLight()
  private sun = new T.DirectionalLight()
  private lampLights = Array.from({length: 6}, () => new T.PointLight(0xffca83, 0, 8))
  private night = 0
  private nightTarget = 0
  private clockSecond = -1
  private snow = new Snowfield(this.scene, true)
  private prints = new Footprints(this.scene, this.snow)
  private flakes = new SnowParticles(this.scene)
  private camera = new T.PerspectiveCamera(45, 1, .1, 180)
  private avatar: Penguin
  private residents: Residents
  private houses = new Map<number, T.Group>()
  private grid: T.LineSegments
  private preview: T.LineLoop<T.BufferGeometry, T.LineBasicMaterial>
  private ghost?: T.Group
  private ghostKind?: BuildKind
  private bounds: T.LineLoop
  private target = new T.Vector2()
  private focus = new T.Vector3()
  private ray = new T.Raycaster()
  private plane = new T.Plane(new T.Vector3(0, 1, 0))
  private point = new T.Vector3()
  private cursor = new T.Vector2()
  private time = 0
  private w = 0
  private h = 0
  private portraits = new Map<string, string>()
  private buildingThumbnails = new Map<BuildKind, string>()
  private portraitScene?: T.Scene
  private portraitTarget?: T.WebGLRenderTarget

  constructor(private renderer: T.WebGLRenderer, player: Penguin, private width: number, private height: number) {
    this.scene.background = this.sky
    this.scene.fog = this.fog
    this.sun.position.set(-7, 9, 4)
    this.scene.add(this.ambient, this.sun)
    for (const light of this.lampLights) {
      light.visible = false
      this.scene.add(light)
    }
    this.avatar = new Penguin(this.scene, 0, 0, 'leader', true, player.snapshot().seed)
    this.residents = new Residents(this.scene, TERRITORY_TILE, width, height)
    this.avatar.angle = player.angle
    this.grid = new T.LineSegments(new T.BufferGeometry(), new T.LineBasicMaterial({
      color: 0x5988a6, transparent: true, opacity: .36, depthWrite: false,
    }))
    this.bounds = new T.LineLoop(new T.BufferGeometry(), new T.LineBasicMaterial({
      color: 0x9abfda, transparent: true, opacity: .78, depthWrite: false,
    }))
    this.preview = new T.LineLoop(new T.BufferGeometry(), new T.LineBasicMaterial({color: 0x2a817d, depthWrite: false}))
    this.scene.add(this.grid, this.bounds, this.preview)
    this.grid.visible = this.preview.visible = false
    this.makeGrid()
    this.updateLighting(0, true)
  }

  private updateLighting(dt: number, immediate = false) {
    const now = Date.now()
    const second = Math.floor(now / 1000)
    if (second !== this.clockSecond || immediate) {
      this.clockSecond = second
      this.nightTarget = Number(previewNight || isTerritoryNight(now))
    }
    const blend = immediate ? this.nightTarget : this.night + T.MathUtils.clamp(this.nightTarget - this.night, -dt / 3, dt / 3)
    if (!immediate && blend === this.night) return
    this.night = blend
    this.sky.copy(daylight.sky).lerp(moonlight.sky, blend)
    this.fog.color.copy(this.sky)
    this.ambient.color.copy(daylight.ambient).lerp(moonlight.ambient, blend)
    this.ambient.groundColor.copy(daylight.ground).lerp(moonlight.ground, blend)
    this.ambient.intensity = T.MathUtils.lerp(2.12, 1.05, blend)
    this.sun.color.copy(daylight.sun).lerp(moonlight.sun, blend)
    this.sun.intensity = T.MathUtils.lerp(1.42, .57, blend)
    const grid = this.grid.material as T.LineBasicMaterial
    grid.color.copy(daylight.grid).lerp(moonlight.grid, blend)
  }

  private makeGrid() {
    const points: T.Vector3[] = []
    const endX = this.width * TERRITORY_TILE
    const endZ = this.height * TERRITORY_TILE
    const vertex = (x: number, z: number) => new T.Vector3(x, this.snow.height(x, z) + .05, z)
    for (let x = 0; x <= endX + .001; x += TERRITORY_TILE) {
      for (let z = 0; z < endZ - .001; z += TERRITORY_TILE / 3) points.push(vertex(x, z), vertex(x, Math.min(endZ, z + TERRITORY_TILE / 3)))
    }
    for (let z = 0; z <= endZ + .001; z += TERRITORY_TILE) {
      for (let x = 0; x < endX - .001; x += TERRITORY_TILE / 3) points.push(vertex(x, z), vertex(Math.min(endX, x + TERRITORY_TILE / 3), z))
    }
    this.grid.geometry.setFromPoints(points)
    this.bounds.geometry.setFromPoints(this.rectangle(0, 0, this.width, this.height))
  }

  private updatePathLamps(x: number, z: number) {
    const nearby = []
    for (const model of this.houses.values()) {
      const lamp = lightPathLamp(model, this.night)
      if (!lamp || this.night === 0) continue
      const delta = (model.position.x - x) ** 2 + (model.position.z - z) ** 2
      nearby.push({model, lamp, delta})
    }
    nearby.sort((a, b) => a.delta - b.delta)
    for (const [index, light] of this.lampLights.entries()) {
      const source = nearby[index]
      light.visible = !!source
      if (!source) continue
      light.position.copy(source.model.position)
      light.position.y += source.lamp.height
      light.distance = source.lamp.range
      light.intensity = source.lamp.intensity * this.night
    }
  }

  private rectangle(x: number, z: number, width: number, height: number) {
    const points: T.Vector3[] = []
    const add = (gx: number, gz: number) => {
      const wx = gx * TERRITORY_TILE
      const wz = gz * TERRITORY_TILE
      points.push(new T.Vector3(wx, this.snow.height(wx, wz) + .08, wz))
    }
    for (let i = 0; i < width * 3; i++) add(x + i / 3, z)
    for (let i = 0; i < height * 3; i++) add(x + width, z + i / 3)
    for (let i = 0; i < width * 3; i++) add(x + width - i / 3, z + height)
    for (let i = 0; i < height * 3; i++) add(x, z + height - i / 3)
    return points
  }

  showGrid(show: boolean) {
    this.grid.visible = show
    this.preview.visible = false
    if (this.ghost) this.ghost.visible = false
  }

  select(kind: BuildKind, cell?: PlotCell, valid = false, rotation = 0) {
    this.preview.visible = !!cell
    if (this.ghost) this.ghost.visible = !!cell && valid
    if (!cell) return
    const {width, depth} = buildingFootprint(kind, rotation)
    const {radius} = BUILDINGS[kind]
    const outline = width ? this.rectangle(cell.x, cell.y, width, depth)
      : this.rectangle(cell.x - radius, cell.y - radius, radius * 2, radius * 2)
    if (this.preview.geometry.getAttribute('position')?.count !== outline.length) {
      this.preview.geometry.dispose()
      this.preview.geometry = new T.BufferGeometry()
    }
    this.preview.geometry.setFromPoints(outline)
    this.preview.geometry.computeBoundingSphere()
    this.preview.material.color.set(valid ? 0x238b87 : 0xa74834)
    if (!valid) return
    if (!this.ghost || this.ghostKind !== kind) {
      if (this.ghost) {
        this.scene.remove(this.ghost)
        this.ghost.traverse(object => {
          if (object instanceof T.InstancedMesh) object.dispose()
          if (object instanceof T.Mesh) object.material.dispose()
        })
      }
      this.ghost = this.makeModel(kind)
      this.ghostKind = kind
      this.ghost.traverse(object => {
        if (!(object instanceof T.Mesh)) return
        object.material = object.material.clone()
        object.material.transparent = true
        object.material.opacity = .44
        object.material.depthWrite = false
      })
      this.scene.add(this.ghost)
    }
    this.placeModel(this.ghost, cell, kind, rotation)
  }

  syncHouses(items: Building[], moving?: number) {
    this.residents.sync(moving === undefined ? items : items.filter(item => item.id !== moving), this.time)
    for (const [id, model] of this.houses) {
      if (items.some(house => house.id === id && id !== moving)) continue
      this.scene.remove(model)
      model.traverse(object => { if (object instanceof T.InstancedMesh) object.dispose() })
      this.houses.delete(id)
    }
    for (const house of items) {
      if (house.id === moving) continue
      let model = this.houses.get(house.id)
      if (!model) {
        model = this.makeModel(buildingKind(house))
        this.houses.set(house.id, model)
        this.scene.add(model)
      }
      this.placeModel(model, house, buildingKind(house), house.rotation ?? 0)
    }
  }

  private placeModel(model: T.Group, cell: PlotCell, kind: BuildKind, rotation: number) {
    const {width, depth} = buildingFootprint(kind, rotation)
    const x = (cell.x + width / 2) * TERRITORY_TILE
    const z = (cell.y + depth / 2) * TERRITORY_TILE
    model.position.set(x, this.snow.height(x, z) - (BUILDINGS[kind].capacity ? .13 : 0), z)
    model.rotation.y = rotation * Math.PI / 4
  }

  private makeModel(kind: BuildKind) {
    if (!BUILDINGS[kind].capacity) return decorationModel(kind)
    const igloo = this.makeIgloo()
    if (kind === 'medium-igloo') igloo.scale.setScalar(1.47)
    return igloo
  }

  private makeIgloo() {
    const model = new T.Group()
    const base = new T.Mesh(dome, mortar)
    base.scale.set(2.43, 2.07, 2.18)
    const cap = new T.Mesh(snowCap, frost)
    cap.scale.set(2.51, 2.15, 2.25)
    cap.rotation.set(.027, 0, -.026)
    model.add(base, new T.Mesh(brickwork, ice), cap)
    const tunnel = new T.Mesh(entrance, portalIce)
    const hole = new T.Mesh(entrance, doorway)
    tunnel.scale.set(.89, .97, 1.02)
    tunnel.position.set(0, .33, 1.78)
    hole.scale.set(.54, .70, .087)
    hole.position.set(0, .34, 2.81)
    model.add(tunnel, hole)
    for (let i = 0; i <= 7; i++) {
      const angle = i * Math.PI / 7
      const stone = new T.Mesh(archBlock, i % 3 === 0 ? frost : portalIce)
      stone.position.set(Math.cos(angle) * .68, .30 + Math.sin(angle) * .78, 2.75)
      stone.rotation.z = angle
      model.add(stone)
    }
    for (const side of [-1, 1]) {
      const drift = new T.Mesh(entrance, frost)
      drift.position.set(side * 1.59, .045, 1.57)
      drift.scale.set(.92, .18, .61)
      model.add(drift)
      for (let i = 0; i < 3; i++) {
        const gem = new T.Mesh(shard, i === 0 ? crystalIce : crystalTip)
        gem.position.set(side * (1.44 + i * .29), .08, 2.02 - i * .17)
        gem.scale.set(.77 - i * .14, (side === 1 ? .68 : .79) - i * .15, .77 - i * .14)
        gem.rotation.set(.12 * (i - 1), .7 + i, side * (.31 - i * .22))
        model.add(gem)
      }
    }
    return model
  }

  get riding() { return !!this.residents.playerRide }

  boardWheel(building: Building) {
    if (!this.houses.has(building.id)) return false
    let seat = -1
    let height = Infinity
    for (let i = 0; i < WHEEL_SEATS; i++) {
      const position = wheelCabinPosition(this.time, i)
      if (position.y >= height || this.residents.wheelSeatInUse(building, i)) continue
      seat = i
      height = position.y
    }
    if (seat < 0) return false
    this.residents.playerRide = {building, seat}
    return true
  }

  leaveWheel() {
    if (!this.riding) return
    this.residents.playerRide = undefined
    this.avatar.root.scale.setScalar(1)
  }

  capture() {
    const source = this.renderer.domElement
    if (!source.width || !source.height) return
    const photo = document.createElement('canvas')
    photo.width = source.width
    photo.height = source.height
    this.renderer.render(this.scene, this.camera)
    photo.getContext('2d')?.drawImage(source, 0, 0)
    return photo
  }

  render(view: HTMLElement, position: PlotCell, dx: number, dy: number, dt: number, zoom: number, angle: number) {
    const w = view.clientWidth, h = view.clientHeight
    if (w < 1 || h < 1) return false
    if (w !== this.w || h !== this.h) {
      this.w = w
      this.h = h
      this.renderer.setSize(w, h, false)
      this.camera.aspect = w / h
      this.camera.fov = w / h < .85 ? 55 : 45
      this.camera.updateProjectionMatrix()
    }
    this.time += dt
    this.updateLighting(dt)
    const x = position.x * TERRITORY_TILE
    const z = position.y * TERRITORY_TILE
    this.avatar.speed = 0
    this.target.set(x, z)
    if (dx || dy) {
      this.avatar.faceToward(this.target.set(x + dx, z + dy), dt)
      this.avatar.speed = Math.min(WALK, Math.hypot(dx, dy) * TERRITORY_TILE / Math.max(dt, .001))
    }
    this.avatar.position.set(x, z)
    const ground = this.snow.height(x, z)
    this.snow.update(x, z)
    this.focus.set(x, ground + .26, z - 2.4)
    const stepped = this.avatar.animate(dt, this.time, this.snow, this.prints, this.flakes)
    const ride = this.residents.playerRide
    if (ride) {
      const model = this.houses.get(ride.building.id)
      if (!model) this.leaveWheel()
      else {
        const cabin = wheelCabinPosition(this.time, ride.seat)
        const heading = model.rotation.y
        this.point.set(cabin.x, cabin.y - .39, .23).applyAxisAngle(T.Object3D.DEFAULT_UP, heading).add(model.position)
        this.avatar.showInCabin(this.point.x, this.point.y, this.point.z, angle)
        this.focus.set(this.point.x, this.point.y + .55, this.point.z)
      }
    }
    const distance = 2 * zoom * (this.camera.aspect < .85 ? 1.15 : 1)
    this.camera.position.set(this.focus.x + Math.sin(angle) * 12.8 * distance,
      this.focus.y + (this.riding ? 4.4 : 9.15) * distance, this.focus.z + Math.cos(angle) * 12.8 * distance)
    this.camera.lookAt(this.focus)
    this.camera.updateMatrixWorld()
    this.residents.update(dt, this.time, x, z, this.snow, this.prints, this.flakes)
    for (const model of this.houses.values()) animateDecoration(model, this.time, true, this.night)
    this.updatePathLamps(x, z)
    this.prints.update(this.time)
    this.flakes.update(dt, x, z, ground)
    this.renderer.render(this.scene, this.camera)
    return stepped
  }

  reenter() {
    this.w = 0
    this.h = 0
    this.updateLighting(0, true)
  }

  portrait(saved: PenguinSave, leader: boolean) {
    const key = `${saved.species ?? 'penguin'}:${saved.seed}:${saved.style ?? 0}:${leader}`
    const cached = this.portraits.get(key)
    if (cached) return cached
    const scene = this.thumbnailScene()
    const animal = createAnimal(scene, 0, 0, 'follow', leader, saved.seed, saved.species)
    if (saved.style !== undefined) animal.wearStyle(saved.style)
    try {
      const url = this.renderThumbnail(scene, animal.root, new T.Vector3(4.1, 2.1, 6.3), 104, .48)
      this.portraits.set(key, url)
      if (this.portraits.size > 160) this.portraits.delete(this.portraits.keys().next().value!)
      return url
    } finally {
      animal.dispose(scene)
    }
  }

  buildingThumbnail(kind: BuildKind) {
    const cached = this.buildingThumbnails.get(kind)
    if (cached) return cached
    const scene = this.thumbnailScene()
    const model = this.makeModel(kind)
    animateDecoration(model, .7, false)
    scene.add(model)
    try {
      const url = this.renderThumbnail(scene, model, new T.Vector3(5, 3.8, 7.5), 208, .50)
      this.buildingThumbnails.set(kind, url)
      return url
    } finally {
      scene.remove(model)
    }
  }

  private thumbnailScene() {
    if (!this.portraitScene) {
      this.portraitScene = new T.Scene()
      this.portraitScene.background = new T.Color(0xe6f4fc)
      this.portraitScene.add(new T.HemisphereLight(0xf6f7ff, 0xa2bbce, 2.12))
      const light = new T.DirectionalLight(0xffe4ce, 1.42)
      light.position.set(-5, 7, 4)
      this.portraitScene.add(light)
    }
    return this.portraitScene
  }

  private renderThumbnail(scene: T.Scene, model: T.Object3D, view: T.Vector3, size: number, padding: number) {
    const box = new T.Box3().setFromObject(model)
    const center = box.getCenter(new T.Vector3())
    const span = box.getSize(new T.Vector3()).length() * padding
    const camera = new T.OrthographicCamera(-span, span, span, -span, .1, 30)
    camera.position.copy(center).add(view)
    camera.lookAt(center)
    const target = this.portraitTarget ??= new T.WebGLRenderTarget(size, size)
    if (target.width !== size) target.setSize(size, size)
    target.texture.colorSpace = T.SRGBColorSpace
    const previous = this.renderer.getRenderTarget()
    const pixels = new Uint8Array(size * size * 4)
    try {
      this.renderer.setRenderTarget(target)
      this.renderer.render(scene, camera)
      this.renderer.readRenderTargetPixels(target, 0, 0, size, size, pixels)
    } finally {
      this.renderer.setRenderTarget(previous)
    }
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    const context = canvas.getContext('2d')!
    const image = context.createImageData(size, size)
    for (let row = 0; row < size; row++) {
      const start = (size - row - 1) * size * 4
      image.data.set(pixels.subarray(start, start + size * 4), row * size * 4)
    }
    context.putImageData(image, 0, 0)
    return canvas.toDataURL('image/png')
  }

  cellAt(x: number, y: number, rect: DOMRect, snap: boolean) {
    this.cursor.set((x - rect.left) / rect.width * 2 - 1, 1 - (y - rect.top) / rect.height * 2)
    this.ray.setFromCamera(this.cursor, this.camera)
    this.plane.constant = 0
    for (let i = 0; i < 4; i++) {
      if (!this.ray.ray.intersectPlane(this.plane, this.point)) return
      this.plane.constant = -this.snow.height(this.point.x, this.point.z)
    }
    const gx = this.point.x / TERRITORY_TILE
    const gz = this.point.z / TERRITORY_TILE
    if (gx >= 0 && gz >= 0 && gx < this.width && gz < this.height) return snap ? {x: Math.floor(gx), y: Math.floor(gz)} : {x: gx, y: gz}
  }

  project(house: Building) {
    const center = buildingCenter(house)
    const info = buildingInfo(house)
    const x = center.x * TERRITORY_TILE
    const z = center.y * TERRITORY_TILE
    const ground = this.snow.height(x, z)
    const distance = this.camera.position.distanceTo(this.point.set(x, ground, z))
    this.point.y += info.capacity ? info.size * .56 : house.kind === 'tall-lamp' ? 2 :
      buildingKind(house) === 'filter' || house.kind === 'snow-lamp' ? 1.25 : .48
    this.point.project(this.camera)
    const cx = (this.point.x + 1) * this.w / 2
    const cy = (1 - this.point.y) * this.h / 2
    const size = Math.min(220, Math.max(info.size ? 35 : 20, 4.9 * info.radius * this.h / distance))
    const visible = this.point.z > -1 && this.point.z < 1 && cx > 0 && cx < this.w && cy > 0 && cy < this.h
    return {x: cx, y: cy, visible, size}
  }
}
