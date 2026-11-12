"""Start the hosted service with a current supplemented subway schedule."""

import os
import runpy
import sys
import tempfile
from pathlib import Path
from urllib.request import urlopen
from zipfile import ZipFile

SCHEDULE_URL = "https://rrgtfsfeeds.s3.amazonaws.com/gtfs_supplemented.zip"


def main():
    if not os.environ.get("BOARD_GTFS_ZIP"):
        directory = Path(tempfile.gettempdir())
        destination = directory / "exit-project-subway-gtfs.zip"
        temporary = directory / "exit-project-subway-gtfs.download"
        try:
            with urlopen(SCHEDULE_URL, timeout=60) as response, temporary.open("wb") as output:
                while chunk := response.read(1024 * 1024):
                    output.write(chunk)
            with ZipFile(temporary) as archive:
                for name in ("stops.txt", "trips.txt", "stop_times.txt"):
                    archive.getinfo(name)
            temporary.replace(destination)
        except (OSError, ValueError, KeyError) as error:
            raise RuntimeError("Could not load the subway schedule for the arrivals service") from error
        os.environ["BOARD_GTFS_ZIP"] = str(destination)
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    runpy.run_path(str(Path(__file__).with_name("server.py")), run_name="__main__")


if __name__ == "__main__":
    main()
