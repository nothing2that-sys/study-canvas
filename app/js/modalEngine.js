export function setupModalManager({ documentRef = globalThis.document, interactionGuard } = {}) {
  const dialogs = [...(documentRef?.querySelectorAll?.("dialog") || [])];
  const stack = [];
  const restorers = [];

  const cleanup = (dialog) => {
    const index = stack.findIndex((entry) => entry.dialog === dialog);
    if (index < 0) return;
    const wasTop = index === stack.length - 1;
    const [entry] = stack.splice(index, 1);
    if (stack.length === 0) {
      interactionGuard?.popModalMode?.();
      entry.opener?.focus?.();
    } else if (wasTop) {
      getFocusable(stack.at(-1).dialog)[0]?.focus?.();
    }
  };

  dialogs.forEach((dialog) => {
    const nativeShow = dialog.showModal?.bind(dialog);
    const nativeClose = dialog.close?.bind(dialog);
    if (!nativeShow || !nativeClose) return;
    dialog.showModal = () => {
      if (!stack.some((entry) => entry.dialog === dialog)) {
        if (stack.length === 0) interactionGuard?.pushModalMode?.();
        stack.push({ dialog, opener: documentRef.activeElement });
      }
      nativeShow();
      queueMicrotask(() => getFocusable(dialog)[0]?.focus?.());
    };
    dialog.close = (returnValue) => {
      nativeClose(returnValue);
      cleanup(dialog);
    };
    const onClose = () => cleanup(dialog);
    const onPointerDown = (event) => {
      if (event.target === dialog && dialog.dataset.backdropClose === "true") dialog.close("backdrop");
    };
    dialog.addEventListener("close", onClose);
    dialog.addEventListener("pointerdown", onPointerDown);
    restorers.push(() => {
      dialog.showModal = nativeShow;
      dialog.close = nativeClose;
      dialog.removeEventListener("close", onClose);
      dialog.removeEventListener("pointerdown", onPointerDown);
    });
  });

  const onKeyDown = (event) => {
    if (event.key !== "Tab" || stack.length === 0) return;
    const dialog = stack.at(-1).dialog;
    const focusable = getFocusable(dialog);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && documentRef.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && documentRef.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  documentRef?.addEventListener?.("keydown", onKeyDown, true);

  return {
    get depth() {
      return stack.length;
    },
    destroy() {
      restorers.forEach((restore) => restore());
      documentRef?.removeEventListener?.("keydown", onKeyDown, true);
      stack.splice(0);
    }
  };
}

function getFocusable(dialog) {
  return [...(dialog?.querySelectorAll?.("button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex='-1'])") || [])];
}
