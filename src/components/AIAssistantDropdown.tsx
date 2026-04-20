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
        className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all text-sm font-semibold border border-white/10 inline-flex items-center gap-2"
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
          <div className="absolute top-full right-0 mt-1 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-[var(--shadow-raised)] z-50 overflow-hidden">
            <button
              onClick={handleOpenAssistant}
              className="flex items-center gap-2 px-4 py-2 text-sm text-slate-200 hover:bg-white/10 cursor-pointer w-full text-left transition-colors"
            >
              <MessageSquare size={15} />
              Open AI Chat
            </button>
            <button
              onClick={handleOpenSettings}
              className="flex items-center gap-2 px-4 py-2 text-sm text-slate-200 hover:bg-white/10 cursor-pointer w-full text-left transition-colors"
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
