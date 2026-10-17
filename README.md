# Real-Time Athlete Monitoring & Assistive Wearable System

[![Platform: ESP32](https://img.shields.io/badge/Platform-ESP32%20%7C%20ESP32--S3-blue.svg)](https://www.espressif.com/)
[![Sensors: MPU6050 | MAX30102](https://img.shields.io/badge/Sensors-MPU6050%20%7C%20MAX30102-green.svg)]()
[![Stack: Node.js | React](https://img.shields.io/badge/FullStack-Node.js%20%7C%20React-61dafb.svg)]()
[![Research: VIT Vellore](https://img.shields.io/badge/School-SENSE%20VIT%20Vellore-orange.svg)]()

A comprehensive wearable bio-kinetic monitoring and athletic assistive device built around the **ESP32/ESP32-S3**. Guided by **Dr. Zachariah C. Alex** at the School of Electronics Engineering (SENSE), VIT Vellore.

The device combines high-speed biomechanical kinematics (squat repetition tracking, spine inclination/posture analysis) with clinical physiology (photoplethysmography heart rate, blood oxygen saturation $\text{SpO}_2$, and embedded ML fall detection), streaming real-time telemetry over Wi-Fi to a Node.js backend and an interactive React web dashboard.

---

## 1. System Architecture

```
                    ┌────────────────────────────┐
                    │      ESP32 / ESP32-S3      │
                    │ Multi-Rate Task Scheduler  │
                    └──────┬──────────────┬──────┘
                           │              │
         200 Hz Kinematics │              │ 25 Hz Physiology
                           ▼              ▼
                    ┌────────────┐ ┌────────────┐
                    │  MPU6050   │ │ MAX30102 / │
                    │ 6-Axis IMU │ │  MAX30105  │
                    └─────┬──────┘ └─────┬──────┘
                          │              │
                          │              │ 16-Tap FIR Denoising
                          ▼              ▼
                    ┌────────────┐ ┌────────────┐
                    │  Squats /  │ │ HR (IBI) / │
                    │  Posture   │ │ SpO2 Ratio │
                    └─────┬──────┘ └─────┬──────┘
                          │              │
                          └──────┬───────┘
                                 │
                   Embedded ML   ▼
                 ┌──────────────────────────────┐
                 │ Random Forest Fall Detection │
                 │    (18 ms MCU Inference)     │
                 └──────────────┬───────────────┘
                                │
                                ├─────────────────────────┐
                                ▼                         ▼
                     ┌────────────────────┐    ┌────────────────────┐
                     │ 128×64 OLED Screen │    │ Wi-Fi JSON Stream  │
                     │  (Vitals + EEQA    │    │ (Node.js + React   │
                     │   Encrypted QR)    │    │  Athlete Dashboard)│
                     └────────────────────┘    └────────────────────┘
```

---

## 2. Multi-Rate Cooperative Firmware

Biomechanical motion occurs rapidly and requires high sampling rates to capture peak acceleration during athletic impacts. In contrast, physiological parameters change gradually. To optimize MCU processing without thread starvation, the firmware executes a cooperative dual-rate scheduler:

### A. High-Speed Kinematics Thread (200 Hz / 5 ms Interval)
- **Squat Repetition Counter**: Tracks vertical acceleration displacement along the y-axis with hysteresis thresholds to prevent double-counting.
- **Posture & Spine Inclination**: Calculates pitch and roll orientation angles using Euler trigonometry:
  $$\text{Pitch} = \text{atan2}(-a_x, \sqrt{a_y^2 + a_z^2}) \times \frac{180}{\pi}$$
  $$\text{Roll} = \text{atan2}(a_y, a_z) \times \frac{180}{\pi}$$
- **Impact Thresholding**: Monitors vector magnitude $A = \sqrt{a_x^2 + a_y^2 + a_z^2}$. Impacts exceeding $2.8\text{g}$ trigger immediate alerts.

### B. Physiological Vitals Thread (25 Hz / 40 ms Interval)
- **16-Tap FIR Low-Pass Filter**: Denoises raw optical photoplethysmogram (PPG) samples with a $4\text{ Hz}$ cutoff to eliminate high-frequency motion artifacts.
- **Heart Rate**: Detects systolic peaks and calculates Inter-Beat Interval (IBI):
  $$\text{HR (BPM)} = \frac{60000}{\text{IBI (ms)}}$$
- **$\text{SpO}_2$ Ratio-of-Ratios**: Compares normalized AC and DC components of Red and Infrared wavelengths:
  $$R = \frac{(AC/DC)_{\text{red}}}{(AC/DC)_{\text{IR}}}$$
  $$\text{SpO}_2 = 110 - 25 \cdot R$$
- **Validated Accuracy**: Heart Rate Mean Absolute Error (MAE) of **$2.1\text{ BPM}$**, $\text{SpO}_2$ Root Mean Square Error (RMSE) of **$1.3\%$**.

---

## 3. Embedded Machine Learning Fall Detection

To avoid false alarms from simple threshold spikes (e.g., jumping or sitting quickly), the system features a 2-stage verification:
1. **Stage 1 (Heuristic Filter)**: Checks for rapid transition: Free-fall ($A < 0.5\text{g}$) $\to$ Impact ($A > 2.8\text{g}$) $\to$ Post-fall immobility ($<0.3\text{g}$ for $3\text{ seconds}$).
2. **Stage 2 (Random Forest Classifier)**:
   - Evaluates 18 sliding-window features (variance, mean, signal magnitude area).
   - 100 decision trees (depth $\le 8$) trained on the MobiAct dataset + physical device recordings.
   - Compiled to native C via `m2cgen` for zero-overhead MCU execution (**18 ms inference latency**, **93.9% F1-score**).

### Emergency Encrypted QR (EEQA)
Upon verified fall emergencies, the OLED switches into rescue mode, rendering an on-screen encrypted QR code in **$120\text{ ms}$** containing vital patient info:
$$C_i = P_i \oplus K_{i \bmod m}$$
Total emergency detection-to-display latency: **$340\text{ ms}$**.

---

## 4. Software Dashboard Stack

- **Backend (`dashboard/backend/`)**: Node.js & Express server receiving telemetry over HTTP REST (`POST /api/telemetry`), exposing live WebSocket and Server-Sent Event (SSE) endpoints.
- **Frontend (`dashboard/frontend/`)**: Modern React application displaying:
  - Real-time gauge cards for Heart Rate and $\text{SpO}_2$
  - Active squat repetition counter with set targets
  - 60-second rolling trend line charts using Chart.js
  - Instant alert banner for abnormal posture and fall events

---

## 5. How to Run & Deploy

### 1. Flash the ESP32 Firmware
- Open [`firmware/athlete_monitoring_firmware.ino`](firmware/athlete_monitoring_firmware.ino) in Arduino IDE.
- Select Board: `ESP32 Dev Module` or `ESP32-S3`.
- Configure Wi-Fi credentials and target backend IP.
- Compile and flash at **115200 baud**.

### 2. Start the Backend Server
```bash
cd dashboard/backend
npm install
npm start
# Server starts on http://localhost:5000
```

### 3. Launch the React Dashboard
```bash
cd dashboard/frontend
npm install
npm start
# Dashboard opens on http://localhost:3000
```

---

## 6. Repository File Structure

```text
Real-Time-Athlete-Monitoring/
├── README.md
├── .gitignore
│
├── firmware/
│   └── athlete_monitoring_firmware.ino    # Multi-rate cooperative scheduling firmware
│
├── dashboard/
│   ├── backend/
│   │   ├── package.json
│   │   └── server.js                      # Express telemetry receiver and API server
│   └── frontend/
│       ├── package.json
│       ├── public/
│       └── src/
│           ├── App.js                     # Main interactive athlete dashboard UI
│           ├── App.css
│           └── index.js
│
└── docs/
    └── Sensors_Athlete_Wearable_Paper.pdf # 8-page published technical paper (VIT SENSE)
```
