import type { LogEntry } from '../types';
import ParserWorker from '../workers/parser.worker?worker';

export const parseLogFile = (file: File, fileName?: string): Promise<LogEntry[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        const fName = fileName || file.name;

        reader.onload = (e) => {
            const text = e.target?.result as string;

            // Offload to Worker
            const worker = new ParserWorker();

            worker.onmessage = (event) => {
                resolve(event.data);
                worker.terminate();
            };

            worker.onerror = (error) => {
                reject(error);
                worker.terminate();
            };

            worker.postMessage({ text, fileName: fName });
        };

        reader.onerror = (err) => reject(err);
        reader.readAsText(file);
    });
};
