import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  focusable: false,
};

export const MenuIcon = (p: IconProps) => (
  <svg aria-hidden="true" {...base} {...p}>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

export const CloseIcon = (p: IconProps) => (
  <svg aria-hidden="true" {...base} {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export const ChevronDownIcon = (p: IconProps) => (
  <svg aria-hidden="true" {...base} {...p}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);

export const CheckIcon = (p: IconProps) => (
  <svg aria-hidden="true" {...base} {...p}>
    <path d="M5 13l4 4L19 7" />
  </svg>
);

export const BellIcon = (p: IconProps) => (
  <svg aria-hidden="true" {...base} {...p}>
    <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.7 21a2 2 0 01-3.4 0" />
  </svg>
);

export const BuildingIcon = (p: IconProps) => (
  <svg aria-hidden="true" {...base} {...p}>
    <path d="M3 21h18M5 21V5a2 2 0 012-2h6a2 2 0 012 2v16M15 21V9h4a2 2 0 012 2v10" />
    <path d="M8 7h2M8 11h2M8 15h2" />
  </svg>
);

export const UserIcon = (p: IconProps) => (
  <svg aria-hidden="true" {...base} {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0116 0" />
  </svg>
);

export const GlobeIcon = (p: IconProps) => (
  <svg aria-hidden="true" {...base} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" />
  </svg>
);

export const SunIcon = (p: IconProps) => (
  <svg aria-hidden="true" {...base} {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);

export const MoonIcon = (p: IconProps) => (
  <svg aria-hidden="true" {...base} {...p}>
    <path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" />
  </svg>
);

export const MonitorIcon = (p: IconProps) => (
  <svg aria-hidden="true" {...base} {...p}>
    <rect x="3" y="4" width="18" height="12" rx="2" />
    <path d="M8 20h8M12 16v4" />
  </svg>
);

export const AskIcon = (p: IconProps) => (
  <svg aria-hidden="true" {...base} {...p}>
    <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
  </svg>
);

export const AuditIcon = (p: IconProps) => (
  <svg aria-hidden="true" {...base} {...p}>
    <path d="M5 4h11l3 3v13H5z" />
    <path d="M9 9h6M9 13h6M9 17h4" />
  </svg>
);

export const SettingsIcon = (p: IconProps) => (
  <svg aria-hidden="true" {...base} {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" />
  </svg>
);

export const TransparencyIcon = (p: IconProps) => (
  <svg aria-hidden="true" {...base} {...p}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M3 9h18M9 3v18" />
  </svg>
);
