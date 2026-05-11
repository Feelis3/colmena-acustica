# Clasificador acústico de colmenas

Aplicación web para clasificar el estado de la colmena (presencia / ausencia de reina) a partir del sonido. Modelo CRNN (Conv1D + BiLSTM) entrenado sobre el dataset *Beehive Sounds*.

## Clases predichas

| idx | clase                  |
|-----|------------------------|
| 0   | Reina original         |
| 1   | Sin reina              |
| 2   | Reina nueva rechazada  |
| 3   | Reina nueva aceptada   |

## Estructura

```
.
├── 01_eda(1).ipynb              # análisis exploratorio
├── 02_preprocesamiento(1).ipynb # mel-espectrogramas + splits
├── 03_lstm.ipynb                # entrenamiento CRNN
├── modelo_crnn.keras            # modelo entrenado (~2.6 MB)
├── web/
│   ├── main.py                  # FastAPI
│   ├── predict.py               # pipeline de inferencia
│   ├── templates/               # HTML (index = v1, index_v2 = v2)
│   └── static/                  # CSS / JS
├── requirements.txt
├── Procfile
├── nixpacks.toml
└── railway.json
```

## Pipeline de inferencia

1. Decodificación del audio a WAV mono 22 050 Hz con FFmpeg.
2. Mel-espectrograma `(n_mels=128, n_fft=2048, hop=512)` en escala dB.
3. Padding/truncado a `T = 2584` frames (≈ 60 s).
4. Z-score por espectrograma.
5. Si dura > 60 s, se trocea en ventanas no solapadas y se promedian las probabilidades softmax.
6. CRNN → softmax sobre 4 clases.

## Uso local

```bash
pip install -r requirements.txt
cd web
KERAS_BACKEND=torch python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

- v1 (académica, expandida): `http://localhost:8000/`
- v2 (rediseño bee-themed):  `http://localhost:8000/v2`

## Deploy en Railway

El repo ya viene listo: `railway.json`, `nixpacks.toml`, `Procfile` y `requirements.txt` en la raíz.

1. New Project → Deploy from GitHub repo
2. Selecciona este repo
3. Railway detectará nixpacks y construirá usando Python 3.11 + ffmpeg
4. La primera build tarda ~5 min (descarga torch CPU + keras + librosa)
5. Una vez desplegado, asegúrate de que la variable `KERAS_BACKEND=torch` está activa (ya viene en `nixpacks.toml`)

El historial de cada análisis se guarda en `localStorage` del navegador, así cada dispositivo tiene el suyo (no hay base de datos).

## Robustez ante datos fuera de dominio

El modelo solo tiene 4 clases y todas asumen "hay colmena", así que ante ruido, música o voz el `softmax` forzaría una de ellas. Antes de devolver una predicción se calculan características acústicas globales (RMS, fracción de energía bajo 1.5 kHz, planitud espectral, centroide) y se aplican umbrales; si el audio no se parece a una colmena o la confianza es baja, la API responde `es_colmena: false` con el motivo en lugar de inventar un estado de reina. Detalles en `ENTREGA/MEMORIA.md` §6.4.

## Entrega académica

La carpeta `ENTREGA/` contiene el paquete entregable: memoria técnica (`MEMORIA.md`), los tres notebooks, el modelo y audios de prueba (controles negativos + demo positiva). Ver `ENTREGA/README.md`.

## Notas

- Dataset: [Beehive Sounds](https://www.kaggle.com/datasets/annajyang/beehive-sounds) (Yang et al.)
- Backend ML: Keras 3 sobre PyTorch (CPU)
- Métricas (validación sin fuga): accuracy 0.931 · F1 macro 0.913
- Tamaño máximo de audio: 50 MB
