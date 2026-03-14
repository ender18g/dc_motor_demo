import { useEffect, useMemo, useState } from 'react';
import './App.css';

const VOLTAGES = [20, 40, 60];
const VOLTAGE_COLORS = {
  20: '#0077b6',
  40: '#2a9d8f',
  60: '#d64b2f'
};

const NO_LOAD_RPM_PER_VOLT = 50;
const STALL_TORQUE_PER_VOLT = 0.05;
const MASS_KG = 20;
const WHEEL_RADIUS_M = 0.1;
const GEAR_RATIO = 12;
const MAX_INCLINE_DEG = 35;

function getLoadTorque(inclineDeg) {
  const inclineRad = (inclineDeg * Math.PI) / 180;
  const wheelTorque = MASS_KG * 9.81 * Math.sin(inclineRad) * WHEEL_RADIUS_M;
  return Math.max(0, wheelTorque / GEAR_RATIO);
}

function getOperatingPoint(voltage, inclineDeg) {
  const noLoadRpm = NO_LOAD_RPM_PER_VOLT * voltage;
  const stallTorque = STALL_TORQUE_PER_VOLT * voltage;
  const loadTorque = getLoadTorque(inclineDeg);
  const torqueFraction = loadTorque / stallTorque;

  if (torqueFraction >= 1) {
    return {
      voltage,
      inclineDeg,
      noLoadRpm,
      stallTorque,
      loadTorque,
      rpm: 0,
      stalled: true
    };
  }

  return {
    voltage,
    inclineDeg,
    noLoadRpm,
    stallTorque,
    loadTorque,
    rpm: noLoadRpm * (1 - torqueFraction),
    stalled: false
  };
}

function seedTracePoints() {
  return Object.fromEntries(
    VOLTAGES.map((voltage) => [
      voltage,
      [
        {
          inclineDeg: 0,
          loadTorque: 0,
          rpm: NO_LOAD_RPM_PER_VOLT * voltage
        }
      ]
    ])
  );
}

function MotorCurveChart({ traces, operatingPoint, selectedVoltage }) {
  const width = 760;
  const height = 430;
  const margin = { top: 64, right: 34, bottom: 60, left: 74 };

  const maxTorque = STALL_TORQUE_PER_VOLT * 60 * 1.06;
  const maxSpeed = NO_LOAD_RPM_PER_VOLT * 60 * 1.06;

  const x = (torque) =>
    margin.left + (torque / maxTorque) * (width - margin.left - margin.right);
  const y = (rpm) =>
    height - margin.bottom - (rpm / maxSpeed) * (height - margin.top - margin.bottom);

  const xTicks = [0, 0.5, 1, 1.5, 2, 2.5, 3];
  const yTicks = [0, 500, 1000, 1500, 2000, 2500, 3000];

  return (
    <section className="chart-card">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Speed torque curve plot">
        <defs>
          <linearGradient id="chartBackground" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#f8fcff" />
            <stop offset="100%" stopColor="#eaf4ff" />
          </linearGradient>
        </defs>

        <rect x="0" y="0" width={width} height={height} fill="url(#chartBackground)" rx="18" />

        <text x={width / 2} y={34} textAnchor="middle" className="chart-title">
          DC Motor Speed-Torque Curves
        </text>

        {xTicks.map((tick) => (
          <g key={`x-${tick}`}>
            <line
              x1={x(tick)}
              y1={margin.top}
              x2={x(tick)}
              y2={height - margin.bottom}
              className="chart-grid"
            />
            <text x={x(tick)} y={height - margin.bottom + 24} textAnchor="middle" className="tick-label">
              {tick.toFixed(1)}
            </text>
          </g>
        ))}

        {yTicks.map((tick) => (
          <g key={`y-${tick}`}>
            <line
              x1={margin.left}
              y1={y(tick)}
              x2={width - margin.right}
              y2={y(tick)}
              className="chart-grid"
            />
            <text x={margin.left - 12} y={y(tick) + 4} textAnchor="end" className="tick-label">
              {tick}
            </text>
          </g>
        ))}

        <line
          x1={margin.left}
          y1={height - margin.bottom}
          x2={width - margin.right}
          y2={height - margin.bottom}
          className="axis-line"
        />
        <line
          x1={margin.left}
          y1={margin.top}
          x2={margin.left}
          y2={height - margin.bottom}
          className="axis-line"
        />

        <text
          x={(margin.left + width - margin.right) / 2}
          y={height - 16}
          textAnchor="middle"
          className="axis-label"
        >
          Motor Torque (N·m)
        </text>

        <text
          x={20}
          y={(margin.top + height - margin.bottom) / 2}
          transform={`rotate(-90, 20, ${(margin.top + height - margin.bottom) / 2})`}
          textAnchor="middle"
          className="axis-label"
        >
          Motor Speed (RPM)
        </text>

        {VOLTAGES.map((voltage) => {
          const stallTorque = STALL_TORQUE_PER_VOLT * voltage;
          const noLoadRpm = NO_LOAD_RPM_PER_VOLT * voltage;
          const color = VOLTAGE_COLORS[voltage];

          return (
            <g key={`curve-${voltage}`}>
              <line
                x1={x(0)}
                y1={y(noLoadRpm)}
                x2={x(stallTorque)}
                y2={y(0)}
                stroke={color}
                strokeWidth={selectedVoltage === voltage ? 4.6 : 3.2}
                strokeLinecap="round"
                opacity={selectedVoltage === voltage ? 0.98 : 0.8}
              />

              {traces[voltage].map((point, index) => (
                <circle
                  key={`${voltage}-${point.inclineDeg}-${index}`}
                  cx={x(point.loadTorque)}
                  cy={y(point.rpm)}
                  r={selectedVoltage === voltage ? 5 : 4}
                  fill={color}
                  opacity={0.75}
                />
              ))}
            </g>
          );
        })}

        <circle
          cx={x(operatingPoint.loadTorque)}
          cy={y(operatingPoint.rpm)}
          r="8"
          fill={VOLTAGE_COLORS[selectedVoltage]}
          stroke="#ffffff"
          strokeWidth="2.5"
        />

        <g transform={`translate(${width - 210}, ${margin.top + 10})`}>
          <rect width="176" height="94" rx="10" className="legend-bg" />
          {VOLTAGES.map((voltage, index) => (
            <g key={`legend-${voltage}`} transform={`translate(12, ${20 + index * 24})`}>
              <line x1="0" y1="0" x2="24" y2="0" stroke={VOLTAGE_COLORS[voltage]} strokeWidth="4" />
              <text x="32" y="4" className="legend-label">
                {voltage} V curve
              </text>
            </g>
          ))}
        </g>
      </svg>
    </section>
  );
}

function InclineScene({ inclineDeg, operatingPoint }) {
  const wheelSpinDuration = `${Math.max(0.3, (60 * GEAR_RATIO) / Math.max(operatingPoint.rpm, 1)).toFixed(2)}s`;

  const vehicleSpeedMps =
    ((operatingPoint.rpm / GEAR_RATIO) * 2 * Math.PI * WHEEL_RADIUS_M) / 60;

  const treeScrollDuration = `${Math.max(1.8, 14 / Math.max(vehicleSpeedMps, 0.25)).toFixed(2)}s`;

  return (
    <section className="scene-card">
      <h2>Incline Drive Visualization</h2>
      <div className="scene-window">
        <div
          className={`tree-lane ${operatingPoint.rpm < 5 ? 'paused' : ''}`}
          style={{ animationDuration: treeScrollDuration }}
        />

        <div className="sun-disc" />

        <div className="road-system" style={{ transform: `translateY(28px) rotate(${-inclineDeg}deg)` }}>
          <div className="road-surface" />
          <div className="car-shell">
            <div className="car-top" />
            <div className="car-base" />
            <div
              className={`wheel ${operatingPoint.stalled ? 'stalled' : ''}`}
              style={{ animationDuration: wheelSpinDuration }}
            >
              <span className="spoke" />
            </div>
            <div
              className={`wheel ${operatingPoint.stalled ? 'stalled' : ''}`}
              style={{ animationDuration: wheelSpinDuration }}
            >
              <span className="spoke" />
            </div>
          </div>
        </div>

        <div className="incline-tag">Incline: {inclineDeg} deg</div>
      </div>
    </section>
  );
}

function App() {
  const [voltage, setVoltage] = useState(20);
  const [inclineDeg, setInclineDeg] = useState(0);
  const [traces, setTraces] = useState(() => seedTracePoints());

  const operatingPoint = useMemo(
    () => getOperatingPoint(voltage, inclineDeg),
    [voltage, inclineDeg]
  );

  useEffect(() => {
    const nextPoint = {
      inclineDeg,
      loadTorque: Number(operatingPoint.loadTorque.toFixed(4)),
      rpm: Number(operatingPoint.rpm.toFixed(2))
    };

    setTraces((currentTraces) => {
      const series = currentTraces[voltage];
      const alreadyTracked = series.some((point) => point.inclineDeg === inclineDeg);

      if (alreadyTracked) {
        return currentTraces;
      }

      return {
        ...currentTraces,
        [voltage]: [...series, nextPoint]
      };
    });
  }, [inclineDeg, operatingPoint.loadTorque, operatingPoint.rpm, voltage]);

  const clearTracePoints = () => {
    setTraces(seedTracePoints());
  };

  const speedMps = ((operatingPoint.rpm / GEAR_RATIO) * 2 * Math.PI * WHEEL_RADIUS_M) / 60;

  return (
    <div className="app-shell">
      <header className="hero-header">
        <img className="site-logo" src="/WRC_logo.png" alt="WRC logo" />
        <div>
          <h1>WRC DC Motor Demo</h1>
          <p>
            Explore how incline load and voltage shift an ideal DC motor operating point on the
            speed-torque curve.
          </p>
        </div>
      </header>

      <main className="content-grid">
        <section className="controls-card">
          <h2>Controls</h2>

          <label htmlFor="incline-slider" className="slider-label">
            Incline angle: <strong>{inclineDeg} deg</strong>
          </label>
          <input
            id="incline-slider"
            type="range"
            min="0"
            max={MAX_INCLINE_DEG}
            step="1"
            value={inclineDeg}
            onChange={(event) => setInclineDeg(Number(event.target.value))}
          />

          <label htmlFor="voltage-slider" className="slider-label">
            Applied voltage: <strong>{voltage} V</strong>
          </label>
          <input
            id="voltage-slider"
            type="range"
            min="20"
            max="60"
            step="20"
            value={voltage}
            onChange={(event) => setVoltage(Number(event.target.value))}
          />

          <div className="voltage-options">
            {VOLTAGES.map((value) => (
              <span key={value} className={value === voltage ? 'active-voltage' : ''}>
                {value} V
              </span>
            ))}
          </div>

          <div className="readout-grid">
            <p>
              Load torque: <strong>{operatingPoint.loadTorque.toFixed(3)} N·m</strong>
            </p>
            <p>
              Motor speed: <strong>{operatingPoint.rpm.toFixed(0)} RPM</strong>
            </p>
            <p>
              Vehicle speed: <strong>{speedMps.toFixed(2)} m/s</strong>
            </p>
            <p>
              Condition:{' '}
              <strong className={operatingPoint.stalled ? 'warn' : 'ok'}>
                {operatingPoint.stalled ? 'Stalled (load >= stall torque)' : 'Running'}
              </strong>
            </p>
          </div>

          <button type="button" onClick={clearTracePoints} className="clear-button">
            Clear plotted points
          </button>
        </section>

        <InclineScene inclineDeg={inclineDeg} operatingPoint={operatingPoint} />
        <MotorCurveChart
          traces={traces}
          operatingPoint={operatingPoint}
          selectedVoltage={voltage}
        />
      </main>
    </div>
  );
}

export default App;
