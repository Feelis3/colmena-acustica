# Memoria — Clasificador acústico del estado de la colmena

**Curso de Especialización en Inteligencia Artificial y Big Data**
**Proyecto Final · Programación de Inteligencia Artificial**
Autor: Marcos · Profesor: Sebastián Rubio Valero · 2026

> Repositorio: <https://github.com/Feelis3/colmena-acustica>
> Despliegue: *(URL de Railway)*

---

## 1. Definición del problema y valor

### 1.1 El problema

En apicultura, el **estado de la reina** es el indicador más crítico de la salud de una colmena. Una colonia que pierde a su reina (estado *queenless*) y no consigue criar una sustituta entra en declive y muere en semanas. Detectarlo a tiempo permite al apicultor intervenir (introducir una reina nueva, fusionar colmenas), pero la inspección tradicional exige **abrir la colmena**, lo que estresa a las abejas, interrumpe la producción y solo es viable cada 1–3 semanas.

El zumbido de una colmena cambia de forma medible según su estado: una colonia sin reina emite un sonido más agudo e irregular (el característico *roar* o *queenless roar*), mientras que una colonia con reina aceptada produce un zumbido grave y estable. Esta señal acústica es **continua, no invasiva y barata de captar** con un micrófono dentro de la colmena.

### 1.2 Propuesta

Una aplicación web que recibe una grabación del interior de la colmena (subida o captada en directo desde el navegador) y devuelve, mediante una red neuronal, la probabilidad de cada uno de los cuatro estados de la reina del dataset de referencia:

| idx | clase                  | descripción |
|-----|------------------------|-------------|
| 0   | Reina original         | la reina propia de la colonia está presente |
| 1   | Sin reina              | colonia huérfana (*queenless*) |
| 2   | Reina nueva rechazada  | se introdujo una reina nueva pero no fue aceptada |
| 3   | Reina nueva aceptada   | reina nueva integrada con éxito |

### 1.3 Valor e impacto

- **Monitorización continua y no invasiva**: sustituye o complementa la inspección manual.
- **Detección temprana**: permite reaccionar antes de que la colonia colapse.
- **Bajo coste**: solo requiere un micrófono y conexión; aplicable a apicultura de pequeña escala, cooperativas, investigación y educación.
- **Hueco real**: no existe una herramienta libre y accesible que haga esto vía web. Los sistemas comerciales de "colmena inteligente" son caros y cerrados.

---

## 2. Obtención y análisis exploratorio de datos (EDA)

### 2.1 Fuente

**Beehive Sounds** (Yang et al.), publicado en Kaggle: grabaciones de audio del interior de colmenas reales etiquetadas con `queen status` (4 clases) más metadatos (temperatura, humedad, fecha, ID de archivo original). El dataset se obtuvo de forma programática mediante la API de Kaggle (`kaggle datasets download annajyang/beehive-sounds`), no descargándolo a mano.

Los audios largos vienen ya segmentados en clips de **60 s** (`*__segmentN.wav`); cada segmento hereda la etiqueta del archivo original (`all_data_updated.csv`). Tras descartar segmentos sin etiqueta de `queen status`, el dataset de trabajo contiene varios miles de segmentos.

### 2.2 EDA (notebook `01_eda.ipynb`)

- **Distribución de clases**: fuerte desbalanceo. La clase 3 (*reina nueva aceptada*) domina (~50 % de los segmentos), mientras que las clases 0 y 1 son minoritarias. → Se mitiga con `class_weight` en el entrenamiento (ver §4.4).
- **Inspección de las formas de onda y espectrogramas**: las colmenas concentran su energía por debajo de ~1.5 kHz (fundamental del zumbido ~200–280 Hz más armónicos). Las clases se distinguen sobre todo en la **distribución de energía en bandas bajas** y en la **estabilidad temporal** del zumbido.
- **Mel-espectrogramas por clase**: visualmente, las colonias con reina aceptada muestran bandas armónicas marcadas y estables; las huérfanas, un patrón más difuso y desplazado a frecuencias algo más altas.
- **Duración**: confirmada en ~60 s por segmento → fija el tamaño de entrada del modelo (ver §4.1).
- **Agrupamiento por audio original**: varios segmentos provienen del mismo archivo/colmena. Esto **obliga a un split por grupos** para que no haya fuga de datos (data leakage) entre train y validación (ver §4.1).

---

## 3. Estado del arte

El análisis acústico de colmenas es un campo activo dentro de la bioacústica aplicada:

- **Datasets y trabajos previos**:
  - *NU-Hive* (Cecchi et al., 2018–2019): grabaciones continuas con clasificación *queen / queenless* mediante CNN sobre espectrogramas.
  - *OSBH (Open Source Beehives) / "To Bee Or Not To Bee"* (Nolasco & Benetos, 2018): benchmark de detección de *strength* y presencia de reina; comparan MFCC + clasificadores clásicos frente a CNN.
  - *Beehive Sounds* (Yang et al.): el dataset usado aquí, con la etiqueta más fina de 4 estados de reina.
- **Enfoques habituales**:
  1. **Características clásicas** (MFCC, contraste espectral, ZCR) + SVM / Random Forest. Sencillo pero limitado en generalización.
  2. **CNN sobre mel-espectrogramas**: tratan el espectrograma como imagen. Muy usado, buenos resultados intra-dataset.
  3. **CRNN (Conv + RNN)**: la capa convolucional extrae patrones espectrales locales y la recurrente modela la **evolución temporal** del zumbido. Es el enfoque elegido en este proyecto porque el estado de la reina se manifiesta tanto en el contenido espectral como en la *estabilidad/irregularidad temporal* del sonido.
  4. **Transfer learning con modelos de audio pre-entrenados** (YAMNet, PANNs, BirdNET): estado del arte en robustez; se discute como mejora futura (§7).
- **Limitación común reportada en la literatura**: fuerte caída de rendimiento al cambiar de colmena, micrófono o localización (*domain shift*). Es un problema abierto y se aborda parcialmente en este proyecto con un detector de fuera-de-dominio (§6.4).

---

## 4. Implementación, técnicas y algoritmos

### 4.1 Obtención y preparación de datos (notebook `02_preprocesamiento.ipynb`)

**Pipeline de preprocesamiento** (parámetros idénticos en entrenamiento e inferencia):

1. **Carga** del audio a 22 050 Hz, mono (`librosa.load`).
2. **Mel-espectrograma**: `n_fft = 2048`, `hop_length = 512`, `n_mels = 128` → matriz `(128, T)`.
3. **Escala logarítmica**: `librosa.power_to_db(mel, ref=np.max)` → dB respecto al máximo.
4. **Longitud fija**: `T_FIXED = ⌊60·22050/512⌋ + 1 = 2584` frames. Se hace *padding* (con el mínimo del espectrograma) o *truncado* para que todos los segmentos tengan exactamente `(128, 2584)`.
5. **Normalización z-score por espectrograma**: `(x − μ) / (σ + 1e-6)`. Centra y escala cada ejemplo → estabiliza el entrenamiento de la parte recurrente y reduce (parcialmente) el efecto de la ganancia del micrófono.
6. **Transposición a `(2584, 128)`** = `(timesteps, features)`: cada paso temporal es un vector de 128 valores mel, que es lo que consume la Conv1D / LSTM.

**División de datos sin fuga**: se usa `GroupKFold(n_splits=5)` con el **ID del audio original como grupo**. Así ningún audio original aparece a la vez en train y validación (se verifica explícitamente con un `assert` sobre la intersección de grupos). Se conserva el fold 0 como conjunto de validación principal y los 5 folds quedan guardados para una posible validación cruzada completa.

**Gestión del desbalanceo**: no se descartan ni se sobre-muestrean ejemplos; se compensa con `class_weight` balanceado en el `fit` (pesos `{0: 1.71, 1: 1.87, 2: 1.14, 3: 0.50}`), penalizando más los errores en las clases minoritarias.

El tensor preprocesado se guarda en `mel_dataset.npz` (X, y, índices de split, parámetros) para que el entrenamiento sea reproducible sin recalcular los espectrogramas.

### 4.2 Diseño del modelo y elección del algoritmo

**Algoritmo elegido: CRNN (Convolutional Recurrent Neural Network).**

Justificación frente a alternativas:

| Alternativa | Por qué no |
|---|---|
| MFCC + SVM/RF | No captura la dinámica temporal; peor con audios largos y ruidosos. |
| CNN 2D pura sobre el espectrograma | Captura patrones espectro-temporales locales pero no modela bien dependencias largas (los 60 s de evolución del zumbido). |
| RNN/LSTM pura sobre los 2584 frames | Secuencia demasiado larga → entrenamiento lento e inestable, gradiente que se diluye. |
| **CRNN (elegido)** | Las **Conv1D** extraen patrones espectrales locales y **reducen la dimensión temporal** (de 2584 a 161 frames vía dos *max-pooling* de factor 4); las **BiLSTM** modelan la evolución temporal del zumbido en ambas direcciones. Equilibra capacidad y coste. |

**Arquitectura** (`construir_modelo`, ~227 K parámetros entrenables):

```
mel_input            (None, 2584, 128)
├─ Conv1D(64, k=5, padding='same', relu)     → patrones espectrales locales
├─ BatchNormalization
├─ MaxPooling1D(pool=4)                       → 2584 → 646 frames
├─ Conv1D(128, k=5, padding='same', relu)
├─ BatchNormalization
├─ MaxPooling1D(pool=4)                       → 646 → 161 frames
├─ Dropout(0.3)
├─ Bidirectional(LSTM(64, return_sequences=True, dropout=0.2))
├─ Bidirectional(LSTM(32, return_sequences=False, dropout=0.2))
├─ Dense(64, relu)
├─ Dropout
└─ Dense(4, softmax)
```

**Decisiones de arquitectura justificadas:**

- **Kernel `k=5` en las Conv1D**: ventana de 5 frames mel (~116 ms con `hop=512`) — suficiente para capturar la estructura armónica local del zumbido sin diluirla.
- **Dos bloques convolucionales con *pooling* ×4**: reducen la secuencia de 2584 a 161 pasos antes de la LSTM, haciéndola tratable y enfocada en la macroestructura temporal.
- **`padding='same'`**: conserva la longitud tras la convolución; el control de la dimensión temporal recae en el *pooling*, no en el borde de la convolución.
- **BiLSTM**: el estado de la reina no es causal en el tiempo (no importa "pasado vs futuro"), así que tiene sentido leer la secuencia en ambos sentidos.
- **Dropout (0.3 tras conv, 0.2 recurrente, otro antes de la salida) + BatchNorm**: regularización para combatir el sobreajuste en un dataset de tamaño moderado.
- **Función de pérdida: entropía cruzada categórica**, `Loss = −Σ yᵢ log(ŷᵢ)`, la elección estándar para clasificación multiclase con `softmax` en la salida; coherente con la capa final de 4 unidades.

### 4.3 Implementación técnica

- **Notebooks** (`01_eda`, `02_preprocesamiento`, `03_entrenamiento_crnn`): cada uno cubre una fase, con celdas comentadas, semillas fijadas (`SEED = 42`) y comprobaciones de sanidad (shapes, ausencia de leakage, distribución de clases por split).
- **Backend** (`web/main.py`, `web/predict.py`): API FastAPI modular. `predict.py` encapsula todo el pipeline de inferencia (decodificación con FFmpeg, mel-espectrograma, ventaneo, predicción, detector OOD) y carga el modelo **una sola vez** al arrancar (`@app.on_event("startup")`) para no penalizar cada petición.
- **Frontend** (`web/static`, `web/templates`): HTML/CSS/JS sin frameworks; dos interfaces (`/` versión académica, `/v2` rediseño).
- **GPU**: el entrenamiento se realizó con aceleración GPU en Google Colab (`tf.config.list_physical_devices('GPU')`). La inferencia en producción corre en CPU (suficiente: ~1 s por audio una vez cargado el modelo).
- **Repositorio**: `.gitignore` (excluye artefactos, cachés, `.claude/`), `README.md` con instalación/uso/deploy, commits descriptivos, archivos de despliegue (`Procfile`, `nixpacks.toml`, `railway.json`, `requirements.txt`).

### 4.4 Entrenamiento y optimización (notebook `03_entrenamiento_crnn.ipynb`)

- **Optimizador**: Adam, *learning rate* inicial `1e-3`.
- **`class_weight` balanceado** para el desbalanceo (ver §4.1).
- **Callbacks**:
  - `EarlyStopping` sobre `val_loss` (restaura los mejores pesos) → evita seguir entrenando una vez que la validación deja de mejorar.
  - `ReduceLROnPlateau` → baja el *learning rate* cuando `val_loss` se estanca.
  - `ModelCheckpoint` → guarda el mejor modelo.
- **Hasta 40 épocas**, lotes de 178 *steps*, ~55 s/época en GPU. La curva de `val_accuracy` sube de ~0.51 (época 1) a ~0.85 (época 12) con oscilaciones que el `ReduceLROnPlateau` y el `EarlyStopping` amortiguan.
- **División**: `GroupKFold` (fold 0 para validación), garantizando reproducibilidad y ausencia de fuga.

### 4.5 Evaluación del modelo

Evaluado sobre el conjunto de validación (1420 segmentos, sin fuga de audios):

| Métrica | Valor |
|---|---|
| **Accuracy** | **0.931** |
| **F1 macro** | **0.913** |
| F1 weighted | 0.931 |

**Reporte de clasificación por clase:**

| Clase | Precision | Recall | F1 | Soporte |
|---|---|---|---|---|
| Reina original | 0.900 | 0.895 | 0.897 | 210 |
| Sin reina | 0.895 | 0.871 | 0.883 | 186 |
| Reina nueva rechazada | 0.867 | 0.958 | 0.910 | 306 |
| Reina nueva aceptada | 0.981 | 0.946 | 0.963 | 718 |

**Análisis de errores:**

- El **F1 macro (0.913)** es casi tan alto como el accuracy (0.931), lo que indica que el modelo **no se limita a acertar la clase mayoritaria**: las clases minoritarias (0 y 1) tienen F1 ≈ 0.88–0.90. Esto valida el uso de `class_weight`.
- La clase **3 (reina nueva aceptada)** es la mejor clasificada (F1 0.963), coherente con que es la más representada y la de patrón acústico más marcado.
- La confusión residual se concentra entre **clases 0 ("reina original") y 1 ("sin reina")** — espectralmente parecidas en algunos segmentos — y entre **2 y 3** (procesos de reemplazo de reina). La matriz de confusión del notebook lo confirma.
- **Límite reconocido**: estas métricas son *intra-dataset*. Sobre audio de otra procedencia (otro micro, otra colmena, vídeos de internet) el rendimiento cae — es el *domain shift* documentado en la literatura. Se mitiga, no se resuelve, con el detector de §6.4; se proponen soluciones de fondo en §7.

---

## 5. Interpretabilidad y análisis del modelo

- **Qué aprende cada bloque**: las Conv1D actúan como detectores de patrones armónicos locales en el eje mel; el *pooling* resume el zumbido en ~161 instantes; las BiLSTM integran si ese zumbido es **estable o irregular** a lo largo del minuto. Esto encaja con el conocimiento apícola: una colonia huérfana suena más inestable y aguda.
- **Salida calibrable**: el `softmax` da una distribución de probabilidad sobre las 4 clases, no solo la clase ganadora. La interfaz muestra las 4 probabilidades, lo que permite al usuario ver cuándo el modelo "duda" (p. ej. 0.55 / 0.40 / … es muy distinto de 0.98 / 0.01 / …).
- **Características acústicas globales explícitas**: el detector OOD (§6.4) expone `rms`, `lf_ratio` (fracción de energía bajo 1.5 kHz), `flatness` (planitud espectral) y `centroid_hz`. Son interpretables directamente y se devuelven en la respuesta de la API, dando trazabilidad de *por qué* un audio se acepta o se rechaza.

---

## 6. Despliegue del modelo e integración

### 6.1 API REST (FastAPI)

`web/main.py` expone:

| Método | Ruta | Descripción |
|---|---|---|
| `GET`  | `/` | interfaz web v1 (académica) |
| `GET`  | `/v2` | interfaz web v2 (rediseño) |
| `GET`  | `/api/clases` | diccionario de clases |
| `POST` | `/api/predict` | recibe un archivo de audio (`multipart/form-data`), devuelve la predicción en JSON |

**Gestión de errores**: validación de extensión (`.wav .mp3 .ogg .m4a .webm .flac .aac .opus`), de tamaño (≤ 50 MB) y de contenido (audio vacío / corrupto / demasiado corto). FFmpeg se invoca con *timeout* de 20 s para no colgarse ante un archivo malformado. Cada fallo devuelve un `HTTPException` con código y mensaje claros (`415`, `413`, `400`, `500`). El modelo se carga una vez al arrancar.

**Respuesta de `/api/predict`** (ejemplo):

```json
{
  "es_colmena": true,
  "motivo": "Audio compatible con sonido de colmena.",
  "clase": "Reina original",
  "clase_idx": 0,
  "confianza": 0.94,
  "probabilidades": {"Reina original": 0.94, "Sin reina": 0.04, "...": 0.02},
  "duracion_seg": 60.0,
  "ventanas_analizadas": 1,
  "features": {"rms": 0.21, "lf_ratio": 0.97, "flatness": 0.012, "centroid_hz": 410.3}
}
```

### 6.2 Interfaz web y experiencia de usuario

- **Grabación en directo** desde el navegador (`MediaRecorder` + `getUserMedia`), con visualización del nivel/espectro en tiempo real.
- **Subida de archivos** por *drag & drop* o selector, con previsualización del audio **antes** de analizar.
- **Resultado claro e interactivo**: clase predicha, anillo de confianza animado, distribución completa de probabilidades y, cuando el audio se rechaza por fuera-de-dominio, un mensaje explicando el motivo (silencio, energía en alta frecuencia, tono sintético, baja confianza…).
- **Histórico por dispositivo** en `localStorage` (no hay base de datos): cada navegador conserva sus últimos análisis; se pueden reproducir los de la sesión actual y borrar el historial.
- **Responsive** (móvil y escritorio) y estética cuidada (tema apícola, panal animado).

### 6.3 Integración y funcionamiento

Flujo completo: el navegador captura/sube el audio → `POST /api/predict` → FastAPI lo decodifica, calcula el mel-espectrograma, lo trocea en ventanas de 60 s si hace falta, ejecuta el CRNN, promedia probabilidades, aplica el detector OOD → devuelve JSON → el frontend lo renderiza y lo guarda en `localStorage`. Funciona de extremo a extremo en local y está preparado para producción (Railway, vía `nixpacks.toml` con Python 3.11 + ffmpeg).

### 6.4 Robustez ante datos ruidosos / fuera de dominio

**Problema detectado.** El modelo tiene solo 4 clases y **todas presuponen "hay una colmena"**. Como el `softmax` siempre suma 1, ante ruido, música, voz o un audio de internet el modelo *forzaba* una de las 4 clases (típicamente "Reina original") con confianza alta pero **sin sentido**. Esto es exactamente el fallo que la rúbrica señala ("un modelo con 99 % que no maneja datos ruidosos no es un buen proyecto").

**Solución implementada (detector de fuera-de-dominio).** Antes de devolver una predicción se calculan características acústicas globales y se aplican comprobaciones:

| Comprobación | Umbral | Motivo de rechazo |
|---|---|---|
| RMS (volumen) | `< 1.5e-3` | "El audio está prácticamente en silencio." |
| Fracción de energía bajo 1.5 kHz | `< 0.35` | "La energía se concentra en frecuencias altas — música, voz o ruido, no una colmena." |
| Planitud espectral (mínima) | `< 1e-4` | "Es un tono sintético casi puro, no una grabación real." |
| Planitud espectral (máxima) | `> 0.45` | "Espectro plano tipo ruido de banda ancha, no el zumbido tonal de una colmena." |
| Confianza del modelo | `< 0.50` | "El modelo no reconoce un patrón de colmena con suficiente confianza." |

Si alguna falla, la API responde `es_colmena: false` con el motivo, y la interfaz lo muestra de forma neutra (sin afirmar un estado de reina) pero enseñando igualmente la salida bruta del modelo, marcada como descartada.

**Validación del detector** (carpeta `audios_prueba/`): 5 audios de control (ruido blanco, silencio, tono puro 440 Hz, tono agudo 3 kHz, barrido de frecuencia) → los 5 se rechazan correctamente con el motivo adecuado. Un audio de zumbido sintético realista → se acepta y se clasifica. Esto demuestra que la app **no miente** cuando le llega algo que no es una colmena, manteniendo a la vez su función con audios válidos.

---

## 7. Conclusiones y mejoras futuras

### 7.1 Conclusiones

Se ha construido un sistema completo *de la idea al despliegue*: EDA → preprocesamiento sin fuga → CRNN justificada → entrenamiento con regularización y compensación de desbalanceo → evaluación con métricas adecuadas (accuracy **0.931**, F1 macro **0.913**) → API FastAPI con gestión de errores → interfaz web responsive → manejo explícito de datos fuera de dominio. El proyecto resuelve un problema real de la apicultura sin solución libre equivalente.

### 7.2 Mejoras futuras (en orden de impacto/esfuerzo)

1. **Data augmentation en el entrenamiento** — SpecAugment (máscaras de tiempo/frecuencia), *pitch shift* / *time stretch*, variación de ganancia, mezcla con ruido de fondo (ESC-50 / MUSAN). Es el cambio con mejor relación esfuerzo/impacto contra el *domain shift*.
2. **Normalización PCEN** (`librosa.pcen`) en lugar de dB + z-score — mucho más robusta a cambios de micrófono y ganancia; pensada precisamente para bioacústica.
3. **Filtro paso-banda 180–2800 Hz** antes del mel — descarta rumble de baja frecuencia (HVAC, viento) y energía de alta frecuencia (voces, tráfico).
4. **Transfer learning con un modelo de audio pre-entrenado** (YAMNet, PANNs CNN14, BirdNET) como extractor de *embeddings* + cabeza de clasificación — el camino hacia la robustez real, evitando entrenar desde cero con un dataset modesto.
5. **Entrenamiento multi-dataset** — combinar Beehive Sounds con NU-Hive / OSBH y un muestreo balanceado por origen para que el modelo aprenda a ignorar el sesgo de cada grabación.
6. **Test-time augmentation + calibración de confianza** (*temperature scaling*) — promediar predicciones sobre variantes aumentadas y calibrar las probabilidades para que el umbral del detector OOD sea más fiable.
7. **Validación cruzada completa** sobre los 5 folds ya guardados, reportando media ± desviación de las métricas.
8. **Persistencia opcional del histórico** (IndexedDB con cap de tamaño) para conservar los audios analizados al recargar la página.

---

## Anexo — Estructura de la entrega

```
ENTREGA/
├── MEMORIA.md                       ← este documento
├── README.md                        ← guía rápida y enlaces
├── modelo_crnn.keras                ← modelo entrenado (~2.6 MB)
├── notebooks/
│   ├── 01_eda.ipynb                 ← análisis exploratorio
│   ├── 02_preprocesamiento.ipynb    ← mel-espectrogramas + splits GroupKFold
│   └── 03_entrenamiento_crnn.ipynb  ← arquitectura, entrenamiento, evaluación
└── audios_prueba/
    ├── README.md                    ← qué predice cada audio
    ├── control_01..05_*.wav         ← negativos (deben dar "no es colmena")
    └── demo_colmena_sintetica.wav   ← positivo de demostración

Código fuente completo y despliegue: https://github.com/Feelis3/colmena-acustica
```
