import React, { useState } from 'react';
import { useLogContext } from '../contexts/LogContext';
import { parseLogFile } from '../utils/parser';
import { Upload, AlertTriangle, X } from 'lucide-react';
import { validateFile } from '../utils/fileUtils';

const FileUploader = () => {
    const { logs, setLogs, setLoading, setSelectedLogId } = useLogContext();
    const [fileError, setFileError] = useState<string | null>(null);
    const [fileWarning, setFileWarning] = useState<string | null>(null);

    const handleFiles = async (files: FileList) => {
        if (!files || files.length === 0) return;

        setFileError(null);
        setFileWarning(null);

        // Validate all files first
        const filesArray = Array.from(files);
        const validationResults = filesArray.map(file => ({
            file,
            validation: validateFile(file)
        }));

        // Check for validation errors
        const errors = validationResults.filter(r => !r.validation.valid);
        if (errors.length > 0) {
            setFileError(errors[0].validation.error || 'Invalid file');
            return;
        }

        // Collect warnings
        const warnings = validationResults
            .map(r => r.validation.warning)
            .filter((w): w is string => !!w);

        if (warnings.length > 0) {
            setFileWarning(warnings[0]);
        }

        setLoading(true);
        try {
            // Process all files
            const allParsedLogs = [];
            let maxId = Math.max(0, ...logs.map(l => l.id)); // Get max ID from existing logs

            const FILE_COLORS = ['#3b82f6', '#eab308', '#a855f7', '#ec4899', '#22c55e', '#f97316', '#06b6d4', '#64748b'];

            for (let i = 0; i < validationResults.length; i++) {
                const { file } = validationResults[i];
                const color = FILE_COLORS[i % FILE_COLORS.length];
                const parsed = await parseLogFile(file, color, maxId);
                allParsedLogs.push(...parsed);
                maxId = Math.max(maxId, ...parsed.map(l => l.id));
            }

            // Merge with existing logs (append mode)
            setLogs([...logs, ...allParsedLogs]);
            setSelectedLogId(null);
        } catch (err) {
            console.error("Failed to parse", err);
            setFileError(`Failed to parse file${files.length > 1 ? 's' : ''}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        } finally {
            setLoading(false);
            if (fileWarning) {
                setTimeout(() => setFileWarning(null), 5000);
            }
        }
    };

    const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFiles(e.dataTransfer.files);
        }
    };

    const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
    };

    const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFiles(e.target.files);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center p-8 w-full max-w-3xl mx-auto">
            {(fileError || fileWarning) && (
                <div className="w-full max-w-md mb-4 p-3 rounded-md border border-[var(--border-color)]">
                    {fileError && (
                        <div className="flex items-center gap-2 text-[var(--err)]/80 text-sm bg-[var(--err)]/10 border border-[var(--err)]/20 rounded p-2">
                            <AlertTriangle size={16} />
                            <span className="flex-grow">{fileError}</span>
                            <button
                                onClick={() => setFileError(null)}
                                className="text-[var(--err)] hover:opacity-80"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    )}
                    {fileWarning && !fileError && (
                        <div className="flex items-center gap-2 text-yellow-400 text-sm bg-yellow-900/20 border border-yellow-800 rounded p-2">
                            <AlertTriangle size={16} />
                            <span className="flex-grow">{fileWarning}</span>
                            <button
                                onClick={() => setFileWarning(null)}
                                className="text-yellow-500 hover:text-yellow-300"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    )}
                </div>
            )}
            <div
                className="w-full flex flex-col items-center justify-center p-12 border-2 border-dashed border-[var(--border-color)] rounded-xl bg-[var(--bg-light)]/50 hover:bg-[var(--bg-light)] transition-colors cursor-pointer group hover:border-[var(--accent-blue)]/50"
                onDrop={onDrop}
                onDragOver={onDragOver}
                onClick={() => document.getElementById('file-input')?.click()}
            >
                <input
                    type="file"
                    id="file-input"
                    className="hidden"
                    accept=".log,.txt,.csv"
                    multiple
                    onChange={onChange}
                />

                <div className="p-4 rounded-full bg-[var(--card-bg)] shadow-[var(--shadow)] mb-4 group-hover:scale-110 transition-transform duration-300">
                    <Upload size={40} className="text-[var(--accent-blue)]" />
                </div>

                <h3 className="text-xl font-bold mb-2 text-[var(--text-primary)]">Drop Log File{logs.length > 0 ? '(s)' : ''} Here</h3>
                <p className="text-[var(--text-secondary)] text-sm mb-4">or click to browse (.log, .txt, .csv)</p>

                {logs.length > 0 && (
                    <div className="px-3 py-1 rounded-full bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] text-xs font-medium">
                        Merging with {logs.length} existing logs
                    </div>
                )}
            </div>
        </div>
    );
};

export default FileUploader;
