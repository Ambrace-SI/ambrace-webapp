import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

vi.mock("next/font/google", () => {
  const font = (name: string) => () => ({ variable: `font-${name}` });
  return {
    Sora: font("sora"),
    Inter: font("inter"),
    JetBrains_Mono: font("mono"),
    Noto_Sans_Devanagari: font("devanagari"),
  };
});
vi.mock("@/components/providers/app-providers", () => ({
  AppProviders: ({ children }: { children: React.ReactNode }) => (
    <div data-providers="">{children}</div>
  ),
}));
vi.mock("@/app/globals.css", () => ({}));

import RootLayout, { metadata, viewport } from "@/app/layout";

describe("the page that wraps every screen", () => {
  const html = renderToStaticMarkup(
    <RootLayout params={Promise.resolve({})}>
      <p>a screen</p>
    </RootLayout>,
  );

  test("is in English and loads all four brand typefaces", () => {
    expect(html).toMatch(/^<html lang="en"/);
    for (const font of ["sora", "inter", "mono", "devanagari"]) {
      expect(html).toContain(`font-${font}`);
    }
  });

  test("sets the theme before anything is drawn, so a dark choice never flashes light", () => {
    expect(html).toMatch(
      /<head><script>[\s\S]*"ambrace:theme"[\s\S]*<\/script><\/head>/,
    );
  });

  test("gives every screen access to sign-in and data loading", () => {
    expect(html).toContain('<div data-providers=""><p>a screen</p></div>');
  });
});

describe("what browsers and search engines are told", () => {
  test("nothing is indexed: every page is behind sign-in", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  test("tabs are titled with the screen name and the product", () => {
    expect(metadata.title).toEqual({
      default: "Ambrace",
      template: "%s · Ambrace",
    });
  });

  test("the icons and manifest come from the logo kit", () => {
    expect(metadata.manifest).toBe("/site.webmanifest");
    expect(metadata.icons).toMatchObject({ apple: "/apple-touch-icon.png" });
  });

  test("the browser chrome is tinted Ink", () => {
    expect(viewport.themeColor).toBe("#0B0B10");
  });
});
