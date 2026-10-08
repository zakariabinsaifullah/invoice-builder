/** Editor actions the command palette can trigger without importing the editor. */
export type EditorCommand = "save" | "pdf" | "print" | "template";

export const runEditorCommand = (cmd: EditorCommand) => window.dispatchEvent(new CustomEvent<EditorCommand>("ib:editor", { detail: cmd }));

export function onEditorCommand(fn: (cmd: EditorCommand) => void) {
  const handler = (e: Event) => fn((e as CustomEvent<EditorCommand>).detail);
  window.addEventListener("ib:editor", handler);
  return () => window.removeEventListener("ib:editor", handler);
}
