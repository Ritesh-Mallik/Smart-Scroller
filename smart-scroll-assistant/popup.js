const DEFAULT_SETTINGS = window.SmartScrollUtils.DEFAULT_SETTINGS;
const COMMANDS = window.SmartScrollUtils.COMMANDS;

const elements = {
  statusText: document.getElementById("statusText"),
  detectedCommand: document.getElementById("detectedCommand"),
  errorMessage: document.getElementById("errorMessage"),
  voiceToggle: document.getElementById("voiceToggle"),
  handToggle: document.getElementById("handToggle"),
  scrollSpeed: document.getElementById("scrollSpeed"),
  scrollSpeedValue: document.getElementById("scrollSpeedValue"),
  sensitivity: document.getElementById("sensitivity"),
  sensitivityValue: document.getElementById("sensitivityValue"),
  continuousToggle: document.getElementById("continuousToggle"),
  previewToggle: document.getElementById("previewToggle"),
  cameraWrap: document.getElementById("cameraWrap"),
  cameraPreview: document.getElementById("cameraPreview"),
  trackingCanvas: document.getElementById("trackingCanvas"),
  scrollUpBtn: document.getElementById("scrollUpBtn"),
  scrollDownBtn: document.getElementById("scrollDownBtn"),
  stopBtn: document.getElementById("stopBtn"),
  testVoiceBtn: document.getElementById("testVoiceBtn"),
  testCameraBtn: document.getElementById("testCameraBtn")
};

let settings = { ...DEFAULT_SETTINGS };
let voiceControl;
let handTracking;
let paused = true;

document.addEventListener("DOMContentLoaded", init);

async function init() {
  voiceControl = new window.SmartScrollVoiceControl({
    onCommand: handleDetectedCommand,
    onStatus: setStatus,
    onError: showError
  });

  handTracking = new window.SmartScrollHandTracking({
    video: elements.cameraPreview,
    canvas: elements.trackingCanvas,
    onCommand: handleDetectedCommand,
    onStatus: setStatus,
    onError: showError
  });

  await loadSettings();
  bindEvents();
  applySettingsToUi();

  if (settings.voiceEnabled) {
    voiceControl.start();
  }
  if (settings.handEnabled) {
    await startHandTracking();
  }
  updateActiveState();
}

function bindEvents() {
  elements.voiceToggle.addEventListener("change", async () => {
    settings.voiceEnabled = elements.voiceToggle.checked;
    await saveSettings();
    if (settings.voiceEnabled) {
      clearError();
      voiceControl.start();
    } else {
      voiceControl.stop();
    }
    updateActiveState();
  });

  elements.handToggle.addEventListener("change", async () => {
    settings.handEnabled = elements.handToggle.checked;
    await saveSettings();
    if (settings.handEnabled) {
      clearError();
      await startHandTracking();
    } else {
      handTracking.stop();
      elements.cameraWrap.hidden = true;
    }
    updateActiveState();
  });

  elements.scrollSpeed.addEventListener("input", () => {
    settings.scrollSpeed = Number(elements.scrollSpeed.value);
    elements.scrollSpeedValue.textContent = settings.scrollSpeed;
    debouncedSave();
  });

  elements.sensitivity.addEventListener("input", () => {
    settings.sensitivity = Number(elements.sensitivity.value);
    elements.sensitivityValue.textContent = settings.sensitivity;
    handTracking.sensitivity = settings.sensitivity;
    debouncedSave();
  });

  elements.continuousToggle.addEventListener("change", () => {
    settings.continuousScrollEnabled = elements.continuousToggle.checked;
    saveSettings();
  });

  elements.previewToggle.addEventListener("change", () => {
    settings.cameraPreviewEnabled = elements.previewToggle.checked;
    handTracking.previewEnabled = settings.cameraPreviewEnabled;
    elements.cameraWrap.hidden = !(settings.handEnabled && settings.cameraPreviewEnabled);
    saveSettings();
  });

  elements.scrollUpBtn.addEventListener("click", () => sendCommand(COMMANDS.SCROLL_UP, "Manual scroll up"));
  elements.scrollDownBtn.addEventListener("click", () => sendCommand(COMMANDS.SCROLL_DOWN, "Manual scroll down"));
  elements.stopBtn.addEventListener("click", () => sendCommand(COMMANDS.STOP, "Manual stop"));
  elements.testVoiceBtn.addEventListener("click", () => voiceControl.test());
  elements.testCameraBtn.addEventListener("click", () => handTracking.test());
}

const debouncedSave = window.SmartScrollUtils.debounce(saveSettings, 250);

async function loadSettings() {
  const stored = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  settings = { ...DEFAULT_SETTINGS, ...stored };
}

async function saveSettings() {
  await chrome.storage.sync.set(settings);
}

function applySettingsToUi() {
  elements.voiceToggle.checked = settings.voiceEnabled;
  elements.handToggle.checked = settings.handEnabled;
  elements.scrollSpeed.value = settings.scrollSpeed;
  elements.scrollSpeedValue.textContent = settings.scrollSpeed;
  elements.sensitivity.value = settings.sensitivity;
  elements.sensitivityValue.textContent = settings.sensitivity;
  elements.continuousToggle.checked = settings.continuousScrollEnabled;
  elements.previewToggle.checked = settings.cameraPreviewEnabled;
  elements.cameraWrap.hidden = !(settings.handEnabled && settings.cameraPreviewEnabled);
}

async function startHandTracking() {
  elements.cameraWrap.hidden = !settings.cameraPreviewEnabled;
  const started = await handTracking.start(settings);
  if (!started) {
    settings.handEnabled = false;
    elements.handToggle.checked = false;
    elements.cameraWrap.hidden = true;
    await saveSettings();
  }
}

function handleDetectedCommand(command) {
  elements.detectedCommand.textContent = command.label || command.raw || command.action;
  elements.detectedCommand.classList.remove("flash");
  requestAnimationFrame(() => elements.detectedCommand.classList.add("flash"));

  if (command.action === COMMANDS.PAUSE) {
    paused = true;
  } else if (command.action === COMMANDS.RESUME) {
    paused = false;
  } else if (settings.voiceEnabled || settings.handEnabled || command.source === "manual") {
    paused = false;
  }

  sendCommand(command.action, command.label || command.raw || command.action);
}

async function sendCommand(action, label) {
  clearError();
  elements.detectedCommand.textContent = label;

  if (action === COMMANDS.PAUSE) {
    paused = true;
  }
  if (action === COMMANDS.RESUME) {
    paused = false;
  }

  updateActiveState();

  try {
    const response = await chrome.runtime.sendMessage({
      type: "SMART_SCROLL_COMMAND",
      payload: {
        action,
        settings
      }
    });

    if (!response?.ok) {
      showError(response?.error || "Could not control this page.");
    }
  } catch (error) {
    showError(error.message);
  }
}

function updateActiveState() {
  const active = (settings.voiceEnabled || settings.handEnabled) && !paused;
  elements.statusText.textContent = active ? "Active" : "Paused";
  elements.statusText.classList.toggle("paused", !active);
}

function setStatus(message) {
  elements.detectedCommand.textContent = message;
  updateActiveState();
}

function showError(message) {
  elements.errorMessage.textContent = message;
  updateActiveState();
}

function clearError() {
  elements.errorMessage.textContent = "";
}
