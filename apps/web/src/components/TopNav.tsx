import React from "react";

function BananaMark() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-8 w-8">
        <div className="absolute inset-0 rounded-full bg-[rgba(255,219,117,0.14)] blur-md" />
        <div className="relative grid h-8 w-8 place-items-center rounded-xl border border-banana-borderStrong bg-black/40 shadow-glow">
          <span className="text-lg leading-none">🍌</span>
        </div>
      </div>
      <div className="text-base font-semibold tracking-tight text-banana-fg">Banana Prompts</div>
    </div>
  );
}

function NavItem({
  active,
  children
}: {
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={[
        "flex items-center gap-2 rounded-xl px-3 py-2 text-sm",
        active
          ? "border border-banana-borderStrong bg-white/10 text-banana-fg shadow-glow"
          : "text-banana-muted hover:bg-white/5 hover:text-banana-fg"
      ].join(" ")}
    >
      {children}
    </div>
  );
}

export function TopNav() {
  return (
    <div className="sticky top-0 z-40 border-b border-banana-border bg-black/30 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <BananaMark />
        <div className="flex items-center gap-2">
          <NavItem active>
            <span className="opacity-80">◦</span>
            <span>Explore</span>
          </NavItem>
          <NavItem>
            <span className="opacity-80">◦</span>
            <span>Blog</span>
          </NavItem>
          <NavItem>
            <span className="opacity-80">◦</span>
            <span>Bookmarks</span>
          </NavItem>
        </div>
      </div>
    </div>
  );
}


