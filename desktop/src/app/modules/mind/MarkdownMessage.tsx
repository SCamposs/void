import { createContext, useContext, useMemo, type ComponentPropsWithoutRef } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { citationLinks, sourceId } from "../library/context";
import type { SourceSnapshot } from "../library/types";
import { Button } from "../../components/ui/Controls";

const ReferenceContext = createContext<{ sources: SourceSnapshot[]; open?(source: SourceSnapshot): void }>({sources:[]});
function MarkdownLink({ children, href, title }: ComponentPropsWithoutRef<"a">) {
  const { sources,open } = useContext(ReferenceContext);
  if (href?.startsWith("#library-")) {
    const source = sources.find((s) => `#library-${sourceId(s)}` === href);
    return source && open ? <Button className="library-citation" onClick={() => open(source)}>{children}</Button>
      : <span className="library-citation-warning">{children} (unmatched source)</span>;
  }
  return <a href={href} title={title} target="_blank" rel="noreferrer">{children}</a>;
}
function MarkdownCode({ className,children }: ComponentPropsWithoutRef<"code">) {
  return <code className={className?.startsWith("language-") ? className : "mind-inline-code"}>{children}</code>;
}
// Stable renderer types preserve reference trigger nodes while messages stream or a dialog opens.
const components: Components = { a: MarkdownLink,code:MarkdownCode };
const NO_SOURCES: SourceSnapshot[] = [];

export function MarkdownMessage({ content, sources = NO_SOURCES, onOpenSource, validateReferences = true }: { content: string; sources?: SourceSnapshot[]; onOpenSource?(source: SourceSnapshot): void; validateReferences?: boolean }) {
  const citations = citationLinks(content,sources);
  const references = useMemo(() => ({sources,open:onOpenSource}),[sources,onOpenSource]);
  return <ReferenceContext.Provider value={references}><div className="mind-markdown">
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{citations.markdown}</ReactMarkdown>
    {validateReferences && citations.unknown.length > 0 && <p className="library-citation-warning">Some references could not be matched to the selected sources. Verify the answer.</p>}
    {validateReferences && sources.length > 0 && citations.cited.length === 0 && <p className="library-citation-warning">No verifiable source reference was provided. Check the selected documents before relying on this answer.</p>}
  </div></ReferenceContext.Provider>;
}
