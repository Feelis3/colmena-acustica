"""Inferencia del CRNN entrenado sobre sonidos de colmena.

Incluye un detector de fuera-de-dominio (OOD): el modelo solo tiene 4 clases
y todas asumen "hay colmena", así que ante ruido, música o voz el softmax
forzaría una de las 4. Antes de devolver una predicción comprobamos que el
audio se parezca acústicamente a una colmena (energía concentrada en baja
frecuencia, espectro no plano, volumen suficiente) y que el modelo tenga
confianza mínima. Si no, devolvemos `es_colmena: False` con el motivo.
"""
import os
os.environ.setdefault("KERAS_BACKEND", "torch")

import subprocess
import tempfile
from pathlib import Path

import numpy as np
import imageio_ffmpeg
import soundfile as sf
import librosa
import keras

# --- parámetros del mel (idénticos a 02_preprocesamiento) ---
SR = 22050
N_MELS = 128
N_FFT = 2048
HOP = 512
DURACION_SEG = 60.0
T_FIXED = int(np.floor(DURACION_SEG * SR / HOP)) + 1  # 2584

CLASES = {
    0: "Reina original",
    1: "Sin reina",
    2: "Reina nueva rechazada",
    3: "Reina nueva aceptada",
}

# --- umbrales del detector OOD (heurísticos, documentados en la memoria) ---
RMS_MIN          = 1.5e-3   # por debajo: audio prácticamente en silencio
LF_RATIO_MIN     = 0.35     # fracción mínima de energía espectral por debajo de 1.5 kHz
FLATNESS_MIN     = 1e-6     # por debajo: tono sintético puro. El zumbido real de abejas es muy tonal (flatness ~2e-5..2e-4), así que el umbral va bien bajo.
FLATNESS_MAX     = 0.45     # planitud espectral máxima (más alto = ruido de banda ancha)
CONFIANZA_MIN    = 0.50     # confianza softmax mínima para aceptar la predicción
LF_CUTOFF_HZ     = 1500.0   # las abejas concentran su energía por debajo de ~1.5 kHz

_root = Path(__file__).resolve().parent.parent
MODEL_PATH = next(
    (p for p in [_root / "modelo_crnn.keras", _root / "modelos" / "modelo_crnn.keras"] if p.exists()),
    _root / "modelo_crnn.keras",
)
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()

_model = None


def get_model():
    global _model
    if _model is None:
        _model = keras.models.load_model(str(MODEL_PATH), compile=False)
    return _model


def _decode_to_wav(src: Path) -> Path:
    """Convierte cualquier formato a WAV mono 22050 Hz usando ffmpeg embebido."""
    dst = Path(tempfile.mkstemp(suffix=".wav")[1])
    cmd = [
        FFMPEG, "-y", "-i", str(src),
        "-ac", "1", "-ar", str(SR),
        "-vn", "-loglevel", "error",
        str(dst),
    ]
    try:
        res = subprocess.run(cmd, capture_output=True, timeout=20)
    except subprocess.TimeoutExpired:
        raise RuntimeError("ffmpeg tardó demasiado (audio posiblemente corrupto)")
    if res.returncode != 0:
        raise RuntimeError(f"ffmpeg falló: {res.stderr.decode(errors='ignore')[:200]}")
    if not dst.exists() or dst.stat().st_size == 0:
        raise RuntimeError("ffmpeg no produjo audio decodificable")
    return dst


def _mel_from_audio(y: np.ndarray) -> np.ndarray:
    """Mel-espectrograma en dB normalizado (z-score), shape (T_FIXED, N_MELS)."""
    mel = librosa.feature.melspectrogram(
        y=y, sr=SR, n_mels=N_MELS, n_fft=N_FFT, hop_length=HOP
    )
    mel_db = librosa.power_to_db(mel, ref=np.max)

    T = mel_db.shape[1]
    if T < T_FIXED:
        mel_db = np.pad(mel_db, ((0, 0), (0, T_FIXED - T)),
                        mode="constant", constant_values=mel_db.min())
    elif T > T_FIXED:
        mel_db = mel_db[:, :T_FIXED]

    mu, sigma = mel_db.mean(), mel_db.std() + 1e-6
    mel_db = (mel_db - mu) / sigma
    return mel_db.T.astype(np.float32)


def _audio_features(y: np.ndarray) -> dict:
    """Características acústicas globales para decidir si el audio parece una colmena."""
    rms = float(np.sqrt(np.mean(y ** 2)))

    S = np.abs(librosa.stft(y, n_fft=N_FFT, hop_length=HOP)) ** 2  # (freq, T)
    freqs = librosa.fft_frequencies(sr=SR, n_fft=N_FFT)
    energia_total = S.sum() + 1e-12
    energia_lf = S[freqs < LF_CUTOFF_HZ, :].sum()
    lf_ratio = float(energia_lf / energia_total)

    flatness = float(np.mean(librosa.feature.spectral_flatness(S=np.sqrt(S))))
    centroid = float(np.mean(librosa.feature.spectral_centroid(S=np.sqrt(S), sr=SR)))

    return {"rms": rms, "lf_ratio": lf_ratio, "flatness": flatness, "centroid_hz": centroid}


def _evaluar_dominio(feats: dict, confianza: float) -> tuple[bool, str]:
    """Devuelve (es_colmena, motivo)."""
    if feats["rms"] < RMS_MIN:
        return False, "El audio está prácticamente en silencio."
    if feats["lf_ratio"] < LF_RATIO_MIN:
        return False, ("La energía se concentra en frecuencias altas — suena a música, "
                       "voz o ruido ambiente, no a una colmena.")
    if feats["flatness"] < FLATNESS_MIN:
        return False, "Es un tono sintético casi puro, no una grabación real de colmena."
    if feats["flatness"] > FLATNESS_MAX:
        return False, "El espectro es plano (tipo ruido de banda ancha), no el zumbido tonal de una colmena."
    if confianza < CONFIANZA_MIN:
        return False, (f"El modelo no reconoce un patrón de colmena con suficiente confianza "
                       f"({confianza*100:.0f}% < {CONFIANZA_MIN*100:.0f}%).")
    return True, "Audio compatible con sonido de colmena."


def predecir(audio_path: Path) -> dict:
    """
    Procesa el audio, comprueba que parezca una colmena y predice la clase.
    Si dura >60 s, divide en ventanas de 60 s no solapadas y promedia probabilidades.
    """
    audio_path = Path(audio_path)
    suf = audio_path.suffix.lower()

    tmp_wav = None
    try:
        if suf != ".wav":
            tmp_wav = _decode_to_wav(audio_path)
            y, sr = sf.read(str(tmp_wav), dtype="float32", always_2d=False)
        else:
            y, sr = sf.read(str(audio_path), dtype="float32", always_2d=False)
            if y.ndim > 1:
                y = y.mean(axis=1)
            if sr != SR:
                y = librosa.resample(y, orig_sr=sr, target_sr=SR)

        if y.ndim > 1:
            y = y.mean(axis=1)

        if len(y) < SR // 2:  # menos de medio segundo
            raise RuntimeError("El audio es demasiado corto (mínimo 0.5 s).")

        duracion = len(y) / SR
        feats = _audio_features(y)

        seg_muestras = int(DURACION_SEG * SR)
        if len(y) <= seg_muestras:
            ventanas = [y]
        else:
            ventanas = [y[i:i + seg_muestras]
                        for i in range(0, len(y), seg_muestras)
                        if len(y[i:i + seg_muestras]) >= SR]

        mels = np.stack([_mel_from_audio(v) for v in ventanas])
        probs = get_model().predict(mels, verbose=0)
        prob_media = probs.mean(axis=0)

        clase = int(np.argmax(prob_media))
        confianza = float(prob_media[clase])

        es_colmena, motivo = _evaluar_dominio(feats, confianza)

        out = {
            "es_colmena": es_colmena,
            "motivo": motivo,
            "clase_idx": clase if es_colmena else None,
            "clase": CLASES[clase] if es_colmena else "No reconocido como colmena",
            "confianza": confianza,
            "probabilidades": {CLASES[i]: float(p) for i, p in enumerate(prob_media)},
            "duracion_seg": round(duracion, 2),
            "ventanas_analizadas": len(ventanas),
            "features": {
                "rms": round(feats["rms"], 5),
                "lf_ratio": round(feats["lf_ratio"], 3),
                "flatness": round(feats["flatness"], 3),
                "centroid_hz": round(feats["centroid_hz"], 1),
            },
        }
        return out
    finally:
        if tmp_wav and tmp_wav.exists():
            try: tmp_wav.unlink()
            except OSError: pass
