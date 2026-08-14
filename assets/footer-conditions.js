(() => {
  "use strict";

  const targets = Array.from(document.querySelectorAll("[data-footer-conditions]"));
  if (!targets.length || typeof window.fetch !== "function") return;

  const WEATHER_URL = "https://api.open-meteo.com/v1/forecast?latitude=12.9716&longitude=77.5946&current=temperature_2m&temperature_unit=celsius&timezone=Asia%2FKolkata";
  const AIR_QUALITY_URL = "https://air-quality-api.open-meteo.com/v1/air-quality?latitude=12.9716&longitude=77.5946&current=us_aqi&timezone=Asia%2FKolkata";
  const CACHE_KEY = "bengaluru-footer-conditions-v1";
  const CACHE_DURATION = 10 * 60 * 1000;

  const readCache = () => {
    try {
      const cached = JSON.parse(window.localStorage.getItem(CACHE_KEY));
      if (!cached || Date.now() - cached.savedAt > CACHE_DURATION) return null;
      return cached;
    } catch {
      return null;
    }
  };

  const writeCache = (conditions) => {
    try {
      window.localStorage.setItem(CACHE_KEY, JSON.stringify({ ...conditions, savedAt: Date.now() }));
    } catch {
      // Live conditions still work when storage is unavailable.
    }
  };

  const render = ({ temperature, aqi }) => {
    const items = [];
    if (Number.isFinite(temperature)) {
      items.push({ text: `${Math.round(temperature)}°C`, label: `${Math.round(temperature)} degrees Celsius` });
    }
    if (Number.isFinite(aqi)) {
      items.push({ text: `AQI ${Math.round(aqi)}`, label: `air quality index ${Math.round(aqi)}` });
    }

    targets.forEach((target) => {
      target.replaceChildren();

      if (!items.length) {
        target.textContent = "Live data unavailable";
        target.setAttribute("aria-label", "Current Bengaluru weather and air quality are unavailable");
        target.removeAttribute("title");
        target.hidden = false;
        return;
      }

      items.forEach((item, index) => {
        if (index > 0) {
          const separator = document.createElement("span");
          separator.className = "footer-conditions-separator";
          separator.setAttribute("aria-hidden", "true");
          separator.textContent = "·";
          target.append(separator);
        }

        const value = document.createElement("span");
        value.textContent = item.text;
        target.append(value);
      });

      target.setAttribute("aria-label", `Current Bengaluru conditions: ${items.map((item) => item.label).join(", ")}`);
      target.title = Number.isFinite(aqi) ? "AQI uses the US AQI standard" : "Current Bengaluru temperature";
      target.hidden = false;
    });
  };

  const cached = readCache();
  if (cached) render(cached);

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 7000);
  const fetchJson = (url) => fetch(url, {
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal: controller.signal
  }).then((response) => {
    if (!response.ok) throw new Error(`Conditions request failed with ${response.status}`);
    return response.json();
  });

  Promise.allSettled([fetchJson(WEATHER_URL), fetchJson(AIR_QUALITY_URL)])
    .then(([weatherResult, airQualityResult]) => {
      const temperature = weatherResult.status === "fulfilled"
        ? Number(weatherResult.value?.current?.temperature_2m)
        : NaN;
      const aqi = airQualityResult.status === "fulfilled"
        ? Number(airQualityResult.value?.current?.us_aqi)
        : NaN;
      const conditions = { temperature, aqi };

      if (Number.isFinite(temperature) || Number.isFinite(aqi)) {
        writeCache(conditions);
        render(conditions);
      } else if (!cached) {
        render(conditions);
      }
    })
    .catch(() => {
      if (!cached) render({ temperature: NaN, aqi: NaN });
    })
    .finally(() => window.clearTimeout(timeout));
})();
