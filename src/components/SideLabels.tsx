/**
 * L and R at the sides of the picture: which side is the dancer's left and
 * right. Assumes the dancer faces the camera, so a plain video shows their
 * right on the left of the screen and a mirrored one shows it on the right
 * (like a studio mirror). Swaps whenever Mirror does.
 */
export function SideLabels({ mirror }: { mirror: boolean }) {
  const [left, right] = mirror ? (['L', 'R'] as const) : (['R', 'L'] as const)
  const name = { L: 'Dancer’s left', R: 'Dancer’s right' }
  return (
    <div className="side-labels" aria-hidden>
      <span className="side-labels__label side-labels__label--left mk-glass" title={name[left]}>
        {left}
      </span>
      <span className="side-labels__label side-labels__label--right mk-glass" title={name[right]}>
        {right}
      </span>
    </div>
  )
}
