"use strict";
(() => {
  let active = null,
    oldOverflow = "",
    oldFocus = null,
    nativeStarted = false;
  function restore() {
    if (!active) return;
    active.classList.remove("presenting");
    active = null;
    document.body.style.overflow = oldOverflow;
    if (oldFocus?.isConnected) oldFocus.focus();
    nativeStarted = false;
  }
  async function exit() {
    if (!active) return;
    const wasNative = document.fullscreenElement === active;
    restore();
    if (wasNative && document.exitFullscreen) {
      try {
        await document.exitFullscreen();
      } catch {}
    }
  }
  async function enter(element) {
    if (active) await exit();
    oldFocus = document.activeElement;
    oldOverflow = document.body.style.overflow;
    active = element;
    active.classList.add("presenting");
    document.body.style.overflow = "hidden";
    active.querySelector(".exit-presentation")?.focus();
    // CSS provides a full-window fallback when browser/device fullscreen is unavailable.
    if (element.requestFullscreen) {
      try {
        await element.requestFullscreen();
        nativeStarted =
          active === element && document.fullscreenElement === element;
      } catch {
        nativeStarted = false;
      }
    }
  }
  document.addEventListener("click", (event) => {
    const button = event.target.closest(
      "[data-present-target], [data-present-exit]",
    );
    if (!button) return;
    if (button.hasAttribute("data-present-exit")) exit();
    else {
      const element = document.getElementById(button.dataset.presentTarget);
      if (element) enter(element);
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && active) {
      event.preventDefault();
      exit();
    }
  });
  document.addEventListener("fullscreenchange", () => {
    if (active && document.fullscreenElement === active) nativeStarted = true;
    else if (nativeStarted && !document.fullscreenElement) restore();
  });
})();
