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

app = FastAPI(title="Piper TTS Server")

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

@app.post("/synthesize", response_model=TTSResponse)
async def synthesize_speech(request: TTSRequest):
    """
    Convert text to speech using Piper TTS.
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
        
        response = TTSResponse(
            success=True,
            message="TTS synthesis successful",
            audio_path=output_path
        )
        return response
        
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
