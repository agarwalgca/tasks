import { BRAND } from '@/lib/brand'

/**
 * A slip of paper: the accent tile with its top corner folded over, and a check.
 * Drawn in theme tokens so it follows light and dark; the favicon and PWA icons
 * are fixed-colour renderings of the same shape.
 */
export function LogoMark({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M14 0H47L64 17V50A14 14 0 0 1 50 64H14A14 14 0 0 1 0 50V14A14 14 0 0 1 14 0Z"
        fill="rgb(var(--accent))"
      />
      <path d="M47 0V12A5 5 0 0 0 52 17H64Z" fill="rgb(var(--accent-fg) / 0.38)" />
      <path
        d="M17.5 33.5L27 43L46 23.5"
        fill="none"
        stroke="rgb(var(--accent-fg))"
        strokeWidth="6.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Mark plus name, and optionally the owner underneath. */
export function Wordmark({
  size = 22,
  withOwner = false,
  className = '',
}: {
  size?: number
  withOwner?: boolean
  className?: string
}) {
  return (
    <span className={`inline-flex min-w-0 items-center gap-2 ${className}`}>
      <LogoMark size={size} className="shrink-0" />
      <span className="flex min-w-0 flex-col leading-tight">
        <span
          className="font-semibold tracking-tight text-ink"
          style={{ fontSize: `${Math.round(size * 0.68)}px` }}
        >
          {BRAND.name}
        </span>
        {withOwner && (
          <span className="truncate text-2xs text-muted">{BRAND.owner}</span>
        )}
      </span>
    </span>
  )
}
