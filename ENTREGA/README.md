# Entrega — Clasificador acústico del estado de la colmena

Proyecto Final · Programación de IA · Curso de Especialización en IA y Big Data
Autor: Marcos · Profesor: Sebastián Rubio Valero · 2026

---

## Empieza por aquí

1. **`MEMORIA.docx`** — documento principal del proyecto (problema, EDA, estado del arte, modelo, entrenamiento, evaluación, despliegue, mejoras).
2. **`INSTRUCCIONES.md`** — cómo descargar los datos, ejecutar los notebooks y levantar/desplegar la web, paso a paso.

## Contenido de la carpeta

| Archivo / carpeta | Contenido |
|---|---|
| `MEMORIA.docx` | Memoria técnica completa (Word). `MEMORIA.md` es la fuente editable. |
| `INSTRUCCIONES.md` | Guía de ejecución local + despliegue. |
| `descargar_datos.py` | Descarga el dataset Beehive Sounds desde Kaggle y deja todo listo para los notebooks. |
| `organizar_audios_test.py` | Ordena los audios del conjunto de validación en carpetas por clase, para probar la app. |
| `modelo_crnn.keras` | Modelo CRNN entrenado (Conv1D + BiLSTM, ~227 K parámetros). |
| `requirements.txt` | Dependencias (cubre notebooks **y** web). |
| `Procfile`, `nixpacks.toml`, `railway.json` | Archivos de despliegue en Railway. |
| `notebooks/` | `01_eda`, `02_preprocesamiento`, `03_entrenamiento_crnn`. |
| `web/` | Aplicación FastAPI completa (backend `main.py` + `predict.py`, frontend en `static/` y `templates/`). |
| `audios_prueba/` | `controles_no_colmena/` (deben rechazarse), `demo_colmena/` (debe aceptarse) y `test_dataset/` (vacía; se rellena con audios reales vía el script). Ver su `README.md`. |

## Enlaces

- **Repositorio (código completo):** <https://github.com/Feelis3/colmena-acustica>
- **Aplicación desplegada:** *(URL de Railway — añadir cuando esté online)*
- **Dataset:** Beehive Sounds (Yang et al.) — <https://www.kaggle.com/datasets/annajyang/beehive-sounds>

## Resultados (validación, sin fuga de datos)

| Métrica | Valor |
|---|---|
| Accuracy | **0.931** |
| F1 macro | **0.913** |

Detalle por clase y análisis de errores: `MEMORIA.docx` §4.5.

## Clases del modelo

| idx | clase |
|---|---|
| 0 | Reina original |
| 1 | Sin reina |
| 2 | Reina nueva rechazada |
| 3 | Reina nueva aceptada |

Más una salida adicional **"No reconocido como colmena"** cuando el audio no supera el detector de fuera-de-dominio (`MEMORIA.docx` §6.4).
