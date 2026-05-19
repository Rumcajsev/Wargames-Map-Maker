import { useLayoutEffect, useRef, useState } from 'react'

export function useFlyoutTop(anchorY: number, margin = 8) {
  const ref = useRef<HTMLDivElement>(null)
  const [top, setTop] = useState(anchorY)

  useLayoutEffect(() => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const overflow = rect.bottom - (window.innerHeight - margin)
    setTop(overflow > 0 ? anchorY - overflow : anchorY)
  }, [anchorY])

  return { ref, top }
}
