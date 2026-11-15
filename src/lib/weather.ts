import 'server-only';
import { CITY_GEO } from './catalog';

export type Weather = { temp: number; feels: number; hum: number; wind: number; rain: number; code: number };
export const wxText = (c: number) => c === 0 ? 'Clear sky' : c <= 2 ? 'Partly cloudy' : c === 3 ? 'Cloudy' : c <= 48 ? 'Misty' : c <= 67 ? 'Rain' : c <= 82 ? 'Showers' : c >= 95 ? 'Thunderstorm' : 'Cloudy';

/** Today's weather for the company's city from Open-Meteo (free, no key). Returns null if unavailable. */
export async function weatherFor(city: string): Promise<Weather | null> {
  if (!city) return null;
  try {
    let geo = CITY_GEO[city.trim().toLowerCase()];
    if (!geo) {
      const g = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&country_code=IN`, { next: { revalidate: 86400 }, signal: AbortSignal.timeout(4000) });
      const j = await g.json();
      if (!j.results?.[0]) return null;
      geo = [j.results[0].latitude, j.results[0].longitude];
    }
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${geo[0]}&longitude=${geo[1]}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code&daily=precipitation_probability_max&timezone=Asia%2FKolkata&forecast_days=1`,
      { next: { revalidate: 1800 }, signal: AbortSignal.timeout(4000) });
    const j = await r.json();
    const c = j.current;
    if (!c) return null;
    return { temp: Math.round(c.temperature_2m), feels: Math.round(c.apparent_temperature), hum: Math.round(c.relative_humidity_2m), wind: Math.round(c.wind_speed_10m), rain: j.daily?.precipitation_probability_max?.[0] ?? 0, code: c.weather_code };
  } catch {
    return null;
  }
}
