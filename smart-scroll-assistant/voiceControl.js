(function attachVoiceControl() {
  class VoiceControl {
    constructor({ onCommand, onStatus, onError }) {
      this.onCommand = onCommand;
      this.onStatus = onStatus;
      this.onError = onError;
      this.recognition = null;
      this.isRunning = false;
      this.shouldRestart = false;
    }

    isSupported() {
      return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
    }

    start() {
      if (!this.isSupported()) {
        this.onError("Web Speech API is not supported in this browser.");
        return false;
      }

      if (this.isRunning) {
        return true;
      }

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();
      this.recognition.lang = "en-US";
      this.recognition.continuous = true;
      this.recognition.interimResults = false;
      this.recognition.maxAlternatives = 1;
      this.shouldRestart = true;

      this.recognition.onstart = () => {
        this.isRunning = true;
        this.onStatus("Voice listening");
      };

      this.recognition.onresult = (event) => {
        const latest = event.results[event.results.length - 1];
        const transcript = latest?.[0]?.transcript || "";
        const parsed = window.SmartScrollUtils.normalizeCommand(transcript);
        if (parsed) {
          this.onCommand({ ...parsed, raw: transcript, source: "voice" });
        } else {
          this.onStatus(`Heard: ${transcript}`);
        }
      };

      this.recognition.onerror = (event) => {
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          this.shouldRestart = false;
          this.onError("Microphone permission denied. Enable microphone access and try again.");
        } else if (event.error === "no-speech") {
          this.onStatus("No speech detected");
        } else {
          this.onError(`Voice error: ${event.error}`);
        }
      };

      this.recognition.onend = () => {
        this.isRunning = false;
        if (this.shouldRestart) {
          window.setTimeout(() => {
            try {
              this.recognition?.start();
            } catch (error) {
              this.onError(error.message);
            }
          }, 350);
        } else {
          this.onStatus("Voice stopped");
        }
      };

      try {
        this.recognition.start();
        return true;
      } catch (error) {
        this.onError(error.message);
        return false;
      }
    }

    stop() {
      this.shouldRestart = false;
      if (this.recognition) {
        this.recognition.stop();
      }
      this.isRunning = false;
      this.onStatus("Voice stopped");
    }

    test() {
      if (!this.isSupported()) {
        this.onError("Web Speech API is not supported in this browser.");
        return;
      }
      this.onStatus("Say: scroll down, scroll up, next page, stop, pause, or resume.");
    }
  }

  window.SmartScrollVoiceControl = VoiceControl;
})();
