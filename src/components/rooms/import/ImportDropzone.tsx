import { useRef, useState, type JSX } from 'react';
import type { ImportFileSource } from '../../../services/importFileSource';
import { openImportFilesDialog } from '../../../services/importFileSource';
import { Card, CardContent, Icon } from '../../ui';

interface ImportDropzoneProps {
  disabled?: boolean;
  onSelectFiles: (files: FileList | ImportFileSource[]) => Promise<void> | void;
}

export function ImportDropzone({ disabled = false, onSelectFiles }: ImportDropzoneProps): JSX.Element {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleNativePick = async () => {
    const nativeFiles = await openImportFilesDialog();
    if (nativeFiles === null) {
      fileInputRef.current?.click();
      return;
    }

    if (nativeFiles.length === 0) {
      return;
    }

    await onSelectFiles(nativeFiles);
  };

  return (
    <>
      <input
        ref={fileInputRef}
        data-testid="import-file-input"
        type="file"
        className="hidden"
        accept=".log,.txt,.csv,.zip,.pdf,.noclense"
        multiple
        onChange={(event) => {
          const { files } = event.currentTarget;
          if (files && files.length > 0) {
            void onSelectFiles(files);
          }
          event.currentTarget.value = '';
        }}
      />

      <Card
        className={[
          'border-dashed bg-[linear-gradient(180deg,rgba(142,240,183,0.04),rgba(255,255,255,0.015))]',
          dragActive ? 'border-[var(--mint)] shadow-[0_0_36px_-24px_rgba(142,240,183,0.7)]' : 'border-[var(--line-bright)]',
          disabled ? 'opacity-70' : '',
        ].join(' ')}
      >
        <CardContent className="p-0">
          <button
            type="button"
            data-testid="import-dropzone"
            disabled={disabled}
            onClick={() => void handleNativePick()}
            onDragEnter={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              setDragActive(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setDragActive(false);
              if (event.dataTransfer.files.length > 0) {
                void onSelectFiles(event.dataTransfer.files);
              }
            }}
            className="flex w-full flex-col items-center gap-4 px-6 py-10 text-center focus-visible:outline-none focus-visible:ring-[var(--ring-width)] focus-visible:ring-[var(--ring)]"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-md)] border border-[rgba(142,240,183,0.25)] bg-[rgba(142,240,183,0.08)]">
              <Icon name="import" size={20} stroke="var(--mint)" />
            </div>
            <div className="space-y-2">
              <p className="text-base font-medium text-[var(--ink-0)]">Choose files to import</p>
              <p className="text-sm leading-6 text-[var(--ink-3)]">
                Supports <span className="mono text-[var(--ink-1)]">.log</span>, <span className="mono text-[var(--ink-1)]">.txt</span>, <span className="mono text-[var(--ink-1)]">.csv</span>, <span className="mono text-[var(--ink-1)]">.zip</span>, <span className="mono text-[var(--ink-1)]">.pdf</span>, and <span className="mono text-[var(--ink-1)]">.noclense</span>.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <span className="btn primary min-h-9 px-3.5 py-2 text-[13px]">
                <Icon name="import" size={14} />
                Open file picker
              </span>
              <span className="mono text-[10px] uppercase tracking-[0.14em] text-[var(--ink-3)]">
                Drag files here or click to browse
              </span>
            </div>
          </button>
        </CardContent>
      </Card>
    </>
  );
}
