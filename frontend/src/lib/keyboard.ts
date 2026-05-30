// Returns true when the event target is an interactive element that handles
// its own keyboard input — global shortcuts must not fire in this case.
export function shouldSuppressShortcut(e: KeyboardEvent): boolean {
  const target = e.target as HTMLElement
  const tag = target.tagName
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    tag === 'BUTTON' ||
    target.isContentEditable
  )
}
