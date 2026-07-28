// Unwraps GraphSON 3.0's typed `{"@type": ..., "@value": ...}` wrapper format
// into plain JS values/objects, and formats the resulting profile/explain
// output for display in the query console.

export const parseGraphSON = (item) => {
    if (item === null || item === undefined) return item;

    if (Array.isArray(item)) {
        return item.map(parseGraphSON);
    }

    if (typeof item === 'object') {
        if (item['@value'] !== undefined) {
            const type = item['@type'];
            const value = item['@value'];

            if (type === 'g:Map') {
                const map = {};
                if (Array.isArray(value)) {
                    for (let i = 0; i < value.length; i += 2) {
                        const k = parseGraphSON(value[i]);
                        const v = parseGraphSON(value[i + 1]);
                        map[k] = v;
                    }
                }
                return map;
            }
            if (type === 'g:List' || type === 'g:Set') {
                return parseGraphSON(value);
            }
            // For other types like g:Int64, g:Double, g:Metrics, etc., just unwrap/recurse
            return parseGraphSON(value);
        }

        // Regular object, recurse keys
        const newObj = {};
        for (const k in item) {
            newObj[k] = parseGraphSON(item[k]);
        }
        return newObj;
    }

    return item;
};

export const formatProfileData = (rawData) => {
    // 1. Parse GraphSON if present
    const parsed = parseGraphSON(rawData);

    // 2. Extract profile object (usually in an array)
    let profileObj = parsed;
    if (Array.isArray(parsed) && parsed.length > 0) {
        profileObj = parsed[0];
    }

    if (!profileObj || !profileObj.metrics) return JSON.stringify(parsed, null, 2);

    const metrics = profileObj.metrics;
    let output = '';

    // Header
    output += 'Dur: ' + (profileObj.dur ? profileObj.dur.toFixed(4) : 'N/A') + ' ms\n\n';

    // Columns
    const pad = (str, len, char = ' ') => (str + '').padEnd(len, char);
    const padL = (str, len, char = ' ') => (str + '').padStart(len, char);

    output += pad('Step', 50) + padL('Count', 12) + padL('Traversers', 12) + padL('Time (ms)', 15) + padL('% Dur', 10) + '\n';
    output += pad('', 50 + 12 + 12 + 15 + 10, '=') + '\n';

    const printMetric = (metric, indent = 0) => {
        const name = (metric.name || 'Unknown').substring(0, 48 - indent);
        const count = metric.counts ? (metric.counts.elementCount || metric.counts.traverserCount || 0) : 0;
        const traversers = metric.counts ? (metric.counts.traverserCount || 0) : 0;
        const dur = metric.dur || 0;
        const perc = metric.percDur || 0;
        const indentStr = ' '.repeat(indent);

        output += pad(indentStr + name, 50) + padL(count, 12) + padL(traversers, 12) + padL(dur.toFixed(3), 15) + padL(perc.toFixed(2), 10) + '\n';

        if (metric.annotations) {
            Object.entries(metric.annotations).forEach(([key, val]) => {
                output += '    ' + indentStr + key + ': ' + val + '\n';
            });
        }

        if (metric.metrics && Array.isArray(metric.metrics)) {
            metric.metrics.forEach(m => printMetric(m, indent + 2));
        }
    };

    metrics.forEach(m => printMetric(m));

    return output;
};

export const formatExplainData = (rawData) => {
    // 1. Parse GraphSON if present
    const parsed = parseGraphSON(rawData);

    // 2. Extract explanation object (usually in an array)
    let explainObj = parsed;
    if (Array.isArray(parsed) && parsed.length > 0) {
        explainObj = parsed[0];
    }

    // Fallback if not standard structure
    if (!explainObj) return JSON.stringify(parsed, null, 2);

    // Try to format nicely if it has expected fields
    let output = '';

    if (explainObj.original) {
        output += 'Original Traversal\n' + '=============================================================================================================\n';
        // original might be array or string
        const orig = Array.isArray(explainObj.original) ? explainObj.original.join('\n') : explainObj.original;
        output += (orig || '') + '\n\n';
    }

    if (explainObj.final) {
        output += 'Final Traversal\n' + '=============================================================================================================\n';
        const final = Array.isArray(explainObj.final) ? explainObj.final.join('\n') : explainObj.final;
        output += (final || '') + '\n\n';
    }

    return output || JSON.stringify(explainObj, null, 2);
};
