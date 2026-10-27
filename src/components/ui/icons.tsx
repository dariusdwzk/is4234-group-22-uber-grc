import type { ReactNode } from "react";

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export const IconCases = () => <Svg><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V4h6v3" /></Svg>;
export const IconReport = () => <Svg><path d="M6 3h9l4 4v14H6z" /><path d="M9 12h7M9 16h7" /></Svg>;
export const IconBoard = () => <Svg><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></Svg>;
export const IconFlag = () => <Svg><path d="M5 21V4M5 4h12l-2 4 2 4H5" /></Svg>;
export const IconLedger = () => <Svg><rect x="9" y="3" width="6" height="6" rx="1" /><rect x="3" y="15" width="6" height="6" rx="1" /><rect x="15" y="15" width="6" height="6" rx="1" /><path d="M12 9v3M6 15v-3h12v3" /></Svg>;
export const IconDemo = () => <Svg><path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3" /></Svg>;
export const IconAlert = () => <Svg><path d="M12 3 2 20h20z" /><path d="M12 10v4M12 17.5v.5" /></Svg>;
export const IconCheck = () => <Svg><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></Svg>;
export const IconInfo = () => <Svg><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8v.5" /></Svg>;
export const IconMenu = () => <Svg><path d="M4 6h16M4 12h16M4 18h16" /></Svg>;
