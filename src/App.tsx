import { useState, useEffect, useCallback, useRef } from 'react';

type Mode = 'focus' | 'shortBreak' | 'longBreak';

interface Settings {
  focus: number;
  shortBreak: number;
  longBreak: number;
}

interface SessionRecord {
  date: string;
  completedAt: string;
  duration: number;
}

interface Stats {
  sessions: SessionRecord[];
  totalFocusMinutes: number;
}

const DEFAULT_SETTINGS: Settings = {
  focus: 25,
  shortBreak: 5,
  longBreak: 15,
};

const MODE_LABELS: Record<Mode, string> = {
  focus: 'Фокусировка',
  shortBreak: 'Короткий перерыв',
  longBreak: 'Длинный перерыв',
};

const MODE_COLORS: Record<Mode, { bg: string; ring: string; text: string; btn: string }> = {
  focus: {
    bg: 'from-red-950 via-slate-900 to-slate-950',
    ring: 'stroke-red-500',
    text: 'text-red-400',
    btn: 'bg-red-600 hover:bg-red-500',
  },
  shortBreak: {
    bg: 'from-emerald-950 via-slate-900 to-slate-950',
    ring: 'stroke-emerald-500',
    text: 'text-emerald-400',
    btn: 'bg-emerald-600 hover:bg-emerald-500',
  },
  longBreak: {
    bg: 'from-blue-950 via-slate-900 to-slate-950',
    ring: 'stroke-blue-500',
    text: 'text-blue-400',
    btn: 'bg-blue-600 hover:bg-blue-500',
  },
};

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

function loadSettings(): Settings {
  try {
    const stored = localStorage.getItem('pomodoro-settings');
    if (stored) return JSON.parse(stored);
  } catch {}
  return DEFAULT_SETTINGS;
}

function saveSettings(settings: Settings) {
  localStorage.setItem('pomodoro-settings', JSON.stringify(settings));
}

function loadStats(): Stats {
  try {
    const stored = localStorage.getItem('pomodoro-stats');
    if (stored) return JSON.parse(stored);
  } catch {}
  return { sessions: [], totalFocusMinutes: 0 };
}

function saveStats(stats: Stats) {
  localStorage.setItem('pomodoro-stats', JSON.stringify(stats));
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function App() {
  const [mode, setMode] = useState<Mode>('focus');
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [timeLeft, setTimeLeft] = useState(settings.focus * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [stats, setStats] = useState<Stats>(loadStats);
  const [showSettings, setShowSettings] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  const totalTime = settings[mode] * 60;
  const progress = totalTime > 0 ? (totalTime - timeLeft) / totalTime : 0;
  const colors = MODE_COLORS[mode];

  const today = getToday();
  const todaySessions = stats.sessions.filter((s) => s.date === today);
  const todayMinutes = todaySessions.reduce((sum, s) => sum + s.duration, 0);
  const todayCount = todaySessions.length;

  // Timer logic
  useEffect(() => {
    if (isRunning) {
      if (!startTimeRef.current) {
        startTimeRef.current = Date.now();
      }
      intervalRef.current = window.setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(intervalRef.current!);
            setIsRunning(false);
            // Record session
            if (mode === 'focus') {
              const newSession: SessionRecord = {
                date: getToday(),
                completedAt: new Date().toISOString(),
                duration: settings.focus,
              };
              setStats((prev) => {
                const updated = {
                  sessions: [...prev.sessions, newSession],
                  totalFocusMinutes: prev.totalFocusMinutes + settings.focus,
                };
                saveStats(updated);
                return updated;
              });
            }
            // Play notification sound
            try {
              const audioCtx = new AudioContext();
              const oscillator = audioCtx.createOscillator();
              const gain = audioCtx.createGain();
              oscillator.connect(gain);
              gain.connect(audioCtx.destination);
              oscillator.frequency.value = 800;
              oscillator.type = 'sine';
              gain.gain.value = 0.3;
              oscillator.start();
              setTimeout(() => {
                oscillator.stop();
                audioCtx.close();
              }, 300);
            } catch {}
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      startTimeRef.current = null;
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, mode, settings.focus]);

  // Update document title
  useEffect(() => {
    document.title = `${formatTime(timeLeft)} — ${MODE_LABELS[mode]}`;
  }, [timeLeft, mode]);

  const switchMode = useCallback(
    (newMode: Mode) => {
      setIsRunning(false);
      setMode(newMode);
      setTimeLeft(settings[newMode] * 60);
    },
    [settings]
  );

  const handleStart = () => setIsRunning(true);
  const handlePause = () => setIsRunning(false);
  const handleReset = () => {
    setIsRunning(false);
    setTimeLeft(settings[mode] * 60);
  };

  const updateSetting = (key: keyof Settings, value: number) => {
    const clamped = Math.max(1, Math.min(120, value));
    const newSettings = { ...settings, [key]: clamped };
    setSettings(newSettings);
    saveSettings(newSettings);
    if (key === mode && !isRunning) {
      setTimeLeft(clamped * 60);
    }
  };

  const clearStats = () => {
    const empty: Stats = { sessions: [], totalFocusMinutes: 0 };
    setStats(empty);
    saveStats(empty);
  };

  // SVG circle parameters
  const radius = 140;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div
      className={`min-h-screen bg-gradient-to-br ${colors.bg} transition-all duration-700 flex flex-col items-center justify-center p-4 relative overflow-hidden`}
    >
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute -top-40 -right-40 w-80 h-80 rounded-full opacity-5 ${mode === 'focus' ? 'bg-red-500' : mode === 'shortBreak' ? 'bg-emerald-500' : 'bg-blue-500'}`} />
        <div className={`absolute -bottom-40 -left-40 w-96 h-96 rounded-full opacity-5 ${mode === 'focus' ? 'bg-red-500' : mode === 'shortBreak' ? 'bg-emerald-500' : 'bg-blue-500'}`} />
      </div>

      {/* Header */}
      <div className="relative z-10 text-center mb-6">
        <h1 className="text-3xl md:text-4xl font-bold text-white/90 tracking-tight">
          🍅 Pomodoro Timer
        </h1>
        <p className="text-white/50 text-sm mt-1">Фокусируйся. Отдыхай. Достигай.</p>
      </div>

      {/* Mode Selector */}
      <div className="relative z-10 flex gap-2 mb-8 bg-white/5 backdrop-blur-sm rounded-2xl p-1.5 border border-white/10">
        {(Object.keys(MODE_LABELS) as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => switchMode(m)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
              mode === m
                ? `${MODE_COLORS[m].btn} text-white shadow-lg`
                : 'text-white/60 hover:text-white/90 hover:bg-white/5'
            }`}
          >
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>

      {/* Timer Display */}
      <div className="relative z-10 mb-8">
        <div className="relative w-72 h-72 md:w-80 md:h-80">
          {/* SVG Progress Ring */}
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 320 320">
            {/* Background circle */}
            <circle
              cx="160"
              cy="160"
              r={radius}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="8"
            />
            {/* Progress circle */}
            <circle
              cx="160"
              cy="160"
              r={radius}
              fill="none"
              className={`${colors.ring} transition-all duration-1000 ease-linear`}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
            />
          </svg>
          {/* Time Display */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-6xl md:text-7xl font-mono font-bold text-white tracking-wider">
              {formatTime(timeLeft)}
            </span>
            <span className={`text-sm font-medium mt-2 ${colors.text} opacity-80`}>
              {MODE_LABELS[mode]}
            </span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="relative z-10 flex items-center gap-4 mb-8">
        <button
          onClick={handleReset}
          className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center text-white/70 hover:text-white transition-all duration-200"
          title="Сбросить"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>

        <button
          onClick={isRunning ? handlePause : handleStart}
          className={`w-16 h-16 rounded-full ${colors.btn} text-white flex items-center justify-center shadow-2xl transition-all duration-200 transform hover:scale-105 active:scale-95`}
          title={isRunning ? 'Пауза' : 'Старт'}
        >
          {isRunning ? (
            <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
            </svg>
          ) : (
            <svg className="w-7 h-7 ml-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        <button
          onClick={() => setShowSettings(!showSettings)}
          className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center text-white/70 hover:text-white transition-all duration-200"
          title="Настройки"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>

      {/* Today Stats Summary */}
      <div className="relative z-10 flex gap-6 mb-6">
        <div className="text-center">
          <div className="text-2xl font-bold text-white">{todayCount}</div>
          <div className="text-xs text-white/50">Сессий сегодня</div>
        </div>
        <div className="w-px bg-white/10" />
        <div className="text-center">
          <div className="text-2xl font-bold text-white">{todayMinutes}</div>
          <div className="text-xs text-white/50">Минут фокуса</div>
        </div>
      </div>

      {/* Stats & Settings buttons */}
      <div className="relative z-10 flex gap-3">
        <button
          onClick={() => setShowStats(!showStats)}
          className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white text-sm font-medium transition-all duration-200"
        >
          📊 Статистика
        </button>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white text-sm font-medium transition-all duration-200"
        >
          ⚙️ Настройки
        </button>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="relative z-20 mt-6 w-full max-w-md bg-slate-800/90 backdrop-blur-xl rounded-2xl border border-white/10 p-6 shadow-2xl">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-white">Настройки длительности</h2>
            <button
              onClick={() => setShowSettings(false)}
              className="text-white/50 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>
          <div className="space-y-4">
            {(Object.keys(MODE_LABELS) as Mode[]).map((m) => (
              <div key={m} className="flex items-center justify-between">
                <label className="text-white/70 text-sm">{MODE_LABELS[m]}</label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateSetting(m, settings[m] - 1)}
                    className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    value={settings[m]}
                    onChange={(e) => updateSetting(m, parseInt(e.target.value) || 1)}
                    className="w-16 text-center bg-white/10 border border-white/20 rounded-lg py-1 text-white text-sm focus:outline-none focus:border-white/40"
                    min={1}
                    max={120}
                  />
                  <button
                    onClick={() => updateSetting(m, settings[m] + 1)}
                    className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
                  >
                    +
                  </button>
                  <span className="text-white/40 text-xs w-8">мин</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats Panel */}
      {showStats && (
        <div className="relative z-20 mt-6 w-full max-w-md bg-slate-800/90 backdrop-blur-xl rounded-2xl border border-white/10 p-6 shadow-2xl">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-white">Статистика</h2>
            <button
              onClick={() => setShowStats(false)}
              className="text-white/50 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Today */}
          <div className="mb-4 p-4 rounded-xl bg-white/5 border border-white/5">
            <h3 className="text-sm font-medium text-white/60 mb-2">Сегодня</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-xl font-bold text-white">{todayCount}</div>
                <div className="text-xs text-white/40">Сессий</div>
              </div>
              <div>
                <div className="text-xl font-bold text-white">{todayMinutes}</div>
                <div className="text-xs text-white/40">Минут</div>
              </div>
              <div>
                <div className="text-xl font-bold text-white">
                  {todayCount > 0 ? Math.round(todayMinutes / todayCount) : 0}
                </div>
                <div className="text-xs text-white/40">Ср. мин</div>
              </div>
            </div>
          </div>

          {/* Last 7 days */}
          <div className="mb-4">
            <h3 className="text-sm font-medium text-white/60 mb-2">Последние 7 дней</h3>
            <div className="flex items-end gap-1 h-24">
              {Array.from({ length: 7 }).map((_, i) => {
                const date = new Date();
                date.setDate(date.getDate() - (6 - i));
                const dateStr = date.toISOString().split('T')[0];
                const dayMinutes = stats.sessions
                  .filter((s) => s.date === dateStr)
                  .reduce((sum, s) => sum + s.duration, 0);
                const maxMinutes = Math.max(
                  ...Array.from({ length: 7 }).map((_, j) => {
                    const d = new Date();
                    d.setDate(d.getDate() - (6 - j));
                    return stats.sessions
                      .filter((s) => s.date === d.toISOString().split('T')[0])
                      .reduce((sum, s) => sum + s.duration, 0);
                  }),
                  1
                );
                const height = maxMinutes > 0 ? (dayMinutes / maxMinutes) * 100 : 0;
                const dayName = date.toLocaleDateString('ru-RU', { weekday: 'short' });
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex flex-col justify-end h-16">
                      <div
                        className={`w-full rounded-t-sm transition-all ${
                          dayMinutes > 0 ? 'bg-red-500/70' : 'bg-white/10'
                        }`}
                        style={{ height: `${Math.max(height, 4)}%` }}
                        title={`${dayMinutes} мин`}
                      />
                    </div>
                    <span className="text-[10px] text-white/40">{dayName}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* All time */}
          <div className="p-4 rounded-xl bg-white/5 border border-white/5 mb-4">
            <h3 className="text-sm font-medium text-white/60 mb-2">Всего</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xl font-bold text-white">{stats.sessions.length}</div>
                <div className="text-xs text-white/40">Всего сессий</div>
              </div>
              <div>
                <div className="text-xl font-bold text-white">{stats.totalFocusMinutes}</div>
                <div className="text-xs text-white/40">Всего минут</div>
              </div>
            </div>
          </div>

          {/* Clear button */}
          <button
            onClick={clearStats}
            className="w-full py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-sm font-medium transition-all duration-200"
          >
            Очистить статистику
          </button>
        </div>
      )}

      {/* Footer */}
      <div className="relative z-10 mt-8 text-white/30 text-xs">
        Данные сохраняются локально в вашем браузере
      </div>
    </div>
  );
}
