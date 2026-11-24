import * as T from 'three'
import { Footprints, random, Snowfield, SnowParticles, winterSprite } from './snow'
import { Colonies, HONK, WALK_SCALE } from './squads'
import type { Penguin } from './penguin'
import './style.css'

const get = <E extends HTMLElement>(id: string) => document.getElementById(id) as E
const game = get('game')
const hint = get('message')
const help = get<HTMLDialogElement>('instructions')
const button = get<HTMLButtonElement>('honk')
const sound = get<HTMLButtonElement>('sound')
const joystick = get('joystick')
const marks = get('markers')
const count = get('count')
const bestNode = get('best')
const saveKey = 'strolling-penguin-best'
let best = 1
try { best = Math.max(1, Number(localStorage.getItem(saveKey)) || 1) } catch { /* Storage may be unavailable. */ }

let audio: AudioContext | undefined
let audible = false
function play(kind: 'honk' | 'join' | 'step') {
  if (!audible) return
  audio ??= new AudioContext()
  void audio.resume().catch(() => {})
  const at = audio.currentTime
  if (kind === 'step') {
    const buffer = audio.createBuffer(1, Math.floor(audio.sampleRate * .075), audio.sampleRate)
    const data = buffer.getChannelData(0)
    let grain = 0
    for (let i = 0; i < data.length; i++) {
      grain = grain * .61 + (Math.random() - .5) * .39
      data[i] = grain * (1 - i / data.length) ** 2
    }
    const step = audio.createBufferSource()
    step.buffer = buffer
    const volume = audio.createGain()
    volume.gain.value = .16
    step.connect(volume).connect(audio.destination)
    step.start()
    return
  }
  const pairs = kind === 'honk' ? [[390, 235], [350, 210]] : [[540, 650], [720, 810]]
  pairs.forEach(([start, end], i) => {
    const t = at + i * .145
    const voice = audio!.createOscillator()
    const volume = audio!.createGain()
    const filter = audio!.createBiquadFilter()
    voice.type = kind === 'honk' ? 'triangle' : 'sine'
    filter.frequency.value = 1100
    voice.frequency.setValueAtTime(start, t)
    voice.frequency.exponentialRampToValueAtTime(end, t + .14)
    volume.gain.setValueAtTime(.001, t)
    volume.gain.exponentialRampToValueAtTime(kind === 'honk' ? .18 : .09, t + .025)
    volume.gain.exponentialRampToValueAtTime(.001, t + .19)
    voice.connect(filter).connect(volume).connect(audio!.destination)
    voice.start(t)
    voice.stop(t + .20)
  })
}

function boot() {
  const scene = new T.Scene()
  scene.background = new T.Color(0xd9e8f6)
  scene.fog = new T.FogExp2(0xd9e8f6, .020)
  const renderer = new T.WebGLRenderer({antialias: true, powerPreference: 'high-performance'})
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.65))
  renderer.outputColorSpace = T.SRGBColorSpace
  renderer.domElement.setAttribute('aria-hidden', 'true')
  game.prepend(renderer.domElement)
  const camera = new T.PerspectiveCamera(45, 1, .1, 180)
  scene.add(new T.HemisphereLight(0xf6f7ff, 0xa2bbce, 2.12))
  const sun = new T.DirectionalLight(0xffe4ce, 1.42)
  sun.position.set(-7, 9, 4)
  scene.add(sun)
  const snow = new Snowfield(scene)
  const prints = new Footprints(scene, snow)
  const particles = new SnowParticles(scene)
  const farIce = new T.Group()
  const rng = random(818)
  const iceberg = winterSprite('iceberg')
  iceberg.color.set(0xe1ecff)
  iceberg.opacity = .52
  iceberg.alphaTest = .24
  iceberg.transparent = true
  iceberg.depthWrite = false
  for (let i = 0; i < 15; i++) {
    const angle = i * Math.PI * 2 / 15
    const size = 13 + rng() * 17
    const peak = new T.Sprite(iceberg)
    peak.position.set(Math.sin(angle) * 49, size * .18, Math.cos(angle) * 49)
    peak.scale.set(size, size * .44, 1)
    farIce.add(peak)
  }
  scene.add(farIce)

  let time = 0
  let hintUntil = 0
  const notify = (value: string, chime = false) => {
    hint.textContent = value
    hintUntil = time + 5
    if (chime) play('join')
  }
  const colonies = new Colonies(scene, snow, particles, notify)
  const player = colonies.player
  const keys = new Set<string>()
  const movement = new T.Vector2()
  const drag = new T.Vector2()
  const start = new T.Vector2()
  const focus = new T.Vector3()
  const view = new T.Vector3()
  const projected = new T.Vector3()
  const indicators = new Map<Penguin, HTMLElement>()
  const controls = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'Space', 'KeyE'])
  let pointer: number | undefined
  let nextHonk = 0
  let nextStep = 0
  let zoom = 1
  let initialized = false
  let previousCount = 0
  const waveMaterial = new T.MeshBasicMaterial({color: 0xe58557, transparent: true, depthWrite: false, side: T.DoubleSide})
  const wave = new T.Mesh(new T.RingGeometry(.91, 1, 90).rotateX(-Math.PI / 2), waveMaterial)
  const echo = new T.Mesh(wave.geometry, waveMaterial)
  wave.renderOrder = echo.renderOrder = 4
  wave.visible = echo.visible = false
  scene.add(wave, echo)

  const honk = () => {
    if (time < nextHonk || help.open) return
    nextHonk = time + 1.45
    player.honk = .6
    const {x, y: z} = player.position
    const originX = x + Math.sin(player.angle) * .34
    const originZ = z + Math.cos(player.angle) * .34
    wave.position.set(originX, snow.height(x, z) + .68, originZ)
    echo.position.copy(wave.position)
    if (colonies.rescue(time)) notify('叫回夥伴了，一起繼續散步。')
    play('honk')
  }

  button.addEventListener('click', honk)
  sound.addEventListener('click', () => {
    audible = !audible
    sound.setAttribute('aria-pressed', String(audible))
    sound.setAttribute('aria-label', audible ? '關閉音效' : '開啟音效')
    if (audible) play('join')
  })
  get('help').addEventListener('click', () => {
    keys.clear()
    resetDrag()
    help.showModal()
  })
  window.addEventListener('keydown', e => {
    if (!controls.has(e.code) || help.open || e.ctrlKey || e.altKey || e.metaKey) return
    if (e.code === 'Space' && e.target instanceof HTMLButtonElement) return
    e.preventDefault()
    keys.add(e.code)
    if (!e.repeat && (e.code === 'Space' || e.code === 'KeyE')) honk()
  })
  window.addEventListener('keyup', e => keys.delete(e.code))
  window.addEventListener('blur', () => { keys.clear(); resetDrag() })
  const canvas = renderer.domElement
  canvas.addEventListener('pointerdown', e => {
    if (pointer !== undefined || e.button !== 0 || help.open) return
    pointer = e.pointerId
    start.set(e.clientX, e.clientY)
    canvas.setPointerCapture(pointer)
    joystick.style.left = start.x + 'px'
    joystick.style.top = start.y + 'px'
    joystick.classList.add('active')
  })
  canvas.addEventListener('pointermove', e => {
    if (e.pointerId !== pointer) return
    drag.set(e.clientX - start.x, e.clientY - start.y).clampLength(0, 42)
    joystick.firstElementChild!.setAttribute('style', 'transform:translate(' + drag.x + 'px,' + drag.y + 'px)')
  })
  function resetDrag() {
    const previous = pointer
    pointer = undefined
    if (previous !== undefined && canvas.hasPointerCapture(previous)) canvas.releasePointerCapture(previous)
    drag.set(0, 0)
    joystick.firstElementChild!.removeAttribute('style')
    joystick.classList.remove('active')
  }
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
    canvas.addEventListener(type, e => { if (e.pointerId === pointer) resetDrag() })
  }

  function resize() {
    const w = game.clientWidth
    const h = game.clientHeight
    renderer.setSize(w, h, false)
    camera.aspect = w / Math.max(h, 1)
    camera.fov = camera.aspect < .85 ? 55 : 45
    camera.updateProjectionMatrix()
  }
  window.addEventListener('resize', resize)
  resize()

  function updateCamera(dt: number) {
    const {x, y: z} = player.position
    const y = snow.height(x, z)
    view.set(x, y + .26, z - 2.4)
    const t = initialized ? 1 - Math.exp(-dt * 5.8) : 1
    focus.lerp(view, t)
    const portrait = camera.aspect < .85
    const desiredZoom = 1 + Math.min(.68, (colonies.party.members.length - 1) * .047)
    zoom = T.MathUtils.lerp(zoom, desiredZoom, t)
    const distance = 2 * zoom * (portrait ? 1.15 : 1)
    camera.position.set(focus.x, focus.y + 9.15 * distance, focus.z + 12.8 * distance)
    camera.lookAt(focus)
    camera.updateMatrixWorld()
    farIce.position.set(x, y, z)
    initialized = true
  }

  function updateMarkers() {
    const w = game.clientWidth
    const h = game.clientHeight
    for (const [p, item] of indicators) {
      if (!colonies.penguins.has(p) || !(p.recruit || p.joy > .34 || colonies.needsHelp(p))) {
        item.remove()
        indicators.delete(p)
      }
    }
    for (const p of colonies.penguins) {
      const needsHelp = colonies.needsHelp(p) && colonies.party.members.includes(p)
      if (!(p.recruit || p.joy > .34 || colonies.needsHelp(p))) continue
      projected.copy(p.root.position)
      projected.y += (p.status === 'trip' ? p.height * .52 : p.height) + .44
      projected.project(camera)
      const x = (projected.x * .5 + .5) * w
      const y = (-projected.y * .5 + .5) * h
      const behind = projected.z > 1
      const off = behind || x < 24 || x > w - 24 || y < 24 || y > h - 24
      let marker = indicators.get(p)
      if (!marker) {
        marker = document.createElement('div')
        indicators.set(p, marker)
        marks.append(marker)
      }
      marker.hidden = off && !needsHelp
      marker.style.display = marker.hidden ? 'none' : ''
      marker.className = 'marker' + (p.recruit ? ' progress' : off ? ' edge' : '')
      marker.textContent = p.recruit ? '' : p.status === 'trip' ? '✷' : p.status === 'dream' ? '?' : p.status === 'stray' ? '!' : '♥'
      marker.style.setProperty('--progress', p.recruit * 100 + '%')
      if (off) {
        const dx = behind ? w / 2 - x : x - w / 2
        const dy = behind ? Math.abs(y - h / 2) : y - h / 2
        const scale = Math.min((w / 2 - 26) / Math.max(1, Math.abs(dx)), (h / 2 - 31) / Math.max(1, Math.abs(dy)))
        marker.style.left = w / 2 + dx * scale + 'px'
        marker.style.top = h / 2 + dy * scale + 'px'
        marker.style.setProperty('--angle', Math.atan2(dx, -dy) + 'rad')
      } else {
        marker.style.left = x + 'px'
        marker.style.top = y + 'px'
      }
    }
  }

  function shiftWorld() {
    const {x, y: z} = player.position
    if (Math.hypot(x, z) < 10000) return
    snow.shift(x, z)
    prints.shift(x, z)
    particles.shift(x, z)
    for (const p of colonies.penguins) p.shift(x, z)
    for (const spot of [focus, wave.position, echo.position]) {
      spot.x -= x
      spot.z -= z
    }
  }

  let previous = performance.now()
  snow.update(0, 0)
  updateCamera(0)
  renderer.setAnimationLoop(now => {
    const dt = Math.min(.045, Math.max(.001, (now - previous) / 1000))
    previous = now
    if (help.open) return
    time += dt
    const pressed = (...values: string[]) => values.some(key => keys.has(key))
    movement.set(Number(pressed('KeyD', 'ArrowRight')) - Number(pressed('KeyA', 'ArrowLeft')),
      Number(pressed('KeyS', 'ArrowDown')) - Number(pressed('KeyW', 'ArrowUp')))
    movement.addScaledVector(drag, 1 / 42).clampLength(0, 1)
    colonies.update(dt, time, movement, camera)
    shiftWorld()
    const {x, y: z} = player.position
    const ground = snow.height(x, z)
    snow.update(x, z)
    updateCamera(dt)
    for (const p of colonies.penguins) p.animate(dt, time, snow, prints, particles)
    if (player.speed > .5 && time >= nextStep) {
      nextStep = time + .18 / WALK_SCALE
      play('step')
    }
    prints.update(time)
    particles.update(dt, x, z, ground)
    const untilReady = Math.max(0, nextHonk - time)
    const progress = (1.45 - untilReady) / .78
    wave.visible = progress >= 0 && progress < 1
    echo.visible = progress > .13 && progress < 1
    if (wave.visible) {
      wave.scale.setScalar(.24 + HONK * progress)
      echo.scale.setScalar(.24 + HONK * (progress - .13))
      waveMaterial.opacity = (1 - progress) * .46
    }
    button.style.setProperty('--cooldown', untilReady / 1.45 * 100 + '%')
    button.disabled = untilReady > 0
    button.classList.toggle('ready', untilReady === 0 && colonies.ready())
    if (hintUntil <= time) {
      const status = colonies.party.incident
      hint.textContent = status ? '順著警示或雪地腳印，回去找夥伴。' : '靠近落單的企鵝，邀牠一起散步。'
    }
    const total = colonies.party.members.length
    if (previousCount !== total) {
      previousCount = total
      count.textContent = String(total)
      if (total > best) {
        best = total
        try { localStorage.setItem(saveKey, String(best)) } catch { /* Continue without persistence. */ }
      }
      bestNode.textContent = String(best)
    }
    updateMarkers()
    renderer.render(scene, camera)
  })
}

try {
  boot()
} catch (error) {
  console.error(error)
  hint.textContent = '無法啟動 3D 雪原。請確認瀏覽器已啟用 WebGL 2。'
  button.disabled = true
}


