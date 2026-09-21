// Open-Meteo connector — free, keyless weather API.
// API contract: https://open-meteo.com/en/docs
//
// Status: code-complete and contract-correct, but not exercised end-to-end
// in this build — this sandbox's outbound network policy blocks
// api.open-meteo.com. See docs/CONNECTOR_STATUS.md. It will run as soon as
// it's deployed somewhere with normal outbound HTTPS; on any fetch failure
// it reports the error rather than writing invented readings.

import { prisma } from "@/lib/prisma";
import type { Connector, ConnectorContext, ConnectorRunResult } from "./types";

interface OpenMeteoResponse {
  current?: {
    time: string;
    temperature_2m: number;
    weather_code: number;
    wind_speed_10m: number;
    precipitation: number;
  };
  daily?: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    weather_code: number[];
    precipitation_probability_max: number[];
  };
}

async function fetchOpenMeteo(lat: number, lng: number): Promise<OpenMeteoResponse> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lng));
  url.searchParams.set("current", "temperature_2m,weather_code,wind_speed_10m,precipitation");
  url.searchParams.set(
    "daily",
    "temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max"
  );
  url.searchParams.set("timezone", "Pacific/Auckland");
  url.searchParams.set("forecast_days", "7");

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Open-Meteo request failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export const weatherConnector: Connector = {
  key: "open-meteo",
  name: "Open-Meteo",
  organisation: "Open-Meteo.com",
  dataType: "weather observation & forecast",

  async run(ctx: ConnectorContext): Promise<ConnectorRunResult> {
    try {
      const data = await fetchOpenMeteo(ctx.lat, ctx.lng);

      const dataSource = await prisma.dataSource.upsert({
        where: { destinationId_name: { destinationId: ctx.destinationId, name: "Open-Meteo" } },
        update: { connectorStatus: "CONNECTED" },
        create: {
          destinationId: ctx.destinationId,
          name: "Open-Meteo",
          organisation: "Open-Meteo.com",
          dataType: "weather observation & forecast",
          defaultAccessLevel: "PUBLIC",
          connectorStatus: "CONNECTED",
          connectorKey: "open-meteo",
          url: "https://open-meteo.com/",
        },
      });

      let rowsWritten = 0;

      if (data.current) {
        await prisma.weatherObservation.create({
          data: {
            destinationId: ctx.destinationId,
            sourceId: dataSource.id,
            temperatureC: data.current.temperature_2m,
            conditionCode: String(data.current.weather_code),
            windSpeedKmh: data.current.wind_speed_10m,
            precipitationMm: data.current.precipitation,
            geography: ctx.destinationSlug,
            observedAt: new Date(data.current.time),
            confidence: "VERIFIED",
            accessLevel: "PUBLIC",
          },
        });
        rowsWritten += 1;
      }

      if (data.daily) {
        const issuedAt = new Date();
        const forecastRows = data.daily.time.map((date, i) => ({
          destinationId: ctx.destinationId,
          sourceId: dataSource.id,
          forDate: new Date(date),
          temperatureMinC: data.daily!.temperature_2m_min[i],
          temperatureMaxC: data.daily!.temperature_2m_max[i],
          conditionCode: String(data.daily!.weather_code[i]),
          precipitationProbability: data.daily!.precipitation_probability_max[i],
          geography: ctx.destinationSlug,
          issuedAt,
          confidence: "HIGH" as const,
          accessLevel: "PUBLIC" as const,
        }));
        await prisma.weatherForecast.createMany({ data: forecastRows });
        rowsWritten += forecastRows.length;
      }

      return { ok: true, rowsWritten };
    } catch (err) {
      return {
        ok: false,
        rowsWritten: 0,
        error: err instanceof Error ? err.message : "Unknown connector error",
      };
    }
  },
};
