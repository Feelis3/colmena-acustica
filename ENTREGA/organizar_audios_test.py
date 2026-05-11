"""
Organiza los segmentos del CONJUNTO DE VALIDACIÓN en carpetas por clase,
para que el evaluador pueda probar la aplicación con audios reales etiquetados.

Reproduce exactamente el split del entrenamiento (GroupKFold(5), grupo = archivo
original, fold 0 = validación), así que las carpetas contienen justo los audios
sobre los que se midieron las métricas de la memoria (accuracy 0.931 / F1 0.913).

USO
---
1) En Google Colab (donde ya tienes el dataset montado en Drive), o
2) En local, tras descargar el dataset:
       kaggle datasets download annajyang/beehive-sounds -p ./beehive --unzip

   python organizar_audios_test.py \
       --dataset ./beehive/versions/3 \
       --salida  ./audios_test \
       --por-clase 8          # nº de audios por clase (usa un nº grande para todos)

Estructura generada
-------------------
    audios_test/
    ├── 0_reina_original/
    ├── 1_sin_reina/
    ├── 2_reina_nueva_rechazada/
    └── 3_reina_nueva_aceptada/
       (cada uno con N segmentos *.wav del conjunto de validación)
"""
import argparse
import re
import shutil
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.model_selection import GroupKFold

# --- mismos parámetros que 02_preprocesamiento / 03_entrenamiento ---
SEED = 42
N_SPLITS = 5
FOLD_VALIDACION = 0

NOMBRES_CLASE = {
    0: "0_reina_original",
    1: "1_sin_reina",
    2: "2_reina_nueva_rechazada",
    3: "3_reina_nueva_aceptada",
}


def segmento_a_original(nombre_segmento: str) -> str:
    """`XXX__segment3.wav` -> `XXX.raw` (igual que en el notebook 02)."""
    return re.sub(r"__segment\d+\.wav$", ".raw", nombre_segmento)


def main():
    ap = argparse.ArgumentParser(description="Organiza el conjunto de validación en carpetas por clase.")
    ap.add_argument("--dataset", default=Path("./data"), type=Path,
                    help="Carpeta del dataset (con 'all_data_updated.csv' y 'sound_files/'). Por defecto ./data")
    ap.add_argument("--salida", default=Path("./audios_prueba/test_dataset"), type=Path,
                    help="Carpeta de salida (por defecto ./audios_prueba/test_dataset).")
    ap.add_argument("--por-clase", default=8, type=int,
                    help="Nº máximo de audios a copiar por clase (pon 100000 para copiarlos todos).")
    ap.add_argument("--mover", action="store_true",
                    help="Mover en vez de copiar (por defecto copia).")
    args = ap.parse_args()

    base = args.dataset
    csv_path = base / "all_data_updated.csv"
    # el dataset trae los audios en sound_files/sound_files/
    audios_dir = base / "sound_files" / "sound_files"
    if not audios_dir.is_dir():
        audios_dir = base / "sound_files"  # por si la estructura es plana
    if not csv_path.is_file():
        raise SystemExit(f"No encuentro {csv_path}. Revisa --dataset.")
    if not audios_dir.is_dir():
        raise SystemExit(f"No encuentro la carpeta de audios dentro de {base}.")

    # --- reconstruir el dataframe igual que en el notebook ---
    main_df = pd.read_csv(csv_path)
    archivos = sorted(p.name for p in audios_dir.glob("*.wav"))
    if not archivos:
        raise SystemExit(f"No hay .wav en {audios_dir}.")

    df = pd.DataFrame({"segmento": archivos})
    df["file name"] = df["segmento"].apply(segmento_a_original)
    df = df.merge(main_df, on="file name", how="left")
    df = df.dropna(subset=["queen status"]).reset_index(drop=True)
    df["queen status"] = df["queen status"].astype(int)

    y = df["queen status"].values
    groups = df["file name"].values

    # --- mismo split: GroupKFold(5), fold 0 = validación ---
    gkf = GroupKFold(n_splits=N_SPLITS)
    folds = list(gkf.split(np.zeros(len(df)), y, groups=groups))
    _, val_idx = folds[FOLD_VALIDACION]

    df_val = df.iloc[val_idx].reset_index(drop=True)
    print(f"Segmentos en validación: {len(df_val)}")
    print("Distribución por clase:", df_val["queen status"].value_counts().sort_index().to_dict())

    # --- crear carpetas y copiar ---
    args.salida.mkdir(parents=True, exist_ok=True)
    copiados = {c: 0 for c in NOMBRES_CLASE}
    for clase, nombre_carpeta in NOMBRES_CLASE.items():
        (args.salida / nombre_carpeta).mkdir(exist_ok=True)

    # baraja determinista para que la muestra sea variada pero reproducible
    df_val = df_val.sample(frac=1.0, random_state=SEED).reset_index(drop=True)

    op = shutil.move if args.mover else shutil.copy2
    for _, fila in df_val.iterrows():
        clase = int(fila["queen status"])
        if copiados[clase] >= args.por_clase:
            continue
        src = audios_dir / fila["segmento"]
        if not src.is_file():
            continue
        dst = args.salida / NOMBRES_CLASE[clase] / fila["segmento"]
        op(str(src), str(dst))
        copiados[clase] += 1

    print("\nCopiados por clase:")
    for clase, n in copiados.items():
        print(f"  {NOMBRES_CLASE[clase]}: {n}")
    print(f"\nListo → {args.salida.resolve()}")


if __name__ == "__main__":
    main()
