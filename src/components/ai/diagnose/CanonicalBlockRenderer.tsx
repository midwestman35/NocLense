import { useState } from 'react';
import { motion } from 'motion/react';
import { usePrefersReducedMotion } from '../../../hooks/usePrefersReducedMotion';
import type { CitationId, Investigation } from '../../../types/canonical';
import ActionBlock from './blocks/ActionBlock';
import AnalysisBlock from './blocks/AnalysisBlock';
import CollectionBlock from './blocks/CollectionBlock';
import ContextBlock from './blocks/ContextBlock';
import HypothesisBlock from './blocks/HypothesisBlock';
import NoteBlock from './blocks/NoteBlock';
import PriorArtBlock from './blocks/PriorArtBlock';

const MAX_STAGGERED_BLOCKS = 12;
const STAGGER_SECONDS = 0.04;
const ENTER_DURATION_SECONDS = 0.25;
const ENTER_EASE = [0.2, 0, 0, 1] as const;

interface CanonicalBlockRendererProps {
  investigation: Investigation;
  onCitationClick?: (citationId: CitationId) => void;
}

export default function CanonicalBlockRenderer({
  investigation,
  onCitationClick,
}: CanonicalBlockRendererProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [revealedInvestigationId, setRevealedInvestigationId] = useState<Investigation['id'] | null>(null);
  const revealComplete = revealedInvestigationId === investigation.id;

  return (
    <div
      className="flex flex-col gap-[var(--space-3)]"
      onKeyDown={(event) => {
        if (event.key === 'Escape') setRevealedInvestigationId(investigation.id);
      }}
      onMouseDown={(event) => {
        const target = event.target as HTMLElement;
        if (!target.closest('a, button, input, select, summary, textarea, [tabindex]:not([tabindex="-1"])')) {
          event.currentTarget.focus();
        }
      }}
      tabIndex={-1}
    >
      {investigation.blocks.map((block, index) => {
        const headingId = `canonical-block-${block.id}`;
        const shouldStagger =
          !prefersReducedMotion && !revealComplete && index < MAX_STAGGERED_BLOCKS;

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
              return <PriorArtBlock block={block} investigation={investigation} onCitationClick={onCitationClick} />;
            case 'note':
              return <NoteBlock block={block} />;
          }
        })();

        return (
          <motion.section
            key={`${investigation.id}:${block.id}`}
            aria-labelledby={headingId}
            className="min-w-0"
            data-block-id={block.id}
            data-block-kind={block.kind}
            initial={shouldStagger ? { opacity: 0, y: 4 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={
              shouldStagger
                ? {
                    duration: ENTER_DURATION_SECONDS,
                    ease: ENTER_EASE,
                    delay: index * STAGGER_SECONDS,
                  }
                : { duration: 0 }
            }
          >
            {content}
          </motion.section>
        );
      })}
    </div>
  );
}
