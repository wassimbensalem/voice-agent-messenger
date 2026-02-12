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

    def search_web(self, query: str) -> str:
        """Perform a web search using DuckDuckGo."""
        self.logger.info(f"🔍 Searching for: {query}")
        try:
            from duckduckgo_search import DDGS
            with DDGS() as ddgs:
                results = list(ddgs.text(query, max_results=3))
                if not results:
                    return "No results found."
                
                formatted = []
                for r in results:
                    formatted.append(f"Source: {r['title']}\nSnippet: {r['body']}")
                return "\n\n".join(formatted)
        except Exception as e:
            self.logger.error(f"Search error: {e}")
            return f"Search failed: {str(e)}"

    def think(self, heard_text: str | None = None, topic: str | None = None, on_tool_call: callable = None) -> str:
        """
        Use the LLM to generate a response.
        Supports tool-calling for web search.
        """
        # Build messages
        system_prompt = f"{self.persona}\n\nAvailable Tools:\n- web_search(query): Use this to verify facts or find current information. Call it by writing 'TOOL_CALL: web_search(\"your query\")'."
        messages = [{"role": "system", "content": system_prompt}]

        if topic and not self.conversation_history:
            messages.append({
                "role": "user",
                "content": f"Start a conversation about: {topic}. If you need to verify something first, use the search tool."
            })
        elif heard_text:
            for entry in self.conversation_history[-6:]:
                messages.append(entry)
            messages.append({"role": "user", "content": heard_text})
        else:
            messages.append({"role": "user", "content": "Continue the conversation naturally."})

        # Tool-Execution Loop (max 2 iterations to avoid loops)
        for _ in range(2):
            self.logger.info(f"🧠 Thinking...")
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

                # Check for tool call in the response
                if "TOOL_CALL: web_search(" in reply:
                    import re
                    match = re.search(r'TOOL_CALL: web_search\("(.*?)"\)', reply)
                    if match:
                        query = match.group(1)
                        self.logger.info(f"🛠️ Executing Tool: web_search(\"{query}\")")
                        
                        if on_tool_call:
                            on_tool_call("web_search", query)
                        
                        # Add assistant's "thinking" with tool call to history
                        messages.append({"role": "assistant", "content": reply})
                        
                        # Execute search
                        search_results = self.search_web(query)
                        
                        # Add tool results as user message (common pattern for LLMs)
                        messages.append({
                            "role": "user", 
                            "content": f"SEARCH_RESULTS:\n{search_results}\n\nPlease synthesize this into your response."
                        })
                        continue # Loop to get final answer

                # If no tool call or after tool results, we have our final reply
                break

            except Exception as e:
                self.logger.error(f"LLM error: {e}")
                reply = "Hmm, let me think about that for a moment."
                break

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
