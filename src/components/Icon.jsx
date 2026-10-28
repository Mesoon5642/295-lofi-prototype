// Simple line icons. Always decorative: the text next to the icon is the label.

const PATHS = {
  back: <path d="M15.5 5l-7 7 7 7" />,
  help: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7v.5" />
      <circle cx="12" cy="17.5" r="0.8" fill="currentColor" />
    </>
  ),
  play: <path d="M8 5l11 7-11 7z" fill="currentColor" />,
  people: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M16.5 14.2c2.9.3 5 2.3 5 5.8" />
    </>
  ),
  speaker: (
    <>
      <path d="M3.5 9h4l5-4v14l-5-4h-4z" fill="currentColor" />
      <path d="M16 9a4 4 0 0 1 0 6" />
      <path d="M18.5 6.5a7.5 7.5 0 0 1 0 11" />
    </>
  ),
  muted: (
    <>
      <path d="M3.5 9h4l5-4v14l-5-4h-4z" fill="currentColor" />
      <path d="M15.5 9.5l5 5M20.5 9.5l-5 5" />
    </>
  ),
  pause: (
    <>
      <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" />
      <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" />
    </>
  ),
  next: <path d="M5 12h13M13 6l6 6-6 6" />,
  check: <path d="M5 12.5l4.5 4.5L19 7" />,
  retry: <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3L4.5 8.5M4.5 4v4.5H9" />,
  home: <path d="M3 11l9-7 9 7M5.5 9.5V20h13V9.5M10 20v-5h4v5" />,
  star: (
    <path
      d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"
      fill="currentColor"
    />
  ),
  flag: <path d="M6 21V4M6 4h12l-2.5 4 2.5 4H6" />,
  bulb: (
    <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" />
  ),
  text: <path d="M3 19l5-14 5 14M5 14h6M14 19l3.5-9 3.5 9M15.2 16h4.6" />,
  chat: <path d="M4 5h16v11H9l-5 4z" />,
  trash: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  sliders: (
    <>
      <path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" />
      <circle cx="15" cy="6" r="2" />
      <circle cx="9" cy="12" r="2" />
      <circle cx="17" cy="18" r="2" />
    </>
  ),
}

export default function Icon({ name, size = 28 }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  )
}
