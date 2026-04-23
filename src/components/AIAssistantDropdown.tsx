import { useState } from 'react';
import { ChevronDown, MessageSquare, Settings } from 'lucide-react';

interface AIAssistantDropdownProps {
  onOpenAssistant: () => void;
  onOpenSettings: () => void;
}

const AIAssistantDropdown = ({ onOpenAssistant, onOpenSettings }: AIAssistantDropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleOpenAssistant = () => {
    setIsOpen(false);
    onOpenAssistant();
  };

  const handleOpenSettings = () => {
    setIsOpen(false);
    onOpenSettings();
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 rounded-lg border border-line bg-bg-2/80 px-3 py-2 text-sm font-semibold text-ink-0 transition-[background-color,border-color,color] duration-150 hover:bg-bg-3"
        title="AI Assistant options"
      >
        AI Assistant
        <ChevronDown
          size={14}
          className={`transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown panel */}
          <div className="absolute top-full right-0 z-50 mt-1 w-48 overflow-hidden rounded-lg border border-line-2 bg-bg-2 shadow-[var(--shadow-raised)]">
            <button
              onClick={handleOpenAssistant}
              className="flex w-full cursor-pointer items-center gap-2 px-4 py-2 text-left text-sm text-ink-1 transition-colors hover:bg-bg-3 hover:text-ink-0"
            >
              <MessageSquare size={15} />
              Open AI Chat
            </button>
            <button
              onClick={handleOpenSettings}
              className="flex w-full cursor-pointer items-center gap-2 px-4 py-2 text-left text-sm text-ink-1 transition-colors hover:bg-bg-3 hover:text-ink-0"
            >
              <Settings size={15} />
              AI Settings
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default AIAssistantDropdown;
