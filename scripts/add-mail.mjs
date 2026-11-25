import {readFileSync, writeFileSync} from 'node:fs'

const schedulePath = new URL('../src/mail-schedule.json', import.meta.url)
const archivePath = new URL('../mail-archive.json', import.meta.url)
const read = path => JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''))
const write = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n')

const input = process.argv[2]
if (!input) throw new Error('Usage: npm run mail:add -- <letter.json>')
const letter = read(input)
const hasText = value => typeof value === 'string' && value.trim().length > 0
const validTime = value => hasText(value) && /(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value))
if (!letter || ![letter.id, letter.title, letter.body, letter.triggerAt].every(hasText) ||
    !validTime(letter.triggerAt) || (letter.expiresAt !== undefined &&
      (!validTime(letter.expiresAt) || Date.parse(letter.expiresAt) <= Date.parse(letter.triggerAt))) ||
    letter.reward?.kind !== 'penguin-coins' || !Number.isSafeInteger(letter.reward.amount) || letter.reward.amount <= 0) {
  throw new Error('Invalid letter. Supply id, title, body, triggerAt with time zone, and a positive penguin-coins reward.')
}

const active = read(schedulePath)
const archive = new Map(read(archivePath).map(entry => [entry.id, entry]))
const id = letter.id.trim()
if (archive.has(id) || active.some(entry => entry.id === id)) throw new Error('Letter ID already exists.')
const now = Date.now()
const upcoming = active.filter(entry => {
  if (entry.expiresAt ? Date.parse(entry.expiresAt) > now : Date.parse(entry.triggerAt) >= now) return true
  archive.set(entry.id, entry)
  return false
})
upcoming.push({...letter, id})
upcoming.sort((a, b) => Date.parse(a.triggerAt) - Date.parse(b.triggerAt))
write(archivePath, [...archive.values()])
write(schedulePath, upcoming)
