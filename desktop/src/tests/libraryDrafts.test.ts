import { afterEach, describe, expect, it, vi } from "vitest";
import { readNoteDrafts, writeNoteDraft, removeNoteDraft, clearNoteDrafts } from "../app/modules/library/noteDrafts";
const note = {id:0,title:"Unfinished",content:"Keep this text",sources:[],updatedAt:1};
afterEach(() => vi.unstubAllGlobals());
describe("Library unfinished notes", () => {
  it("restores independent drafts and clears only Library draft storage", () => {
    const data = new Map<string,string>([["void.mind.state.v1","preserve"]]);
    vi.stubGlobal("localStorage",{ getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>data.set(k,v),removeItem:(k:string)=>data.delete(k) });
    writeNoteDraft(note); writeNoteDraft({...note,id:2,title:"Edited saved note"});
    expect(readNoteDrafts().new.content).toBe("Keep this text");
    removeNoteDraft(2); expect(Object.keys(readNoteDrafts())).toEqual(["new"]);
    clearNoteDrafts(); expect(readNoteDrafts()).toEqual({}); expect(data.get("void.mind.state.v1")).toBe("preserve");
  });
  it("reports write failures so the editor can warn before losing text", () => {
    vi.stubGlobal("localStorage",{getItem:()=>null,setItem:()=>{throw new Error("quota");}});
    expect(()=>writeNoteDraft(note)).toThrow("quota");
  });
});
