type CheckInEvent = {
  id: string
  type: 'check-in'
  title: string
  rewards: readonly number[]
}

const checkInEvents: readonly CheckInEvent[] = [
  {id: 'snow-check-in', type: 'check-in', title: '企鵝 7 天簽到', rewards: [30, 30, 30, 50, 50, 70, 100]},
]
const events = [...checkInEvents, {id: 'christmas-treasure', type: 'promo', title: '聖誕寶箱'} as const]

type CheckIn = {days: number, lastDay: string, claimed: number[], completedDay?: string}
export type CheckIns = Record<string, CheckIn>
const dayClock = new Intl.DateTimeFormat('sv-SE', {timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit'})

export function recordEventLogin(book: CheckIns, today = dayClock.format()) {
  let changed = false
  for (const event of checkInEvents) {
    const previous = book[event.id]
    if (previous && (today <= previous.lastDay ||
      (previous.completedDay ? today <= previous.completedDay : previous.days >= event.rewards.length))) continue
    book[event.id] = {
      days: previous && !previous.completedDay ? previous.days + 1 : 1,
      lastDay: today,
      claimed: previous && !previous.completedDay ? previous.claimed : [],
    }
    changed = true
  }
  return changed
}

export function claimCheckIn(book: CheckIns, id: string, day: number,
  credit: (amount: number) => void, save: () => boolean, today = dayClock.format()) {
  const previous = book[id]
  const reward = checkInEvents.find(event => event.id === id)?.rewards
  if (!previous || !reward || !Number.isInteger(day) || day < 1 || day > previous.days ||
      day > reward.length || previous.claimed.includes(day)) return false
  const claimed = [...previous.claimed, day]
  book[id] = {...previous, claimed, completedDay: claimed.length === reward.length ? today : undefined}
  const amount = reward[day - 1]
  credit(amount)
  if (save()) return true
  credit(-amount)
  book[id] = previous
  return false
}

function renderCheckIn(event: CheckInEvent, progress: CheckIn | undefined, onClaim: (day: number) => void) {
  const schedule = document.createElement('div')
  schedule.className = 'check-in'
  const banner = document.createElement('header')
  banner.className = 'check-in-banner'
  const title = document.createElement('h2')
  title.textContent = event.title
  const art = document.createElement('div')
  art.className = 'check-in-art'
  art.setAttribute('aria-hidden', 'true')
  for (let i = 0; i < 3; i++) {
    const penguin = document.createElement('span')
    penguin.className = 'check-in-penguin'
    art.append(penguin)
  }
  banner.append(title, art)
  const description = document.createElement('p')
  description.className = 'check-in-progress'
  description.textContent = progress?.completedDay ? '這輪已領完，下個登入日開啟新一輪。'
    : `累計 ${progress?.days ?? 0} / ${event.rewards.length} 天 · 登入日可累計，漏天不扣進度`
  const days = document.createElement('ol')
  days.className = 'check-in-days'
  for (const [index, reward] of event.rewards.entries()) {
    const day = index + 1
    const cell = document.createElement('li')
    const label = document.createElement('span')
    label.textContent = `第 ${day} 天`
    const button = document.createElement('button')
    const collected = progress?.claimed.includes(day)
    const stateName = collected ? 'claimed' : day > (progress?.days ?? 0) ? 'locked' : 'available'
    button.disabled = stateName !== 'available'
    button.dataset.state = stateName
    button.className = 'check-in-reward'
    const coins = document.createElement('strong')
    coins.textContent = `${reward} 金幣`
    const state = document.createElement('small')
    state.textContent = collected ? '✓ 已領取' : button.disabled ? '未解鎖' : '可領取'
    button.append(label, coins, state)
    button.onclick = () => onClaim(day)
    cell.append(button)
    days.append(cell)
  }
  schedule.append(banner, description, days)
  return schedule
}

export function setupEvents(pauseInput: () => void, book: CheckIns, credit: (amount: number) => void, save: () => boolean) {
  const launch = document.querySelector<HTMLButtonElement>('#open-events')!
  const dot = launch.querySelector<HTMLElement>('.event-dot')!
  const dialog = document.querySelector<HTMLDialogElement>('#events-dialog')!
  const tabs = document.querySelector<HTMLElement>('#event-tabs')!
  const panel = document.querySelector<HTMLElement>('#event-panel')!
  const status = document.querySelector<HTMLElement>('#event-status')!
  const treasureBanner = document.querySelector<HTMLTemplateElement>('#christmas-treasure-banner')!
  let active = 0
  const buttons = events.map((event, index) => {
    const button = document.createElement('button')
    button.id = 'event-tab-' + event.id
    button.setAttribute('role', 'tab')
    button.setAttribute('aria-controls', panel.id)
    button.textContent = event.title
    button.onclick = () => select(index)
    tabs.append(button)
    return button
  })
  function select(index: number) {
    const available = checkInEvents.some(event => {
      const progress = book[event.id]
      return progress && event.rewards.some((_, index) => index < progress.days && !progress.claimed.includes(index + 1))
    })
    dot.hidden = !available
    launch.setAttribute('aria-label', available ? '活動，有獎勵可領取' : '活動')
    active = index
    buttons.forEach((button, i) => {
      button.setAttribute('aria-selected', String(i === active))
      button.tabIndex = i === active ? 0 : -1
    })
    panel.setAttribute('aria-labelledby', buttons[active].id)
    const event = events[active]
    status.textContent = ''
    if (event.type === 'promo') {
      panel.replaceChildren(treasureBanner.content.cloneNode(true))
      return
    }
    panel.replaceChildren(renderCheckIn(event, book[event.id], day => {
      if (!claimCheckIn(book, event.id, day, credit, save)) {
        status.textContent = '領取結果未能儲存，請重新整理後再試。'
        return
      }
      select(active)
      panel.focus()
      status.textContent = `已領取 ${event.rewards[day - 1]} 枚企鵝金幣。`
    }))
  }
  tabs.addEventListener('keydown', e => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!step && e.key !== 'Home' && e.key !== 'End') return
    e.preventDefault()
    select(e.key === 'Home' ? 0 : e.key === 'End' ? buttons.length - 1 : (active + step + buttons.length) % buttons.length)
    buttons[active].focus()
  })
  select(0)
  launch.onclick = () => {
    pauseInput()
    select(active)
    dialog.showModal()
    buttons[active].focus()
  }
  dialog.addEventListener('close', () => launch.focus())
  return {dialog, refresh: () => select(active)}
}
