
import fs from 'fs';
import path from 'path';

const LOG_DIR = './analysis_logs';

function parseLine(line) {
    // Expected format: [LEVEL] [TIMESTAMP] [COMPONENT] Message...
    const parts = line.match(/^\[(.*?)\]\s+\[(.*?)\]\s+\[(.*?)\]\s+(.*)/);
    if (!parts) return null;

    const [_, level, timestamp, component, message] = parts;

    // Check for a "Tag" at the start of the message (e.g. [std-logger])
    const tagMatch = message.match(/^\[(.*?)\]/);
    const tag = tagMatch ? tagMatch[1] : null;

    return { level, timestamp, component, message, tag };
}

function analyzeLogs() {
    if (!fs.existsSync(LOG_DIR)) {
        console.error(`Directory ${LOG_DIR} not found.`);
        return;
    }

    const files = fs.readdirSync(LOG_DIR).filter(f => f.endsWith('.txt') || f.endsWith('.log'));
    console.error(`Analyzing ${files.length} files...`); // Log to stderr so it doesn't pollute JSON stdout

    const stats = {
        components: {},
        tags: {},
        totalLines: 0
    };

    files.forEach(file => {
        const content = fs.readFileSync(path.join(LOG_DIR, file), 'utf-8');
        const lines = content.split('\n');

        lines.forEach(line => {
            if (!line.trim()) return;
            const parsed = parseLine(line);
            if (parsed) {
                stats.totalLines++;

                // Count Components
                const comp = parsed.component;
                // Simplify component name
                const shortComp = comp.split('.')[0];
                stats.components[shortComp] = (stats.components[shortComp] || 0) + 1;

                // Count Tags
                if (parsed.tag) {
                    stats.tags[parsed.tag] = (stats.tags[parsed.tag] || 0) + 1;
                }
            }
        });
    });

    const output = {
        totalLines: stats.totalLines,
        topComponents: Object.entries(stats.components)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 20)
            .reduce((obj, [k, v]) => ({ ...obj, [k]: v }), {}),
        topTags: Object.entries(stats.tags)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 20)
            .reduce((obj, [k, v]) => ({ ...obj, [k]: v }), {})
    };

    const jsonOutput = JSON.stringify(output, null, 2);
    console.log(jsonOutput);
    fs.writeFileSync('analysis_report_clean.json', jsonOutput);
}

analyzeLogs();
