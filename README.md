# ScreenRec

A modern, high-performance desktop screen recorder built with **Electron** and **Node.js**. 

Record your entire display or individual application windows, overlay your webcam with draggable picture-in-picture (PiP), capture and mix microphone and desktop audio, and export cleanly to **MP4, WebM, MOV, AVI, or animated WebP**.

---

## 🌟 Key Features

- **Quick 1-Click Modes**:
  - 🖥️ **Bare Skjermen (Screen Only)** — instantly stream and record your full display.
  - 🎥 **Skjerm + Webcam (Screen + Camera)** — overlay your webcam directly onto your screen capture with draggable positioning.
  - 🤳 **Kun Webcam (Webcam Only)** — record directly from your webcam camera as the primary video source.
- **Source Filtering & Live Thumbnails**:
  - Filter by **Alle (All)**, **Skjermer (Screens)**, or **Vinduer (Windows)**.
  - Live window thumbnails and instant refresh (`⟳`) with active status feedback.
- **Draggable Webcam Overlay (Picture-in-Picture)**:
  - Reposition your webcam feed anywhere over the preview in real-time.
  - Rounded corners, clean border accent, and seamless stream composition.
- **Multi-Track Audio Capture**:
  - Record voice narration via microphone with echo-cancellation and noise suppression.
  - Capture desktop/system audio.
  - Direct low-latency hardware audio routing.
- **Multi-Format Video Export via Bundled FFmpeg**:
  - Save directly to **MP4 (H.264/AAC)**, **WebM (VP9/VP8)**, **MOV (QuickTime)**, **AVI**, or **Animated WebP**.
  - Built-in fallback path resolver with support for bundled `ffmpeg-static`, Homebrew, and system binaries.
- **Cross-Platform Compatibility**:
  - **macOS**: ScreenCaptureKit integration, concurrency-safe session caching, and Apple privacy permissions handling.
  - **Windows**: Full screen, window, webcam, and native loopback audio capture.
  - **Linux / Ubuntu**: Desktop portal and PipeWire compatibility.
- **Sleek Frameless Dark UI**:
  - Custom dark interface with interactive controls, recording timer badge, and window management controls.

---

## 📋 Requirements

- [Node.js](https://nodejs.org/) (version 18 or higher recommended)
- `npm` (bundled with Node.js)
- Supported Operating Systems:
  - **macOS** (macOS 12.3+ recommended for ScreenCaptureKit)
  - **Windows** (Windows 10 / 11)
  - **Linux** (Ubuntu 20.04+, Debian, Fedora, Arch)

---

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/HollmanRivero/ScreenRec.git
cd ScreenRec
```

### 2. Install Dependencies

```bash
npm install
```

> **Note:** `node_modules/` is excluded from git via `.gitignore` and is installed locally during this step.

### 3. Launch the Application

```bash
npm start
```

### 4. Run Automated End-to-End Tests

```bash
npm test
```

This tests screen and window enumeration, category filters, quick modes, preview streaming, and sample recording generation.

---

## 📦 Packaging & Distributing

Build standalone executable installers for your operating system:

```bash
# Build desktop packages for current OS (produces DMG/ZIP on Mac, NSIS on Windows)
npm run dist
```

Installers and packaged binaries are placed inside the `dist/` folder.

---

## 📖 How to Use

1. **Choose a Mode or Source**:
   - Click one of the **Hurtigvalg** quick cards (**Bare Skjermen**, **Skjerm + Webcam**, or **Kun Webcam**).
   - Alternatively, choose a specific window or display under the **Skjermer** or **Vinduer** tabs.
2. **Adjust Audio & Overlay**:
   - Toggle **Webcam**, **Webcam preview**, **Mikrofon (Mic)**, or **Systemlyd (Desktop Audio)**.
   - If the webcam overlay is active, click and drag it to your desired position inside the preview area.
3. **Select Export Format**:
   - Pick your desired container format from the dropdown: **MP4**, **WebM**, **MOV**, **AVI**, or **Animated WebP**.
4. **Record**:
   - Click **Start Opptak** to begin recording. The live timer and red recording badge will appear.
5. **Save**:
   - Click **Stopp Opptak**. A standard system save dialog appears allowing you to select your save destination.

---

## 🛠️ Project Architecture & Tech Stack

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Runtime** | [Electron](https://www.electronjs.org/) | Cross-platform desktop application framework |
| **Renderer** | HTML5, CSS3, Modern ES6+ JavaScript | High-performance user interface with zero external UI bloat |
| **Capture APIs** | `desktopCapturer` + `navigator.mediaDevices` | W3C Display Media and User Media capture pipelines |
| **Media Mixer** | Canvas 2D Stream Capture + Web Audio API | Live composition of screen and webcam feeds |
| **Video Processing** | [ffmpeg-static](https://github.com/eugeneware/ffmpeg-static) / FFmpeg | Transcoding and remuxing to MP4, MOV, AVI, and WebP |
| **Packaging** | [electron-builder](https://www.electron.build/) | Generates production installers (DMG, ZIP, NSIS) |

---

## 👤 Project Owner & Maintainer

**Hollman Enrique Salazar Rivero**

- 💬 **WhatsApp:** [wa.me/4797269623](https://wa.me/4797269623) (`+47 972 69 623`)
- 📧 **Email:** [hollman.rivero@smart-things.site](mailto:hollman.rivero@smart-things.site)

---

## 📄 License

This project is licensed under the **MIT License**. You are free to use, modify, distribute, and sell this software, provided that the original copyright notice and permission notice are included in all copies or substantial portions of the software.

See the [LICENSE](LICENSE) file for complete details.

Copyright (c) 2026 **Hollman Enrique Salazar Rivero**.
