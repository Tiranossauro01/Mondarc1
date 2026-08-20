import { cn } from '@/lib/utils';

// LOGO 1: Symbol only — circular arrows with "m" inside
// Used in: sidebar, favicon, mobile header, compact spaces
export function LogoSymbol({ className, size = 40 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Circular arrows */}
      <path
        d="M50 8C27.9 8 10 25.9 10 48c0 13.2 6.4 24.9 16.3 32.3"
        stroke="url(#mondarc-grad-sym)"
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M26.3 80.3L34 82l-1.2-8"
        stroke="url(#mondarc-grad-sym)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M50 92C72.1 92 90 74.1 90 52c0-13.2-6.4-24.9-16.3-32.3"
        stroke="url(#mondarc-grad-sym)"
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M73.7 19.7L66 18l1.2 8"
        stroke="url(#mondarc-grad-sym)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* "m" letter */}
      <text
        x="50"
        y="62"
        textAnchor="middle"
        fontSize="42"
        fontWeight="700"
        fill="url(#mondarc-grad-sym)"
        fontFamily="Inter, system-ui, sans-serif"
      >
        m
      </text>
      <defs>
        <linearGradient id="mondarc-grad-sym" x1="10" y1="8" x2="90" y2="92" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0B7EC4" />
          <stop offset="1" stopColor="#2FBFAE" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// LOGO 2: Full logo — symbol + "mondarc" text + "AR CONDICIONADO" subtitle
// Used in: reports, print headers, large spaces
export function LogoFull({ className, showText = true }: { className?: string; showText?: boolean }) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <LogoSymbol size={48} />
      {showText && (
        <div className="leading-none">
          <p className="text-2xl font-bold tracking-tight text-ink">mondarc</p>
          <p className="text-[0.65rem] font-semibold tracking-[0.2em] text-ink-soft uppercase mt-0.5">
            Ar Condicionado
          </p>
        </div>
      )}
    </div>
  );
}
