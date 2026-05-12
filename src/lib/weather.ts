// Clima real de Imbituba via Open-Meteo (forecast + marine).
// Server-side com cache de 10min — fallback pro mock se a API falhar.

import { tempo as fallback } from "./mock-data";

const IMBITUBA = { lat: -28.2412, lon: -48.6713 };
const REVALIDATE_S = 600;

export type WeatherDay = {
  dia: string;
  min: number;
  max: number;
  icone: string;
};

export type Weather = {
  cidade: string;
  tempC: number;
  condicao: string;
  ondaM: number;
  proximos: WeatherDay[];
};

const WMO_PT: Record<number, string> = {
  0: "Ensolarado",
  1: "Predominantemente claro",
  2: "Parcialmente nublado",
  3: "Nublado",
  45: "Neblina",
  48: "Neblina densa",
  51: "Garoa fraca",
  53: "Garoa moderada",
  55: "Garoa intensa",
  61: "Chuva fraca",
  63: "Chuva moderada",
  65: "Chuva intensa",
  71: "Neve fraca",
  73: "Neve moderada",
  75: "Neve intensa",
  80: "Pancadas",
  81: "Pancadas fortes",
  82: "Pancadas intensas",
  95: "Tempestade",
  96: "Tempestade com granizo",
  99: "Tempestade severa",
};

function wmoCondition(code: number): string {
  return WMO_PT[code] ?? "Variável";
}

function wmoIcon(code: number): string {
  if (code <= 1) return "☀";
  if (code === 2) return "🌤";
  if (code === 3) return "⛅";
  if (code === 45 || code === 48) return "🌫";
  if (code >= 51 && code <= 67) return "🌧";
  if (code >= 71 && code <= 77) return "❄";
  if (code >= 80 && code <= 82) return "🌦";
  if (code >= 85 && code <= 86) return "❄";
  if (code >= 95) return "⛈";
  return "☁";
}

const DOW_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function dayLabel(iso: string, isToday: boolean): string {
  if (isToday) return "Hoje";
  // Forçamos meio-dia em BRT pra evitar deriva de fuso na conversão
  const d = new Date(`${iso}T12:00:00-03:00`);
  return DOW_PT[d.getDay()];
}

type ForecastResp = {
  current?: { temperature_2m?: number; weather_code?: number };
  daily?: {
    time?: string[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    weather_code?: number[];
  };
};

type MarineResp = {
  current?: { wave_height?: number };
};

export async function getWeather(): Promise<Weather> {
  const fcUrl =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${IMBITUBA.lat}&longitude=${IMBITUBA.lon}` +
    `&current=temperature_2m,weather_code` +
    `&daily=temperature_2m_max,temperature_2m_min,weather_code` +
    `&timezone=America/Sao_Paulo&forecast_days=4`;
  const mrUrl =
    `https://marine-api.open-meteo.com/v1/marine` +
    `?latitude=${IMBITUBA.lat}&longitude=${IMBITUBA.lon}` +
    `&current=wave_height&timezone=America/Sao_Paulo`;

  try {
    const [fcRes, mrRes] = await Promise.all([
      fetch(fcUrl, { next: { revalidate: REVALIDATE_S } }),
      fetch(mrUrl, { next: { revalidate: REVALIDATE_S } }),
    ]);
    if (!fcRes.ok) throw new Error(`forecast ${fcRes.status}`);
    const fc = (await fcRes.json()) as ForecastResp;
    // Marine API é serviço separado — se falhar, segue sem altura de onda
    const mr = mrRes.ok ? ((await mrRes.json()) as MarineResp) : null;

    const tempC = Math.round(fc.current?.temperature_2m ?? fallback.tempC);
    const code = fc.current?.weather_code ?? 0;
    const condicao = wmoCondition(code);
    const ondaM = mr?.current?.wave_height ?? fallback.ondaM;

    const times = fc.daily?.time ?? [];
    const maxs = fc.daily?.temperature_2m_max ?? [];
    const mins = fc.daily?.temperature_2m_min ?? [];
    const codes = fc.daily?.weather_code ?? [];

    const proximos: WeatherDay[] = times.slice(0, 4).map((iso, i) => ({
      dia: dayLabel(iso, i === 0),
      max: Math.round(maxs[i] ?? 0),
      min: Math.round(mins[i] ?? 0),
      icone: wmoIcon(codes[i] ?? 0),
    }));

    return {
      cidade: "Imbituba",
      tempC,
      condicao,
      ondaM: Math.round(ondaM * 10) / 10,
      proximos: proximos.length ? proximos : fallback.proximos,
    };
  } catch (err) {
    console.warn("[weather] fallback to mock:", err);
    return fallback;
  }
}
