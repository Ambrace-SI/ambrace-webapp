"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * Short messages that appear at the edge of the screen and leave by
 * themselves. From shadcn/ui. The app screens are always Paper, so the theme
 * is fixed to light and the colours come from the brand tokens.
 */
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="light"
      position="bottom-center"
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
}

export { Toaster };
