// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import GlobalError from "@/app/global-error";

/**
 * The last-resort page replaces the whole document, <html> included, so it is
 * tested alone: it is rendered as the document itself, not inside one.
 */
test("when the whole app fails, a self-contained page still offers a retry", () => {
  const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
  const fault = new Error("layout broke");
  const retry = vi.fn();

  render(<GlobalError error={fault} retry={retry} />, { container: document });

  expect(document.documentElement.lang).toBe("en");
  expect(document.title).toBe("Something went wrong · Ambrace");
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
    "Ambrace couldn't load",
  );
  // The student is never shown the technical detail.
  expect(screen.queryByText(/layout broke/)).toBeNull();
  expect(logged).toHaveBeenCalledWith(expect.any(String), fault);

  fireEvent.click(screen.getByRole("button", { name: "Try again" }));

  expect(retry).toHaveBeenCalledTimes(1);
});
