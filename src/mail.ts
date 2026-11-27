import schedule from './mail-schedule.json'
import { ITEMS, type ItemId } from './items'

export type MailReward = {kind: 'penguin-coins', amount: number} | {kind: 'inventory-item', item: ItemId, amount: number}
type Letter = {id: string, triggerAt: string, expiresAt?: string, title: string, body: string,
  reward: MailReward}

const rewardName = (reward: MailReward) => reward.kind === 'penguin-coins' ? '企鵝金幣' : ITEMS[reward.item].name

const canClaim = (letter: Letter, now: number) =>
  Date.parse(letter.triggerAt) <= now && (!letter.expiresAt || now < Date.parse(letter.expiresAt))

export function availableLetters(letters: readonly Letter[], claimed: ReadonlySet<string>, now = Date.now()) {
  return letters.filter(letter => canClaim(letter, now) && !claimed.has(letter.id))
}

export function claimLetter(letter: Letter, claimed: Set<string>,
  credit: (reward: MailReward, amount: number) => void, save: (id: string) => boolean, now = Date.now()) {
  if (claimed.has(letter.id) || !canClaim(letter, now)) return false
  claimed.add(letter.id)
  credit(letter.reward, letter.reward.amount)
  if (save(letter.id)) return true
  credit(letter.reward, -letter.reward.amount)
  claimed.delete(letter.id)
  return false
}

export function setupMail(claimed: Set<string>, credit: (reward: MailReward, amount: number) => void,
  save: (id: string) => boolean, pauseInput: () => void) {
  const letters = schedule as Letter[]
  const get = <E extends HTMLElement>(id: string) => document.getElementById(id) as E
  const toggle = get('settings-toggle')
  const mailButton = get('open-mail')
  const dots = get('settings').querySelectorAll<HTMLElement>('.mail-dot')
  const options = get('settings-options')
  const dialog = get<HTMLDialogElement>('mailbox')
  const list = get('mail-list')
  const detail = get('mail-detail')
  const deadline = get('mail-deadline')
  const empty = get('mail-empty')
  const status = get('mail-status')
  const claim = get<HTMLButtonElement>('claim-mail')
  let selected: Letter | undefined

  function showMenu(open: boolean) {
    options.hidden = !open
    toggle.setAttribute('aria-expanded', String(open))
  }

  function render() {
    const active = availableLetters(letters, claimed)
    for (const dot of dots) dot.hidden = !active.length
    const unreadLabel = active.length ? `，${active.length} 封信件可領取` : ''
    toggle.setAttribute('aria-label', '選單' + unreadLabel)
    mailButton.setAttribute('aria-label', '信箱' + unreadLabel)
    if (!dialog.open) return
    empty.hidden = !!active.length
    if (selected && !active.includes(selected)) selected = undefined
    detail.hidden = !selected
    const items = active.map(letter => {
      const item = document.createElement('li')
      const button = document.createElement('button')
      button.textContent = letter.title
      button.setAttribute('aria-pressed', String(letter === selected))
      button.onclick = () => {
        selected = letter
        status.textContent = ''
        render()
        claim.focus()
      }
      item.append(button)
      return item
    })
    list.replaceChildren(...items)
    if (!selected) return
    get('mail-subject').textContent = selected.title
    deadline.hidden = !selected.expiresAt
    if (selected.expiresAt) {
      const date = new Intl.DateTimeFormat('zh-TW', {timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit'})
      deadline.textContent = `領取期限　${date.format(Date.parse(selected.expiresAt) - 1)} 以前（台灣時間）`
    }
    get('mail-body').textContent = selected.body
    get('mail-reward').querySelector<HTMLElement>('.penguin-coin')!.hidden = selected.reward.kind !== 'penguin-coins'
    get('mail-reward-label').textContent = `${rewardName(selected.reward)} × ${selected.reward.amount}`
  }

  toggle.onclick = () => {
    showMenu(options.hidden)
    render()
  }
  options.addEventListener('click', event => {
    if (event.target instanceof Element && event.target.closest('[data-close-settings]')) showMenu(false)
  }, {capture: true})
  document.addEventListener('pointerdown', event => {
    if (event.target instanceof Node && !get('settings').contains(event.target)) showMenu(false)
  })
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !options.hidden) {
      showMenu(false)
      toggle.focus()
    }
  })
  mailButton.onclick = () => {
    showMenu(false)
    pauseInput()
    selected = undefined
    status.textContent = ''
    dialog.showModal()
    render()
  }
  dialog.addEventListener('close', () => toggle.focus())
  claim.onclick = () => {
    if (!selected) return
    if (!canClaim(selected, Date.now())) {
      status.textContent = '這封信已超過領取期限。'
      render()
      return
    }
    if (!claimLetter(selected, claimed, credit, save)) {
      status.textContent = '無法儲存領取結果。若已在其他分頁領取，請重新整理。'
      return
    }
    status.textContent = `已領取${rewardName(selected.reward)}。`
    render()
    const nextButton = list.querySelector('button') ?? dialog.querySelector('header button')
    nextButton?.focus()
  }
  function refreshAtNextDelivery() {
    render()
    const now = Date.now()
    const next = Math.min(...letters.flatMap(letter => [letter.triggerAt, letter.expiresAt ?? ''])
      .map(value => Date.parse(value)).filter(time => time > now))
    if (Number.isFinite(next)) window.setTimeout(refreshAtNextDelivery, Math.min(2_147_483_647, next - now))
  }
  window.addEventListener('focus', render)
  refreshAtNextDelivery()
  return dialog
}
