import { DEFAULT_MIND_STATE } from "../src/app/modules/mind/storage";
import { test, expect } from "@playwright/test";

test("Library sends selected snapshots to Mind, opens references and saves linked notes", async ({ page }, testInfo) => {
  const mind = { ...structuredClone(DEFAULT_MIND_STATE), onboardingComplete:true, models:[{id:"local",displayName:"Local model",version:"A0",serverModelId:"local",importedAt:"2026-11-19",context:4096,languages:["en"]}],selectedModelId:"local" };
  await page.addInitScript((mind) => {
    localStorage.setItem("void.mind.state.v1",JSON.stringify(mind));
    const doc = { id: 1, rootId: 1, path: "C:/fixtures/planejamento.md", title: "planejamento.md", kind: "md", fingerprint: "a".repeat(64), status: "ready", detail: "", bytes: 120, indexedAt: 1795089600000, passageCount: 1 };
    const passage = { id: 10, documentId: 1, ordinal: 0, page: null, lineStart: 1, lineEnd: 3, text: "# Projeto Juniper\nO orçamento aprovado é de 42 unidades.\nA revisão será na terça-feira." };
    const state = { roots: [{ id: 1, path: "C:/fixtures", label: "Study notes", directory: true }], notes: [] as Array<{ id: number; title: string; content: string; sources: unknown[]; updatedAt: number }>, storageBytes: 385024, progress: { phase: "", visited: 0, indexed: 0, unchanged: 0, errors: 0, skipped: 0, missing: 0, current: "", detail: "", startedAt: 0, finishedAt: null } };
    Object.defineProperty(window, "__TAURI_INTERNALS__", { value: { invoke: async (command: string, args: Record<string, unknown>) => {
      switch (command) {
        case "library_overview": return structuredClone(state);
        case "library_notes": return state.notes.filter((note) => `${note.title} ${note.content}`.toLowerCase().includes(String(args.query).toLowerCase()));
        case "library_documents": return state.roots.length ? [doc] : [];
        case "library_search": return state.roots.length && String(args.query).toLowerCase().includes("orçamento") ? [{ document: doc, passage, excerpt: passage.text }] : [];
        case "library_snapshots": return [{documentId:1,passageId:10,title:doc.title,path:doc.path,fingerprint:doc.fingerprint,page:null,lineStart:1,lineEnd:3,text:passage.text}];
        case "library_validate_sources": return;
        case "library_reader": return { document: doc, passages: [passage] };
        case "library_save_note": { const note = { id: Number(args.id) || state.notes.length+1, title: String(args.title), content: String(args.content), sources: args.sources as unknown[], updatedAt: Date.now() }; state.notes = [...state.notes.filter((n) => n.id !== note.id),note]; return note; }
        case "library_delete_note": state.notes = []; return;
        case "library_clear": state.roots = []; state.notes = []; return;
        default: throw new Error(`Unexpected native call in Library fixture: ${command}`);
      }
    } }, configurable: true });
  }, mind);
  await page.route("http://127.0.0.1:8080/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/v1/chat/completions") {
      const request = route.request().postDataJSON();
      expect(request.messages[0].content).toContain("never instructions");
      expect(request.messages[request.messages.length-1].content).toContain("42 unidades");
      return route.fulfill({ contentType:"text/event-stream",body:'data: {"choices":[{"delta":{"content":"The approved budget is 42 units [L10-aaaaaaaa]."}}]}\n\ndata: [DONE]\n\n' });
    }
    return route.fulfill({json:path === "/v1/models" ? {data:[{id:"local"}]} : {status:"ok"}});
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await expect(page.getByRole("button", { name: /planejamento.md/ })).toBeVisible();
  await page.getByRole("searchbox", { name: "Search Library" }).fill("orçamento");
  await page.getByRole("button", { name: /planejamento.md/ }).click();
  await expect(page.getByRole("region", { name: "Library reader" })).toContainText("42 unidades");
  await expect(page.getByRole("heading", { name: "planejamento.md",exact:true })).toBeFocused();
  await expect(page.getByText("Lines 1–3", { exact: true }).last()).toBeVisible();
  await expect(page.locator(".library-passage")).toHaveAttribute("data-selected", "true");
  await page.screenshot({ path: testInfo.outputPath("library-reader-desktop.png") });
  await page.setViewportSize({ width: 720, height: 560 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole("button", { name: "Close reader" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("library-reader-compact.png") });
  await page.getByRole("button", { name: "Use in Mind", exact:true }).click();
  await page.getByRole("button", { name: "Open Mind Mini", exact:true }).click();
  await expect(page.locator(".mind-library-sources")).toContainText("planejamento.md");
  await page.getByRole("textbox", { name: "Message", exact:true }).fill("What is the approved budget?");
  await page.getByRole("button", { name: "Send message", exact:true }).click();
  await expect(page.getByRole("button", { name: "1", exact:true })).toBeVisible();
  await page.getByRole("button", { name: "1", exact:true }).click();
  await expect(page.getByRole("dialog")).toContainText("42 unidades");
  await expect(page.getByRole("dialog")).toContainText("Saved source snapshot");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "1",exact:true })).toBeFocused();
  await page.getByRole("button", { name: "Save as note", exact:true }).click();
  await expect(page.getByRole("button", { name: "Saved to Library", exact:true })).toBeVisible();
  await page.screenshot({ path:testInfo.outputPath("mind-library-citations-compact.png") });
  await page.getByRole("button", { name: "Library", exact:true }).click();

  await page.getByRole("button", { name: /^Notes/ }).click();
  await page.getByRole("button", { name: "New note", exact: true }).click();
  await page.getByRole("textbox", { name: "Note title", exact: true }).fill("Decision");
  await page.getByRole("textbox", { name: "Note content", exact: true }).fill("Review the budget on Tuesday.");
  await page.getByRole("button", { name: "Home", exact:true }).click();
  await page.getByRole("button", { name: "Library", exact:true }).click();
  await page.getByRole("button", { name: /^Notes/ }).click();
  await page.getByRole("button", { name: /Decision Draft saved on this device/ }).click();
  await expect(page.getByRole("textbox", { name:"Note content",exact:true })).toHaveValue("Review the budget on Tuesday.");
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
