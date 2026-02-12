#!/usr/bin/env python3
"""
Simple HTTP server for Piper TTS
"""

import json
import subprocess
import tempfile
import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
import uvicorn
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Piper TTS Server")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
# Configuration
DEFAULT_MODEL_PATH = os.environ.get("PIPER_MODEL_PATH", "/models/en_US-amy-medium.onnx")
PIPER_CMD = os.environ.get("PIPER_CMD", "piper")
MODELS_DIR = "/models"
AVAILABLE_MODELS = {}

def load_models():
    """Scan models directory for available ONNX files."""
    if not os.path.exists(MODELS_DIR):
        return
    for filename in os.listdir(MODELS_DIR):
        if filename.endswith(".onnx"):
            model_name = filename[:-5] # remove .onnx
            AVAILABLE_MODELS[model_name] = os.path.join(MODELS_DIR, filename)
            print(f"Loaded model: {model_name}")

class TTSRequest(BaseModel):
    text: str
    output_file: Optional[str] = None
    voice: Optional[str] = None

class TTSResponse(BaseModel):
    success: bool
    message: str
    audio_path: Optional[str] = None

@app.on_event("startup")
async def startup_event():
    load_models()

@app.post("/synthesize")
async def synthesize_speech(request: TTSRequest):
    """
    Convert text to speech using Piper TTS.
    Returns audio file directly.
    """
    if not request.text or len(request.text.strip()) == 0:
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    
    # Select Model
    model_path = DEFAULT_MODEL_PATH
    if request.voice:
        # 1. Exact match
        if request.voice in AVAILABLE_MODELS:
            model_path = AVAILABLE_MODELS[request.voice]
        else:
            # 2. Partial match
            for name, path in AVAILABLE_MODELS.items():
                if request.voice.lower() in name.lower():
                    model_path = path
                    break
    
    try:
        # Create a temporary file for the output
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            output_path = tmp.name
        
        # Run piper
        process = subprocess.run(
            [
                PIPER_CMD,
                "--model", model_path,
                "--output_file", output_path
            ],
            input=request.text,
            capture_output=True,
            text=True
        )
        
        if process.returncode != 0:
            raise Exception(f"Piper failed: {process.stderr}")
        
        # Read the audio file and return it
        from fastapi.responses import FileResponse
        return FileResponse(
            output_path,
            media_type="audio/wav",
            filename="speech.wav"
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy", 
        "default_model": DEFAULT_MODEL_PATH,
        "available_models": list(AVAILABLE_MODELS.keys())
    }

@app.get("/")
async def root():
    """Root endpoint with API documentation."""
    return {
        "service": "Piper TTS Server",
        "version": "1.0.0",
        "endpoints": {
            "POST /synthesize": "Convert text to speech",
            "GET /health": "Health check",
            "GET /": "This documentation"
        }
    }

if __name__ == "__main__":
    port = int(os.environ.get("PIPER_PORT", 5000))
    uvicorn.run(app, host="0.0.0.0", port=port)
