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
MODEL_PATH = os.environ.get("PIPER_MODEL_PATH", "/root/.openclaw/workspace-agents/max/piper-models/en_US-amy-medium.onnx")
PIPER_CMD = os.environ.get("PIPER_CMD", "/root/.openclaw/workspace-agents/max/piper-env/bin/piper")

class TTSRequest(BaseModel):
    text: str
    output_file: Optional[str] = None

class TTSResponse(BaseModel):
    success: bool
    message: str
    audio_path: Optional[str] = None

@app.post("/synthesize")
async def synthesize_speech(request: TTSRequest):
    """
    Convert text to speech using Piper TTS.
    Returns audio file directly.
    """
    if not request.text or len(request.text.strip()) == 0:
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    
    try:
        # Create a temporary file for the output
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            output_path = tmp.name
        
        # Run piper
        process = subprocess.run(
            [
                PIPER_CMD,
                "--model", MODEL_PATH,
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
    return {"status": "healthy", "model": MODEL_PATH}

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
