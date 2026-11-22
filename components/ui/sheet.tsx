"use client";

import { Dialog as SheetPrimitive } from "radix-ui";
import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * A panel that slides in over the page. From shadcn/ui, cut down to the two
 * uses Ambrace has on a phone: the side panel from the left, and home's lists
 * of choices from the bottom, where a thumb already is.
 */
function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

const SIDES = {
  left: "inset-y-0 left-0 h-full max-w-[85vw] border-r data-open:slide-in-from-left data-closed:slide-out-to-left",
  bottom:
    "inset-x-0 bottom-0 max-h-[85dvh] rounded-t-3xl border-t data-open:slide-in-from-bottom data-closed:slide-out-to-bottom",
} as const;

function SheetContent({
  className,
  children,
  side = "left",
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: keyof typeof SIDES;
}) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay
        data-slot="sheet-overlay"
        className="fixed inset-0 z-50 bg-scrim duration-200 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 motion-reduce:animate-none"
      />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          "fixed z-50 flex flex-col border-border bg-popover text-sm text-popover-foreground shadow-lg duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] outline-none data-open:animate-in data-closed:animate-out data-closed:duration-200 motion-reduce:animate-none",
          SIDES[side],
          className,
        )}
        {...props}
      >
        {children}
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}

function SheetTitle({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return <SheetPrimitive.Title data-slot="sheet-title" {...props} />;
}

function SheetDescription({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description data-slot="sheet-description" {...props} />
  );
}

export { Sheet, SheetContent, SheetDescription, SheetTitle };
