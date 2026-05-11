# Entrega — Clasificador acústico del estado de la colmena

Proyecto Final · Programación de IA · Curso de Especialización en IA y Big Data
Autor: Marcos · Profesor: Sebastián Rubio Valero · 2026

---

## Qué hay en esta carpeta

| Archivo / carpeta | Contenido |
|---|---|
| **`MEMORIA.md`** | Memoria técnica completa (problema, EDA, estado del arte, modelo, entrenamiento, evaluación, despliegue, mejoras). Se puede exportar a PDF desde cualquier visor de Markdown. |
| **`modelo_crnn.keras`** | Modelo CRNN entrenado (Conv1D + BiLSTM, ~227 K parámetros). |
| **`notebooks/`** | Los tres notebooks del proyecto: `01_eda`, `02_preprocesamiento`, `03_entrenamiento_crnn`. |
| **`audios_prueba/`** | Audios para probar la aplicación (ver su propio `README.md`). |

## Enlaces

- **Repositorio (código completo, instalación, despliegue):** <https://github.com/Feelis3/colmena-acustica>
- **Aplicación desplegada:** *(URL de Railway — añadir cuando esté online)*
- **Dataset:** Beehive Sounds (Yang et al.) — <https://www.kaggle.com/datasets/annajyang/beehive-sounds>

## Cómo probar la aplicación

### Opción A — usar el despliegue

Abrir la URL de Railway. Hay dos interfaces:
- `…/` — versión académica (más información en pantalla).
- `…/v2` — versión rediseñada (más limpia, tema apícola).

### Opción B — en local

```bash
git clone https://github.com/Feelis3/colmena-acustica
cd colmena-acustica
pip install -r requirements.txt
cd web
# en Windows PowerShell:  $env:KERAS_BACKEND="torch"; python -m uvicorn main:app --host 0.0.0.0 --port 8000
# en Linux/macOS:         KERAS_BACKEND=torch python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

Luego abrir <http://localhost:8000/v2>.

### Qué probar

1. **Subir un audio real de colmena** (ver `audios_prueba/README.md` para extraer muestras del dataset) → el modelo devuelve uno de los 4 estados de reina con su probabilidad.
2. **Subir `audios_prueba/demo_colmena_sintetica.wav`** → es aceptado como sonido de colmena y clasificado.
3. **Subir cualquiera de los `control_0X_*.wav`** (ruido, silencio, tono, barrido) → la app responde **"No reconocido como colmena"** con el motivo, en lugar de inventarse un estado de reina. Esto demuestra el manejo de datos fuera de dominio.
4. **Grabar en directo** desde el navegador (botón "grabar en vivo"), revisar el audio y analizarlo.

## Resultados (validación, sin fuga de datos)

| Métrica | Valor |
|---|---|
| Accuracy | **0.931** |
| F1 macro | **0.913** |

Detalle por clase y análisis de errores: ver `MEMORIA.md` §4.5.

## Clases del modelo

| idx | clase |
|---|---|
| 0 | Reina original |
| 1 | Sin reina |
| 2 | Reina nueva rechazada |
| 3 | Reina nueva aceptada |

Más una salida adicional **"No reconocido como colmena"** cuando el audio no supera el detector de fuera-de-dominio (ver `MEMORIA.md` §6.4).
