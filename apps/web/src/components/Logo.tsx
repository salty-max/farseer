/** The Farseer mark: a gilded eye with a blue, slit-pupil iris. */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="40 60 432 400" aria-hidden>
      <defs>
        <linearGradient id="lg-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe08a" />
          <stop offset="0.5" stopColor="#f8b700" />
          <stop offset="1" stopColor="#a86f00" />
        </linearGradient>
        <radialGradient id="lg-iris" cx="50%" cy="45%" r="55%">
          <stop offset="0" stopColor="#d8f4ff" />
          <stop offset="0.35" stopColor="#4cc3ff" />
          <stop offset="1" stopColor="#0a5fa8" />
        </radialGradient>
      </defs>
      <path
        d="M64 262 C 140 150, 372 150, 448 262 C 372 374, 140 374, 64 262 Z"
        fill="#0b0d12"
        stroke="url(#lg-gold)"
        strokeWidth="26"
        strokeLinejoin="round"
      />
      <circle cx="256" cy="262" r="74" fill="url(#lg-iris)" />
      <path d="M256 214 L 270 262 L 256 310 L 242 262 Z" fill="#0b0d12" />
      <path d="M256 70 L 272 132 L 256 120 L 240 132 Z" fill="url(#lg-gold)" />
      <path d="M150 104 L 188 152 L 170 150 L 162 164 Z" fill="url(#lg-gold)" />
      <path d="M362 104 L 324 152 L 342 150 L 350 164 Z" fill="url(#lg-gold)" />
    </svg>
  );
}
