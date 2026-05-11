"""
Descarga el dataset 'Beehive Sounds' (Yang et al.) desde Kaggle y lo deja
listo para ejecutar los notebooks en local.

REQUISITOS PREVIOS
------------------
1. Cuenta de Kaggle (gratuita).
2. Token de la API de Kaggle:
   - Entra en https://www.kaggle.com → tu perfil → "Settings" → "Create New Token".
   - Se descarga un archivo `kaggle.json`.
   - Colócalo en:   Windows -> C:\\Users\\<usuario>\\.kaggle\\kaggle.json
                    Linux/macOS -> ~/.kaggle/kaggle.json
   (o, alternativamente, define las variables de entorno KAGGLE_USERNAME y KAGGLE_KEY).
3. Instala las dependencias del proyecto:   pip install -r requirements.txt
   (incluye el paquete `kaggle`).

USO
---
   python descargar_datos.py                 # descarga a ./datos/beehive-sounds
   python descargar_datos.py --salida /ruta  # descarga a otra carpeta

Tras la descarga, los notebooks de la carpeta `notebooks/` esperan estas rutas
(ajústalas en la primera celda de cada notebook si usas otra carpeta):

   RUTA_BASE   = "datos/beehive-sounds/"
   RUTA_AUDIOS = "datos/beehive-sounds/sound_files/sound_files/"
   RUTA_OUT    = "datos/salida_proyecto/"      # donde se guarda mel_dataset.npz, etc.

Orden de ejecución de los notebooks:
   1) 01_eda.ipynb                 -> análisis exploratorio
   2) 02_preprocesamiento.ipynb    -> genera mel_dataset.npz y folds.npz en RUTA_OUT
   3) 03_entrenamiento_crnn.ipynb  -> entrena y evalúa; guarda modelo_crnn.keras
"""
import argparse
import os
import subprocess
import sys
from pathlib import Path

DATASET = "annajyang/beehive-sounds"


def main():
    ap = argparse.ArgumentParser(description="Descarga el dataset Beehive Sounds desde Kaggle.")
    ap.add_argument("--salida", default=Path("./datos/beehive-sounds"), type=Path,
                    help="Carpeta donde descomprimir el dataset (por defecto ./datos/beehive-sounds).")
    args = ap.parse_args()

    # comprobar que la librería kaggle está instalada
    try:
        import kaggle  # noqa: F401
    except ImportError:
        sys.exit("Falta el paquete 'kaggle'. Instala las dependencias:  pip install -r requirements.txt")

    # comprobar credenciales
    home = Path.home()
    cred = home / ".kaggle" / "kaggle.json"
    if not cred.is_file() and not (os.environ.get("KAGGLE_USERNAME") and os.environ.get("KAGGLE_KEY")):
        sys.exit(
            "No encuentro las credenciales de Kaggle.\n"
            f"  - Coloca tu kaggle.json en: {cred}\n"
            "  - O define las variables KAGGLE_USERNAME y KAGGLE_KEY.\n"
            "  Token: https://www.kaggle.com/settings -> Create New Token"
        )

    args.salida.mkdir(parents=True, exist_ok=True)
    print(f"Descargando '{DATASET}' en {args.salida.resolve()} ...")

    # usamos el CLI de kaggle (lo instala el paquete 'kaggle')
    cmd = [sys.executable, "-m", "kaggle", "datasets", "download", DATASET,
           "-p", str(args.salida), "--unzip"]
    res = subprocess.run(cmd)
    if res.returncode != 0:
        sys.exit("La descarga falló. Revisa tus credenciales de Kaggle y tu conexión.")

    # localizar la subcarpeta de audios (la estructura de Kaggle a veces incluye 'versions/3/')
    wavs = list(args.salida.rglob("*.wav"))
    csvs = list(args.salida.rglob("all_data_updated.csv"))
    print(f"\nDescarga completada: {len(wavs)} archivos .wav, {len(csvs)} CSV de etiquetas.")
    if csvs:
        base = csvs[0].parent
        print(f"\nRUTA_BASE sugerida para los notebooks:  {base}")
        sound_dir = next((p for p in [base / 'sound_files' / 'sound_files', base / 'sound_files'] if p.is_dir()), None)
        if sound_dir:
            print(f"RUTA_AUDIOS sugerida:                  {sound_dir}")
    print("\nListo. Abre los notebooks de la carpeta 'notebooks/' y ejecuta en orden: 01 -> 02 -> 03.")


if __name__ == "__main__":
    main()
