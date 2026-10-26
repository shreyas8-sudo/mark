// Which first-visit coach marks are done: one set per mode, shown once each.
// Per-viewer convenience, so localStorage is fine; every access is guarded
// (private mode, blocked storage).
export type CoachMode = 'learn' | 'rehearse'

const KEYS: Record<CoachMode, string> = {
  learn: 'mark.coachmarks.done', // the v2 key, so anyone who saw Learn's tips isn't shown them again
  rehearse: 'mark.coachmarks.rehearse.done',
}

export function coachMarksDone(mode: CoachMode) {
  try {
    return localStorage.getItem(KEYS[mode]) === '1'
  } catch {
    return false // storage blocked: they'll simply show again next time
  }
}

/** Done with `modes` (finishing a set marks that mode; Skip marks both). */
export function markCoachMarksDone(...modes: CoachMode[]) {
  try {
    for (const mode of modes) localStorage.setItem(KEYS[mode], '1')
  } catch {
    // storage blocked; nothing else to do
  }
}
