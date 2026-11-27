const visitorKey = 'strolling-penguin-chat-uuid'
const nicknameKey = 'strolling-penguin-chat-name'
const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function chatIdentity() {
  const fresh = crypto.randomUUID()
  try {
    const saved = localStorage.getItem(visitorKey)
    if (saved && uuidV4.test(saved)) return saved
    localStorage.setItem(visitorKey, fresh)
  } catch { /* Keep the generated ID for this session. */ }
  return fresh
}

export function setupChat(pauseInput: () => void) {
  const visitor = chatIdentity()
  let nickname = ''
  try {
    nickname = localStorage.getItem(nicknameKey) ?? ''
  } catch { /* Keep the nickname in memory for this session. */ }
  const button = document.querySelector<HTMLButtonElement>('#open-chat')!
  const dialog = document.querySelector<HTMLDialogElement>('#chat-dialog')!
  const content = document.querySelector<HTMLElement>('#chat-content')!
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(location.hostname)
  const rooms = [import.meta.env.VITE_CHAT_ROOM_1, import.meta.env.VITE_CHAT_ROOM_2].flatMap((value, index) => {
    const number = index + 1
    const url = value?.trim() || (local ? `http://127.0.0.1:4182/room/${number}` : '')
    return url ? [{number, endpoint: new URL(url, location.href)}] : []
  })
  if (!rooms.length) return dialog
  let room = rooms[0]
  const nav = document.querySelector<HTMLElement>('#chat-rooms')!
  let frame: HTMLIFrameElement | undefined
  window.addEventListener('message', event => {
    const type = event.data?.type
    if (!dialog.open || (type !== 'penguin-chat-ready' && type !== 'penguin-chat-save-name') ||
        !event.source || !('parent' in event.source)) return
    const {endpoint} = room
    const googleFrame = endpoint.origin === 'https://script.google.com' &&
      /^https:\/\/[^/]+-script\.googleusercontent\.com$/.test(event.origin)
    if (event.origin !== endpoint.origin && !googleFrame) return
    let source = event.source as Window
    for (let depth = 0; depth < 4; depth++) {
      if (source === frame?.contentWindow) {
        if (type === 'penguin-chat-ready') {
          event.source.postMessage({type: 'penguin-chat-identity', visitor, nickname}, {targetOrigin: event.origin})
        } else if (typeof event.data.nickname === 'string') {
          const usedName = event.data.nickname.trim()
          if (!usedName || usedName.length > 20) return
          nickname = usedName
          try {
            localStorage.setItem(nicknameKey, nickname)
          } catch { /* The current session can still reuse the nickname. */ }
        }
        return
      }
      if (source === source.parent) return
      source = source.parent
    }
  })
  function loadRoom() {
    frame = document.createElement('iframe')
    frame.id = 'chat-frame'
    frame.title = `雪地聊天（實驗版） · 頻道 ${room.number}`
    // Android Chromium can load public Apps Script rooms without reusing Google sign-in cookies.
    if (room.endpoint.origin === 'https://script.google.com' && /Android/i.test(navigator.userAgent) &&
        'credentialless' in frame) frame.setAttribute('credentialless', '')
    frame.src = room.endpoint.href
    content.replaceChildren(frame)
    roomButtons.forEach((option, index) => option.setAttribute('aria-pressed', String(rooms[index] === room)))
  }
  const roomButtons = rooms.map(option => {
    const tab = document.createElement('button')
    tab.type = 'button'
    tab.textContent = `頻道 ${option.number}`
    tab.onclick = () => {
      if (room === option) return
      room = option
      loadRoom()
    }
    nav.append(tab)
    return tab
  })
  nav.hidden = rooms.length < 2
  button.hidden = false
  button.onclick = () => {
    pauseInput()
    dialog.showModal()
    loadRoom()
    button.setAttribute('aria-expanded', 'true')
  }
  dialog.addEventListener('close', () => {
    frame?.remove()
    frame = undefined
    button.setAttribute('aria-expanded', 'false')
    button.focus()
  })
  return dialog
}
