import type { CitationId, Investigation } from '../../../types/canonical';
import ActionBlock from './blocks/ActionBlock';
import AnalysisBlock from './blocks/AnalysisBlock';
import CollectionBlock from './blocks/CollectionBlock';
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

        const content = (() => {
          switch (block.kind) {
            case 'context':
              return <ContextBlock block={block} />;
            case 'hypothesis':
              return <HypothesisBlock block={block} />;
            case 'collection':
              return <CollectionBlock block={block} investigation={investigation} />;
            case 'analysis':
              return (
                <AnalysisBlock
                  block={block}
                  investigation={investigation}
                  onCitationClick={onCitationClick}
                />
              );
            case 'action':
              return <ActionBlock block={block} />;
            case 'prior-art':
            case 'note':
              // These block kinds still need their richer interaction model.
              return <UnsupportedBlockPlaceholder block={block} />;
          }
        })();

        return (
          <section
            key={block.id}
            aria-labelledby={headingId}
            className="min-w-0"
            data-block-id={block.id}
            data-block-kind={block.kind}
          >
            {content}
          </section>
        );
      })}
    </div>
  );
}
