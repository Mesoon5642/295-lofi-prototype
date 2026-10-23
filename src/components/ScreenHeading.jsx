import { useEffect, useRef } from 'react'

// Page heading that can take focus when a new screen opens, so keyboard and
// screen reader users start at the top of the new content.
export default function ScreenHeading({ children, focusOnMount = false, className = '' }) {
  const ref = useRef(null)
  useEffect(() => {
    if (focusOnMount) ref.current?.focus()
  }, [focusOnMount])
  return (
    <h1 ref={ref} tabIndex={-1} className={`screen-heading ${className}`.trim()}>
      {children}
    </h1>
  )
}
