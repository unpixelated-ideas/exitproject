# Display board

From the application directory, set up the arrivals service in a Python virtual environment.

```sh
python3 -m venv /tmp/exit-board-venv
/tmp/exit-board-venv/bin/python -m pip install -r arrivals/requirements.txt
/tmp/exit-board-venv/bin/python -B arrivals/server.py
```

In a second terminal, run `pnpm dev` and open `http://127.0.0.1:5173/#/display-board`. Vite proxies board requests to the local service. The home page does not link to the board.

The service reads the project’s station catalog and caches the eight subway and SIR GTFS Realtime feeds. `/stations` lists station complexes and `/arrivals?station=611` returns Times Square–42 St / Port Authority predictions. Times are Unix seconds. Predictions can include terminating trains. Set `BOARD_GTFS_ZIP` to the current MTA supplemented subway schedule to use matching trip headsigns and restore preceding stops omitted from live updates. Unmatched trips use the last stop in the live stop list as a destination estimate.

For a hosted board, serve the arrivals service behind an HTTPS reverse proxy and build the frontend with `VITE_BOARD_API_URL` set to that service’s base URL. For a separate frontend origin, set `BOARD_WEB_ORIGIN` on the service to the frontend origin. The bundled server listens on loopback port 8787. GitHub Pages hosts only the frontend.

The Full-color board requests `/weather?station=611` for current National Weather Service observations near Times Square. The service identifies itself to NWS with the project's public URL, caches station discovery and observations, and returns HTTP 503 when it cannot obtain a recent temperature. Arrival requests run separately.
