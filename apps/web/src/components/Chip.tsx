import React from "react";

export function Chip({
  active,
  onClick,
  children
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      data-active={active ? "true" : "false"}
      className="banana-chip"
      onClick={onClick}
    >
      {children}
    </button>
  );
}


