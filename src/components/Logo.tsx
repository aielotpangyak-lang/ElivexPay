export default function Logo({ className = "w-20 h-20" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Background */}
      <rect width="100" height="100" rx="22" fill="url(#bg-gradient)" />
      
      {/* Dark 3D shadow for arrows */}
      <path d="M 16 52 C 16 30, 35 18, 65 20 L 58 12 L 80 22 L 55 34 L 62 26 C 38 24, 26 35, 26 52 Z" fill="#333333" />
      <path d="M 84 48 C 84 70, 65 82, 35 80 L 42 88 L 20 78 L 45 66 L 38 74 C 62 76, 74 65, 74 48 Z" fill="#333333" />

      {/* White top surface for arrows */}
      <path d="M 16 49 C 16 27, 35 15, 65 17 L 58 9 L 80 19 L 55 31 L 62 23 C 38 21, 26 32, 26 49 Z" fill="white" />
      <path d="M 84 51 C 84 73, 65 85, 35 83 L 42 91 L 20 81 L 45 69 L 38 77 C 62 79, 74 68, 74 51 Z" fill="white" />

      {/* Sparkles Top Left */}
      <path d="M 28 18 Q 30 23 35 25 Q 30 27 28 32 Q 26 27 21 25 Q 26 23 28 18 Z" fill="white" />
      <path d="M 40 20 Q 41 23 44 24 Q 41 25 40 28 Q 39 25 36 24 Q 39 23 40 20 Z" fill="white" />
      
      {/* Sparkles Bottom Right */}
      <path d="M 72 82 Q 70 77 65 75 Q 70 73 72 68 Q 74 73 79 75 Q 74 77 72 82 Z" fill="white" />
      <path d="M 60 80 Q 59 77 56 76 Q 59 75 60 72 Q 61 75 64 76 Q 61 77 60 80 Z" fill="white" />

      {/* Paper Airplane */}
      <g transform="translate(32, 36) scale(0.9)">
        <path d="M 0 15 L 12 20 L 35 0 L 0 15 Z" fill="white" stroke="#444" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M 12 20 L 16 32 L 35 0 Z" fill="#d4d4d4" stroke="#444" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M 12 20 L 20 16 L 35 0 Z" fill="#f0f0f0" stroke="#444" strokeWidth="1" strokeLinejoin="round" />
      </g>

      <defs>
        <linearGradient id="bg-gradient" x1="0" y1="0" x2="0" y2="100" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6b6b6b" />
          <stop offset="1" stopColor="#3f3f3f" />
        </linearGradient>
      </defs>
    </svg>
  );
}
