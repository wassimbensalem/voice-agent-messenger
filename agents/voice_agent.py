#!/usr/bin/env python3
"""
VoiceAgent - Core agent class implementing Listen → Think → Speak loop
Each agent has a persona, can think via Ollama, speak via Piper TTS, and listen via Whisper STT.
"""

import io
import os
import json
import time
import logging
import httpx

from agent_config import OLLAMA_BASE_URL, WHISPER_URL, PIPER_URL

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(message)s")


class VoiceAgent:
    """An autonomous voice agent that can think, speak, and listen."""

    def __init__(self, agent_id: str, config: dict):
        self.agent_id = agent_id
        self.name = config["name"]
        self.emoji = config["emoji"]
        self.persona = config["persona"]
        self.voice = config["voice"]
        self.model = config["model"]
        self.color = config.get("color", "#ffffff")
        self.options = config.get("options", {
            "temperature": 0.7,
            "top_p": 0.9,
            "num_predict": 150,
        })

        self.conversation_history: list[dict] = []
        self.logger = logging.getLogger(f"Agent:{self.name}")

        # HTTP client with generous timeouts for LLM
        self.http = httpx.Client(timeout=httpx.Timeout(120.0, connect=10.0))

        self.logger.info(f"{self.emoji} {self.name} initialized (model: {self.model})")
        
        # Memory
        self.memory_file = f"/app/history/{self.agent_id}.json"
        self.load_memory()

    def load_memory(self):
        """Load conversation history from JSON file."""
        if os.path.exists(self.memory_file):
            try:
                with open(self.memory_file, "r") as f:
                    self.conversation_history = json.load(f)
                self.logger.info(f"Loaded {len(self.conversation_history)} turns from memory.")
            except Exception as e:
                self.logger.error(f"Failed to load memory: {e}")
                self.conversation_history = []
        else:
             # Ensure directory exists
             os.makedirs(os.path.dirname(self.memory_file), exist_ok=True)

    def save_memory(self):
        """Save conversation history to JSON file."""
        try:
            # Keep last 100 turns to prevent infinite growth
            if len(self.conversation_history) > 100:
                self.conversation_history = self.conversation_history[-100:]
            
            with open(self.memory_file, "w") as f:
                json.dump(self.conversation_history, f, indent=2)
        except Exception as e:
            self.logger.error(f"Failed to save memory: {e}")

    def think(self, heard_text: str | None = None, topic: str | None = None) -> str:
        """
        Use the LLM to generate a response.
        - If heard_text is provided, respond to what was heard.
        - If topic is provided and no history, start the conversation.
        """
        # Build messages
        messages = [{"role": "system", "content": self.persona}]

        if topic and not self.conversation_history:
            # First turn — initiate the conversation
            messages.append({
                "role": "user",
                "content": (
                    f"Start a conversation about this topic: {topic}. "
                    f"Give your opening thoughts naturally as if speaking aloud."
                ),
            })
        elif heard_text:
            # Add conversation history for context
            for entry in self.conversation_history[-6:]:  # Last 6 turns for context
                messages.append(entry)

            messages.append({
                "role": "user",
                "content": heard_text,
            })
        else:
            messages.append({
                "role": "user",
                "content": "Continue the conversation naturally.",
            })

        # Call Ollama
        self.logger.info(f"🧠 Thinking...")
        start = time.time()

        try:
            response = self.http.post(
                f"{OLLAMA_BASE_URL}/api/chat",
                json={
                    "model": self.model,
                    "messages": messages,
                    "stream": False,
                    "options": self.options,
                },
            )
            response.raise_for_status()
            result = response.json()
            reply = result["message"]["content"].strip()

        except Exception as e:
            self.logger.error(f"LLM error: {e}")
            reply = "Hmm, let me think about that for a moment."

        elapsed = time.time() - start
        self.logger.info(f"💭 Thought in {elapsed:.1f}s: {reply[:80]}...")

        # Update conversation history
        if heard_text:
            self.conversation_history.append({"role": "user", "content": heard_text})
        self.conversation_history.append({"role": "assistant", "content": reply})
        self.save_memory()

        return reply

    def speak(self, text: str) -> bytes | None:
        """Convert text to speech using Piper TTS. Returns WAV audio bytes."""
        self.logger.info(f"🔊 Speaking: {text[:60]}...")
        start = time.time()

        try:
            response = self.http.post(
                f"{PIPER_URL}/synthesize",
                json={"text": text, "voice": self.voice},
            )
            response.raise_for_status()

            audio_bytes = response.content
            elapsed = time.time() - start
            self.logger.info(
                f"🎵 Synthesized {len(audio_bytes)} bytes in {elapsed:.1f}s"
            )
            return audio_bytes

        except Exception as e:
            self.logger.error(f"TTS error: {e}")
            return None

    def listen(self, audio_bytes: bytes) -> str | None:
        """Convert audio to text using Whisper STT. Returns transcribed text."""
        self.logger.info(f"👂 Listening to {len(audio_bytes)} bytes of audio...")
        start = time.time()

        try:
            files = {"file": ("speech.wav", io.BytesIO(audio_bytes), "audio/wav")}
            response = self.http.post(f"{WHISPER_URL}/transcribe", files=files)
            response.raise_for_status()

            result = response.json()
            text = result.get("text", "").strip()

            elapsed = time.time() - start
            self.logger.info(f"📝 Transcribed in {elapsed:.1f}s: {text[:80]}...")
            return text

        except Exception as e:
            self.logger.error(f"STT error: {e}")
            return None

    def reset(self):
        """Reset conversation state (but keep memory for now)."""
        # self.conversation_history = [] 
        self.logger.info("🔄 Conversation reset (Memory retained)")

    def to_dict(self) -> dict:
        """Serialize agent info for the frontend."""
        return {
            "id": self.agent_id,
            "name": self.name,
            "emoji": self.emoji,
            "color": self.color,
            "model": self.model,
        }
