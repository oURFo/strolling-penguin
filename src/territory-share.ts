import qrcodegen from './vendor/qrcodegen'
import {BUILDINGS, buildingKind, rotatesOnGrid, type Building, type BuildKind} from './buildings'
import {TERRITORY_WIDTH, TERRITORY_HEIGHT, type TerritorySave} from './territory'

const prefix = '#visit='
const maxBytes = 64 * 1024
const maxTokenLength = 2300

function drawQr(canvas: HTMLCanvasElement, url: string) {
  const code = qrcodegen.QrCode.encodeText(url, qrcodegen.QrCode.Ecc.MEDIUM)
  const scale = 5
  const margin = 4
  canvas.width = canvas.height = (code.size + margin * 2) * scale
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#000'
  for (let y = 0; y < code.size; y++) for (let x = 0; x < code.size; x++) {
    if (code.getModule(x, y)) ctx.fillRect((x + margin) * scale, (y + margin) * scale, scale, scale)
  }
}

function drawSnowFooter(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const sky = ctx.createLinearGradient(0, 0, width, height)
  sky.addColorStop(0, '#15395a')
  sky.addColorStop(.62, '#286887')
  sky.addColorStop(1, '#5a9db2')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, width, height)
  const snow = ctx.createLinearGradient(0, 385, 0, height)
  snow.addColorStop(0, '#e9faff')
  snow.addColorStop(1, '#92bfd8')
  ctx.fillStyle = snow
  ctx.beginPath()
  ctx.moveTo(0, 469)
  ctx.bezierCurveTo(380, 513, 529, 366, 770, 407)
  ctx.bezierCurveTo(1042, 456, 1195, 348, width, 395)
  ctx.lineTo(width, height)
  ctx.lineTo(0, height)
  ctx.fill()
  for (let i = 0; i < 62; i++) {
    const x = (i * 109 + 19) % width
    const y = (i * 79 + 23) % 392
    ctx.fillStyle = i % 4 ? '#dcf7ff35' : '#f2fcff83'
    ctx.beginPath()
    ctx.arc(x, y, 1.5 + i % 4, 0, Math.PI * 2)
    ctx.fill()
  }
  const ellipse = (x: number, y: number, rx: number, ry: number, fill: string | CanvasGradient, angle = 0) => {
    ctx.fillStyle = fill
    ctx.beginPath()
    ctx.ellipse(x, y, rx, ry, angle, 0, Math.PI * 2)
    ctx.fill()
  }
  for (let i = 0; i < 9; i++) {
    ellipse(236 + i * 48, 528 - i * 7 + (i % 2) * 10, 9, 4, '#598ca955', -.24)
  }
  ctx.save()
  ctx.translate(810, 409)
  ellipse(3, 22, 96, 20, '#46779952')
  ellipse(-41, 5, 32, 15, '#e89447', -.15)
  ellipse(42, 5, 32, 15, '#e89447', .15)
  const feathers = ctx.createLinearGradient(-78, -170, 74, 6)
  feathers.addColorStop(0, '#4c6c87')
  feathers.addColorStop(1, '#16283c')
  ellipse(-75, -90, 19, 58, feathers, .49)
  ellipse(74, -98, 18, 57, feathers, -.62)
  ellipse(0, -95, 79, 104, feathers)
  ellipse(0, -152, 77, 65, feathers)
  ellipse(0, -67, 62, 64, '#e4f5ff')
  ellipse(-26, -143, 39, 42, '#f9fdff', -.18)
  ellipse(26, -143, 39, 42, '#f9fdff', .18)
  ellipse(-26, -151, 7, 9, '#15263a')
  ellipse(26, -151, 7, 9, '#15263a')
  ellipse(-28, -154, 2, 3, '#fff')
  ellipse(24, -154, 2, 3, '#fff')
  ellipse(0, -129, 17, 9, '#ed9f4e')
  ellipse(-47, -135, 11, 5, '#edb6b8')
  ellipse(47, -135, 11, 5, '#edb6b8')
  ctx.fillStyle = '#df7467'
  ctx.beginPath()
  ctx.ellipse(0, -105, 68, 16, 0, 0, Math.PI)
  ctx.lineTo(-68, -107)
  ctx.fill()
  ctx.restore()
}

async function collect(stream: ReadableStream<Uint8Array>, limit: number) {
  const reader = stream.getReader()
  const chunks: Uint8Array<ArrayBuffer>[] = []
  let length = 0
  try {
    for (;;) {
      const {done, value} = await reader.read()
      if (done) break
      length += value.length
      if (length > limit) {
        await reader.cancel()
        throw new Error('Share layout exceeds size limit')
      }
      chunks.push(new Uint8Array(value))
    }
  } finally {
    reader.releaseLock()
  }
  return new Blob(chunks)
}

export async function territoryShareUrl(houses: readonly Building[], address = location.href) {
  const rows = houses.map(house => [buildingKind(house), Number(house.x.toFixed(6)),
    Number(house.y.toFixed(6)), house.rotation ?? 0])
  const source = new Blob([JSON.stringify([1, rows])])
  if (source.size > maxBytes) throw new Error('Share layout exceeds size limit')
  const compressed = await collect(source.stream().pipeThrough(new CompressionStream('deflate-raw')), maxBytes)
  const bytes = new Uint8Array(await compressed.arrayBuffer())
  const token = btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(''))
    .replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
  if (token.length > maxTokenLength) throw new Error('Share link exceeds QR capacity')
  const url = new URL(address)
  url.search = ''
  url.hash = prefix + token
  return url.href
}

export async function readTerritoryVisit(hash: string): Promise<TerritorySave | undefined> {
  if (!hash.startsWith(prefix)) return
  const token = hash.slice(prefix.length)
  if (token.length > maxTokenLength || !/^[\w-]+$/.test(token)) throw new Error('Invalid visit token')
  const bytes = Uint8Array.from(atob(token.replaceAll('-', '+').replaceAll('_', '/')), byte => byte.charCodeAt(0))
  const source = await collect(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw')), maxBytes)
  const data: unknown = JSON.parse(await source.text())
  if (!Array.isArray(data) || data[0] !== 1 || !Array.isArray(data[1]) || data[1].length > 1024) throw new Error('Invalid visit layout')
  const houses: Building[] = data[1].map((row: unknown, index: number) => {
    if (!Array.isArray(row) || row.length !== 4) throw new Error('Invalid building')
    const [id, x, y, rotation] = row
    if (typeof id !== 'string' || !Object.hasOwn(BUILDINGS, id) || !Number.isFinite(x) || !Number.isFinite(y) ||
        !Number.isInteger(rotation) || rotation < 0 || rotation > 7) throw new Error('Invalid building')
    const kind = id as BuildKind
    const info = BUILDINGS[kind]
    const depth = 'depth' in info ? info.depth : info.size
    const turned = rotation % 4 === 2
    if (x < 0 || y < 0 || x + (turned ? depth : info.size) > TERRITORY_WIDTH ||
        y + (turned ? info.size : depth) > TERRITORY_HEIGHT ||
        (info.size && (!Number.isInteger(x) || !Number.isInteger(y))) ||
        (rotatesOnGrid(kind) && rotation % 2)) throw new Error('Building outside territory')
    return {id: index + 1, kind, x, y, rotation, residents: []}
  })
  return {coins: 0, houses, pondGrid: true}
}

export function setupTerritoryShare(houses: () => readonly Building[], capture: () => HTMLCanvasElement | undefined) {
  const button = document.querySelector<HTMLButtonElement>('#share-territory')!
  const dialog = document.querySelector<HTMLDialogElement>('#territory-share')!
  const link = document.querySelector<HTMLInputElement>('#territory-share-url')!
  const qr = document.querySelector<HTMLCanvasElement>('#territory-share-qr')!
  const copy = document.querySelector<HTMLButtonElement>('#copy-territory-url')!
  const download = document.querySelector<HTMLButtonElement>('#download-territory-image')!
  const status = document.querySelector<HTMLElement>('#territory-share-status')!
  let attempt = 0
  button.onclick = async () => {
    const current = ++attempt
    link.value = ''
    qr.hidden = copy.disabled = download.disabled = true
    status.textContent = '正在產生分享網址…'
    dialog.showModal()
    try {
      const url = await territoryShareUrl(houses())
      const code = document.createElement('canvas')
      drawQr(code, url)
      if (current !== attempt || !dialog.open) return
      qr.width = code.width
      qr.height = code.height
      qr.getContext('2d')!.drawImage(code, 0, 0)
      link.value = url
      qr.hidden = copy.disabled = false
      download.disabled = false
      status.textContent = ''
    } catch {
      if (current === attempt && dialog.open) status.textContent = '無法產生 QR 碼。領地擺設較多時，分享網址可能超過 QR 碼容量。'
    }
  }
  copy.onclick = async () => {
    try {
      await navigator.clipboard.writeText(link.value)
      status.textContent = '已複製分享網址。'
    } catch {
      link.select()
      status.textContent = '已選取網址，可手動複製。'
    }
  }
  download.onclick = () => {
    const photo = capture()
    if (!photo) {
      status.textContent = '目前無法擷取領地畫面。'
      return
    }
    const image = document.createElement('canvas')
    image.width = 1600
    const photoHeight = 900
    const modules = qr.width / 5
    const qrSize = modules * Math.floor(500 / modules)
    const footerHeight = 550
    const textLeft = 78
    const qrLeft = image.width - qrSize - 48
    const textWidth = qrLeft - textLeft - 64
    image.height = photoHeight + footerHeight
    const ctx = image.getContext('2d')!
    ctx.fillStyle = '#173b57'
    ctx.fillRect(0, 0, image.width, image.height)
    const scale = Math.min(image.width / photo.width, photoHeight / photo.height)
    const width = photo.width * scale
    const height = photo.height * scale
    ctx.drawImage(photo, (image.width - width) / 2, (photoHeight - height) / 2, width, height)
    ctx.save()
    ctx.translate(0, photoHeight)
    drawSnowFooter(ctx, image.width, footerHeight)
    ctx.restore()
    ctx.fillStyle = '#eff9ff'
    ctx.font = 'bold 94px system-ui, sans-serif'
    ctx.fillText('散步企鵝', textLeft, photoHeight + 166, Math.min(textWidth, 580))
    ctx.font = '52px system-ui, sans-serif'
    ctx.fillText('掃描 QR 碼', textLeft, photoHeight + 262, Math.min(textWidth, 580))
    ctx.fillText('來我的領地散步', textLeft, photoHeight + 335, Math.min(textWidth, 580))
    const qrTop = photoHeight + Math.floor((footerHeight - qrSize) / 2)
    ctx.fillStyle = '#effaff'
    ctx.beginPath()
    ctx.roundRect(qrLeft - 13, qrTop - 13, qrSize + 26, qrSize + 26, 24)
    ctx.fill()
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(qr, qrLeft, qrTop, qrSize, qrSize)
    image.toBlob(blob => {
      if (!blob) return
      const downloadUrl = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = downloadUrl
      anchor.download = '散步企鵝-領地分享.png'
      anchor.click()
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 10_000)
    }, 'image/png')
  }
}
