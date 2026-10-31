// The name a control with a short visible label is given: the visible text first, then the full name (WCAG 2.5.3,
// "label in name"), so someone who says what they see ("Upscale") reaches the button as well as someone who reads the full
// name. A full name that already holds the visible text is left as it is.
export function withVisibleText(name: string, visible: string): string {
  return name.toLowerCase().includes(visible.trim().toLowerCase()) ? name : `${visible} ${name}`;
}
