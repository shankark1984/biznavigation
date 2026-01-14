
document.addEventListener('keydown', (e) => {

    // ❌ Ignore when typing in input / textarea
    const tag = document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    function trigger(btn) {
        if (!btn || btn.disabled) return; // 🔒 disabled = shortcut disabled
        btn.click();
    }

    if (e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        trigger(newButton);
    }

    if (e.altKey && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        trigger(modifyButton);
    }

    if (e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        trigger(saveButton);
    }
    if (e.altKey && e.key.toLowerCase() === 'u') {
        e.preventDefault();
        trigger(saveButton);
    }

    if (e.altKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        trigger(deleteButton);
    }

    if (e.altKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        trigger(reportButton);
    }
});
