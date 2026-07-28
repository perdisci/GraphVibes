// Shared helpers for normalizing Gremlin element IDs, which can be numbers,
// strings, or composite objects (e.g. PuppyGraph IDs), into a form usable as
// a deterministic Map/Set key.

export const getId = (obj) => {
    if (obj && typeof obj === 'object' && obj.id) return obj.id;
    return obj;
};

export const getSafeKey = (id) => {
    if (id && typeof id === 'object') {
        // Sort keys to ensure deterministic string
        const keys = Object.keys(id).sort();
        if (keys.length === 0 && typeof id.toString === 'function') {
            // Handle Longs or custom classes with no enumerable props but valid toString
            const s = id.toString();
            if (s !== '[object Object]') return s;
        }
        const sorted = {};
        keys.forEach(k => sorted[k] = id[k]);
        return JSON.stringify(sorted);
    }
    return id;
};

// Roughly serializes Gremlin driver result items (Maps, bigints, nested
// objects/arrays) into plain JSON-friendly values.
export const formatResult = (item) => {
    if (item === null || item === undefined) return item;
    if (typeof item === 'bigint') return Number(item);

    if (item instanceof Map) {
        const obj = {};
        for (const [key, value] of item.entries()) {
            obj[String(key)] = formatResult(value);
        }
        return obj;
    }

    if (Array.isArray(item)) {
        return item.map(formatResult);
    }

    if (typeof item === 'object') {
        const obj = {};
        for (const key in item) {
            if (Object.prototype.hasOwnProperty.call(item, key)) {
                obj[key] = formatResult(item[key]);
            }
        }
        return obj;
    }

    return item;
};
