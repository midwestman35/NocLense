import { useMemo } from 'react';
import { useLogContext } from '../../contexts/LogContext';
import { Star, Sparkles, Check } from 'lucide-react';
import { ToggleChip } from '../ui/ToggleChip';
import SipFilterDropdown from '../SipFilterDropdown';
import MessageTypeFilterDropdown from '../MessageTypeFilterDropdown';
import SourceFilterDropdown from './SourceFilterDropdown';

export default function FilterControls() {
  const {
    logs,
    isSipFilterEnabled,
    setIsSipFilterEnabled,
    selectedLevels,
    toggleLevel,
    selectedSipMethods,
    toggleSipMethod,
    clearFilterSelections,
    availableMessageTypes,
    excludedMessageTypes,
    toggleExcludedMessageType,
    selectedMessageTypeFilter,
    setSelectedMessageTypeFilter,
    isCollapseSimilarEnabled,
    setIsCollapseSimilarEnabled,
    aiHighlightedLogIds,
    isShowAiHighlightOnly,
    setIsShowAiHighlightOnly,
    favoriteLogIds,
    isShowFavoritesOnly,
    setIsShowFavoritesOnly,
    selectedSourceFilter,
    setSelectedSourceFilter,
    availableSources,
  } = useLogContext();

  const hasHomerLogs = useMemo(() => logs.some(log => log.component === 'Homer SIP'), [logs]);

  const availableSipMethods = useMemo(() => {
    if (!hasHomerLogs) return [];
    const methods = new Set<string>();
    logs.forEach(log => {
      if (log.component === 'Homer SIP' && log.sipMethod) {
        const responseMatch = log.sipMethod.match(/^(\d{3})\s+(\w+)(?:\s+.*)?$/i);
        if (responseMatch) {
          const code = responseMatch[1];
          const firstWord = responseMatch[2].charAt(0).toUpperCase() + responseMatch[2].slice(1).toLowerCase();
          methods.add(`${code} ${firstWord}`);
        } else {
          methods.add(log.sipMethod);
        }
      }
    });
    return Array.from(methods);
  }, [logs, hasHomerLogs]);

  return (
    <div className="flex items-center gap-4 shrink-0">
      <SipFilterDropdown
        selectedLevels={selectedLevels}
        isSipFilterEnabled={isSipFilterEnabled}
        selectedSipMethods={selectedSipMethods}
        availableSipMethods={availableSipMethods}
        onToggleLevel={toggleLevel}
        onToggleSipOnly={() => setIsSipFilterEnabled(!isSipFilterEnabled)}
        onToggleSipMethod={toggleSipMethod}
        onClearAll={clearFilterSelections}
      />

      <MessageTypeFilterDropdown
        availableMessageTypes={availableMessageTypes}
        excludedMessageTypes={excludedMessageTypes}
        selectedMessageTypeFilter={selectedMessageTypeFilter}
        onToggleExcluded={toggleExcludedMessageType}
        onSelectFilter={setSelectedMessageTypeFilter}
      />

      {availableSources.length > 1 && (
        <SourceFilterDropdown
          sources={availableSources}
          selected={selectedSourceFilter}
          onSelect={setSelectedSourceFilter}
        />
      )}

      <ToggleChip
        label="Favorites"
        checked={isShowFavoritesOnly}
        onChange={setIsShowFavoritesOnly}
        icon={<Star size={10} className={isShowFavoritesOnly ? "fill-[var(--warning)] text-[var(--warning)]" : "text-transparent"} />}
        activeClassName="bg-[var(--warning)]/10 border-[var(--warning)]"
        activeLabelClassName="group-hover:text-[var(--warning)]"
        count={favoriteLogIds.size}
      />

      <ToggleChip
        label="AI highlighted"
        checked={isShowAiHighlightOnly}
        onChange={setIsShowAiHighlightOnly}
        disabled={aiHighlightedLogIds.size === 0}
        icon={<Sparkles size={9} className={isShowAiHighlightOnly && aiHighlightedLogIds.size > 0 ? 'text-violet-400' : 'text-transparent'} />}
        activeClassName="bg-violet-500/20 border-violet-500"
        activeLabelClassName="group-hover:text-violet-400"
        count={aiHighlightedLogIds.size}
      />

      <ToggleChip
        label="Collapse similar"
        checked={isCollapseSimilarEnabled}
        onChange={setIsCollapseSimilarEnabled}
        icon={isCollapseSimilarEnabled ? <Check size={12} className="text-white" /> : null}
        activeClassName="bg-[var(--foreground)] border-[var(--foreground)]"
        activeLabelClassName="group-hover:text-[var(--foreground)]"
        title="Group consecutive rows with same service and message"
      />
    </div>
  );
}
