import type { CitationId, Investigation } from '../../../types/canonical';
import AnalysisBlock from './blocks/AnalysisBlock';
import ContextBlock from './blocks/ContextBlock';
import HypothesisBlock from './blocks/HypothesisBlock';
import UnsupportedBlockPlaceholder from './blocks/UnsupportedBlockPlaceholder';

interface CanonicalBlockRendererProps {
  investigation: Investigation;
  onCitationClick?: (citationId: CitationId) => void;
}

export default function CanonicalBlockRenderer({
  investigation,
  onCitationClick,
}: CanonicalBlockRendererProps) {
  return (
    <div className="flex flex-col gap-[var(--space-3)]">
      {investigation.blocks.map((block) => {
        const headingId = `canonical-block-${block.id}`;

        return (
          <section
            key={block.id}
            aria-labelledby={headingId}
            className="min-w-0"
            data-block-id={block.id}
            data-block-kind={block.kind}
          >
            {block.kind === 'context' && <ContextBlock block={block} />}
            {block.kind === 'hypothesis' && <HypothesisBlock block={block} />}
            {block.kind === 'analysis' && (
              <AnalysisBlock
                block={block}
                investigation={investigation}
                onCitationClick={onCitationClick}
              />
            )}
            {block.kind !== 'context' &&
              block.kind !== 'hypothesis' &&
              block.kind !== 'analysis' && (
                <UnsupportedBlockPlaceholder block={block} />
              )}
          </section>
        );
      })}
    </div>
  );
}
