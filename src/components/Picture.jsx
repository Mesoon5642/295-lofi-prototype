// Friendly inline illustrations keyed by pictureId. No words appear inside
// the pictures, and the accessible name never reveals the answer.

function Cat() {
  return (
    <>
      <rect width="200" height="200" rx="28" fill="#efe9f8" />
      {/* Tail: a wider dark stroke underneath gives it the same outline as the body. */}
      <path d="M146 172 Q188 150 170 112" stroke="#8a4b14" strokeWidth="22" strokeLinecap="round" fill="none" />
      <path d="M146 172 Q188 150 170 112" stroke="#f0a04b" strokeWidth="14" strokeLinecap="round" fill="none" />
      <ellipse cx="100" cy="168" rx="52" ry="26" fill="#f0a04b" stroke="#8a4b14" strokeWidth="4" />
      <polygon points="52,80 60,26 96,56" fill="#f0a04b" stroke="#8a4b14" strokeWidth="4" strokeLinejoin="round" />
      <polygon points="148,80 140,26 104,56" fill="#f0a04b" stroke="#8a4b14" strokeWidth="4" strokeLinejoin="round" />
      <polygon points="64,66 66,40 84,56" fill="#f6b7c1" />
      <polygon points="136,66 134,40 116,56" fill="#f6b7c1" />
      <circle cx="100" cy="104" r="54" fill="#f0a04b" stroke="#8a4b14" strokeWidth="4" />
      <path d="M100 52v14M86 55l4 12M114 55l-4 12" stroke="#c56d1c" strokeWidth="5" strokeLinecap="round" />
      <ellipse cx="80" cy="98" rx="7" ry="11" fill="#2b2b2b" />
      <ellipse cx="120" cy="98" rx="7" ry="11" fill="#2b2b2b" />
      <circle cx="82" cy="94" r="2.5" fill="#fff" />
      <circle cx="122" cy="94" r="2.5" fill="#fff" />
      <polygon points="91,114 109,114 100,124" fill="#e5787f" strokeLinejoin="round" />
      <path d="M100 124q0 9-11 10M100 124q0 9 11 10" stroke="#5a3310" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M82 118L38 108M82 124L38 128M118 118L162 108M118 124L162 128" stroke="#5a3310" strokeWidth="3" strokeLinecap="round" />
    </>
  )
}

function Dog() {
  return (
    <>
      <rect width="200" height="200" rx="28" fill="#fbf3dc" />
      {/* Body sits behind the head so the collar has a neck to wrap around. */}
      <ellipse cx="100" cy="170" rx="48" ry="26" fill="#b07a4a" stroke="#5e3b1d" strokeWidth="4" />
      <rect x="66" y="153" width="68" height="12" rx="6" fill="#2f6fb3" />
      <circle cx="100" cy="172" r="7" fill="#f2c230" stroke="#9a7a00" strokeWidth="2" />
      <ellipse cx="100" cy="104" rx="50" ry="52" fill="#b07a4a" stroke="#5e3b1d" strokeWidth="4" />
      <ellipse cx="52" cy="100" rx="18" ry="40" fill="#6e4524" stroke="#5e3b1d" strokeWidth="4" transform="rotate(16 52 100)" />
      <ellipse cx="148" cy="100" rx="18" ry="40" fill="#6e4524" stroke="#5e3b1d" strokeWidth="4" transform="rotate(-16 148 100)" />
      <ellipse cx="121" cy="86" rx="15" ry="13" fill="#8a5a32" />
      <circle cx="80" cy="90" r="7.5" fill="#2b2b2b" />
      <circle cx="120" cy="90" r="7.5" fill="#2b2b2b" />
      <circle cx="82" cy="87" r="2.5" fill="#fff" />
      <circle cx="122" cy="87" r="2.5" fill="#fff" />
      <ellipse cx="100" cy="130" rx="30" ry="23" fill="#f1d9b5" />
      {/* Tongue starts under the mouth line so it hangs from the mouth. */}
      <path d="M92 137q8 20 16 0z" fill="#e5787f" />
      <path d="M100 124v10M100 134q-10 9-19 1M100 134q10 9 19 1" stroke="#2b2b2b" strokeWidth="3" fill="none" strokeLinecap="round" />
      <ellipse cx="100" cy="118" rx="13" ry="9" fill="#2b2b2b" />
    </>
  )
}

const SUN_RAYS = [0, 45, 90, 135, 180, 225, 270, 315]

function Sun() {
  return (
    <>
      <rect width="200" height="200" rx="28" fill="#dcefff" />
      <g stroke="#f2a516" strokeWidth="10" strokeLinecap="round">
        {SUN_RAYS.map((deg) => {
          const rad = (deg * Math.PI) / 180
          return (
            <line
              key={deg}
              x1={100 + Math.cos(rad) * 62}
              y1={100 + Math.sin(rad) * 62}
              x2={100 + Math.cos(rad) * 86}
              y2={100 + Math.sin(rad) * 86}
            />
          )
        })}
      </g>
      <circle cx="100" cy="100" r="48" fill="#ffd23f" stroke="#f2a516" strokeWidth="5" />
      <circle cx="84" cy="94" r="5" fill="#8a5a00" />
      <circle cx="116" cy="94" r="5" fill="#8a5a00" />
      <circle cx="74" cy="110" r="6" fill="#f7a8a0" />
      <circle cx="126" cy="110" r="6" fill="#f7a8a0" />
      <path d="M82 112q18 18 36 0" stroke="#8a5a00" strokeWidth="4" fill="none" strokeLinecap="round" />
    </>
  )
}

function Hat() {
  return (
    <>
      <rect width="200" height="200" rx="28" fill="#fde9df" />
      <ellipse cx="100" cy="152" rx="74" ry="17" fill="#2e3a59" stroke="#1b2338" strokeWidth="4" />
      {/* Crown base and band curve like the brim, so the crown sits on it in perspective. */}
      <path d="M58 54v96a42 9 0 0 0 84 0V54z" fill="#3b4a70" stroke="#1b2338" strokeWidth="4" strokeLinejoin="round" />
      <ellipse cx="100" cy="54" rx="42" ry="9" fill="#46557d" stroke="#1b2338" strokeWidth="4" />
      <path d="M60 118a40 8 0 0 0 80 0v20a40 8 0 0 1-80 0z" fill="#c8553d" />
      <rect x="70" y="66" width="10" height="46" rx="5" fill="#5a6a94" />
      <circle cx="124" cy="134" r="7" fill="#ffd23f" />
    </>
  )
}

function Bus() {
  return (
    <>
      <rect width="200" height="200" rx="28" fill="#e3f2ea" />
      {/* Road top (y=162) touches the bottom of the wheels. */}
      <rect x="12" y="162" width="176" height="7" rx="3.5" fill="#9aa5b1" />
      <rect x="20" y="56" width="160" height="90" rx="14" fill="#f7c33c" stroke="#9a6b00" strokeWidth="4" />
      {/* Stripe goes under the windows and door, inside the body outline. */}
      <rect x="22" y="108" width="130" height="7" fill="#3a3a3a" />
      {[32, 62, 92, 122].map((x) => (
        <rect key={x} x={x} y="68" width="24" height="28" rx="4" fill="#cfe8f7" stroke="#6b5300" strokeWidth="2.5" />
      ))}
      <rect x="152" y="68" width="18" height="60" rx="3" fill="#cfe8f7" stroke="#6b5300" strokeWidth="2.5" />
      <circle cx="170" cy="136" r="4" fill="#fff6c2" stroke="#6b5300" strokeWidth="2" />
      <circle cx="58" cy="146" r="16" fill="#2b2b2b" />
      <circle cx="58" cy="146" r="6" fill="#c3ccd6" />
      <circle cx="142" cy="146" r="16" fill="#2b2b2b" />
      <circle cx="142" cy="146" r="6" fill="#c3ccd6" />
    </>
  )
}

const PICTURES = { cat: Cat, dog: Dog, sun: Sun, hat: Hat, bus: Bus }

export default function Picture({ pictureId, decorative = false, className = '' }) {
  const Drawing = PICTURES[pictureId]
  const a11y = decorative
    ? { 'aria-hidden': 'true', focusable: 'false' }
    : { role: 'img', 'aria-label': 'Mystery picture' }
  return (
    <svg
      className={`picture ${className}`.trim()}
      viewBox="0 0 200 200"
      {...a11y}
    >
      {Drawing ? <Drawing /> : <rect width="200" height="200" rx="28" fill="#eef1f4" />}
    </svg>
  )
}
