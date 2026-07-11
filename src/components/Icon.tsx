interface IconProps {
  /** SVG path data from @mdi/js (Material Design Icons). */
  path: string
  size?: number
  className?: string
}

/** Renders a Material Design Icon inline; decorative — pair with aria-label on the control. */
export function Icon({ path, size = 20, className }: IconProps) {
  return (
    <svg
      className={className ? `icon ${className}` : 'icon'}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <path d={path} fill="currentColor" />
    </svg>
  )
}
