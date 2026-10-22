export function createUpdateCoordinator({ flush, getController, waitForControllerChange, reload }) {
  let updatePromise = null;
  let reloaded = false;

  return {
    get isUpdating() {
      return updatePromise !== null;
    },
    apply(worker) {
      if (updatePromise) return updatePromise;
      updatePromise = (async () => {
        if (!worker || typeof worker.postMessage !== "function") {
          throw new Error("대기 중인 service worker가 없습니다.");
        }
        await flush();
        const previousController = getController();
        const controllerChanged = waitForControllerChange();
        worker.postMessage({ type: "SKIP_WAITING" });
        const nextController = await controllerChanged;
        if (!nextController || nextController === previousController) {
          throw new Error("새 service worker controller를 확인하지 못했습니다.");
        }
        if (!reloaded) {
          reloaded = true;
          reload();
        }
      })();
      return updatePromise.finally(() => {
        updatePromise = null;
      });
    }
  };
}

export function waitForServiceWorkerControllerChange(serviceWorkerContainer, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    let timeoutId;
    const cleanup = () => {
      clearTimeout(timeoutId);
      serviceWorkerContainer.removeEventListener("controllerchange", onChange);
    };
    const onChange = () => {
      cleanup();
      resolve(serviceWorkerContainer.controller);
    };
    timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error("service worker 교체 시간이 초과되었습니다."));
    }, timeoutMs);
    serviceWorkerContainer.addEventListener("controllerchange", onChange, { once: true });
  });
}
