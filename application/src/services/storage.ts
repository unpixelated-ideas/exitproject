// Version 2 starts with clean preferences and drafts after the initial UI testing.
// Subsequent explicit user choices continue to persist normally.
const namespace = 'mta-exit:v2';
export const storage = {
    read(key: string): unknown { try {
        const value = localStorage.getItem(`${namespace}:${key}`);
        return value ? JSON.parse(value) : null;
    }
    catch {
        return null;
    } },
    write(key: string, value: unknown) { try {
        localStorage.setItem(`${namespace}:${key}`, JSON.stringify(value));
    }
    catch { /* Voting remains usable when storage is unavailable. */ } }
};
