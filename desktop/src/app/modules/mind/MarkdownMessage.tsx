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
          a: ({ children, href, ...props }) => {
            if (href?.startsWith("#library-")) {
              const source = sources.find((s) => `#library-${sourceId(s)}` === href);
              return source && onOpenSource ? <Button className="library-citation" onClick={() => onOpenSource(source)}>{children}</Button>
                : <span className="library-citation-warning">{children} (unmatched source)</span>;
            }
            return <a {...props} href={href} target="_blank" rel="noreferrer">{children}</a>;
          },
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
