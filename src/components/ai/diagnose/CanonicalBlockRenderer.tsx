import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Pin } from 'lucide-react';
import { usePrefersReducedMotion } from '../../../hooks/usePrefersReducedMotion';
import type { Block, CitationId, Investigation } from '../../../types/canonical';
import Button from '../../ui/Button';
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
  onPinBlock?: (block: Block) => void;
}

export default function CanonicalBlockRenderer({
  investigation,
  onCitationClick,
  onPinBlock,
}: CanonicalBlockRendererProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [revealedInvestigationId, setRevealedInvestigationId] = useState<Investigation['id'] | null>(null);
  const [justPinned, setJustPinned] = useState<Block['id'] | null>(null);
  const hoveredBlockRef = useRef<Block | null>(null);
  const revealComplete = revealedInvestigationId === investigation.id;

  useEffect(() => {
    if (justPinned === null || prefersReducedMotion) return;
    const timeoutId = window.setTimeout(() => setJustPinned(null), 80);
    return () => window.clearTimeout(timeoutId);
  }, [justPinned, prefersReducedMotion]);

  return (
    <div
      className="flex flex-col gap-[var(--space-3)]"
      onKeyDown={(event) => {
        if (event.key === 'Escape') setRevealedInvestigationId(investigation.id);
        if (event.key === 'P' && event.ctrlKey && event.shiftKey && hoveredBlockRef.current && onPinBlock) {
          event.preventDefault();
          onPinBlock(hoveredBlockRef.current);
          setJustPinned(hoveredBlockRef.current.id);
        }
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
        const pulseStyle =
          justPinned === block.id && !prefersReducedMotion
            ? { scale: '1.02', transition: 'scale 80ms var(--ease-enter-out)' }
            : { scale: '1', transition: 'scale 80ms var(--ease-enter-out)' };

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
            className="group relative min-w-0"
            data-block-id={block.id}
            data-block-kind={block.kind}
            initial={shouldStagger ? { opacity: 0, y: 4 } : false}
            animate={{ opacity: 1, y: 0 }}
            onMouseEnter={() => { hoveredBlockRef.current = block; }}
            onFocusCapture={() => { hoveredBlockRef.current = block; }}
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
            <div style={pulseStyle}>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-[var(--space-3)] top-[var(--space-3)] z-10 min-h-10 min-w-10 px-2 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                aria-label="Pin to Evidence (Ctrl+Shift+P)"
                onClick={() => {
                  if (!onPinBlock) return;
                  onPinBlock(block);
                  setJustPinned(block.id);
                }}
              >
                <Pin size={14} />
              </Button>
              {content}
            </div>
          </motion.section>
        );
      })}
    </div>
  );
}
