"use client"

import { useEffect, useState } from "react"
import "./App.css"

function App() {
  const [data, setData] = useState({})
  const [connected, setConnected] = useState(false)
  const [hrHistory, setHrHistory] = useState([])
  const [spo2History, setSpo2History] = useState([])
  const [hrChart, setHrChart] = useState(null)
  const [spo2Chart, setSpo2Chart] = useState(null)

  useEffect(() => {
    const interval = setInterval(() => {
      fetch("http://10.230.93.86:8000/latest")
        .then((res) => res.json())
        .then((json) => {
          if (Object.keys(json).length > 0) {
            setData(json)
            setConnected(true)

            // Update history (keep last 60 data points)
            setHrHistory((prev) => {
              const newHistory = [...prev, { time: new Date().toLocaleTimeString(), value: json.heartRate || 0 }]
              return newHistory.slice(-60)
            })

            setSpo2History((prev) => {
              const newHistory = [...prev, { time: new Date().toLocaleTimeString(), value: json.spO2 || 0 }]
              return newHistory.slice(-60)
            })
          } else {
            setConnected(false)
          }
        })
        .catch(() => setConnected(false))
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  // Initialize and update charts
  useEffect(() => {
    const canvas1 = document.getElementById("hrChart")
    const canvas2 = document.getElementById("spo2Chart")

    if (canvas1 && hrHistory.length > 0) {
      const ctx = canvas1.getContext("2d")
      drawLineChart(ctx, hrHistory, "#ff006e", "Heart Rate")
    }

    if (canvas2 && spo2History.length > 0) {
      const ctx = canvas2.getContext("2d")
      drawLineChart(ctx, spo2History, "#00d9ff", "SpO₂ Level")
    }
  }, [hrHistory, spo2History])

  const drawLineChart = (ctx, history, color, label) => {
    const padding = 40
    const width = ctx.canvas.width - padding * 2
    const height = ctx.canvas.height - padding * 2

    // Clear canvas
    ctx.fillStyle = "rgba(15, 15, 35, 0.5)"
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)

    // Draw grid
    ctx.strokeStyle = "rgba(100, 200, 200, 0.1)"
    ctx.lineWidth = 1
    for (let i = 0; i <= 5; i++) {
      const y = padding + (height / 5) * i
      ctx.beginPath()
      ctx.moveTo(padding, y)
      ctx.lineTo(ctx.canvas.width - padding, y)
      ctx.stroke()
    }

    // Get min/max values
    const values = history.map((d) => d.value)
    const minVal = Math.min(...values)
    const maxVal = Math.max(...values)
    const range = maxVal - minVal || 1

    // Draw line
    ctx.strokeStyle = color
    ctx.lineWidth = 3
    ctx.lineCap = "round"
    ctx.lineJoin = "round"

    ctx.beginPath()
    history.forEach((point, index) => {
      const x = padding + (width / (history.length - 1 || 1)) * index
      const y = padding + height - ((point.value - minVal) / range) * height

      if (index === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    })
    ctx.stroke()

    // Draw gradient fill
    const gradient = ctx.createLinearGradient(0, padding, 0, ctx.canvas.height - padding)
    gradient.addColorStop(0, color + "40")
    gradient.addColorStop(1, color + "00")
    ctx.fillStyle = gradient
    ctx.lineTo(ctx.canvas.width - padding, ctx.canvas.height - padding)
    ctx.lineTo(padding, ctx.canvas.height - padding)
    ctx.fill()

    // Draw labels
    ctx.fillStyle = "#00d9ff"
    ctx.font = "bold 12px Poppins"
    ctx.fillText(Math.ceil(maxVal), padding - 30, padding + 5)
    ctx.fillText(Math.ceil(minVal), padding - 30, ctx.canvas.height - padding + 5)
  }

  const getHealthStatus = (hr, spo2) => {
    if (spo2 < 95) return { status: "Critical", color: "#ff006e" }
    if (hr > 180) return { status: "High", color: "#ff006e" }
    if (hr > 160) return { status: "Intense", color: "#ffd60a" }
    if (hr > 120) return { status: "Moderate", color: "#00d9ff" }
    return { status: "Normal", color: "#06ffa5" }
  }

  const health = getHealthStatus(data.heartRate, data.spO2)

  return (
    <div className="app">
      <div className="sidebar">
        <div className="logo-section">
          <h1>
            SENSE  <br /> Dashboard
          </h1>
        </div>

        <div className="status-section">
          <div className={`status-badge ${connected ? "online" : "offline"}`}>
            <div className="status-dot"></div>
            {connected ? "Connected" : "Disconnected"}
          </div>
          <div className="connection-text">{connected ? "Backend Online" : "No Backend Connection"}</div>
        </div>
      </div>

      <div className="content">
        <div className="header">
          <h2>Real-Time Vitals Monitor</h2>
          <div className={`health-indicator ${health.status.toLowerCase()}`} style={{ borderColor: health.color }}>
            <span className="pulse" style={{ backgroundColor: health.color }}></span>
            {health.status}
          </div>
        </div>

        <div className="metrics-grid">
          <div className="metric-card hr-card">
            <div className="metric-label">Heart Rate</div>
            <div className="metric-value">{data.heartRate || "--"}</div>
            <div className="metric-unit">bpm</div>
            <div className="metric-range">60-100 normal</div>
          </div>

          <div className="metric-card spo2-card">
            <div className="metric-label">Blood Oxygen (SpO₂)</div>
            <div className="metric-value">{data.spO2 || "--"}</div>
            <div className="metric-unit">%</div>
            <div className="metric-range">95-100 optimal</div>
          </div>

          <div className="metric-card stats-card">
            <div className="stat-item">
              <div className="stat-label">Squats</div>
              <div className="stat-value">{data.squatCount || 0}</div>
            </div>
            <div className="stat-item">
              <div className="stat-label">Posture</div>
              <div className="stat-value">{data.postureStatus || "--"}</div>
            </div>
            <div className="stat-item">
             
            </div>
          </div>

          <div className={`metric-card alert-card ${data.fallDetected ? "alert-active" : ""}`}>
            <div className="alert-icon">⚠️</div>
            <div className="alert-text">
              Fall Detection
              <span className="alert-status">{data.fallDetected ? "Detected 🚨" : "Normal"}</span>
            </div>
          </div>
        </div>

        <div className="charts-section">
          <div className="chart-container">
            <div className="chart-header">
              <h3>❤️ Heart Rate Trend</h3>
              <span className="chart-range">Last 60s</span>
            </div>
            <canvas id="hrChart" width="400" height="200"></canvas>
            <div className="chart-info">
              Current: {data.heartRate || "--"} bpm | Peak: {Math.max(...hrHistory.map((d) => d.value), 0)} bpm
            </div>
          </div>

          <div className="chart-container">
            <div className="chart-header">
              <h3>🩸 Blood Oxygen Trend</h3>
              <span className="chart-range">Last 60s</span>
            </div>
            <canvas id="spo2Chart" width="400" height="200"></canvas>
            <div className="chart-info">
              Current: {data.spO2 || "--"}% | Average:{" "}
              {spo2History.length > 0
                ? (spo2History.reduce((a, b) => a + b.value, 0) / spo2History.length).toFixed(1)
                : "--"}
              %
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
