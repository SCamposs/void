import { test, expect } from "@playwright/test";

test("Library reads searchable source snapshots and saves notes without a model", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    const doc = { id: 1, rootId: 1, path: "C:/fixtures/planejamento.md", title: "planejamento.md", kind: "md", fingerprint: "fixture-sha256", status: "ready", detail: "", bytes: 120, indexedAt: 1795089600000, passageCount: 1 };
    const passage = { id: 10, documentId: 1, ordinal: 0, page: null, lineStart: 1, lineEnd: 3, text: "# Projeto Juniper\nO orçamento aprovado é de 42 unidades.\nA revisão será na terça-feira." };
    const state = { roots: [{ id: 1, path: "C:/fixtures", label: "Study notes", directory: true }], notes: [] as Array<{ id: number; title: string; content: string; sources: unknown[]; updatedAt: number }>, storageBytes: 385024, progress: { phase: "", visited: 0, indexed: 0, unchanged: 0, errors: 0, skipped: 0, missing: 0, current: "", detail: "", startedAt: 0, finishedAt: null } };
    Object.defineProperty(window, "__TAURI_INTERNALS__", { value: { invoke: async (command: string, args: Record<string, unknown>) => {
      switch (command) {
        case "library_overview": return structuredClone(state);
        case "library_documents": return state.roots.length ? [doc] : [];
        case "library_search": return state.roots.length && String(args.query).toLowerCase().includes("orçamento") ? [{ document: doc, passage, excerpt: passage.text }] : [];
        case "library_reader": return { document: doc, passages: [passage] };
        case "library_save_note": { const note = { id: 1, title: String(args.title), content: String(args.content), sources: [], updatedAt: Date.now() }; state.notes = [note]; return note; }
        case "library_delete_note": state.notes = []; return;
        case "library_clear": state.roots = []; state.notes = []; return;
        default: throw new Error(`Unexpected native call in Library fixture: ${command}`);
      }
    } }, configurable: true });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await expect(page.getByRole("button", { name: /planejamento.md/ })).toBeVisible();
  await page.getByRole("searchbox", { name: "Search Library" }).fill("orçamento");
  await page.getByRole("button", { name: /planejamento.md/ }).click();
  await expect(page.getByRole("region", { name: "Library reader" })).toContainText("42 unidades");
  await expect(page.getByText("Lines 1–3", { exact: true }).last()).toBeVisible();
  await expect(page.locator(".library-passage")).toHaveAttribute("data-selected", "true");
  await page.screenshot({ path: testInfo.outputPath("library-reader-desktop.png") });
  await page.setViewportSize({ width: 720, height: 560 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole("button", { name: "Close reader" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("library-reader-compact.png") });
  await page.getByRole("button", { name: "Close reader" }).click();
  await page.getByRole("button", { name: /^Notes/ }).click();
  await page.getByRole("button", { name: "New note", exact: true }).click();
  await page.getByRole("textbox", { name: "Note title", exact: true }).fill("Decision");
  await page.getByRole("textbox", { name: "Note content", exact: true }).fill("Review the budget on Tuesday.");
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Edit note", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close reader" }).click();
  await page.getByRole("searchbox", { name: "Search Library" }).fill("");
  await expect(page.getByRole("button", { name: /Decision/ })).toBeVisible();
  await page.getByRole("button", { name: "Clear Library data", exact: true }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("button", { name: /Decision/ })).toBeVisible();
});

test("Library explains native availability without requesting file access in browser preview", async ({ page }) => {
  await page.goto("/"); await page.getByRole("button", { name: "Library", exact: true }).click();
  await expect(page.getByRole("button", { name: "Add documents", exact: true })).toBeDisabled();
  await expect(page.getByText("Open the installed VOID app to import and search your local documents.")).toBeVisible();
});
