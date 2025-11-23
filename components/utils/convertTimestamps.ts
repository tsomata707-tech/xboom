
// Utility to convert Firestore Timestamps and JS Dates to numbers for JSON-serializable state
// Includes strict cycle detection and prototype checking to prevent "Converting circular structure to JSON" errors
export const convertTimestamps = (data: any, visited = new WeakSet()): any => {
    // Handles null, undefined, primitives
    if (!data || typeof data !== 'object') {
        return data;
    }

    // Detect circular references
    if (visited.has(data)) {
        return null; 
    }
    visited.add(data);

    // Firestore Timestamps (from server) have a toMillis method.
    if (typeof data.toMillis === 'function') {
        return data.toMillis();
    }

    // JavaScript Date objects.
    if (data instanceof Date) {
        return data.getTime();
    }

    // Arrays: recurse on each element.
    if (Array.isArray(data)) {
        return data.map(item => convertTimestamps(item, visited));
    }
    
    // Handle plain objects strictly.
    // This check (!proto || proto === Object.prototype) ensures we don't traverse 
    // complex class instances (like Firestore DocumentReference or Snapshot) 
    // which are the usual cause of circular JSON errors.
    const proto = Object.getPrototypeOf(data);
    if (!proto || proto === Object.prototype) {
        const res: { [key: string]: any } = {};
        for (const key of Object.keys(data)) {
            res[key] = convertTimestamps(data[key], visited);
        }
        return res;
    }
    
    // For any other complex object (like FieldValue sentinels, DOM nodes, Firestore refs, etc.)
    // return null to be safe and prevent crashes.
    return null;
};
