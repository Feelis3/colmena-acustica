import os
os.environ.setdefault("KERAS_BACKEND", "torch")

import tempfile
import uuid
from pathlib import Path

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles

from predict import predecir, get_model, CLASES

BASE_DIR = Path(__file__).resolve().parent
INDEX_HTML = BASE_DIR / "templates" / "index_v2.html"

ALLOWED_EXT = {".wav", ".mp3", ".ogg", ".m4a", ".webm", ".flac", ".aac", ".opus"}
MAX_BYTES = 50 * 1024 * 1024

app = FastAPI(title="Clasificador de sonidos de colmena")
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")


@app.on_event("startup")
def _warmup():
    get_model()


@app.get("/", response_class=HTMLResponse)
async def index():
    return FileResponse(INDEX_HTML, media_type="text/html")


@app.get("/api/clases")
async def clases():
    return {"clases": CLASES}


@app.post("/api/predict")
async def predict(file: UploadFile = File(...)):
    suffix = Path(file.filename or "").suffix.lower()
    if suffix and suffix not in ALLOWED_EXT:
        raise HTTPException(415, f"Formato no soportado: {suffix}")
    if not suffix:
        suffix = ".webm"

    data = await file.read()
    if not data:
        raise HTTPException(400, "Archivo vacío")
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "Archivo > 50 MB")

    tmp = Path(tempfile.gettempdir()) / f"abejas_{uuid.uuid4().hex}{suffix}"
    tmp.write_bytes(data)
    try:
        resultado = predecir(tmp)
    except Exception as e:
        raise HTTPException(500, f"Error al procesar audio: {e}")
    finally:
        try: tmp.unlink()
        except OSError: pass

    return JSONResponse({
        "filename": file.filename or f"audio{suffix}",
        "size": len(data),
        **resultado,
    })
