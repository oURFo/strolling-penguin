import * as T from 'three'
import { createNoise2D } from 'simplex-noise'

export function random(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0
    return (seed >>> 0) / 4294967296
  }
}

const noise = createNoise2D(random(3425))
const CHUNK = 36
const GRID = 24
const STEP = CHUNK / GRID
export const SEA_LEVEL = -2
const snowColor = new T.Color()
const frostColor = new T.Color(0xb7d7ea)
const seabedColor = new T.Color(0x527f95)
const normal = new T.Vector3()
const up = new T.Vector3(0, 1, 0)
const yaw = new T.Quaternion()
const matrix = new T.Matrix4()
const stampScale = new T.Vector3()
const position = new T.Vector3()
const temp = new T.Object3D()

export class Snowfield {
  offset = new T.Vector2()
  private chunks = new Map<string, T.Group>()
  private free: T.Group[] = []
  private material: T.MeshStandardMaterial
  private seaMaterial = new T.MeshBasicMaterial({transparent: true, opacity: .60, depthWrite: false})
  private seaTime = {value: 0}
  private crystal = winterSprite('crystals')
  private driftSprite = winterSprite('drift')
  private drift = new T.SphereGeometry(1, 14, 9)

  private driftMaterial = new T.MeshStandardMaterial({color: 0xf5faff, roughness: .92})

  constructor(private scene: T.Scene, private landOnly = false) {
    const loader = new T.TextureLoader()
    const albedo = loader.load(import.meta.env.BASE_URL + 'textures/snow.webp')
    albedo.colorSpace = T.SRGBColorSpace
    const normalMap = loader.load(import.meta.env.BASE_URL + 'textures/snow-normal.webp')
    const roughnessMap = loader.load(import.meta.env.BASE_URL + 'textures/snow-roughness.webp')
    for (const map of [albedo, normalMap, roughnessMap]) {
      map.wrapS = map.wrapT = T.RepeatWrapping
      map.anisotropy = 4
    }
    this.material = new T.MeshStandardMaterial({
      color: 0xffffff, map: albedo, normalMap, roughnessMap, normalScale: new T.Vector2(.2, .2), roughness: .9, vertexColors: true
    })
    this.seaMaterial.onBeforeCompile = shader => {
      shader.uniforms.seaTime = this.seaTime
      shader.vertexShader = 'varying vec2 vSea; varying float vDepth;\n' + shader.vertexShader
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
        #include <begin_vertex>
        vSea = uv * 7.0;
        vDepth = ${SEA_LEVEL.toFixed(1)} - position.y;
        transformed.y = ${SEA_LEVEL.toFixed(1)};
      `)
      shader.fragmentShader = 'uniform float seaTime; varying vec2 vSea; varying float vDepth;\n' + shader.fragmentShader
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
        #include <color_fragment>
        if (vDepth <= 0.0) discard;
        float moving = sin(dot(vSea, vec2(0.82, 1.74)) - seaTime * 1.8
          + sin(vSea.x * 0.42 + seaTime * 0.42) * 1.22);
        float crossWave = sin(dot(vSea, vec2(-1.21, 0.49)) + seaTime * 1.24);
        vec3 deep = vec3(0.105, 0.34, 0.53);
        vec3 shallow = vec3(0.34, 0.66, 0.77);
        vec3 sea = mix(shallow, deep, smoothstep(0.0, 2.4, vDepth));
        sea += (moving * 0.019 + crossWave * 0.014);
        float ripple = smoothstep(0.88, 1.0, moving) * smoothstep(0.08, 0.8, crossWave);
        sea = mix(sea, vec3(0.68, 0.87, 0.94), ripple * 0.34);
        float foam = 1.0 - smoothstep(0.04, 0.26, vDepth + moving * 0.035);
        diffuseColor.rgb = mix(sea, vec3(0.84, 0.94, 0.98), foam * 0.63);
        diffuseColor.a *= clamp(0.68 + foam * 0.26 + ripple * 0.16, 0.0, 1.0);
      `)
    }
  }

  private elevation(x: number, z: number) {
    const ground = noise(x * .025, z * .025) * .96 + noise(x * .065, z * .065) * .23
      + noise(x * .008 + 20, z * .008) * .55
    if (this.landOnly) return ground
    const coast = noise(x * .021 + 106, z * .021 - 73) * .76 + noise(x * .008 - 64, z * .008 + 19) * .32
    const ocean = T.MathUtils.smoothstep(coast, .12, .41) * T.MathUtils.smoothstep(Math.hypot(x, z), 13, 24)
    return ground - 4.7 * ocean
  }

  surface(x: number, z: number) {
    return Math.max(SEA_LEVEL, this.height(x, z))
  }

  isWater(x: number, z: number) {
    return this.height(x, z) < SEA_LEVEL
  }

  animate(time: number) {
    this.seaTime.value = time
  }

  height(x: number, z: number) {
    x += this.offset.x
    z += this.offset.y
    const left = Math.floor(x / STEP) * STEP
    const top = Math.floor(z / STEP) * STEP
    const u = (x - left) / STEP
    const v = (z - top) / STEP
    const a = this.elevation(left, top)
    const b = this.elevation(left + STEP, top)
    const c = this.elevation(left, top + STEP)
    const d = this.elevation(left + STEP, top + STEP)
    return u + v <= 1 ? a + u * (b - a) + v * (c - a) : d + (1 - u) * (c - d) + (1 - v) * (b - d)
  }

  slope(x: number, z: number, out: T.Vector3) {
    return out.set(this.height(x - .13, z) - this.height(x + .13, z), .26,
      this.height(x, z - .13) - this.height(x, z + .13)).normalize()
  }

  update(x: number, z: number) {
    const cx = Math.floor((x + this.offset.x) / CHUNK)
    const cz = Math.floor((z + this.offset.y) / CHUNK)
    for (const [key, group] of this.chunks) {
      const [gx, gz] = key.split(',').map(Number)
      if (Math.abs(gx - cx) <= 2 && Math.abs(gz - cz) <= 2) continue
      this.chunks.delete(key)
      group.visible = false
      this.free.push(group)
    }
    for (let gz = cz - 2; gz <= cz + 2; gz++) {
      for (let gx = cx - 2; gx <= cx + 2; gx++) {
        const key = gx + ',' + gz
        if (this.chunks.has(key)) continue
        const group = this.free.pop() ?? this.makeChunk()
        this.shape(group, gx, gz)
        this.chunks.set(key, group)
      }
    }
  }

  shift(dx: number, dz: number) {
    this.offset.x += dx
    this.offset.y += dz
    for (const group of this.chunks.values()) {
      group.position.x -= dx
      group.position.z -= dz
    }
  }

  private makeChunk() {
    const group = new T.Group()
    const geometry = new T.PlaneGeometry(CHUNK, CHUNK, GRID, GRID)
    geometry.rotateX(-Math.PI / 2)
    geometry.translate(CHUNK / 2, 0, CHUNK / 2)
    geometry.setAttribute('color', new T.BufferAttribute(new Float32Array((GRID + 1) ** 2 * 3), 3))
    const mesh = new T.Mesh(geometry, this.material)
    group.add(mesh)
    group.add(new T.Mesh(geometry, this.seaMaterial))
    group.add(new T.Sprite(this.crystal), new T.Sprite(this.driftSprite))
    for (let i = 0; i < 5; i++) group.add(new T.Mesh(this.drift, this.driftMaterial))
    this.scene.add(group)
    return group
  }

  private shape(group: T.Group, gx: number, gz: number) {
    const wx = gx * CHUNK
    const wz = gz * CHUNK
    group.position.set(wx - this.offset.x, 0, wz - this.offset.y)
    group.visible = true
    const geometry = (group.children[0] as T.Mesh<T.PlaneGeometry>).geometry
    const vertices = geometry.attributes.position
    const colors = geometry.attributes.color
    const normals = geometry.attributes.normal
    const uv = geometry.attributes.uv
    let underwater = false
    for (let i = 0; i < vertices.count; i++) {
      const x = wx + vertices.getX(i)
      const z = wz + vertices.getZ(i)
      const elevation = this.elevation(x, z)
      vertices.setY(i, elevation)
      underwater ||= elevation < SEA_LEVEL
      normal.set(this.elevation(x - .2, z) - this.elevation(x + .2, z), .4,
        this.elevation(x, z - .2) - this.elevation(x, z + .2)).normalize()
      normals.setXYZ(i, normal.x, normal.y, normal.z)
      const frost = noise(x * .047 + 80, z * .047) * .5 + .5
      snowColor.set(0xfafaff).lerp(frostColor, frost ** 2 * .67)
      snowColor.lerp(seabedColor, T.MathUtils.smoothstep(SEA_LEVEL - elevation, .08, 2.4) * .82)
      colors.setXYZ(i, snowColor.r, snowColor.g, snowColor.b)
      uv.setXY(i, x / 7, z / 7)
    }
    vertices.needsUpdate = colors.needsUpdate = normals.needsUpdate = uv.needsUpdate = true
    geometry.computeBoundingSphere()
    group.children[1].visible = underwater
    const rng = random((gx * 73856093) ^ (gz * 19349663))
    group.children.slice(2).forEach((item, i) => {
      const sprite = i < 2
      const x = i === 0 ? 6 + rng() * 24 : rng() * 34 + 1
      const z = i === 0 ? 6 + rng() * 24 : rng() * 34 + 1
      const height = i === 0 ? 1.8 + rng() * .7 : i === 1 ? .62 : .14 + rng() * .22
      const width = i === 0 ? height * .97 : 1.2 + rng() * 2
      const ground = this.height(group.position.x + x, group.position.z + z)
      item.visible = Math.hypot(wx + x, wz + z) >= 5 && ground > SEA_LEVEL + .26
      item.position.set(x, ground + (sprite ? height * .40 : -.07), z)
      item.scale.set(width, height, width * (.6 + rng() * .5))
      if (!sprite) item.rotation.y = rng() * Math.PI
    })
  }
}

export function winterSprite(name: string) {
  const map = new T.TextureLoader().load(import.meta.env.BASE_URL + 'textures/' + name + '.webp')
  map.colorSpace = T.SRGBColorSpace
  return new T.SpriteMaterial({map, alphaTest: .5})
}

function paintedTexture(size: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  draw(canvas.getContext('2d')!)
  const texture = new T.CanvasTexture(canvas)
  texture.colorSpace = T.SRGBColorSpace
  return texture
}

export function softDot() {
  return paintedTexture(64, ctx => {
    const fade = ctx.createRadialGradient(32, 32, 1, 32, 32, 31)
    fade.addColorStop(0, '#fff')
    fade.addColorStop(.28, '#fffe')
    fade.addColorStop(1, '#fff0')
    ctx.fillStyle = fade
    ctx.fillRect(0, 0, 64, 64)
  })
}

const PRINTS = 2400
const PRINT_LIFE = 92
export type Print = { x: number, z: number, heading: number, size: number, born: number }

export class Footprints {
  private cursor = 0
  private marks: (Print | undefined)[] = new Array(PRINTS)
  private mesh: T.InstancedMesh
  private births = new T.InstancedBufferAttribute(new Float32Array(PRINTS).fill(-PRINT_LIFE), 1)
  private clock = {value: 0}

  constructor(scene: T.Scene, private snow: Snowfield) {
    const geometry = new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)
    geometry.setAttribute('born', this.births)
    const map = paintedTexture(128, ctx => {
      ctx.scale(2, 2)
      ctx.shadowColor = '#94b4c0'
      ctx.shadowBlur = 3
      const ink = ctx.createLinearGradient(0, 5, 64, 56)
      ink.addColorStop(0, '#6689a6')
      ink.addColorStop(.45, '#91aec1')
      ink.addColorStop(1, '#b1cbd7')
      ctx.fillStyle = ink
      ctx.beginPath()
      ctx.moveTo(31, 56)
      ctx.bezierCurveTo(21, 55, 18, 43, 16, 32)
      ctx.bezierCurveTo(6, 18, 9, 10, 14, 14)
      ctx.lineTo(26, 23)
      ctx.bezierCurveTo(27, 0, 37, 0, 38, 12)
      ctx.lineTo(38, 23)
      ctx.bezierCurveTo(54, 9, 59, 13, 48, 32)
      ctx.bezierCurveTo(44, 47, 41, 53, 31, 56)
      ctx.fill()
      ctx.shadowBlur = 0
      ctx.lineWidth = 2
      ctx.strokeStyle = '#e5f5fa'
      ctx.stroke()
    })
    const material = new T.MeshBasicMaterial({map, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1})
    material.onBeforeCompile = shader => {
      shader.uniforms.time = this.clock
      shader.vertexShader = 'attribute float born; varying float vBorn;\n' + shader.vertexShader
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvBorn = born;')
      shader.fragmentShader = 'uniform float time; varying float vBorn;\n' + shader.fragmentShader
      shader.fragmentShader = shader.fragmentShader.replace('#include <alphatest_fragment>',
        '#include <alphatest_fragment>\ndiffuseColor.a *= .86 * (1.0 - smoothstep(12.0, 92.0, time - vBorn)); if (diffuseColor.a < .008) discard;')
    }
    this.mesh = new T.InstancedMesh(geometry, material, PRINTS)
    this.mesh.count = 0
    this.mesh.frustumCulled = false
    this.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage)
    this.mesh.renderOrder = 1
    scene.add(this.mesh)
  }

  add(x: number, z: number, heading: number, size: number, born: number) {
    const index = this.cursor
    const mark = {x, z, heading, size, born}
    this.marks[index] = mark
    this.births.setX(index, born)
    this.births.needsUpdate = true
    this.cursor = (index + 1) % PRINTS
    this.mesh.count = Math.max(this.mesh.count, index + 1)
    this.transform(index, mark)
  }

  update(time: number) {
    this.clock.value = time
  }

  snapshot(time: number, x: number, z: number) {
    return this.marks.filter((mark): mark is Print => !!mark && time - mark.born < PRINT_LIFE &&
      (mark.x - x) ** 2 + (mark.z - z) ** 2 < 90 ** 2).sort((a, b) => a.born - b.born)
  }

  restore(marks: Print[], time: number) {
    for (const mark of marks.slice(-PRINTS)) {
      const {x, z, heading, size, born} = mark ?? {}
      if ([x, z, heading, size, born].every(Number.isFinite) && size > 0 && born <= time && time - born < PRINT_LIFE) {
        this.add(x, z, heading, size, born)
      }
    }
    this.update(time)
  }

  shift(dx: number, dz: number) {
    this.marks.forEach((mark, index) => {
      if (!mark) return
      mark.x -= dx
      mark.z -= dz
      this.transform(index, mark)
    })
  }

  private transform(index: number, {x, z, heading, size}: Print) {
    this.snow.slope(x, z, normal)
    temp.quaternion.setFromUnitVectors(up, normal).multiply(yaw.setFromAxisAngle(up, heading + Math.PI))
    position.set(x, this.snow.height(x, z) + .025, z)
    stampScale.set(size * .85, 1, size * 1.18)
    matrix.compose(position, temp.quaternion, stampScale)
    this.mesh.setMatrixAt(index, matrix)
    this.mesh.instanceMatrix.needsUpdate = true
  }
}

export class SnowParticles {
  private dust = Array.from({length: 600}, () => ({x: 0, y: -100, z: 0, vx: 0, vy: 0, vz: 0, life: 0}))
  private flurries = Array.from({length: 500}, () => new T.Vector3())
  private vertices = new Float32Array((this.dust.length + this.flurries.length) * 3)
  private geometry = new T.BufferGeometry()
  private cursor = 0
  private initialized = false

  constructor(scene: T.Scene) {
    this.geometry.setAttribute('position', new T.BufferAttribute(this.vertices, 3).setUsage(T.DynamicDrawUsage))
    const points = new T.Points(this.geometry, new T.PointsMaterial({
      color: 0xffffff, size: .12, map: softDot(), transparent: true, opacity: .9, depthWrite: false
    }))
    points.frustumCulled = false
    points.renderOrder = 3
    scene.add(points)
  }

  burst(x: number, y: number, z: number, count: number, force: number) {
    for (let i = 0; i < count; i++) {
      const p = this.dust[this.cursor]
      this.cursor = (this.cursor + 1) % this.dust.length
      const angle = Math.random() * Math.PI * 2
      const speed = (.25 + Math.random()) * force
      Object.assign(p, {x, y, z, vx: Math.cos(angle) * speed, vy: (.35 + Math.random()) * force,
        vz: Math.sin(angle) * speed, life: .23 + Math.random() * .38})
    }
  }

  update(dt: number, x: number, z: number, ground: number) {
    this.flurries.forEach((p, i) => {
      if (!this.initialized || Math.abs(p.x - x) > 36 || Math.abs(p.z - z) > 36 || p.y < ground - 1.8) {
        p.set(x + (Math.random() - .5) * 61, ground + (this.initialized ? 14 : Math.random() * 15), z + (Math.random() - .5) * 61)
      }
      p.x += dt * (.6 + i % 4 * .14)
      p.z += dt * .18
      p.y -= dt * (.55 + i % 5 * .17)
      p.toArray(this.vertices, i * 3)
    })
    this.initialized = true
    this.dust.forEach((p, i) => {
      p.life -= dt
      if (p.life > 0) {
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.z += p.vz * dt
        p.vy -= 4.5 * dt
      }
      const k = (i + this.flurries.length) * 3
      this.vertices[k] = p.x
      this.vertices[k + 1] = p.life > 0 ? p.y : -100
      this.vertices[k + 2] = p.z
    })
    this.geometry.attributes.position.needsUpdate = true
  }

  shift(dx: number, dz: number) {
    for (const p of this.flurries) {
      p.x -= dx
      p.z -= dz
    }
    for (const p of this.dust) {
      p.x -= dx
      p.z -= dz
    }
  }
}



