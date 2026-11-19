import { citationLinks, sourceId } from "../library/context";
import type { SourceSnapshot } from "../library/types";
import { Button } from "../../components/ui/Controls";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function MarkdownMessage({ content, sources = [], onOpenSource, validateReferences = true }: { content: string; sources?: SourceSnapshot[]; onOpenSource?(source: SourceSnapshot): void; validateReferences?: boolean }) {
  const citations = citationLinks(content,sources);
  return (
    <div className="mind-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ children, href, ...props }) => href?.startsWith("#library-") && onOpenSource
            ? <Button className="library-citation" onClick={() => { const source = sources.find((s) => `#library-${sourceId(s)}` === href); if (source) onOpenSource(source); }}>{children}</Button>
            : <a {...props} href={href} target="_blank" rel="noreferrer">{children}</a>,
          code: ({ className, children, ...props }) => {
            const block = className?.startsWith("language-");
            return block ? (
              <code className={className} {...props}>
                {children}
              </code>
            ) : (
              <code className="mind-inline-code" {...props}>
                {children}
              </code>
            );
          },
        }}
      >
        {citations.markdown}
      </ReactMarkdown>
      {validateReferences && citations.unknown.length > 0 && <p className="library-citation-warning">Some references could not be matched to the selected sources. Verify the answer.</p>}
      {validateReferences && sources.length > 0 && citations.cited.length === 0 && <p className="library-citation-warning">No verifiable source reference was provided. Check the selected documents before relying on this answer.</p>}
    </div>
  );
}
