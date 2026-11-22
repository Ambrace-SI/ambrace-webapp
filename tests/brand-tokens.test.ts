import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "vitest";

const css = readFileSync("app/globals.css", "utf8");

function tokens(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  assert.notEqual(start, -1, `${selector} block is missing`);
  const block = css.slice(start, css.indexOf("\n}", start));
  const found: Record<string, string> = {};
  for (const match of block.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})\b/gi)) {
    found[match[1]] = match[2].toLowerCase();
  }
  return found;
}

function luminance(hex: string): number {
  const channel = (offset: number) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928
      ? value / 12.92
      : Math.pow((value + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** WCAG 2 contrast ratio between two colours. */
function contrast(first: string, second: string): number {
  const [light, dark] = [luminance(first), luminance(second)].sort(
    (a, b) => b - a,
  );
  return (light + 0.05) / (dark + 0.05);
}

const AA_TEXT = 4.5;
const AAA_TEXT = 7;

const themes = { Paper: tokens(":root"), Ink: tokens(".dark") };

for (const [name, theme] of Object.entries(themes)) {
  test(`${name}: body text is comfortable to read for a long time`, () => {
    assert.ok(contrast(theme.foreground, theme.background) >= AAA_TEXT);
    assert.ok(contrast(theme["card-foreground"], theme.card) >= AAA_TEXT);
  });

  test(`${name}: secondary text stays readable on every surface`, () => {
    for (const surface of ["background", "card", "muted"]) {
      assert.ok(
        contrast(theme["muted-foreground"], theme[surface]) >= AA_TEXT,
        `muted text on ${surface}`,
      );
    }
  });

  test(`${name}: button labels are readable`, () => {
    assert.ok(contrast(theme["primary-foreground"], theme.primary) >= AA_TEXT);
    assert.ok(contrast(theme["ember-foreground"], theme.ember) >= AA_TEXT);
  });

  test(`${name}: the selector's surfaces use only the agreed palette`, () => {
    const palette = new Set([
      "#0b0b10", // Ink
      "#1c1b25", // Graphite
      "#ecebf2", // Mist
      "#f4f3ef", // Paper
      "#cfcdd8", // Orbit light
      "#3a3946", // Orbit dark
    ]);
    for (const token of ["surface", "surface-active"])
      assert.ok(palette.has(theme[token]), `${token} is ${theme[token]}`);
  });

  test(`${name}: text stays readable on the selector's surfaces`, () => {
    for (const surface of ["surface", "surface-active"]) {
      assert.ok(contrast(theme.foreground, theme[surface]) >= AAA_TEXT);
      assert.ok(
        contrast(theme["muted-foreground"], theme[surface]) >= AA_TEXT,
        `muted text on ${surface}`,
      );
    }
  });

  test(`${name}: the logo's inner orbit, drawn in the muted tone, is visible`, () => {
    // Graphics need 3:1. The logo kit's own orbit tint is about 1.5:1.
    for (const surface of ["background", "surface"])
      assert.ok(contrast(theme["muted-foreground"], theme[surface]) >= 3);
  });

  test(`${name}: coral text is readable where it is used`, () => {
    assert.ok(contrast(theme["ember-text"], theme.background) >= AA_TEXT);
  });
}

test("Ember is the brand colour in both themes, and its label is never white", () => {
  for (const theme of Object.values(themes)) {
    assert.equal(theme.ember, "#ff6b4a");
    assert.equal(theme["ember-foreground"], "#0b0b10");
  }
  // The reason for the rule above: white on Ember fails for text.
  assert.ok(contrast("#ffffff", "#ff6b4a") < AA_TEXT);
});

test("Ember itself is too light for text on Paper, so Paper uses the darker coral", () => {
  assert.ok(contrast("#ff6b4a", themes.Paper.background) < AA_TEXT);
  assert.notEqual(themes.Paper["ember-text"], "#ff6b4a");
});

test("Ember is not the general primary colour", () => {
  for (const theme of Object.values(themes)) {
    assert.notEqual(theme.primary, theme.ember);
    assert.notEqual(theme.ring, theme.ember);
  }
});

test("the logo files the app shows draw the inner orbit in the muted tones", () => {
  const orbit = (file: string) =>
    readFileSync(`public/brand/${file}`, "utf8").match(
      /<circle cx="60" cy="60" r="20"[^>]*stroke="(#[0-9A-Fa-f]{6})"/,
    )?.[1];

  assert.equal(orbit("ambrace-lowercase-horizontal.svg"), "#55536A");
  assert.equal(orbit("ambrace-lowercase-horizontal-reversed.svg"), "#9A98AC");
});

test("the scrim behind windows is Ink in both themes, stronger on Ink", () => {
  const scrim = (selector: string) =>
    css
      .slice(css.indexOf(`${selector} {`))
      .match(/--scrim:\s*rgb\(11 11 16 \/ (0\.\d+)\)/)?.[1];

  const paper = Number(scrim(":root"));
  const ink = Number(scrim(".dark"));
  assert.ok(paper > 0 && ink > paper, `scrim ${paper} on Paper, ${ink} on Ink`);
});

test("scrollbars everywhere are thin, quiet and in the theme's own tone", () => {
  // Orbit light on Paper, Orbit dark on Ink: the same tone as the borders.
  assert.equal(themes.Paper.scrollbar, "#cfcdd8");
  assert.equal(themes.Ink.scrollbar, "#3a3946");
  // The side panel's look, for every scrolling area: the standard thin bar.
  const everywhere = css.slice(0, css.indexOf("@supports not"));
  assert.match(everywhere, /scrollbar-width:\s*thin/);
  assert.match(
    everywhere,
    /scrollbar-color:\s*var\(--scrollbar\)\s+transparent/,
  );
  // Browsers that cannot read those (older Safari) get the same look the
  // old way, and only they do.
  const fallback = css.slice(css.indexOf("@supports not (scrollbar-color"));
  assert.match(fallback, /::-webkit-scrollbar-thumb/);
});

test("the side panel uses the shared scrollbar, not one of its own", () => {
  const sidebar = readFileSync("components/ui/sidebar.tsx", "utf8");
  assert.doesNotMatch(sidebar, /scrollbar-color|scrollbar-width/);
});

test("the stylesheet has no gradients or glows", () => {
  assert.doesNotMatch(css, /gradient\(/);
  assert.doesNotMatch(css, /box-shadow|drop-shadow|text-shadow/);
});

test("decorative motion is switched off for people who ask for less", () => {
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});
