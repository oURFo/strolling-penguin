import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createServer} from 'node:http'
import {runInNewContext} from 'node:vm'
import {randomUUID} from 'node:crypto'

const code = readFileSync(new URL('../chat-apps-script/Code.gs', import.meta.url), 'utf8')
const html = readFileSync(new URL('../chat-apps-script/Chat.html', import.meta.url), 'utf8')
const testing = process.argv.includes('--test')

function createRoom() {
 const rows = []
 const cache = new Map()
 const state = {time: Date.now(), opens: 0, unavailable: false, flushFails: false, locked: false}
 const now = () => testing ? state.time : Date.now()
 const api = runInNewContext(code + '\n({getChat, sendChat})', {
  Date: {now},
  console: testing ? {error() {}} : console,
  CacheService: {getScriptCache: () => ({
    get(key) {
      const entry = cache.get(key)
      return entry && entry.expires > now() ? entry.value : null
    },
    put(key, value, ttl) { cache.set(key, {value, expires: now() + ttl * 1000}) },
    remove(key) { cache.delete(key) },
  })},
  LockService: {getScriptLock: () => ({tryLock: () => !state.locked, releaseLock() {}})},
  PropertiesService: {getScriptProperties: () => ({getProperty: () => 'local-test'})},
  SpreadsheetApp: {
    flush() { if (state.flushFails) throw Error('Mock flush response lost') },
    openById() {
      state.opens++
      if (state.unavailable) throw Error('Mock spreadsheet unavailable')
      return {getSheetByName: () => ({
        getLastRow: () => rows.length,
        getRange: (start, _column, count) => ({getValues: () => rows.slice(start - 1, start - 1 + count)}),
        appendRow: row => rows.push(row),
      })}
    },
  },
 })
 return {api, rows, cache, state}
}

const rooms = Array.from({length: 4}, createRoom)

if (testing) {
  const {api, rows, cache, state} = rooms[0]
  const message = {id: randomUUID(), visitor: randomUUID(), name: '雪地訪客', text: '=literal <b>text</b>'}
  assert(api.getChat().ok)
  for (let i = 0; i < 30; i++) assert(api.getChat().ok)
  assert.equal(state.opens, 1)
  assert(!api.sendChat({...message, text: 'a'.repeat(201)}).ok)
  assert.equal(api.sendChat({...message, visitor: '00000000-0000-1000-8000-000000000000'}).error, 'invalid')
  assert(api.sendChat(message).ok)
  assert(api.sendChat(message).ok)
  assert.equal(rows.length, 1)
  assert(rows[0][0].startsWith('{'))
  assert.equal(api.sendChat({...message, id: randomUUID()}).error, 'slow')
  assert.equal(api.getChat().messages[0].text, message.text)
  assert(!('visitor' in api.getChat().messages[0]))
  assert.equal(api.getChat().messages[0].tag, message.visitor.slice(-5).toUpperCase())
  state.time += 9000
  const next = {...message, id: randomUUID(), text: '再一則'}
  state.unavailable = true
  assert.equal(api.sendChat(next).error, 'unavailable')
  assert.equal(api.getChat().messages.length, 1)
  const afterFailure = state.opens
  assert.equal(api.sendChat(next).error, 'unavailable')
  assert.equal(state.opens, afterFailure)
  for (const other of rooms.slice(1)) {
    assert.equal(other.api.getChat().messages.length, 0)
    assert(other.api.sendChat(message).ok)
    assert.equal(other.rows.length, 1)
    assert.equal(other.api.getChat().messages[0].tag, message.visitor.slice(-5).toUpperCase())
  }
  state.unavailable = false
  state.time += 31000
  state.flushFails = true
  assert.equal(api.sendChat(next).error, 'unavailable')
  state.time += 31000
  state.flushFails = false
  assert(api.sendChat(next).ok)
  assert.equal(rows.length, 2)
  cache.clear()
  state.locked = true
  assert.equal(api.getChat().error, 'busy')
  state.locked = false
  assert.equal(api.getChat().messages.length, 2)
  console.log('Four-room isolation, room-specific failure, cache, retry and duplicate handling passed.')
} else {
  const adapter = `<script>
  window.google = {script:{run:{
    withSuccessHandler(success) {
      return {withFailureHandler(failure) {
        const send = (action, payload) => fetch(location.pathname + '/rpc', {method:'POST', headers:{'Content-Type':'application/json'},
          body:JSON.stringify({action,payload})}).then(response => response.json()).then(success, failure);
        return {getChat:() => send('get'), sendChat:payload => send('send',payload)};
      }};
    }
  }}};
  </script>`
  createServer(async (request, response) => {
    try {
      const route = /^\/room\/([1-4])(\/rpc)?$/.exec(request.url)
      if (route && request.method === 'GET' && !route[2]) {
        response.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'})
        response.end(html.replace('<script>', () => adapter + '<script>'))
        return
      }
      if (!route?.[2] || request.method !== 'POST') {
        response.writeHead(404).end()
        return
      }
      let body = ''
      for await (const part of request) {
        body += part
        if (body.length > 4096) break
      }
      if (body.length > 4096) {
        response.writeHead(413).end()
        return
      }
      const {action, payload} = JSON.parse(body)
      const {api} = rooms[Number(route[1]) - 1]
      const result = action === 'get' ? api.getChat() : action === 'send' ? api.sendChat(payload) : {ok: false, error: 'invalid'}
      response.writeHead(200, {'Content-Type': 'application/json'}).end(JSON.stringify(result))
    } catch {
      response.writeHead(400, {'Content-Type': 'application/json'}).end(JSON.stringify({ok: false, error: 'invalid'}))
    }
  }).listen(4182, '127.0.0.1', () => console.log('Local chat simulator: http://127.0.0.1:4182/'))
}
