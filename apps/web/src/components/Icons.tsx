import React from "react";

type IconProps = { className?: string };

export function SearchIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M8.5 14.5a6 6 0 1 1 0-12 6 6 0 0 1 0 12Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M13.2 13.2 17 17"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ChevronDownIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M4.5 6.75 9 11.25l4.5-4.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CopyIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M6.25 5.25h7.5c.69 0 1.25.56 1.25 1.25v7.5c0 .69-.56 1.25-1.25 1.25h-7.5c-.69 0-1.25-.56-1.25-1.25v-7.5c0-.69.56-1.25 1.25-1.25Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M3.75 12.75h-.5c-.69 0-1.25-.56-1.25-1.25V3.75c0-.69.56-1.25 1.25-1.25H11.5c.69 0 1.25.56 1.25 1.25v.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function BookmarkIcon({ className, filled }: IconProps & { filled?: boolean }) {
  if (filled) {
    return (
      <svg
        className={className}
        width="18"
        height="18"
        viewBox="0 0 18 18"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M5 2.75h8c.69 0 1.25.56 1.25 1.25v11.5l-5.25-2.75L3.75 15.5V4c0-.69.56-1.25 1.25-1.25Z"
          fill="currentColor"
        />
      </svg>
    );
  }

  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M5 2.75h8c.69 0 1.25.56 1.25 1.25v11.5l-5.25-2.75L3.75 15.5V4c0-.69.56-1.25 1.25-1.25Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ImageIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M3.5 4.25h11c.69 0 1.25.56 1.25 1.25v7.25c0 .69-.56 1.25-1.25 1.25h-11c-.69 0-1.25-.56-1.25-1.25V5.5c0-.69.56-1.25 1.25-1.25Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M6.3 7.15a1.1 1.1 0 1 1 0-2.2 1.1 1.1 0 0 1 0 2.2Z"
        fill="currentColor"
      />
      <path
        d="M4.5 13l3.2-3.2 2.3 2.3 1.6-1.6L15.5 13"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}


