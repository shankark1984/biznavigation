async function clearServiceWorkersAndCache() {
    try {
        // Unregister Service Workers
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();

            for (const reg of registrations) {
                const success = await reg.unregister();
                console.log(success
                    ? `Unregistered: ${reg.scope}`
                    : `Failed: ${reg.scope}`);
            }
        }

        // Clear Cache Storage
        if ('caches' in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map(key => caches.delete(key)));
            console.log("All caches cleared");
        }

    } catch (err) {
        console.error("Cleanup error:", err);
    }
}