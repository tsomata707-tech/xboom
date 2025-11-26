
import { Timestamp } from 'firebase/firestore';

export const convertTimestamps = (data: any, seen = new WeakSet<object>()): any => {
    // 1. Handle primitives
    if (data === null || data === undefined || typeof data !== 'object') {
        return data;
    }

    // 2. Prevent Circular References
    if (seen.has(data)) {
        return null;
    }
    seen.add(data);

    // 3. Handle Firestore Timestamp
    // Check for toMillis function
    if (typeof data.toMillis === 'function') {
        return data.toMillis();
    }
    // Check for seconds/nanoseconds properties (duck typing)
    if ('seconds' in data && 'nanoseconds' in data) {
        try {
            return new Timestamp(data.seconds, data.nanoseconds).toMillis();
        } catch (e) {
            return Date.now();
        }
    }

    // 4. Handle standard Date objects
    if (data instanceof Date) {
        return data.getTime();
    }

    // 5. Handle Arrays recursively
    if (Array.isArray(data)) {
        return data.map(item => convertTimestamps(item, seen));
    }

    // 6. Handle React Internals or DOM Nodes (Safety check)
    if (data['$$typeof'] || data.nodeType || data._owner) {
        return null;
    }

    // 7. Handle Objects recursively
    // We create a new plain object to strip prototype chains and internal SDK circular references
    const result: { [key: string]: any } = {};
    for (const key in data) {
        // Skip internal Firebase/SDK keys that often cause circular issues
        if (key.startsWith('__') || key === 'auth' || key === 'firestore' || key === 'storage' || key === 'app' || key === 'database') continue;
        
        try {
            // Only copy own properties to avoid prototype pollution and getters
            if (Object.prototype.hasOwnProperty.call(data, key)) {
                result[key] = convertTimestamps(data[key], seen);
            }
        } catch (e) {
            // Ignore properties that throw errors on access
        }
    }
    return result;
};
