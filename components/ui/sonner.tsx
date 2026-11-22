"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

import { useTheme } from "@/lib/hooks/use-theme";

/**
 * Short messages that appear at the edge of the screen and leave by
 * themselves. From shadcn/ui. They follow the student's theme, and their
 * colours come from the brand tokens, so they match the page in both.
 */
function Toaster(props: ToasterProps) {
  const { resolved } = useTheme();

  return (
    <Sonner
      theme={resolved}
      position="top-center"
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
