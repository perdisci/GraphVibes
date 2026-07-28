// Sanity-checks the host/port used to build the Gremlin WebSocket URL.
//
// This app is a Gremlin console: connecting to arbitrary hosts is the whole
// point, so this intentionally does NOT restrict *which* hosts can be
// reached. It only rejects malformed input that could break out of the
// `ws://${host}:${port}/gremlin` template (e.g. embedded `://`, `@`, path
// separators, or whitespace/control characters), and out-of-range ports.
//
// Operators who run this somewhere more exposed than a trusted local
// machine can opt into an allowlist via the GREMLIN_ALLOWED_HOSTS env var
// (comma-separated hostnames/IPs). It is unset - i.e. unrestricted - by
// default.

const HOST_PATTERN = /^[A-Za-z0-9.\-:_]+$/;

export const validateConnectionTarget = (host, port) => {
    if (typeof host !== 'string' || host.length === 0 || host.length > 255) {
        return { valid: false, error: 'Invalid host' };
    }
    if (!HOST_PATTERN.test(host)) {
        return { valid: false, error: 'Host contains invalid characters' };
    }

    const portNum = Number(port);
    if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
        return { valid: false, error: 'Invalid port' };
    }

    const allowedHosts = (process.env.GREMLIN_ALLOWED_HOSTS || '')
        .split(',')
        .map(h => h.trim())
        .filter(Boolean);

    if (allowedHosts.length > 0 && !allowedHosts.includes(host)) {
        return { valid: false, error: 'Host is not in GREMLIN_ALLOWED_HOSTS' };
    }

    return { valid: true };
};
