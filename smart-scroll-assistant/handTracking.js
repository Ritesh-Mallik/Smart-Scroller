(function attachHandTracking() {
  const COMMANDS = window.SmartScrollUtils.COMMANDS;

  class HandTracking {
    constructor({ video, canvas, onCommand, onStatus, onError }) {
      this.video = video;
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.onCommand = onCommand;
      this.onStatus = onStatus;
      this.onError = onError;
      this.stream = null;
      this.hands = null;
      this.hasMediaPipeResult = false;
      this.processingFrame = false;
      this.animationId = 0;
      this.lastGestureAt = 0;
      this.lastWristY = null;
      this.lastFrame = null;
      this.sensitivity = 5;
      this.previewEnabled = true;
      this.pausedByPalm = false;
    }

    async start(settings = {}) {
      this.sensitivity = Number(settings.sensitivity || 5);
      this.previewEnabled = Boolean(settings.cameraPreviewEnabled);

      if (!navigator.mediaDevices?.getUserMedia) {
        this.onError("Camera is not available in this browser.");
        return false;
      }

      try {
        this.stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: "user" },
          audio: false
        });
        this.video.srcObject = this.stream;
        await this.video.play();
        await this.tryLoadMediaPipe();
        this.onStatus(this.hands ? "MediaPipe hand tracking active" : "Camera motion fallback active");
        this.loop();
        return true;
      } catch (error) {
        this.onError(error.name === "NotAllowedError" ? "Camera permission denied. Enable camera access and try again." : `Camera error: ${error.message}`);
        return false;
      }
    }

    stop() {
      cancelAnimationFrame(this.animationId);
      this.animationId = 0;
      this.lastFrame = null;
      this.lastWristY = null;
      if (this.stream) {
        this.stream.getTracks().forEach((track) => track.stop());
      }
      this.stream = null;
      this.video.srcObject = null;
      this.clearCanvas();
      if (this.hands?.close) {
        this.hands.close();
      }
      this.hands = null;
      this.onStatus("Hand tracking stopped");
    }

    async tryLoadMediaPipe() {
      if (this.hands) {
        return;
      }

      try {
        if (!window.Hands) {
          throw new Error("MediaPipe Hands script is unavailable.");
        }

        this.hands = new window.Hands({
          locateFile: (file) => chrome.runtime.getURL(`vendor/mediapipe/${file}`)
        });
        this.hands.setOptions({
          maxNumHands: 1,
          modelComplexity: 1,
          minDetectionConfidence: 0.65,
          minTrackingConfidence: 0.55
        });
        this.hands.onResults((results) => {
          const landmarks = results.multiHandLandmarks?.[0];
          this.hasMediaPipeResult = Boolean(landmarks);
          if (landmarks) {
            this.drawLandmarks(landmarks);
            this.handleLandmarkGesture(landmarks);
          }
        });
      } catch (error) {
        this.hands = null;
      }
    }

    async loop() {
      if (!this.stream) {
        return;
      }

      this.drawPreview();

      if (this.hands) {
        if (!this.processingFrame) {
          this.processingFrame = true;
          try {
            await this.hands.send({ image: this.video });
          } catch (error) {
            this.hands = null;
            this.onStatus("MediaPipe stopped; using camera motion fallback");
          } finally {
            this.processingFrame = false;
          }
        }
      } else {
        this.handleMotionFallback();
      }

      this.animationId = requestAnimationFrame(() => this.loop());
    }

    drawPreview() {
      const { width, height } = this.canvas;
      this.ctx.clearRect(0, 0, width, height);
      if (!this.previewEnabled) {
        return;
      }
      this.ctx.save();
      this.ctx.scale(-1, 1);
      this.ctx.drawImage(this.video, -width, 0, width, height);
      this.ctx.restore();
    }

    drawLandmarks(landmarks) {
      if (!this.previewEnabled) {
        return;
      }

      this.ctx.fillStyle = "#2af0b6";
      landmarks.forEach((point) => {
        this.ctx.beginPath();
        this.ctx.arc((1 - point.x) * this.canvas.width, point.y * this.canvas.height, 3, 0, Math.PI * 2);
        this.ctx.fill();
      });
    }

    clearCanvas() {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    handleLandmarkGesture(landmarks) {
      const fingers = this.getFingerStates(landmarks);
      const extendedCount = Object.values(fingers).filter(Boolean).length;
      const wrist = landmarks[0];
      const indexTip = landmarks[8];
      const middleTip = landmarks[12];
      const thumbTip = landmarks[4];
      const now = Date.now();
      const swipeThreshold = 0.11 - this.sensitivity * 0.006;

      if (this.lastWristY !== null) {
        const deltaY = wrist.y - this.lastWristY;
        if (deltaY < -swipeThreshold) {
          this.emit(COMMANDS.SCROLL_UP, "Swipe upward", now);
        } else if (deltaY > swipeThreshold) {
          this.emit(COMMANDS.SCROLL_DOWN, "Swipe downward", now);
        }
      }
      this.lastWristY = wrist.y;

      if (extendedCount >= 4) {
        const action = this.pausedByPalm ? COMMANDS.RESUME : COMMANDS.PAUSE;
        this.pausedByPalm = !this.pausedByPalm;
        this.emit(action, this.pausedByPalm ? "Open palm pause" : "Open palm resume", now, 1200);
        return;
      }

      if (extendedCount === 0) {
        this.emit(COMMANDS.STOP, "Fist stop", now);
        return;
      }

      if (fingers.index && fingers.middle && !fingers.ring && !fingers.pinky) {
        this.emit(COMMANDS.NEXT_PAGE, "Two fingers next page", now);
        return;
      }

      if (fingers.index && !fingers.middle && !fingers.ring && !fingers.pinky) {
        const isPointingUp = indexTip.y < landmarks[6].y;
        this.emit(isPointingUp ? COMMANDS.SCROLL_UP : COMMANDS.SCROLL_DOWN, isPointingUp ? "Index finger up" : "Index finger down", now);
        return;
      }

      const thumbHorizontal = Math.abs(thumbTip.x - landmarks[2].x) > 0.16;
      if (thumbHorizontal && extendedCount <= 2) {
        const action = thumbTip.x < middleTip.x ? COMMANDS.PREVIOUS_PAGE : COMMANDS.NEXT_PAGE;
        this.emit(action, action === COMMANDS.PREVIOUS_PAGE ? "Thumb left previous page" : "Thumb right next page", now);
      }
    }

    getFingerStates(landmarks) {
      return {
        thumb: Math.abs(landmarks[4].x - landmarks[2].x) > 0.12,
        index: landmarks[8].y < landmarks[6].y,
        middle: landmarks[12].y < landmarks[10].y,
        ring: landmarks[16].y < landmarks[14].y,
        pinky: landmarks[20].y < landmarks[18].y
      };
    }

    handleMotionFallback() {
      const sampleCanvas = document.createElement("canvas");
      sampleCanvas.width = 48;
      sampleCanvas.height = 36;
      const sampleCtx = sampleCanvas.getContext("2d", { willReadFrequently: true });
      sampleCtx.drawImage(this.video, 0, 0, sampleCanvas.width, sampleCanvas.height);
      const frame = sampleCtx.getImageData(0, 0, sampleCanvas.width, sampleCanvas.height).data;

      if (!this.lastFrame) {
        this.lastFrame = frame;
        return;
      }

      let upperMotion = 0;
      let lowerMotion = 0;
      for (let y = 0; y < sampleCanvas.height; y += 1) {
        for (let x = 0; x < sampleCanvas.width; x += 1) {
          const i = (y * sampleCanvas.width + x) * 4;
          const diff = Math.abs(frame[i] - this.lastFrame[i]) + Math.abs(frame[i + 1] - this.lastFrame[i + 1]) + Math.abs(frame[i + 2] - this.lastFrame[i + 2]);
          if (diff > 85) {
            if (y < sampleCanvas.height / 2) upperMotion += 1;
            else lowerMotion += 1;
          }
        }
      }

      const threshold = 42 - this.sensitivity * 3;
      if (upperMotion - lowerMotion > threshold) {
        this.emit(COMMANDS.SCROLL_UP, "Upward hand motion");
      } else if (lowerMotion - upperMotion > threshold) {
        this.emit(COMMANDS.SCROLL_DOWN, "Downward hand motion");
      }
      this.lastFrame = frame;
    }

    emit(action, label, now = Date.now(), cooldown = 700) {
      if (now - this.lastGestureAt < cooldown) {
        return;
      }
      this.lastGestureAt = now;
      this.onCommand({ action, label, source: "hand" });
    }

    test() {
      this.onStatus("Turn on hand control, allow camera access, then try palm, fist, finger, or swipe gestures.");
    }
  }

  window.SmartScrollHandTracking = HandTracking;
})();
