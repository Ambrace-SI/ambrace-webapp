// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { AuthHeading, AuthShell } from "@/components/auth/auth-shell";
import { CodeField } from "@/components/auth/code-field";
import { GoogleButton, OrDivider } from "@/components/auth/google-button";
import { PasswordChecklist } from "@/components/auth/password-checklist";
import { Logo } from "@/components/brand/logo";
import { Orbit } from "@/components/brand/orbit";
import { WelcomeMark } from "@/components/brand/welcome-mark";
import { ChoiceChips } from "@/components/forms/choice-chips";
import {
  FormMessage,
  PasswordField,
  SubmitButton,
  TextField,
} from "@/components/forms/fields";
import { Button } from "@/components/ui/button";

vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    <span data-src={src}>{alt}</span>
  ),
}));

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  document.elementFromPoint = () => null;
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("a text field", () => {
  test("is found by its visible label", () => {
    render(<TextField label="Email" defaultValue="asha@example.com" />);

    expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe(
      "asha@example.com",
    );
  });

  test("ties its error to the input for screen readers and marks it invalid", () => {
    render(<TextField label="Email" error="Enter your email address." />);
    const input = screen.getByLabelText("Email");
    const error = screen.getByRole("alert");

    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe(error.id);
    expect(error.textContent).toBe("Enter your email address.");
  });

  test("shows its hint until there is an error to show instead", () => {
    const { rerender } = render(<TextField label="Name" hint="As you like." />);
    expect(screen.getByText("As you like.")).toBeTruthy();

    rerender(<TextField label="Name" hint="As you like." error="Required." />);
    expect(screen.queryByText("As you like.")).toBeNull();
  });

  test("an optional field says so", () => {
    render(<TextField label="School name" optional />);

    expect(screen.getByText("Optional")).toBeTruthy();
  });

  test("is tall enough for a thumb", () => {
    render(<TextField label="Email" />);

    expect(screen.getByLabelText("Email").className).toContain("h-11");
  });
});

describe("a password field", () => {
  test("hides the password until asked, and says which state it is in", async () => {
    render(<PasswordField label="Password" defaultValue="Secret123" />);
    const input = screen.getByLabelText("Password") as HTMLInputElement;
    const user = userEvent.setup();

    expect(input.type).toBe("password");
    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(input.type).toBe("text");
    const hide = screen.getByRole("button", { name: "Hide password" });
    expect(hide.getAttribute("aria-pressed")).toBe("true");
    await user.click(hide);
    expect(input.type).toBe("password");
  });

  test("the show button never submits the form", () => {
    render(<PasswordField label="Password" />);

    expect(
      screen
        .getByRole("button", { name: "Show password" })
        .getAttribute("type"),
    ).toBe("button");
  });

  test("reports its error under the field", () => {
    render(<PasswordField label="Password" error="Enter your password." />);

    expect(screen.getByLabelText("Password").getAttribute("aria-invalid")).toBe(
      "true",
    );
    expect(screen.getByRole("alert").textContent).toBe("Enter your password.");
  });
});

describe("a form message", () => {
  test("an error interrupts; a success or a note waits its turn", () => {
    render(
      <>
        <FormMessage tone="error">Wrong password</FormMessage>
        <FormMessage tone="success">Saved</FormMessage>
        <FormMessage tone="info">Code sent</FormMessage>
      </>,
    );

    expect(screen.getByRole("alert").textContent).toBe("Wrong password");
    expect(
      screen.getAllByRole("status").map((message) => message.textContent),
    ).toEqual(["Saved", "Code sent"]);
  });

  test("carries an icon as well as a colour", () => {
    render(<FormMessage tone="error">Wrong password</FormMessage>);

    expect(screen.getByRole("alert").querySelector("svg")).toBeTruthy();
  });
});

describe("the submit button", () => {
  test("says what it is doing and cannot be pressed again while busy", () => {
    render(
      <SubmitButton pending pendingLabel="Saving…">
        Save
      </SubmitButton>,
    );
    const button = screen.getByRole("button") as HTMLButtonElement;

    expect(button.textContent).toBe("Saving…");
    expect(button.disabled).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");
  });

  test("is an ordinary submit button when idle", () => {
    render(
      <SubmitButton pending={false} pendingLabel="Saving…">
        Save
      </SubmitButton>,
    );
    const button = screen.getByRole("button") as HTMLButtonElement;

    expect(button.textContent).toBe("Save");
    expect(button.type).toBe("submit");
    expect(button.disabled).toBe(false);
  });
});

describe("buttons", () => {
  test("the Ember button labels itself in Ink, never white", () => {
    render(<Button variant="ember">Continue</Button>);
    const classes = screen.getByRole("button").className;

    expect(classes).toContain("bg-ember");
    expect(classes).toContain("text-ember-foreground");
    expect(classes).not.toContain("text-white");
  });

  test("the touch size is 44px tall", () => {
    render(<Button size="touch">Continue</Button>);

    expect(screen.getByRole("button").className).toContain("h-11");
  });

  test("can lend its look to a link", () => {
    render(
      <Button asChild>
        <a href="#details">Details</a>
      </Button>,
    );

    expect(
      screen.getByRole("link", { name: "Details" }).getAttribute("href"),
    ).toBe("#details");
  });
});

describe("the password checklist", () => {
  test("ticks only the rules that are met, in words as well as colour", () => {
    render(<PasswordChecklist password="abcdefgh" />);
    const rules = within(screen.getByRole("list", { name: "Password rules" }))
      .getAllByRole("listitem")
      .map((rule) => rule.textContent);

    expect(rules).toEqual([
      "8+ characters (done)",
      "An uppercase letter (not yet)",
      "A lowercase letter (done)",
      "A number (not yet)",
    ]);
  });
});

describe("the confirmation code field", () => {
  function Harness({ onComplete }: { onComplete: (code: string) => void }) {
    const [code, setCode] = useState("");
    return (
      <CodeField value={code} onChange={setCode} onComplete={onComplete} />
    );
  }

  test("accepts six digits and reports when the code is complete", async () => {
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);
    const input = screen.getByLabelText(
      "Confirmation code",
    ) as HTMLInputElement;

    await userEvent.setup().type(input, "123456");

    expect(input.value).toBe("123456");
    expect(onComplete).toHaveBeenCalledWith("123456");
  });

  test("ignores letters and stops at six digits", async () => {
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);
    const input = screen.getByLabelText(
      "Confirmation code",
    ) as HTMLInputElement;

    await userEvent.setup().type(input, "12ab3456789");

    expect(input.value).toBe("123456");
  });

  test("a pasted code fills every box at once", async () => {
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);
    const input = screen.getByLabelText(
      "Confirmation code",
    ) as HTMLInputElement;

    input.focus();
    await userEvent.setup().paste("654321");

    expect(input.value).toBe("654321");
    expect(onComplete).toHaveBeenCalledWith("654321");
  });

  test("lets the phone offer the code from the email, with a number pad", () => {
    render(<CodeField value="" onChange={() => undefined} />);
    const input = screen.getByLabelText("Confirmation code");

    expect(input.getAttribute("autocomplete")).toBe("one-time-code");
    expect(input.getAttribute("inputmode")).toBe("numeric");
  });

  test("reports its error under the boxes", () => {
    render(
      <CodeField
        value=""
        onChange={() => undefined}
        error="That code isn't right."
      />,
    );

    expect(screen.getByRole("alert").textContent).toBe(
      "That code isn't right.",
    );
  });
});

describe("choice chips", () => {
  const OPTIONS = [
    { value: "a", label: "A" },
    { value: "b", label: "B" },
    { value: "c", label: "C" },
  ];

  function Chips({ optional = false }: { optional?: boolean }) {
    const [value, setValue] = useState<string | null>(null);
    return (
      <ChoiceChips
        legend="Pick one"
        options={OPTIONS}
        value={value}
        onChange={setValue}
        columns="grid-cols-3"
        optional={optional}
      />
    );
  }

  const checked = () =>
    screen
      .getAllByRole("radio")
      .map((chip) => chip.getAttribute("aria-checked"));

  test("only one can be chosen at a time", async () => {
    render(<Chips />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("radio", { name: "A" }));
    await user.click(screen.getByRole("radio", { name: "C" }));

    expect(checked()).toEqual(["false", "false", "true"]);
  });

  test("a required choice cannot be cleared by tapping it again", async () => {
    render(<Chips />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("radio", { name: "B" }));
    await user.click(screen.getByRole("radio", { name: "B" }));

    expect(checked()).toEqual(["false", "true", "false"]);
  });

  test("the group is one stop for the Tab key", () => {
    render(<Chips />);

    expect(
      screen.getAllByRole("radio").map((chip) => chip.getAttribute("tabindex")),
    ).toEqual(["0", "-1", "-1"]);
  });

  test("arrow keys move the choice both ways and wrap around", async () => {
    render(<Chips />);
    const user = userEvent.setup();

    screen.getByRole("radio", { name: "A" }).focus();
    await user.keyboard("{ArrowLeft}");
    expect(checked()).toEqual(["false", "false", "true"]);
    await user.keyboard("{ArrowDown}");
    expect(checked()).toEqual(["true", "false", "false"]);
    await user.keyboard("{ArrowUp}{ArrowRight}{ArrowRight}");
    expect(checked()).toEqual(["false", "true", "false"]);
  });

  test("other keys leave the choice alone", async () => {
    render(<Chips />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("radio", { name: "B" }));
    await user.keyboard("x{Home}");

    expect(checked()).toEqual(["false", "true", "false"]);
  });

  test("names its error for screen readers", () => {
    render(
      <ChoiceChips
        legend="Which class are you in?"
        options={OPTIONS}
        value={null}
        onChange={() => undefined}
        columns="grid-cols-3"
        error="Pick your class."
      />,
    );
    const error = screen.getByRole("alert");

    expect(screen.getByRole("group").getAttribute("aria-describedby")).toBe(
      error.id,
    );
  });
});

describe("the Google button", () => {
  test("shows that it is leaving for Google and cannot be pressed again", () => {
    render(<GoogleButton onClick={() => undefined} pending />);
    const button = screen.getByRole("button") as HTMLButtonElement;

    expect(button.textContent).toBe("Opening Google…");
    expect(button.disabled).toBe(true);
  });

  test("uses Google's own colours for its mark", () => {
    render(<GoogleButton onClick={() => undefined} pending={false} />);
    const fills = Array.from(
      screen.getByRole("button").querySelectorAll("path"),
    ).map((path) => path.getAttribute("fill"));

    expect(fills).toEqual(["#EA4335", "#4285F4", "#FBBC05", "#34A853"]);
  });

  test("can be held back while another action is running", async () => {
    const onClick = vi.fn();
    render(<GoogleButton onClick={onClick} pending={false} disabled />);

    await userEvent.setup().click(screen.getByRole("button"));

    expect(onClick).not.toHaveBeenCalled();
  });

  test("the divider reads as a separator", () => {
    render(<OrDivider label="or use email" />);

    expect(screen.getByRole("separator").textContent).toBe("or use email");
  });
});

describe("brand pieces", () => {
  test("the logo picks the colourway for the surface it sits on", () => {
    const { rerender } = render(<Logo surface="ink" />);
    expect(screen.getByText("Ambrace").getAttribute("data-src")).toBe(
      "/brand/ambrace-lowercase-horizontal-reversed.svg",
    );

    rerender(<Logo surface="paper" />);
    expect(screen.getByText("Ambrace").getAttribute("data-src")).toBe(
      "/brand/ambrace-lowercase-horizontal.svg",
    );
  });

  test("the wordmark alone, without the symbol, comes from the kit's wordmark files", () => {
    render(<Logo surface="paper" variant="wordmark" />);

    expect(screen.getByText("Ambrace").getAttribute("data-src")).toBe(
      "/brand/ambrace-lowercase-wordmark.svg",
    );
  });

  test("on a surface that follows the theme, it carries both colourways and is named once", () => {
    const { container } = render(<Logo surface="theme" />);

    expect(screen.getByRole("img", { name: "Ambrace" })).toBeTruthy();
    const files = [...container.querySelectorAll("[data-src]")];
    expect(files.map((file) => file.getAttribute("data-src"))).toEqual([
      "/brand/ambrace-lowercase-horizontal.svg",
      "/brand/ambrace-lowercase-horizontal-reversed.svg",
    ]);
  });

  test("the orbit is decoration, hidden from screen readers", () => {
    const { container } = render(<Orbit />);

    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe(
      "true",
    );
  });

  test("only the student's point is Ember, and only it breathes", () => {
    const { container } = render(<Orbit />);
    const ember = container.querySelectorAll('[fill="var(--ember)"]');

    expect(ember).toHaveLength(1);
    expect(ember[0].getAttribute("class")).toContain("animate-breathe");
    expect(container.querySelectorAll(".animate-breathe")).toHaveLength(1);
  });

  test("the inner orbit is drawn in the muted tone, so it shows on every surface", () => {
    const { container } = render(<Orbit />);
    const ring = container.querySelector('circle[r="20"]');

    expect(ring?.getAttribute("stroke")).toBe("var(--muted-foreground)");
  });

  test("the orbit can be held still", () => {
    const { container } = render(<Orbit breathing={false} />);

    expect(container.querySelector(".animate-breathe")).toBeNull();
  });
});

describe("the welcome mark", () => {
  test("is decoration, hidden from screen readers", () => {
    const { container } = render(<WelcomeMark />);

    expect(container.firstElementChild?.getAttribute("aria-hidden")).toBe(
      "true",
    );
  });

  test("greets once, then only the student's point keeps moving", () => {
    const { container } = render(<WelcomeMark />);
    const ember = container.querySelectorAll('[fill="var(--ember)"]');

    expect(container.querySelectorAll(".animate-greet-left")).toHaveLength(1);
    expect(container.querySelectorAll(".animate-greet-right")).toHaveLength(1);
    expect(container.querySelectorAll(".animate-arrive")).toHaveLength(1);
    expect(ember).toHaveLength(1);
    expect(ember[0].getAttribute("class")).toContain("animate-breathe");
  });

  test("draws its inner orbit in the muted tone", () => {
    const { container } = render(<WelcomeMark />);

    expect(
      container.querySelector('circle[r="20"]')?.getAttribute("stroke"),
    ).toBe("var(--muted-foreground)");
  });
});

describe("the signed-out frame", () => {
  const renderShell = () =>
    render(
      <AuthShell>
        <p>The form</p>
      </AuthShell>,
    );

  test("follows the student's theme, and holds the form in the page's main region", () => {
    const { container } = renderShell();

    // Not forced to Ink any more: Paper or Ink, as the student chose.
    expect(container.firstElementChild?.className).not.toMatch(/\bdark\b/);
    expect(within(screen.getByRole("main")).getByText("The form")).toBeTruthy();
  });

  test("the form sits in a quiet glass card", () => {
    renderShell();

    const card = screen.getByText("The form").closest("[data-slot=auth-card]");
    expect(card).toBeTruthy();
    // The card is inside the main region, so the form is still found there.
    expect(screen.getByRole("main").contains(card)).toBe(true);
  });

  test("is headed by the text-only wordmark, in both colourways", () => {
    const { container } = renderShell();

    expect(screen.getByRole("img", { name: "Ambrace" })).toBeTruthy();
    expect(
      [...container.querySelectorAll("[data-src]")].map((file) =>
        file.getAttribute("data-src"),
      ),
    ).toEqual([
      "/brand/ambrace-lowercase-wordmark.svg",
      "/brand/ambrace-lowercase-wordmark-reversed.svg",
    ]);
  });

  test("greets with the animated mark and the new words, once each", () => {
    const { container } = renderShell();

    expect(container.querySelectorAll(".animate-greet-left")).toHaveLength(1);
    expect(screen.getAllByText("Learn differently.")).toHaveLength(1);
    expect(
      screen.getAllByText(
        "Spend 10 minutes a day with Ambrace, and discover how you learn best.",
      ),
    ).toHaveLength(1);
    // The form's own title stays the page's one top-level heading.
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  });

  test("signs off with the company's name at the foot", () => {
    renderShell();

    expect(screen.getByRole("contentinfo").textContent).toBe(
      "Ambrace Super Intelligence",
    );
  });

  test("has no Ember button: the student has not arrived yet", () => {
    const { container } = render(
      <AuthShell>
        <p>The form</p>
      </AuthShell>,
    );

    expect(container.querySelector(".bg-ember")).toBeNull();
  });

  test("a heading gives the screen its one top-level title", () => {
    render(<AuthHeading title="Welcome back" description="Sign in." />);

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "Welcome back",
    );
    expect(screen.getByText("Sign in.")).toBeTruthy();
  });
});
