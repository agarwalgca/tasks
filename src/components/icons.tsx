interface IconProps {
  className?: string
  size?: number
}

function Svg({
  className,
  size = 16,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export const CheckIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m5 12.5 4.5 4.5L19 7" />
  </Svg>
)

export const InboxIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 13h4l2 3h4l2-3h4" />
    <path d="M5.5 5h13l1.5 8v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-4Z" />
  </Svg>
)

export const SunIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
  </Svg>
)

export const CalendarIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </Svg>
)

export const StackIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 8h16M4 12h16M4 16h16" />
  </Svg>
)

export const ArchiveIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="4" width="18" height="4" rx="1" />
    <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4" />
  </Svg>
)

export const ListIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />
  </Svg>
)

export const PlusIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
)

export const ChevronIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m9 6 6 6-6 6" />
  </Svg>
)

export const CloseIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
)

export const MenuIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Svg>
)

export const TrashIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13M10 11v6M14 11v6" />
  </Svg>
)

export const TagIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 12V4h8l9 9-8 8-9-9Z" />
    <circle cx="7.5" cy="7.5" r="1.2" />
  </Svg>
)

export const DownloadIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 4v11M8 11l4 4 4-4M4 19h16" />
  </Svg>
)

export const CloudIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 18a4 4 0 0 1-.5-7.97A5.5 5.5 0 0 1 17.5 10 3.5 3.5 0 0 1 17 18Z" />
  </Svg>
)

export const CloudOffIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 18a4 4 0 0 1-.5-7.97A5.5 5.5 0 0 1 12 6M17 18a3.5 3.5 0 0 0 .5-6.96" />
    <path d="M3 3l18 18" />
  </Svg>
)

export const AlertIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 4 2.5 20h19L12 4Z" />
    <path d="M12 10v4M12 17.5h.01" />
  </Svg>
)

export const SyncIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20 11a8 8 0 0 0-14.3-4.9M4 13a8 8 0 0 0 14.3 4.9" />
    <path d="M20 4v4h-4M4 20v-4h4" />
  </Svg>
)

export const SettingsIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" />
  </Svg>
)

export const NoteIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 4h14v16H5zM8 9h8M8 13h8M8 17h5" />
  </Svg>
)

export const RepeatIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 9a4 4 0 0 1 4-4h11M4 9l3-3M4 9l3 3" />
    <path d="M20 15a4 4 0 0 1-4 4H5M20 15l-3-3M20 15l-3 3" />
  </Svg>
)
