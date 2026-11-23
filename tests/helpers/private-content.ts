import { PRIVATE_CLASS } from "@/lib/analytics/privacy";

/**
 * Every place under `root` where one of `secrets` would reach a screen
 * recording or a captured click: text, or an attribute, that is not inside an
 * element marked private.
 *
 * An empty list means the screen is safe to record. What a student types is
 * not checked here: every input is masked by the recorder itself.
 */
export function privateContentLeaks(
  root: ParentNode,
  secrets: readonly string[],
): string[] {
  const hidden = (element: Element | null) =>
    Boolean(element?.closest(`.${PRIVATE_CLASS}`));
  const leaks: string[] = [];

  const texts = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = texts.nextNode(); node; node = texts.nextNode()) {
    const text = node.textContent ?? "";
    for (const secret of secrets)
      if (text.includes(secret) && !hidden(node.parentElement))
        leaks.push(
          `"${secret}" as text in <${node.parentElement?.tagName.toLowerCase()}>`,
        );
  }

  for (const element of root.querySelectorAll("*")) {
    if (hidden(element)) continue;
    for (const { name, value } of element.attributes)
      for (const secret of secrets)
        if (name !== "value" && value.includes(secret))
          leaks.push(
            `"${secret}" in ${name} of <${element.tagName.toLowerCase()}>`,
          );
  }

  return leaks;
}
