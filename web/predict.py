"""Inferencia del CRNN entrenado sobre sonidos de colmena."""
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

# --- parámetros (idénticos a 02_preprocesamiento) ---
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

MODEL_PATH = Path(__file__).resolve().parent.parent / "modelo_crnn.keras"
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
    mel_db = librosa.power_to_db(mel, ref=np.max)  # (n_mels, T)

    T = mel_db.shape[1]
    if T < T_FIXED:
        mel_db = np.pad(
            mel_db, ((0, 0), (0, T_FIXED - T)),
            mode="constant", constant_values=mel_db.min()
        )
    elif T > T_FIXED:
        mel_db = mel_db[:, :T_FIXED]

    mu, sigma = mel_db.mean(), mel_db.std() + 1e-6
    mel_db = (mel_db - mu) / sigma

    # modelo espera (T, n_mels)
    return mel_db.T.astype(np.float32)


def predecir(audio_path: Path) -> dict:
    """
    Predice la clase del audio. Si dura >60 s, divide en ventanas de 60 s
    no solapadas y promedia las probabilidades (igual que en entrenamiento).
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

        duracion = len(y) / SR
        seg_muestras = int(DURACION_SEG * SR)

        # ventanas de 60 s; si dura menos, una sola ventana (con padding en mel)
        if len(y) <= seg_muestras:
            ventanas = [y]
        else:
            ventanas = [
                y[i:i + seg_muestras]
                for i in range(0, len(y), seg_muestras)
                if len(y[i:i + seg_muestras]) >= SR  # mínimo 1 s
            ]

        mels = np.stack([_mel_from_audio(v) for v in ventanas])  # (B, T, F)
        probs = get_model().predict(mels, verbose=0)              # (B, 4)
        prob_media = probs.mean(axis=0)                           # (4,)

        clase = int(np.argmax(prob_media))
        return {
            "clase_idx": clase,
            "clase": CLASES[clase],
            "confianza": float(prob_media[clase]),
            "probabilidades": {
                CLASES[i]: float(p) for i, p in enumerate(prob_media)
            },
            "duracion_seg": round(duracion, 2),
            "ventanas_analizadas": len(ventanas),
        }
    finally:
        if tmp_wav and tmp_wav.exists():
            try: tmp_wav.unlink()
            except OSError: pass
