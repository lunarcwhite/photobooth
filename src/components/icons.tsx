"use client";

interface IconProps {
  size?: number;
  className?: string;
  strokeWidth?: number;
}

function Base({
  size = 20,
  className = "",
  strokeWidth = 1.5,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

export const CameraIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 8h3l2-2.2h6L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
    <circle cx="12" cy="13.5" r="3.4" />
  </Base>
);

export const MicIcon = (p: IconProps) => (
  <Base {...p}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3.5" />
  </Base>
);

export const MicOffIcon = (p: IconProps) => (
  <Base {...p}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3.5M4 4l16 16" />
  </Base>
);

export const MirrorIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 3.5v17" />
    <path d="M8.5 8 4.5 12l4 4M15.5 8l4 4-4 4" />
  </Base>
);

export const RatioIcon = (p: IconProps) => (
  <Base {...p}>
    <rect x="6.5" y="4" width="11" height="16" rx="1.5" />
    <path d="M6.5 9h11M6.5 15h11" strokeDasharray="2 2" />
  </Base>
);

export const DownloadIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 4v10.5m0 0-4-4m4 4 4-4M4.5 20h15" />
  </Base>
);

export const ShareIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="6" cy="12" r="2.6" />
    <circle cx="17.5" cy="5.8" r="2.6" />
    <circle cx="17.5" cy="18.2" r="2.6" />
    <path d="m8.3 10.8 6.9-3.8M8.3 13.2l6.9 3.8" />
  </Base>
);

export const RefreshIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M20 5v5h-5M4 19v-5h5" />
    <path d="M5.5 10a8 8 0 0 1 13-3.4L20 10M18.5 14a8 8 0 0 1-13 3.4L4 14" />
  </Base>
);

export const CopyIcon = (p: IconProps) => (
  <Base {...p}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5.5 15v-9.5a2 2 0 0 1 2-2H17" />
  </Base>
);

export const CheckIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="m4.5 12.5 5 5L19.5 7" />
  </Base>
);

export const BackIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M19 12H5m0 0 6-6m-6 6 6 6" />
  </Base>
);

export const FilmIcon = (p: IconProps) => (
  <Base {...p}>
    <rect x="4" y="4.5" width="16" height="15" rx="2" />
    <path d="M8.5 4.5v15M15.5 4.5v15M4 9.5h4.5M4 14.5h4.5M15.5 9.5H20M15.5 14.5H20" />
  </Base>
);

export const UserIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="8" r="3.4" />
    <path d="M5 20a7 7 0 0 1 14 0" />
  </Base>
);

export const ClockIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8.3" />
    <path d="M12 7.5V12l3.3 2" />
  </Base>
);

export const AlertIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 4.5 3 20h18L12 4.5Z" />
    <path d="M12 10v4.2m0 2.8v.3" />
  </Base>
);

export const LockIcon = (p: IconProps) => (
  <Base {...p}>
    <rect x="5.5" y="10.5" width="13" height="9.5" rx="2" />
    <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
  </Base>
);
