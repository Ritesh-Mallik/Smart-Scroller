(function attachSmartScrollUtils() {
  const DEFAULT_SETTINGS = {
    voiceEnabled: false,
    handEnabled: false,
    scrollSpeed: 650,
    sensitivity: 5,
    continuousScrollEnabled: false,
    cameraPreviewEnabled: true
  };

  const COMMANDS = {
    SCROLL_UP: "scrollUp",
    SCROLL_DOWN: "scrollDown",
    STOP: "stop",
    NEXT_PAGE: "nextPage",
    PREVIOUS_PAGE: "previousPage",
    PAUSE: "pause",
    RESUME: "resume",
    STATUS: "status"
  };

  function normalizeCommand(text) {
    const phrase = String(text || "").toLowerCase().trim();

    if (phrase.includes("scroll down") || phrase.includes("go down") || phrase === "down") {
      return { action: COMMANDS.SCROLL_DOWN, label: "Scroll down" };
    }
    if (phrase.includes("scroll up") || phrase.includes("go up") || phrase === "up") {
      return { action: COMMANDS.SCROLL_UP, label: "Scroll up" };
    }
    if (phrase.includes("next page") || phrase.includes("next slide") || phrase.includes("page down")) {
      return { action: COMMANDS.NEXT_PAGE, label: "Next page" };
    }
    if (phrase.includes("previous page") || phrase.includes("prev page") || phrase.includes("previous slide") || phrase.includes("page up")) {
      return { action: COMMANDS.PREVIOUS_PAGE, label: "Previous page" };
    }
    if (phrase.includes("stop")) {
      return { action: COMMANDS.STOP, label: "Stop" };
    }
    if (phrase.includes("pause")) {
      return { action: COMMANDS.PAUSE, label: "Pause" };
    }
    if (phrase.includes("resume") || phrase.includes("start again")) {
      return { action: COMMANDS.RESUME, label: "Resume" };
    }

    return null;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, Number(value)));
  }

  function debounce(fn, wait) {
    let timeoutId = 0;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), wait);
    };
  }

  window.SmartScrollUtils = {
    DEFAULT_SETTINGS,
    COMMANDS,
    normalizeCommand,
    clamp,
    debounce
  };
})();
