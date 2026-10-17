# Real-Time Athlete Monitoring & Assistive Wearable System
### Bio-Kinematic Motion Tracking, Clinical Photoplethysmography, and MCU-Level Fall Detection

[![Platform: ESP32](https://img.shields.io/badge/Platform-ESP32%20%7C%20ESP32--S3-blue.svg)](https://www.espressif.com/)
[![Sensors: MPU6050 | MAX30102](https://img.shields.io/badge/Sensors-MPU6050%20%7C%20MAX30102-green.svg)](docs/Sensors.pdf)
[![Stack: Node.js | React](https://img.shields.io/badge/FullStack-Node.js%20%7C%20React%2018-61dafb.svg)](dashboard/)
[![Research: VIT Vellore](https://img.shields.io/badge/Research-VIT%20SENSE%20Biomedical-orange.svg)](docs/Sensors.pdf)
[![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)

An integrated, wearable bio-kinematic monitoring and clinical assistive system designed around the **ESP32 / ESP32-S3**. Guided by **Dr. Zachariah C. Alex** at the School of Electronics Engineering (SENSE), Vellore Institute of Technology (VIT), Vellore.

The system combines high-frequency biomechanical motion analysis (squat repetition counting, spine inclination, and Euler angle orientation) with clinical physiology (photoplethysmography heart rate, blood oxygen saturation $\text{SpO}_2$, and embedded Random Forest fall detection). Real-time telemetry streams over dual-band Wi-Fi to a reactive Node.js backend and an interactive 3D/chart React dashboard.

---

## 1. System Architecture & Dual-Rate Scheduler

```
                   +---------------------------------------------+
                   |              ESP32 / ESP32-S3               |
                   |      Multi-Rate Cooperative Scheduler       |
                   +--------------+----------------+-------------+
                                  |                |
             200 Hz Kinematics    |                | 25 Hz Physiology
             (5 ms deterministic) |                | (40 ms window)
                                  v                v
                   +--------------+----+    +------+-------------+
                   |  MPU-6050         |    |  MAX30102 / 105    |
                   |  6-Axis IMU (I2C) |    |  Pulse Oximeter    |
                   +--------------+----+    +------+-------------+
                                  |                |
                                  |                | 16-Tap FIR Low-Pass Filter
                                  v                v
                   +--------------+----+    +------+-------------+
                   | Euler Angle &     |    | Systolic Peak (IBI)|
                   | Squat Rep Counter |    | SpO2 Ratio Engine  |
                   +--------------+----+    +------+-------------+
                                  |                |
                                  +--------+-------+
                                           |
                              Embedded ML  v
                   +-----------------------+---------------------+
                   | Random Forest Classifier (C native via m2c) |
                   | 18 Features, 18 ms Latency, 93.9% F1-Score  |
                   +-----------------------+---------------------+
                                           |
                                  +--------+--------+
                                  |                 |
                                  v                 v
                   +--------------+----+     +------+------------+
                   | 128x64 OLED Screen|     | Wi-Fi WebSockets  |
                   | Live Vitals & EEQA|     | Node.js Backend & |
                   | Encrypted QR Code |     | React Dashboard   |
                   +-------------------+     +-------------------+
```

---

## 2. Mathematical Formulations

### A. Biomechanical Motion & Orientation (200 Hz Sampling)
Tri-axial accelerometer ($a_x, a_y, a_z$) and gyroscope readings ($\omega_x, \omega_y, \omega_z$) are processed using trigonometry to eliminate gravitational drift:

$$\text{Pitch } (\theta) = \text{atan2}\left(-a_x,\, \sqrt{a_y^2 + a_z^2}\right) \times \frac{180}{\pi}$$

$$\text{Roll } (\phi) = \text{atan2}\left(a_y,\, a_z\right) \times \frac{180}{\pi}$$

$$\text{Total Vector Acceleration } (A) = \sqrt{a_x^2 + a_y^2 + a_z^2}$$

- **Squat Detection**: Evaluates $a_y$ displacement with dynamic hysteresis thresholds ($A_{\text{low}} < -0.4\text{g}$, $A_{\text{high}} > 0.6\text{g}$) and a minimum repetition refractory period of $1200\text{ ms}$ to eliminate false double-counts.

### B. Physiological Signal Conditioning (25 Hz Sampling)
1. **16-Tap Finite Impulse Response (FIR) Filter**:
   $$y[n] = \sum_{k=0}^{15} h[k] \cdot x[n-k]$$
   Coefficients are optimized with a normalized cutoff $f_c = 4.0\text{ Hz}$ to suppress high-frequency muscle tremor noise and baseline wander.

2. **Heart Rate (HR)**:
   Detected systolic inflection points calculate the Inter-Beat Interval (IBI):
   $$\text{HR (BPM)} = \frac{60{,}000}{\text{IBI (ms)}}$$

3. **Blood Oxygen Saturation ($\text{SpO}_2$)**:
   $$\text{Ratio } R = \frac{(V_{\text{AC}} / V_{\text{DC}})_{\text{Red}}}{(V_{\text{AC}} / V_{\text{DC}})_{\text{IR}}}$$
   $$\text{SpO}_2 = 110.0 - 25.0 \cdot R$$
   - **Clinical Validation**: Heart Rate Mean Absolute Error (MAE) of **$2.1\text{ BPM}$**, $\text{SpO}_2$ Root Mean Square Error (RMSE) of **$1.3\%$**.

### C. Emergency Encrypted Quick Response (EEQA)
Upon confirmed fall detection, patient medical metadata is encrypted on-chip using a byte-wise stream cipher:

$$C_i = P_i \oplus K_{i \bmod m}$$

The encrypted payload is rendered on the onboard SSD1306 OLED as a QR code within **$120\text{ ms}$**, enabling emergency medical responders to scan patient history securely. Total end-to-end event-to-display latency is **$340\text{ ms}$**.

---

## 3. Hardware Interfacing & Pin Assignments

| Subsystem | Sensor / Module | Interface | ESP32 Pinout | Operational Voltage | Function |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **Motion** | MPU-6050 (6-DOF) | I²C Bus | `SDA: GPIO 21`, `SCL: GPIO 22` | 3.3V | 3-axis accelerometer ($\pm 8\text{g}$) & 3-axis gyro |
| **Vitals** | MAX30102 / MAX30105 | I²C Bus | `SDA: GPIO 21`, `SCL: GPIO 22` | 3.3V / 1.8V | Optical dual-wavelength PPG pulse oximetry |
| **Display** | SSD1306 128×64 OLED | I²C Bus | `SDA: GPIO 21`, `SCL: GPIO 22` | 3.3V | Real-time vitals, posture indicator, and EEQA QR |
| **Buzzer** | Active Piezo Buzzer | GPIO Output | `GPIO 13` | 3.3V | Audible alarm upon confirmed fall event |
| **LED** | Bi-Color Alert LED | GPIO Output | `GPIO 12` | 3.3V | Visual fault and status indicator |

---

## 4. Software Stack & API Specifications

### Backend (Node.js & Express)
The backend service ingests real-time JSON frames over HTTP POST and broadcasts updates to connected dashboard clients via WebSockets:

| Method | Endpoint | Description | Payload Format |
| :---: | :--- | :--- | :--- |
| `POST` | `/api/telemetry` | Receives sensor frames from ESP32 | `{"hr": 74, "spo2": 98.2, "squats": 12, "pitch": -4.2, "fall": false}` |
| `GET` | `/api/status` | Queries current athlete operational state | Returns aggregated latest vitals and alert status |
| `WS` | `/ws/live` | WebSocket stream for 25 Hz updates | Broadcasts streaming telemetry directly to frontend |

### Frontend (React 18 Dashboard)
Located in `dashboard/frontend/`:
- **Kinematic Monitor**: Real-time canvas rendering spine pitch/roll inclination and squat repetition tally.
- **Cardiovascular Monitor**: Live SVG waveform visualization of filtered PPG pulses, heart rate trends, and $\text{SpO}_2$ bar charts.
- **Emergency Alert Modal**: Automatically triggers on incoming fall packets, presenting emergency geolocation and QR decryption utilities.

---

## 5. Directory Layout

```
Real-Time-Athlete-Monitoring/
├── README.md                           # Master system specification
├── .gitignore                          # Build and dependency exclusions
├── firmware/
│   ├── athlete_monitoring_firmware.ino # Dual-rate cooperative firmware
│   └── platformio.ini                  # PlatformIO compilation environment
├── tools/
│   └── validate_vitals_algorithm.py    # Offline FIR filter, HR/SpO2, and fall validator
├── dashboard/
│   ├── backend/                        # Node.js REST API & WebSocket server
│   │   ├── server.js
│   │   └── package.json
│   └── frontend/                       # React 18 dashboard interface
│       ├── src/
│       ├── public/
│       └── package.json
└── docs/
    └── Sensors.pdf                     # 8-Page peer-reviewed research paper
```

---

## 6. Build & Execution Quick Start

### 1. Firmware Upload (PlatformIO)
```bash
cd firmware
pio run -t upload
pio device monitor -b 115200
```

### 2. Algorithm Verification Harness (Python)
```bash
python tools/validate_vitals_algorithm.py
```

### 3. Dashboard Server Launch
```bash
# Start Backend
cd dashboard/backend
npm install
node server.js

# Start Frontend (in separate terminal)
cd dashboard/frontend
npm install
npm start
```

---

## 7. Authors & Academic Citation

- **Lead Engineer**: Hari Kruthik SK  
- **Faculty Supervisor**: Dr. Zachariah C. Alex  
- **Institution**: School of Electronics Engineering (SENSE), Vellore Institute of Technology (VIT), Vellore  
- **Publication**: Published research documentation available in [`docs/Sensors.pdf`](docs/Sensors.pdf).
- **License**: Released under the [MIT License](LICENSE).
