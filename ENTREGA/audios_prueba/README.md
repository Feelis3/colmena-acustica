# Audios de prueba

Audios para probar la aplicación. Se dividen en dos grupos.

## 1. Controles negativos — deben dar "No reconocido como colmena"

Sirven para demostrar que la aplicación **no se inventa un estado de reina** ante un audio que no es una colmena (es el manejo de datos fuera de dominio descrito en la memoria, §6.4).

| Archivo | Qué es | Resultado esperado |
|---|---|---|
| `control_01_ruido_blanco.wav` | Ruido blanco | Rechazado — "energía en frecuencias altas" |
| `control_02_silencio.wav` | Casi silencio | Rechazado — "audio prácticamente en silencio" |
| `control_03_tono_440hz.wav` | Tono puro de 440 Hz (nota La) | Rechazado — "tono sintético casi puro" |
| `control_04_tono_3khz.wav` | Tono puro de 3 kHz (agudo) | Rechazado — "energía en frecuencias altas" |
| `control_05_barrido.wav` | Barrido de frecuencia 200 Hz → 6 kHz | Rechazado — "energía en frecuencias altas" |

## 2. Demostración positiva

| Archivo | Qué es | Resultado esperado |
|---|---|---|
| `demo_colmena_sintetica.wav` | Zumbido sintético realista (fundamental ~235 Hz + armónicos + textura de banda ancha filtrada bajo 1.5 kHz + aleteo) | Aceptado como sonido de colmena y clasificado en una de las 4 clases |

## 3. Audios reales del dataset (recomendado añadir)

Para una prueba con datos reales, descarga el dataset **Beehive Sounds** (Yang et al.) desde Kaggle:

```bash
kaggle datasets download annajyang/beehive-sounds
```

y copia aquí **2–3 segmentos de cada clase** (archivos `*__segmentN.wav`), nombrándolos de forma clara, por ejemplo:

```
real_clase0_reina_original_a.wav
real_clase1_sin_reina_a.wav
real_clase2_reina_nueva_rechazada_a.wav
real_clase3_reina_nueva_aceptada_a.wav
```

La clase de cada segmento está en `all_data_updated.csv` (columna `queen status`): `0 = Reina original`, `1 = Sin reina`, `2 = Reina nueva rechazada`, `3 = Reina nueva aceptada`. El nombre del segmento `XXX__segmentN.wav` corresponde al archivo original `XXX.raw` de ese CSV.

> Estos audios reales **no se incluyen aquí** porque el dataset está sujeto a su propia licencia de Kaggle; se referencia para que el evaluador pueda reproducir la prueba.
