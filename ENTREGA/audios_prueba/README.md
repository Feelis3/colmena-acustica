# Audios de prueba

Organizados en tres carpetas.

```
audios_prueba/
├── controles_no_colmena/   ← audios que NO son colmenas → la app debe rechazarlos
├── demo_colmena/           ← un zumbido sintético realista → la app debe aceptarlo
└── test_dataset/           ← (vacía) audios reales del conjunto de validación
                              se rellena ejecutando ../organizar_audios_test.py
```

---

## `controles_no_colmena/` — deben dar "No reconocido como colmena"

Demuestran que la aplicación **no se inventa un estado de reina** ante un audio que no es una colmena (manejo de datos fuera de dominio, ver `MEMORIA.md` §6.4).

| Archivo | Qué es | Resultado esperado |
|---|---|---|
| `control_01_ruido_blanco.wav` | Ruido blanco | Rechazado — "energía en frecuencias altas" |
| `control_02_silencio.wav` | Casi silencio | Rechazado — "audio prácticamente en silencio" |
| `control_03_tono_440hz.wav` | Tono puro de 440 Hz | Rechazado — "tono sintético casi puro" |
| `control_04_tono_3khz.wav` | Tono puro de 3 kHz | Rechazado — "energía en frecuencias altas" |
| `control_05_barrido.wav` | Barrido 200 Hz → 6 kHz | Rechazado — "energía en frecuencias altas" |

## `demo_colmena/` — debe ser aceptado

| Archivo | Qué es | Resultado esperado |
|---|---|---|
| `demo_colmena_sintetica.wav` | Zumbido sintético realista (fundamental ~235 Hz + armónicos + textura de banda ancha < 1.5 kHz + aleteo) | Aceptado como colmena y clasificado en una de las 4 clases |

## `test_dataset/` — audios reales del conjunto de validación

Vacía a propósito (el dataset de Kaggle no se redistribuye). Para rellenarla con los **mismos audios de validación** sobre los que se midieron las métricas de la memoria, ejecuta desde la carpeta `ENTREGA/`:

```bash
# 1) descargar el dataset (local o Colab)
kaggle datasets download annajyang/beehive-sounds -p ./beehive --unzip

# 2) organizar el conjunto de validación en carpetas por clase
python organizar_audios_test.py --dataset ./beehive/versions/3 --salida ./audios_prueba/test_dataset --por-clase 8
```

Genera:

```
test_dataset/
├── 0_reina_original/          (N segmentos *.wav)
├── 1_sin_reina/
├── 2_reina_nueva_rechazada/
└── 3_reina_nueva_aceptada/
```

El nombre de cada subcarpeta es la **clase verdadera**, así al subir un audio a la app se comprueba si la predicción coincide. Usa `--por-clase 100000` para copiar **todos** los segmentos de validación en vez de una muestra. Detalles en `LEEME.txt` dentro de la carpeta y en la cabecera del script.
