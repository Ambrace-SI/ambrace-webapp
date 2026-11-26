import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Slot } from "radix-ui";

/**
 * The one button for the whole app. Every button is the same object: a pill
 * of glass, lit from above, that lifts on hover and is pushed in on a press,
 * so it always looks like something to press. A variant picks its colour
 * and nothing else; the look and the movement live in globals.css under
 * `[data-button]` (a marker menu and dialog wrappers leave alone, unlike
 * data-slot), keyed on `data-variant`.
 *
 *   default   Ink, lit. The main action when Ember would be too loud.
 *   ember     Ember, lit. The one action on a screen that moves a student
 *             forward. The label is Ink, never white (white on Ember is 2.8:1).
 *   glass     Frosted glass: back, close and menu buttons.
 *   outline   Frosted glass, the same as glass: every other action.
 *   secondary Frosted glass, the same as glass.
 *   destructive  Frosted glass with red words: delete, remove, leave.
 *   ghost     No glass until hovered: actions inside rows and lists.
 *   link      Words only.
 */
const buttonVariants = cva(
  "group/button relative inline-flex shrink-0 items-center justify-center rounded-full border border-transparent bg-clip-padding text-sm font-semibold whitespace-nowrap outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "text-primary-foreground",
        ember: "text-ember-foreground",
        glass: "text-foreground",
        outline: "text-foreground",
        secondary: "text-foreground",
        destructive: "text-destructive focus-visible:ring-destructive/30",
        ghost: "text-foreground",
        link: "font-medium text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-8 gap-1.5 px-3.5 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        xs: "h-6 gap-1 px-2.5 text-xs has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 px-3 text-[0.8rem] has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-4 has-data-[icon=inline-end]:pr-3.5 has-data-[icon=inline-start]:pl-3.5",
        icon: "size-8",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7",
        "icon-lg": "size-9",
        // 44px tall: comfortable for a thumb on a phone, which is where most
        // students will be. Used for every main form action.
        touch: "h-11 gap-2 px-5 text-base",
        "icon-touch": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-button=""
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
