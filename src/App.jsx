import { useEffect, useMemo, useState } from 'react';
import './App.css';

const VOLTAGES = [20, 40, 60, 80, 100];
const VOLTAGE_COLORS = {
  20: '#0077b6',
  40: '#2a9d8f',
  60: '#d64b2f',
  80: '#ff9f1c',
  100: '#6a994e'
};
const MAX_VOLTAGE = Math.max(...VOLTAGES);

const NO_LOAD_RPM_PER_VOLT = 50;
const STALL_TORQUE_PER_VOLT = 0.05;
const GEAR_RATIO = 12;
const ROLLING_FORCE_N = 60;
const MIN_TIRE_RADIUS_M = 0.01;
const MAX_TIRE_RADIUS_M = 1;
const TIRE_RADIUS_STEP_M = 0.01;

function getLoadTorque(tireRadiusM) {
  const wheelTorque = ROLLING_FORCE_N * tireRadiusM;
  return Math.max(0, wheelTorque / GEAR_RATIO);
}

function getOperatingPoint(voltage, tireRadiusM) {
  const noLoadRpm = NO_LOAD_RPM_PER_VOLT * voltage;
  const stallTorque = STALL_TORQUE_PER_VOLT * voltage;
  const requiredTorque = getLoadTorque(tireRadiusM);
  const stalled = requiredTorque >= stallTorque;
  const motorTorque = stalled ? stallTorque : requiredTorque;

  return {
    voltage,
    tireRadiusM,
    noLoadRpm,
    stallTorque,
    requiredTorque,
    motorTorque,
    rpm: stalled ? 0 : noLoadRpm * (1 - requiredTorque / stallTorque),
    stalled
  };
}

function getVehicleSpeedMps(rpm, tireRadiusM) {
  return ((rpm / GEAR_RATIO) * 2 * Math.PI * tireRadiusM) / 60;
}

function getAngularSpeedRadPerSec(rpm) {
  return (rpm * 2 * Math.PI) / 60;
}

function seedTracePoints() {
  return Object.fromEntries(VOLTAGES.map((voltage) => [voltage, []]));
}

function MotorCurveChart({ traces, operatingPoint, selectedVoltage }) {
  const width = 760;
  const height = 430;
  const margin = { top: 64, right: 34, bottom: 60, left: 74 };

  const speedTickStep = 50;
  const speedTickMax =
    Math.ceil(getAngularSpeedRadPerSec(NO_LOAD_RPM_PER_VOLT * MAX_VOLTAGE) / speedTickStep) *
    speedTickStep;
  const torqueTickMax = Math.ceil((STALL_TORQUE_PER_VOLT * MAX_VOLTAGE) / 0.5) * 0.5;
  const maxSpeed = speedTickMax * 1.06;
  const maxTorque = torqueTickMax * 1.06;

  const x = (angularSpeedRadPerSec) =>
    margin.left + (angularSpeedRadPerSec / maxSpeed) * (width - margin.left - margin.right);
  const y = (torque) =>
    height - margin.bottom - (torque / maxTorque) * (height - margin.top - margin.bottom);

  const xTicks = Array.from(
    { length: Math.round(speedTickMax / speedTickStep) + 1 },
    (_, index) => index * speedTickStep
  );
  const yTicks = Array.from({ length: Math.round(torqueTickMax / 0.5) + 1 }, (_, index) => index * 0.5);
  const legendHeight = 20 + VOLTAGES.length * 24;
  const fastestPointIndexByVoltage = Object.fromEntries(
    VOLTAGES.map((voltage) => {
      let fastestIndex = -1;
      let fastestSpeedMps = -Infinity;

      traces[voltage].forEach((point, index) => {
        if (point.vehicleSpeedMps > fastestSpeedMps) {
          fastestSpeedMps = point.vehicleSpeedMps;
          fastestIndex = index;
        }
      });

      return [voltage, fastestIndex];
    })
  );

  return (
    <section className="chart-card">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Motor torque vs angular speed operating points"
      >
        <defs>
          <linearGradient id="chartBackground" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#f8fcff" />
            <stop offset="100%" stopColor="#eaf4ff" />
          </linearGradient>
        </defs>

        <rect x="0" y="0" width={width} height={height} fill="url(#chartBackground)" rx="18" />

        <text x={width / 2} y={34} textAnchor="middle" className="chart-title">
          DC Motor Operating Points (Torque vs Speed)
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
              {tick.toFixed(0)}
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
              {tick.toFixed(1)}
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
          Motor Speed (rad/s)
        </text>

        <text
          x={20}
          y={(margin.top + height - margin.bottom) / 2}
          transform={`rotate(-90, 20, ${(margin.top + height - margin.bottom) / 2})`}
          textAnchor="middle"
          className="axis-label"
        >
          Motor Load Torque (N·m)
        </text>

        {VOLTAGES.map((voltage) => {
          const color = VOLTAGE_COLORS[voltage];

          return (
            <g key={`points-${voltage}`}>
              {traces[voltage].map((point, index) => {
                const baseRadius = selectedVoltage === voltage ? 5 : 4;
                const isFastestPoint = index === fastestPointIndexByVoltage[voltage];

                return (
                  <circle
                    key={`${voltage}-${point.tireRadiusM}-${index}`}
                    cx={x(getAngularSpeedRadPerSec(point.rpm))}
                    cy={y(point.motorTorque)}
                    r={isFastestPoint ? baseRadius * 2 : baseRadius}
                    fill={color}
                    opacity={0.75}
                  />
                );
              })}
            </g>
          );
        })}

        <circle
          cx={x(getAngularSpeedRadPerSec(operatingPoint.rpm))}
          cy={y(operatingPoint.motorTorque)}
          r="8"
          fill={VOLTAGE_COLORS[selectedVoltage]}
          stroke="#ffffff"
          strokeWidth="2.5"
        />

        <g transform={`translate(${width - 210}, ${margin.top + 10})`}>
          <rect width="176" height={legendHeight} rx="10" className="legend-bg" />
          {VOLTAGES.map((voltage, index) => (
            <g key={`legend-${voltage}`} transform={`translate(12, ${20 + index * 24})`}>
              <circle cx="12" cy="-1" r="6" fill={VOLTAGE_COLORS[voltage]} />
              <text x="32" y="4" className="legend-label">
                {voltage} V points
              </text>
            </g>
          ))}
        </g>
      </svg>
    </section>
  );
}

function TruckScene({ tireRadiusM, operatingPoint }) {
  const wheelSpinDuration = `${Math.max(0.3, (60 * GEAR_RATIO) / Math.max(operatingPoint.rpm, 1)).toFixed(2)}s`;
  const vehicleSpeedMps = getVehicleSpeedMps(operatingPoint.rpm, tireRadiusM);
  const visualSpeedMps = operatingPoint.stalled ? 0 : Math.max(vehicleSpeedMps, 0.2);
  const terrainScrollDuration = `${Math.max(1.8, 18 / Math.max(visualSpeedMps, 0.2)).toFixed(2)}s`;
  const roadDashDuration = `${Math.max(0.9, 8 / Math.max(visualSpeedMps, 0.2)).toFixed(2)}s`;
  const flagWaveDuration = `${Math.max(0.45, 2.4 / Math.max(visualSpeedMps, 0.2)).toFixed(2)}s`;

  const normalizedRadius =
    (tireRadiusM - MIN_TIRE_RADIUS_M) / (MAX_TIRE_RADIUS_M - MIN_TIRE_RADIUS_M);
  const tireRadiusPx = 2 + normalizedRadius * 52;
  const tireDiameterPx = tireRadiusPx * 2;
  const bodyBottomPx = Math.max(0, tireDiameterPx - 16);
  const isTinyWheel = tireDiameterPx < 12;

  return (
    <section className="scene-card">
      <h2>Truck Visualization</h2>
      <div className="scene-window">
        <div className="sun-disc" />

        <div className="hill-layer">
          <div className="hill hill-back" />
          <div className="hill hill-front" />
        </div>

        <div
          className={`terrain-scroll ${operatingPoint.stalled ? 'paused' : ''}`}
          style={{ animationDuration: terrainScrollDuration }}
        />

        <div className="road-system">
          <div
            className={`road-surface ${operatingPoint.stalled ? 'paused' : ''}`}
            style={{ '--road-dash-duration': roadDashDuration }}
          />
        </div>

        <div className="truck-shell">
          <div className="truck-body" style={{ bottom: `${bodyBottomPx}px` }}>
            <div className="tailgate-flag" aria-hidden="true">
              <span className="flag-pole" />
              <div
                className={`flag-cloth ${operatingPoint.stalled ? 'paused' : ''}`}
                style={{ '--flag-wave-duration': flagWaveDuration }}
              >
                <span className="flag-mark-n">N</span>
                <span className="flag-mark-star">★</span>
              </div>
            </div>
            <div className="pickup-body-main" />
            <div className="pickup-cab-shell" />
            <div className="pickup-hood" />
            <div className="pickup-window-main" />
            <div className="pickup-window-rear" />
            <div className="pickup-fender fender-left" />
            <div className="pickup-fender fender-right" />
            <div className="pickup-front-bumper" />
            <div className="pickup-headlight" />
          </div>

          <div
            className={`truck-wheel wheel-left ${operatingPoint.stalled ? 'stalled' : ''} ${
              isTinyWheel ? 'dot-wheel' : ''
            }`}
            style={{
              width: `${tireDiameterPx}px`,
              height: `${tireDiameterPx}px`,
              animationDuration: wheelSpinDuration
            }}
          >
            <span className="wheel-spin-bar" />
          </div>

          <div
            className={`truck-wheel wheel-right ${operatingPoint.stalled ? 'stalled' : ''} ${
              isTinyWheel ? 'dot-wheel' : ''
            }`}
            style={{
              width: `${tireDiameterPx}px`,
              height: `${tireDiameterPx}px`,
              animationDuration: wheelSpinDuration
            }}
          >
            <span className="wheel-spin-bar" />
          </div>
        </div>

        <div className="incline-tag">Tire radius: {tireRadiusM.toFixed(2)} m</div>
      </div>
    </section>
  );
}

function App() {
  const [voltage, setVoltage] = useState(60);
  const [tireRadiusM, setTireRadiusM] = useState(0.5);
  const [traces, setTraces] = useState(() => seedTracePoints());

  const operatingPoint = useMemo(
    () => getOperatingPoint(voltage, tireRadiusM),
    [voltage, tireRadiusM]
  );
  const fastestSpeedByVoltage = useMemo(
    () =>
      Object.fromEntries(
        VOLTAGES.map((value) => {
          const fastestPoint = traces[value].reduce((fastest, point) => {
            if (!fastest || point.vehicleSpeedMps > fastest.vehicleSpeedMps) {
              return point;
            }
            return fastest;
          }, null);

          return [value, fastestPoint];
        })
      ),
    [traces]
  );

  useEffect(() => {
    const nextPoint = {
      tireRadiusM: Number(tireRadiusM.toFixed(4)),
      motorTorque: Number(operatingPoint.motorTorque.toFixed(4)),
      rpm: Number(operatingPoint.rpm.toFixed(2)),
      vehicleSpeedMps: Number(getVehicleSpeedMps(operatingPoint.rpm, tireRadiusM).toFixed(4)),
      stalled: operatingPoint.stalled
    };

    setTraces((currentTraces) => {
      const series = currentTraces[voltage];
      const alreadyTracked = series.some((point) => point.tireRadiusM === nextPoint.tireRadiusM);

      if (alreadyTracked) {
        return currentTraces;
      }

      const hasStallPoint = series.some((point) => point.stalled);
      if (nextPoint.stalled && hasStallPoint) {
        return currentTraces;
      }

      return {
        ...currentTraces,
        [voltage]: [...series, nextPoint]
      };
    });
  }, [tireRadiusM, operatingPoint.motorTorque, operatingPoint.rpm, operatingPoint.stalled, voltage]);

  const clearTracePoints = () => {
    const resetTraces = seedTracePoints();
    const point = getOperatingPoint(voltage, tireRadiusM);
    resetTraces[voltage] = [
      {
        tireRadiusM: Number(tireRadiusM.toFixed(4)),
        motorTorque: Number(point.motorTorque.toFixed(4)),
        rpm: Number(point.rpm.toFixed(2)),
        vehicleSpeedMps: Number(getVehicleSpeedMps(point.rpm, tireRadiusM).toFixed(4)),
        stalled: point.stalled
      }
    ];

    setTraces(resetTraces);
  };

  const vehicleSpeedMps = getVehicleSpeedMps(operatingPoint.rpm, tireRadiusM);
  const motorAngularSpeedRadPerSec = getAngularSpeedRadPerSec(operatingPoint.rpm);

  return (
    <div className="app-shell">
      <header className="hero-header">
<img
  className="site-logo"
  src={`${import.meta.env.BASE_URL}WRC_logo.png`}
  alt="WRC logo"
/>        <div>
          <h1>WRC DC Motor Demo</h1>
          <p>
            Explore how tire radius load and voltage shift an ideal DC motor operating point on
            the torque-speed plot.
          </p>
        </div>
      </header>

      <main className="content-grid">
        <section className="controls-card">
          <h2>Controls</h2>

          <label htmlFor="tire-radius-slider" className="slider-label">
            Tire radius: <strong>{tireRadiusM.toFixed(2)} m</strong>
          </label>
          <input
            id="tire-radius-slider"
            type="range"
            min={MIN_TIRE_RADIUS_M}
            max={MAX_TIRE_RADIUS_M}
            step={TIRE_RADIUS_STEP_M}
            value={tireRadiusM}
            onChange={(event) => setTireRadiusM(Number(event.target.value))}
          />

          <label className="slider-label">
            Applied voltage: <strong>{voltage} V</strong>
          </label>
          <div className="voltage-options" role="group" aria-label="Applied voltage options">
            {VOLTAGES.map((value) => (
              <button
                key={value}
                type="button"
                className={`voltage-button ${value === voltage ? 'active-voltage' : ''}`}
                onClick={() => setVoltage(value)}
                aria-pressed={value === voltage}
              >
                {value} V
              </button>
            ))}
          </div>

          <div className="readout-grid">
            <p>
              Required load torque: <strong>{operatingPoint.requiredTorque.toFixed(3)} N·m</strong>
            </p>
            <p>
              Motor torque: <strong>{operatingPoint.motorTorque.toFixed(3)} N·m</strong>
            </p>
            <p>
              Motor speed: <strong>{motorAngularSpeedRadPerSec.toFixed(2)} rad/s</strong>
            </p>
            <p>
              Vehicle speed: <strong>{vehicleSpeedMps.toFixed(2)} m/s</strong>
            </p>
            <p>
              Condition:{' '}
              <strong className={operatingPoint.stalled ? 'warn' : 'ok'}>
                {operatingPoint.stalled ? 'Stalled (at stall torque)' : 'Running'}
              </strong>
            </p>
          </div>

          <div className="fastest-speed-grid">
            <p className="fastest-speed-title">Fastest tracked speed by voltage</p>
            {VOLTAGES.map((value) => (
              <p key={`fastest-${value}`}>
                {value} V:{' '}
                <strong>
                  {fastestSpeedByVoltage[value]
                    ? `${fastestSpeedByVoltage[value].vehicleSpeedMps.toFixed(2)} m/s`
                    : '--'}
                </strong>
              </p>
            ))}
          </div>

          <button type="button" onClick={clearTracePoints} className="clear-button">
            Clear plotted points
          </button>
        </section>

        <TruckScene tireRadiusM={tireRadiusM} operatingPoint={operatingPoint} />
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
