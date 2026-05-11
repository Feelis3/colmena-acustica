# Instrucciones de ejecución (local)

Guía para reproducir el proyecto completo: descargar los datos, ejecutar los notebooks (EDA → preprocesamiento → entrenamiento) y levantar / desplegar la aplicación web.

> Documento principal del proyecto: **`MEMORIA.docx`** (la versión `.md` es solo la fuente editable).

---

## 0. Requisitos

- **Python 3.11** recomendado (funciona en 3.10–3.12).
- Instalar dependencias:
  ```bash
  pip install -r requirements.txt
  ```
  (incluye FastAPI, Keras, PyTorch CPU, librosa, imageio-ffmpeg —que trae su propio ffmpeg, no hace falta instalarlo aparte— y el paquete `kaggle`).

---

## 1. Descargar los datos

El dataset **Beehive Sounds** (Yang et al.) está en Kaggle. Para descargarlo:

1. Crea un token de la API de Kaggle: <https://www.kaggle.com/settings> → **Create New Token** → se descarga `kaggle.json`.
2. Colócalo en:
   - Windows: `C:\Users\<usuario>\.kaggle\kaggle.json`
   - Linux/macOS: `~/.kaggle/kaggle.json`
3. Ejecuta:
   ```bash
   python descargar_datos.py
   ```
   Descarga y descomprime el dataset en `./datos/beehive-sounds/`. Al terminar imprime las rutas exactas que deben usar los notebooks (`RUTA_BASE`, `RUTA_AUDIOS`).

---

## 2. Ejecutar los notebooks (carpeta `notebooks/`)

En la **primera celda** de cada notebook, ajusta las rutas a las que imprimió el paso anterior, por ejemplo:

```python
RUTA_BASE   = "datos/beehive-sounds/"                        # o la que indique descargar_datos.py
RUTA_AUDIOS = "datos/beehive-sounds/sound_files/sound_files/"
RUTA_OUT    = "datos/salida_proyecto/"                        # carpeta donde se guardan mel_dataset.npz, folds.npz, etc.
```

> Los notebooks originales se ejecutaron en Google Colab, así que algunas rutas apuntan a `/content/drive/...`; basta cambiarlas por las locales de arriba.

Orden de ejecución:

| # | Notebook | Qué hace | Salida |
|---|---|---|---|
| 1 | `01_eda.ipynb` | Análisis exploratorio: distribución de clases, formas de onda, mel-espectrogramas por clase. | (gráficos en el notebook) |
| 2 | `02_preprocesamiento.ipynb` | Calcula los mel-espectrogramas `(128, 2584)`, normaliza (z-score), hace el split `GroupKFold(5)` sin fuga de datos. | `mel_dataset.npz`, `folds.npz` en `RUTA_OUT` |
| 3 | `03_entrenamiento_crnn.ipynb` | Construye la CRNN (Conv1D + BiLSTM), entrena con `class_weight`, `EarlyStopping` y `ReduceLROnPlateau`, evalúa (accuracy, F1, matriz de confusión). | `modelo_crnn.keras` |

El modelo ya entrenado se incluye en `modelo_crnn.keras` (raíz de esta carpeta), así que se puede saltar al paso 3/4 sin reentrenar.

---

## 3. Levantar la aplicación web en local

```bash
cd web
# Windows PowerShell:
$env:KERAS_BACKEND="torch"; python -m uvicorn main:app --host 0.0.0.0 --port 8000
# Linux/macOS:
KERAS_BACKEND=torch python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

Luego abre:
- <http://localhost:8000/>  → interfaz v1 (académica, más información en pantalla)
- <http://localhost:8000/v2> → interfaz v2 (rediseño, tema apícola)

> El `web/predict.py` busca el modelo en `../modelo_crnn.keras` (un nivel por encima de `web/`). En esta carpeta el modelo está en `ENTREGA/modelo_crnn.keras`, así que la estructura ya es correcta.

### Probar

- **Audios reales del dataset**: rellena `audios_prueba/test_dataset/` con
  ```bash
  python organizar_audios_test.py --dataset ./datos/beehive-sounds --salida ./audios_prueba/test_dataset --por-clase 8
  ```
  (ajusta `--dataset` a la ruta real que devolvió `descargar_datos.py`; pon `--por-clase 100000` para copiar todos los segmentos de validación). Quedan ordenados en `0_reina_original/ … 3_reina_nueva_aceptada/`; sube uno y compara la predicción con el nombre de su carpeta.
- **`audios_prueba/demo_colmena/demo_colmena_sintetica.wav`** → debe ser aceptado y clasificado.
- **`audios_prueba/controles_no_colmena/*.wav`** (ruido, silencio, tonos, barrido) → la app responde **"No reconocido como colmena"** con el motivo, en vez de inventarse un estado de reina (manejo de datos fuera de dominio, ver `MEMORIA.docx` §6.4).
- **Grabar en directo** desde el navegador con el botón "grabar en vivo".

---

## 4. Desplegar la web (Railway)

Esta carpeta incluye los archivos de despliegue (`requirements.txt`, `Procfile`, `nixpacks.toml`, `railway.json`) — pero apuntan a la estructura del **repositorio** (donde el modelo está en la raíz y la app en `web/`). Para desplegar:

1. Sube el repositorio a GitHub (ya está en <https://github.com/Feelis3/colmena-acustica>).
2. En <https://railway.app> → **New Project → Deploy from GitHub repo** → selecciona el repo.
3. Railway detecta `nixpacks.toml` (Python 3.11 + ffmpeg) y `railway.json` (comando de arranque + healthcheck en `/v2`).
4. La primera build tarda ~5–8 min (descarga torch CPU, keras, librosa). Cuando termine, Railway da una URL pública.

> Nota: el plan gratuito de Railway tiene ~512 MB de RAM; el modelo + torch + librosa cargan ~400–500 MB, así que puede ir justo. Alternativas equivalentes: Render, Fly.io, Hugging Face Spaces.

---

## Resumen de la estructura de esta entrega

```
ENTREGA/
├── MEMORIA.docx                 ← documento principal del proyecto (Word)
├── MEMORIA.md                   ← fuente editable de la memoria
├── README.md                    ← guía rápida y enlaces
├── INSTRUCCIONES.md             ← este documento
├── descargar_datos.py           ← descarga el dataset desde Kaggle
├── organizar_audios_test.py     ← ordena el conjunto de validación en carpetas por clase
├── modelo_crnn.keras            ← modelo entrenado
├── requirements.txt             ← dependencias (todo: notebooks + web)
├── Procfile / nixpacks.toml / railway.json   ← despliegue en Railway
├── notebooks/
│   ├── 01_eda.ipynb
│   ├── 02_preprocesamiento.ipynb
│   └── 03_entrenamiento_crnn.ipynb
├── web/                         ← aplicación FastAPI (backend + frontend)
│   ├── main.py
│   ├── predict.py
│   ├── templates/  (index.html, index_v2.html)
│   └── static/     (script.js, style.css, v2.css, v2.js)
└── audios_prueba/
    ├── README.md
    ├── controles_no_colmena/    ← audios que la app debe rechazar
    ├── demo_colmena/            ← zumbido sintético que la app debe aceptar
    └── test_dataset/            ← (vacía) audios reales de validación, vía organizar_audios_test.py

Repositorio con el código completo: https://github.com/Feelis3/colmena-acustica
```
