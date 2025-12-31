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

            // File colors (Tailwind-ish palette)
            const FILE_COLORS = [
                '#3b82f6', // blue-500
                '#eab308', // yellow-500
                '#a855f7', // purple-500
                '#ec4899', // pink-500
                '#22c55e', // green-500
                '#f97316', // orange-500
                '#06b6d4', // cyan-500
                '#64748b', // slate-500
            ];

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
        <div className="flex flex-col items-center justify-center p-8">
            {(fileError || fileWarning) && (
                <div className="w-full max-w-md mb-4 p-3 rounded-md border">
                    {fileError && (
                        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/20 border border-red-800 rounded p-2">
                            <AlertTriangle size={16} />
                            <span className="flex-grow">{fileError}</span>
                            <button
                                onClick={() => setFileError(null)}
                                className="text-red-500 hover:text-red-300"
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
                className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-600 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors cursor-pointer"
                onDrop={onDrop}
                onDragOver={onDragOver}
                onClick={() => document.getElementById('file-input')?.click()}
            >
                <input
                    type="file"
                    id="file-input"
                    className="hidden"
                    accept=".log,.txt"
                    multiple
                    onChange={onChange}
                />
                <Upload size={48} className="text-blue-500 mb-4" />
                <h3 className="text-xl font-semibold mb-2">Drop Log File{logs.length > 0 ? '(s)' : ''} Here</h3>
                <p className="text-slate-400">or click to browse (.log, .txt)</p>
                {logs.length > 0 && (
                    <p className="text-xs text-slate-500 mt-2">You can add more files to merge with existing logs</p>
                )}
            </div>
        </div>
    );
};

export default FileUploader;
