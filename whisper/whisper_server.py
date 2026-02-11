#!/usr/bin/env python3
"""
Whisper STT Server - FastAPI-based transcription service
"""

import tempfile
import os
from faster_whisper import WhisperModel
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
import uvicorn
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Whisper STT Server")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
MODEL_SIZE = os.environ.get("WHISPER_MODEL_SIZE", "base")
DEVICE = os.environ.get("WHISPER_DEVICE", "cpu")
COMPUTE_TYPE = os.environ.get("WHISPER_COMPUTE_TYPE", "int8")

# Load Whisper model
print(f"Loading Whisper model ({MODEL_SIZE}) on {DEVICE}...")
model = WhisperModel(MODEL_SIZE, device=DEVICE, compute_type=COMPUTE_TYPE)
print("Whisper model loaded successfully!")

class TranscriptionResponse(BaseModel):
    success: bool
    text: str
    language: Optional[str] = None
    duration: Optional[float] = None

class HealthResponse(BaseModel):
    status: str
    model: str
    device: str

@app.get("/health")
async def health_check() -> HealthResponse:
    """Health check endpoint."""
    return HealthResponse(
        status="healthy",
        model=MODEL_SIZE,
        device=DEVICE
    )

@app.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe_audio(file: UploadFile = File(...)):
    """
    Transcribe audio file to text.
    """
    try:
        # Save uploaded file to temporary location
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name
        
        # Transcribe
        segments, info = model.transcribe(tmp_path, beam_size=5)
        
        # Combine all segments
        full_text = ""
        for segment in segments:
            full_text += segment.text + " "
        full_text = full_text.strip()
        
        # Clean up
        os.unlink(tmp_path)
        
        return TranscriptionResponse(
            success=True,
            text=full_text,
            language=info.language,
            duration=info.duration
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
async def root():
    """Root endpoint with API documentation."""
    return {
        "service": "Whisper STT Server",
        "version": "1.0.0",
        "endpoints": {
            "POST /transcribe": "Transcribe audio file to text",
            "GET /health": "Health check",
            "GET /": "This documentation"
        }
    }

if __name__ == "__main__":
    port = int(os.environ.get("WHISPER_PORT", 8001))
    uvicorn.run(app, host="0.0.0.0", port=port)
