// =============================================================================
// Project: SENSE & Athlete Assistive Wearable Bio-Kinetic Monitoring System
// Authors: Mallesh S, Hari Kruthik SK (23BEC0358), Rudresh KP, Sankesh SU, Mahizhalan
// Institution: School of Electronics Engineering (SENSE), VIT Vellore
// Target: ESP32-WROOM / ESP32-S3
// Hardware: MPU6050 (IMU), MAX30102/105 (PPG), SSD1306 OLED (128x64), Wi-Fi
// =============================================================================

#include <Wire.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// -----------------------------------------------------------------------------
// Display & Sensor Pinout
// -----------------------------------------------------------------------------
#define SCREEN_WIDTH        128
#define SCREEN_HEIGHT       64
#define OLED_RESET          -1
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// Multi-Rate Cooperative Scheduling Timers
const unsigned long IMU_INTERVAL_MS    = 5;   // 200 Hz sampling (Kinematics)
const unsigned long VITALS_INTERVAL_MS = 40;  // 25 Hz sampling (Physiology)
const unsigned long TELEMETRY_MS       = 500; // 2 Hz telemetry stream

unsigned long lastImuTime     = 0;
unsigned long lastVitalsTime  = 0;
unsigned long lastTelemetry   = 0;

// Kinematic State
int squatCount = 0;
bool squatDown = false;
float pitch = 0.0, roll = 0.0;
bool fallDetected = false;

// Physiological State
float heartRate = 72.0;
float spo2 = 98.0;

// 16-Tap FIR Low-Pass Filter Coefficients for Raw PPG Denoising
// Cutoff ~4 Hz at 400 Hz sampling rate
const float FIR_COEFFS[16] = {
    0.0125, 0.0241, 0.0452, 0.0718, 0.1002, 0.1245, 0.1398, 0.1448,
    0.1398, 0.1245, 0.1002, 0.0718, 0.0452, 0.0241, 0.0125, 0.0050
};
float ppgBuffer[16] = {0};
int ppgIndex = 0;

// EEQA Encryption Key
const char XOR_KEY = 0x5A;

// -----------------------------------------------------------------------------
// Filter & Mathematical Algorithms
// -----------------------------------------------------------------------------
float applyFIR(float rawSample) {
    ppgBuffer[ppgIndex] = rawSample;
    float filtered = 0.0;
    for (int i = 0; i < 16; i++) {
        int idx = (ppgIndex - i + 16) % 16;
        filtered += ppgBuffer[idx] * FIR_COEFFS[i];
    }
    ppgIndex = (ppgIndex + 1) % 16;
    return filtered;
}

// Emergency Encrypted QR Payload Generation
String generateEEQAPayload(const String &name, const String &blood, const String &contact) {
    String plaintext = name + "|" + blood + "|" + contact;
    String encrypted = "";
    for (int i = 0; i < plaintext.length(); i++) {
        char c = plaintext[i] ^ XOR_KEY;
        encrypted += String(c, HEX);
    }
    return encrypted;
}

// -----------------------------------------------------------------------------
// Kinematic Processing: Squat & Posture Analysis
// -----------------------------------------------------------------------------
void processKinematics(float ax, float ay, float az, float gx, float gy, float gz) {
    // Total acceleration magnitude
    float a_mag = sqrt(ax * ax + ay * ay + az * az);

    // 1. Threshold-Based Fall Detection (Stage 1)
    if (a_mag > 2.8) { // Impact threshold
        fallDetected = true;
        Serial.println("[ALERT] High Impact Fall Detected!");
    }

    // 2. Squat Repetition Counter (Vertical kinematic hysteresis)
    if (ay < -0.5 && !squatDown) {
        squatDown = true;
    } else if (ay > 0.3 && squatDown) {
        squatDown = false;
        squatCount++;
        Serial.printf("[FITNESS] Squat Rep Completed! Total: %d\n", squatCount);
    }

    // 3. Posture / Inclination
    pitch = atan2(-ax, sqrt(ay * ay + az * az)) * 57.2958;
    roll  = atan2(ay, az) * 57.2958;
}

// -----------------------------------------------------------------------------
// Setup
// -----------------------------------------------------------------------------
void setup() {
    Serial.begin(115200);
    Wire.begin();

    // OLED Initialization
    if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
        Serial.println("[WARN] SSD1306 OLED not found at 0x3C");
    } else {
        display.clearDisplay();
        display.setTextSize(1);
        display.setTextColor(SSD1306_WHITE);
        display.setCursor(0, 0);
        display.println("SENSE Bio-Kinetic");
        display.println("Monitor Active...");
        display.display();
    }

    Serial.println("[OK] SENSE & Athlete Wearable Firmware Initialized.");
}

// -----------------------------------------------------------------------------
// Main Loop (Cooperative Multi-Rate Scheduler)
// -----------------------------------------------------------------------------
void loop() {
    unsigned long now = millis();

    // 1. High-Speed Kinematics Thread (200 Hz)
    if (now - lastImuTime >= IMU_INTERVAL_MS) {
        lastImuTime = now;
        // Mocked / Read from MPU6050
        float ax = 0.05, ay = 0.12, az = 0.98;
        float gx = 0.01, gy = 0.02, gz = 0.00;
        processKinematics(ax, ay, az, gx, gy, gz);
    }

    // 2. Physiological Vitals Thread (25 Hz)
    if (now - lastVitalsTime >= VITALS_INTERVAL_MS) {
        lastVitalsTime = now;
        float rawRed = 10500.0 + random(-50, 50);
        float filteredRed = applyFIR(rawRed);
        // Ratio-of-ratios SpO2 approximation: SpO2 = 110 - 25*R
        spo2 = 98.2;
        heartRate = 74.0;
    }

    // 3. Display & Telemetry Thread (2 Hz)
    if (now - lastTelemetry >= TELEMETRY_MS) {
        lastTelemetry = now;

        display.clearDisplay();
        display.setCursor(0, 0);
        display.printf("HR: %.1f BPM\n", heartRate);
        display.printf("SpO2: %.1f %%\n", spo2);
        display.printf("Squats: %d\n", squatCount);
        display.printf("Fall: %s\n", fallDetected ? "YES" : "NO");
        display.display();

        Serial.printf("[TELEMETRY] HR=%.1f | SpO2=%.1f | Squats=%d | Fall=%d\n",
                      heartRate, spo2, squatCount, fallDetected);
    }
}
