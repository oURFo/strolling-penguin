import type {Penguin} from './penguin'
import {PENGUIN_STYLES, RESEARCH_RARITIES, rollResearch} from './penguin-styles'

export function setupResearch(team: () => Penguin[], portrait: (member: Penguin, leader: boolean) => string,
  exchange: (selected: ReadonlySet<Penguin>, style: number) => Penguin | undefined) {
  const dialog = document.querySelector<HTMLDialogElement>('#penguin-research')!
  const list = dialog.querySelector<HTMLElement>('#research-team')!
  const result = dialog.querySelector<HTMLElement>('#research-result')!
  const status = dialog.querySelector<HTMLElement>('#research-status')!
  const start = dialog.querySelector<HTMLButtonElement>('#start-research')!
  const close = dialog.querySelector<HTMLButtonElement>('#close-research')!
  const rates = dialog.querySelector('#research-rates')!
  const selected = new Set<Penguin>()
  const options = new Map<Penguin, HTMLButtonElement>()
  const candidates = () => team().slice(1).filter(member => member.species === 'penguin')
  let working = false

  function label(member: Penguin) {
    return PENGUIN_STYLES[(member.snapshot().style ?? 0) - 1]?.name ?? '企鵝'
  }

  for (const tier of RESEARCH_RARITIES) {
    const line = document.createElement('li')
    const title = document.createElement('strong')
    title.textContent = `${tier.name} ${tier.chance}%（每款約 ${Number((tier.chance / tier.styles.length).toFixed(2))}%）`
    const designs = document.createElement('span')
    designs.textContent = tier.styles.map(id => PENGUIN_STYLES[id - 1].name).join('、')
    line.append(title, designs)
    rates.append(line)
  }

  function updateSelection() {
    start.disabled = working || selected.size !== 5
    close.disabled = working
    for (const [member, button] of options) {
      const picked = selected.has(member)
      button.disabled = working || (selected.size === 5 && !picked)
      button.setAttribute('aria-pressed', String(picked))
    }
  }

  function renderTeam() {
    list.replaceChildren()
    options.clear()
    for (const [index, member] of candidates().entries()) {
      const row = document.createElement('li')
      const button = document.createElement('button')
      const image = new Image()
      const name = document.createElement('span')
      button.type = 'button'
      image.alt = ''
      image.src = portrait(member, false)
      name.textContent = `${index + 1} · ${label(member)}`
      button.append(image, name)
      button.onclick = () => {
        if (working) return
        if (selected.has(member)) selected.delete(member)
        else if (selected.size < 5) selected.add(member)
        result.hidden = true
        status.textContent = `已選 ${selected.size} / 5 隻企鵝。研究完成後，選中的企鵝會離隊。`
        updateSelection()
      }
      row.append(button)
      list.append(row)
      options.set(member, button)
    }
    updateSelection()
  }

  dialog.addEventListener('cancel', event => {
    if (working) event.preventDefault()
  })
  start.onclick = async () => {
    if (working || selected.size !== 5) return
    working = true
    result.hidden = true
    status.textContent = '實驗進行中…'
    dialog.classList.add('research-running')
    updateSelection()
    await new Promise(resolve => window.setTimeout(resolve, 1500))
    dialog.classList.remove('research-running')
    const reward = rollResearch()
    const newMember = exchange(selected, reward.style)
    working = false
    if (!newMember) {
      status.textContent = '研究結果未能儲存，隊伍已保留。'
      updateSelection()
      return
    }
    selected.clear()
    renderTeam()
    const image = new Image()
    image.alt = ''
    image.src = portrait(newMember, false)
    const name = document.createElement('strong')
    name.textContent = `${reward.rarity} · ${PENGUIN_STYLES[reward.style - 1].name}`
    result.replaceChildren(image, name)
    result.hidden = false
    status.textContent = `${PENGUIN_STYLES[reward.style - 1].name}已加入隊伍。`
    close.focus()
  }
  return {
    dialog,
    open() {
      selected.clear()
      result.hidden = true
      status.textContent = candidates().length < 5 ? '隊伍中需要 5 隻可供研究的企鵝。領隊會留在隊伍。'
        : '選擇 5 隻企鵝。研究完成後，選中的企鵝會離隊，並有一隻新企鵝加入。'
      renderTeam()
      dialog.showModal()
    },
  }
}
