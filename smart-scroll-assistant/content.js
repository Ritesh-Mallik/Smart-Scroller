(function attachSmartScrollContent() {
  if (window.__smartScrollContentLoaded) {
    return;
  }
  window.__smartScrollContentLoaded = true;

  const COMMANDS = window.SmartScrollUtils?.COMMANDS || {
    SCROLL_UP: "scrollUp",
    SCROLL_DOWN: "scrollDown",
    STOP: "stop",
    NEXT_PAGE: "nextPage",
    PREVIOUS_PAGE: "previousPage",
    PAUSE: "pause",
    RESUME: "resume"
  };

  let continuousTimer = 0;
  let paused = false;
  let lastSettings = {
    scrollSpeed: 650,
    continuousScrollEnabled: false
  };

  function getScrollableElement() {
    const candidates = [
      document.scrollingElement,
      document.documentElement,
      document.body,
      document.querySelector("[role='main']"),
      document.querySelector(".kix-appview-editor"),
      document.querySelector(".ndfHFb-c4YZDc-cYSp0e-DARUcf"),
      document.querySelector("embed[type='application/pdf']")
    ].filter(Boolean);

    return candidates.find((element) => {
      const style = window.getComputedStyle(element);
      return element.scrollHeight > element.clientHeight && style.overflowY !== "hidden";
    }) || document.scrollingElement || document.documentElement || document.body;
  }

  function smoothScroll(amount) {
    const element = getScrollableElement();
    if (element === document.body || element === document.documentElement || element === document.scrollingElement) {
      window.scrollBy({ top: amount, behavior: "smooth" });
      return;
    }

    element.scrollBy({ top: amount, behavior: "smooth" });
  }

  function dispatchKeyboardFallback(keys) {
    const target = document.activeElement || document.body;
    keys.forEach((key) => {
      const eventInit = {
        key,
        code: key,
        bubbles: true,
        cancelable: true
      };
      target.dispatchEvent(new KeyboardEvent("keydown", eventInit));
      target.dispatchEvent(new KeyboardEvent("keyup", eventInit));
      document.dispatchEvent(new KeyboardEvent("keydown", eventInit));
      document.dispatchEvent(new KeyboardEvent("keyup", eventInit));
    });
  }

  function scrollUp(settings = lastSettings) {
    if (paused) return;
    stopScroll();
    smoothScroll(-Number(settings.scrollSpeed || lastSettings.scrollSpeed));
    dispatchKeyboardFallback(["ArrowUp"]);
  }

  function scrollDown(settings = lastSettings) {
    if (paused) return;
    stopScroll();
    smoothScroll(Number(settings.scrollSpeed || lastSettings.scrollSpeed));
    dispatchKeyboardFallback(["ArrowDown"]);
  }

  function continuousScroll(direction, settings = lastSettings) {
    if (paused) return;
    stopScroll();

    const step = direction === "up" ? -80 : 80;
    continuousTimer = window.setInterval(() => {
      smoothScroll(step);
    }, Math.max(30, 150 - Number(settings.scrollSpeed || lastSettings.scrollSpeed) / 14));
  }

  function nextPage(settings = lastSettings) {
    if (paused) return;
    stopScroll();
    smoothScroll(Number(settings.scrollSpeed || lastSettings.scrollSpeed) * 1.25);
    dispatchKeyboardFallback(["PageDown", "ArrowRight", "ArrowDown"]);
  }

  function previousPage(settings = lastSettings) {
    if (paused) return;
    stopScroll();
    smoothScroll(-Number(settings.scrollSpeed || lastSettings.scrollSpeed) * 1.25);
    dispatchKeyboardFallback(["PageUp", "ArrowLeft", "ArrowUp"]);
  }

  function stopScroll() {
    if (continuousTimer) {
      clearInterval(continuousTimer);
      continuousTimer = 0;
    }
  }

  function pause() {
    paused = true;
    stopScroll();
  }

  function resume() {
    paused = false;
  }

  function runAction(payload = {}) {
    const settings = { ...lastSettings, ...(payload.settings || {}) };
    lastSettings = settings;

    switch (payload.action) {
      case COMMANDS.SCROLL_UP:
        settings.continuousScrollEnabled ? continuousScroll("up", settings) : scrollUp(settings);
        break;
      case COMMANDS.SCROLL_DOWN:
        settings.continuousScrollEnabled ? continuousScroll("down", settings) : scrollDown(settings);
        break;
      case COMMANDS.NEXT_PAGE:
        nextPage(settings);
        break;
      case COMMANDS.PREVIOUS_PAGE:
        previousPage(settings);
        break;
      case COMMANDS.STOP:
        stopScroll();
        break;
      case COMMANDS.PAUSE:
        pause();
        break;
      case COMMANDS.RESUME:
        resume();
        break;
      default:
        return { ok: false, error: "Unknown scroll command." };
    }

    return { ok: true, paused };
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || message.type !== "SMART_SCROLL_COMMAND") {
      return false;
    }

    sendResponse(runAction(message.payload));
    return true;
  });

  window.SmartScrollContent = {
    scrollUp,
    scrollDown,
    stopScroll,
    nextPage,
    previousPage,
    smoothScroll,
    continuousScroll
  };
})();
