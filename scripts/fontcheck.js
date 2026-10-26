// Paste into the devtools console (desktop, or Safari Web Inspector attached
// to an iPhone) on any screen. Lists every visible text node whose family
// isn't Manrope / Geist Mono, or any character those fonts don't draw:
// each glyph is measured with two different fallbacks, so a difference
// means a fallback face drew it. `bad: []` means no fallback on screen.
(() => {
  const OK = ['manrope', 'geist mono']
  const ctx = document.createElement('canvas').getContext('2d')
  const bad = [], seen = new Set()
  let nodes = 0
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let n; (n = walker.nextNode()); ) {
    const text = n.textContent.replace(/\s+/g, '')
    if (!text) continue
    const el = n.parentElement
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden') continue
    nodes++
    const fam = cs.fontFamily.split(',')[0].trim().replace(/["']/g, '')
    if (!OK.includes(fam.toLowerCase())) { bad.push({ text: text.slice(0, 30), why: 'family ' + cs.fontFamily }); continue }
    for (const ch of new Set(text)) {
      const key = fam + cs.fontWeight + cs.fontStyle + ch
      if (seen.has(key)) continue
      seen.add(key)
      const base = `${cs.fontStyle} ${cs.fontWeight} 48px "${fam}"`
      ctx.font = base + ', serif'; const a = ctx.measureText(ch.repeat(4)).width
      ctx.font = base + ', monospace'; const b = ctx.measureText(ch.repeat(4)).width
      if (Math.abs(a - b) > 0.01) bad.push({ text: text.slice(0, 30), why: `fallback for "${ch}" (${fam} ${cs.fontWeight})` })
    }
  }
  const faces = [...document.fonts].filter((f) => f.status === 'loaded').map((f) => `${f.family.replace(/["']/g, '')} ${f.weight}`)
  return { nodes, bad, loadedFaces: [...new Set(faces)] }
})()
