#!/usr/bin/env python3
"""
Voice Agent Runner (Client)

Runs a single Voice Agent as a standalone process that connects to the Orchestrator.
"""

import asyncio
import json
import logging
import os
import argparse
import sys
import httpx
import websockets
import base64

from voice_agent import VoiceAgent
from agent_config import AGENTS, SIGNALING_URL

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(message)s",
)

class AgentRunner:
    def __init__(self, agent_id: str, api_key: str | None = None):
        if agent_id not in AGENTS:
            raise ValueError(f"Unknown agent: {agent_id}")
        
        self.agent_id = agent_id
        self.config = AGENTS[agent_id]
        self.voice_agent = VoiceAgent(agent_id, self.config)
        self.logger = logging.getLogger(f"Runner:{self.config['name']}")
        self.api_key = api_key

    async def register(self):
        """Register agent with Signaling Server to get API Key."""
        if self.api_key:
            return

        self.logger.info("Registering agent...")
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    f"{SIGNALING_URL}/api/agents/register",
                    json={
                        "name": self.config["name"],
                        "emoji": self.config["emoji"],
                        "color": self.config["color"]
                    }
                )
                if resp.status_code == 201:
                    data = resp.json()["data"]
                    self.api_key = data["apiKey"]
                    self.logger.info(f"Registered! API Key: {self.api_key[:10]}...")
                else:
                    raise Exception(f"Registration failed: {resp.text}")
        except Exception as e:
            self.logger.error(f"Registration error: {e}")
            sys.exit(1)

    async def find_active_room(self):
        """Poll Signaling Server for active rooms."""
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(f"{SIGNALING_URL}/api/rooms")
                if resp.status_code == 200:
                    data = resp.json()
                    rooms = data.get("data", {}).get("rooms", [])
                    interests = self.config.get("interests", [])
                    
                    # 1. Look for preferred topic
                    for room in rooms:
                        topic = room.get("topic")
                        if topic and topic in interests and room.get("connectionUrl"):
                            self.logger.info(f"🎯 Found interesting room: '{room['name']}' (Topic: {topic})")
                            return room["connectionUrl"]
                    
                    # 2. Fallback to any room
                    for room in rooms:
                        if room.get("connectionUrl"):
                            self.logger.info(f"🤔 No specific interest found. Joining available room: '{room['name']}'")
                            return room["connectionUrl"]
                            
        except Exception as e:
            self.logger.warning(f"Discovery error: {e}")
        return None

    async def run(self):
        """Connect to Orchestrator and participate in conversation."""
        if not self.api_key:
            await self.register()

        while True:
            # 1. Discovery Phase
            orchestrator_url = await self.find_active_room()
            
            if not orchestrator_url:
                self.logger.info("No active room found. Retrying in 5s...")
                await asyncio.sleep(5)
                continue

            self.logger.info(f"Found room! Connecting to {orchestrator_url}...")
            
            # 2. Connection Phase
            try:
                async with websockets.connect(orchestrator_url) as ws:
                    # Identify
                    await ws.send(json.dumps({
                        "type": "identify",
                        "apiKey": self.api_key
                    }))
                    self.logger.info("Sent identity, waiting for events...")

                    # Event Loop
                    async for msg in ws:
                        event = json.loads(msg)
                        event_type = event.get("type")

                        if event_type == "turn_request":
                            await self.handle_turn(ws, event)
                        
                        elif event_type == "turn_start":
                            pass # Info only

                        elif event_type == "conversation_end":
                            self.logger.info("Conversation ended.")
                            self.voice_agent.reset()
                            # Stay connected? Orchestrator might close connection or keep room open.
                            # If connection closes, loop catches it.

            except (websockets.exceptions.ConnectionClosed, OSError) as e:
                self.logger.info(f"Disconnected from Orchestrator: {e}")
                await asyncio.sleep(2) # Brief pause before re-discovery

    async def handle_turn(self, ws, event):
        """Handle a turn request."""
        self.logger.info("🎤 It's my turn!")
        context = event.get("context")
        topic = event.get("topic")
        turn_num = event.get("turn", 0)

        # THINK and detect tool calls
        async def think_with_status():
            # Broadcast THINKING
            await ws.send(json.dumps({
                "type": "agent_thinking",
                "agent": self.voice_agent.to_dict()
            }))
            
            def handle_tool_call(tool, query):
                # This runs in a background thread, but we can use the loop
                asyncio.run_coroutine_threadsafe(
                    ws.send(json.dumps({
                        "type": "agent_searching",
                        "agent": self.voice_agent.to_dict(),
                        "query": query
                    })),
                    asyncio.get_event_loop()
                )

            return await asyncio.to_thread(
                self.voice_agent.think,
                heard_text=context if turn_num > 0 else None,
                topic=topic,
                on_tool_call=handle_tool_call
            )

        reply = await think_with_status()

        # SPEAK
        audio_bytes = await asyncio.to_thread(self.voice_agent.speak, reply)
        
        response_payload = {
            "type": "turn_response",
            "text": reply,
            "audio": ""
        }

        if audio_bytes:
            response_payload["audio"] = base64.b64encode(audio_bytes).decode('utf-8')

        await ws.send(json.dumps(response_payload))
        self.logger.info("✅ Turn complete, sent response")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Voice Agent Runner")
    parser.add_argument("agent_id", help="Agent ID from agent_config.py (e.g. scout)")
    parser.add_argument("--api-key", help="Existing API Key (optional)")
    
    args = parser.parse_args()

    runner = AgentRunner(args.agent_id, args.api_key)
    try:
        asyncio.run(runner.run())
    except KeyboardInterrupt:
        pass
