import React from 'react';
import { useLogContext } from '../contexts/LogContext';
import { parseLogFile } from '../utils/parser';
import { Upload } from 'lucide-react';

const FileUploader = () => {
    const { setLogs, setLoading, setSelectedLogId } = useLogContext();

    const handleFile = async (file: File) => {
        if (!file) return;
        setLoading(true);
        try {
            const parsed = await parseLogFile(file);
            setLogs(parsed);
            setSelectedLogId(null);
        } catch (err) {
            console.error("Failed to parse", err);
            // In a real app we'd show a toast here
        } finally {
            setLoading(false);
        }
    };

    const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    };

    const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
    };

    const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            handleFile(e.target.files[0]);
        }
    };

    return (
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
                onChange={onChange}
            />
            <Upload size={48} className="text-blue-500 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Drop Log File Here</h3>
            <p className="text-slate-400">or click to browse (.log, .txt)</p>
        </div>
    );
};

export default FileUploader;
