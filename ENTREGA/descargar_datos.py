import argparse
import os
import subprocess
import sys
from pathlib import Path

DATASET = "annajyang/beehive-sounds"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--salida", default=Path("./datos/beehive-sounds"), type=Path)
    args = ap.parse_args()

    try:
        import kaggle  # noqa: F401
    except ImportError:
        sys.exit("Falta el paquete 'kaggle': pip install -r requirements.txt")

    cred = Path.home() / ".kaggle" / "kaggle.json"
    if not cred.is_file() and not (os.environ.get("KAGGLE_USERNAME") and os.environ.get("KAGGLE_KEY")):
        sys.exit(f"Sin credenciales de Kaggle. Coloca kaggle.json en {cred} "
                 "(https://www.kaggle.com/settings -> Create New Token).")

    args.salida.mkdir(parents=True, exist_ok=True)
    print(f"Descargando '{DATASET}' en {args.salida.resolve()} ...")

    res = subprocess.run([sys.executable, "-m", "kaggle", "datasets", "download",
                          DATASET, "-p", str(args.salida), "--unzip"])
    if res.returncode != 0:
        sys.exit("La descarga falló. Revisa credenciales y conexión.")

    wavs = list(args.salida.rglob("*.wav"))
    csvs = list(args.salida.rglob("all_data_updated.csv"))
    print(f"Listo: {len(wavs)} archivos .wav, {len(csvs)} CSV de etiquetas.")
    if csvs:
        base = csvs[0].parent
        sound_dir = next((p for p in [base / "sound_files" / "sound_files", base / "sound_files"] if p.is_dir()), base)
        print(f"RUTA_BASE   = {base}")
        print(f"RUTA_AUDIOS = {sound_dir}")


if __name__ == "__main__":
    main()
