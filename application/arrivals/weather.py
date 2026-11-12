"""Current surface observations from the National Weather Service."""

import json
import math
import time
from datetime import datetime
from functools import lru_cache
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

NWS_ROOT = "https://api.weather.gov"
USER_AGENT = "TheExitProject/1.0 (https://unpixelated-ideas.github.io/exitproject/)"


def nws_json(url):
    parts = urlsplit(url)
    if parts.scheme != "https" or parts.netloc != "api.weather.gov":
        raise ValueError("Unexpected NWS URL")
    request = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/geo+json"})
    with urlopen(request, timeout=5) as response:
        return json.load(response)


@lru_cache(maxsize=512)
def nearby_stations(latitude, longitude, _day):
    point = nws_json(f"{NWS_ROOT}/points/{latitude},{longitude}")
    stations = nws_json(point["properties"]["observationStations"])
    return tuple(item["properties"]["stationIdentifier"] for item in stations["features"][:3])


def condition_category(description):
    text = description.lower()
    for category, words in (
        ("storm", ("thunder",)),
        ("snow", ("snow", "sleet", "ice", "freezing")),
        ("rain", ("rain", "drizzle", "shower")),
        ("fog", ("fog", "mist", "haze", "smoke")),
        ("cloudy", ("cloud", "overcast")),
        ("clear", ("clear", "fair", "sunny")),
    ):
        if any(word in text for word in words):
            return category
    return "unknown"


@lru_cache(maxsize=64)
def observation(station_id, _interval):
    try:
        data = nws_json(f"{NWS_ROOT}/stations/{station_id}/observations/latest")["properties"]
        celsius = data["temperature"]["value"]
        timestamp = datetime.fromisoformat(data["timestamp"].replace("Z", "+00:00")).timestamp()
        if isinstance(celsius, (int, float)) and math.isfinite(celsius) and time.time() - timestamp < 7200:
            return {"celsius": celsius, "condition": condition_category(data.get("textDescription") or ""),
                    "observedAt": timestamp}
    except (OSError, KeyError, TypeError, ValueError):
        pass
    return None


def station_weather(latitude, longitude):
    now = int(time.time())
    for station_id in nearby_stations(round(float(latitude), 2), round(float(longitude), 2), now // 86400):
        weather = observation(station_id, now // 600)
        if weather:
            return weather
    return None
