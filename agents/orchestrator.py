#!/usr/bin/env python3
"""
Voice Agent Orchestrator (Open Gateway)

- Acts as the host for the voice room.
- Accepts WebSocket connections from:
  1. Frontend (Observers) - /frontend
  2. Agents (Participants) - /agent
- Manages turn-taking by signaling connected agents.
"""

import asyncio
import json
import logging
import argparse
import random
import os
import time
import httpx
import websockets
from websockets.server import serve
from typing import Dict, Optional

# Configuration
SIGNALING_URL = os.environ.get("SIGNALING_URL", "http://signaling:8080")
ORCHESTRATOR_URL = os.environ.get("ORCHESTRATOR_URL", "ws://orchestrator:8765/agent")
DEFAULT_MAX_TURNS = 20
DEFAULT_TOPIC = "The future of autonomous AI agents"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [Orchestrator] %(message)s",
)
logger = logging.getLogger("Orchestrator")


class ConnectedAgent:
    def __init__(self, ws, profile):
        self.ws = ws
        self.profile = profile
        self.id = profile["id"]
        self.name = profile["name"]
        self.emoji = profile["emoji"]
        self.color = profile["color"]

    def to_dict(self):
        return self.profile


class Orchestrator:
    def __init__(self):
        self.frontend_clients = set()
        self.agents: Dict[str, ConnectedAgent] = {}
        self.agent_queues: Dict[str, asyncio.Queue] = {}
        self.conversation_active = False
        self.room_id = None # Will be set by API
        self.room_name = DEFAULT_TOPIC
        self.topic = os.environ.get("ORCHESTRATOR_TOPIC", "General AI")
        self.turn_count = 0
        self.max_turns = DEFAULT_MAX_TURNS
        self.history = []
        self.api_key = None
        self.host_url = os.environ.get("ORCHESTRATOR_URL", "ws://orchestrator:8765/agent")

    async def register_host(self):
        """Register Orchestrator as a Host Agent and create a room."""
        async with httpx.AsyncClient() as client:
            try:
                # 1. Register Host Agent
                registration_secret = os.getenv("AGENT_REGISTRATION_SECRET")
                headers = {}
                if registration_secret:
                    headers["X-Registration-Secret"] = registration_secret

                resp = await client.post(f"{SIGNALING_URL}/api/agents/register", json={
                    "name": "Orchestrator Host",
                    "emoji": "🤖",
                    "color": "#FF0000"
                }, headers=headers)
                resp.raise_for_status()
                data = resp.json()
                self.api_key = data["data"]["apiKey"]
                logger.info(f"Registered Host Agent. Key length: {len(self.api_key)}")

                # 2. Create Room
                resp = await client.post(
                    f"{SIGNALING_URL}/api/rooms",
                    json={
                        "name": self.room_name,
                        "type": "voice",
                        "connectionUrl": self.host_url,
                        "topic": self.topic,
                        "settings": {
                            "maxDuration": 60,
                            "allowRecording": True
                        }
                    },
                    headers={"Authorization": f"Bearer {self.api_key}"}
                )
                resp.raise_for_status()
                room_data = resp.json()["data"]
                self.room_id = room_data["id"]
                logger.info(f"Created Room: {self.room_id} ({self.room_name})")
                
            except Exception as e:
                logger.error(f"Failed to register host: {e}")
                # Fallback purely for local testing if signaling is down, but ideally should fail
                if not self.room_id:
                     self.room_id = f"room-{int(time.time())}"
                     logger.warning(f"Using fallback room ID: {self.room_id}")

    async def cleanup_room(self):
        """Delete the room on shutdown."""
        if not self.room_id or not self.api_key:
            return
            
        async with httpx.AsyncClient() as client:
            try:
                await client.delete(
                    f"{SIGNALING_URL}/api/rooms/{self.room_id}",
                    headers={"Authorization": f"Bearer {self.api_key}"}
                )
                logger.info(f"Deleted Room: {self.room_id}")
            except Exception as e:
                logger.error(f"Failed to delete room: {e}")

    async def broadcast(self, event: dict):
        """Send event to all frontend clients and agents."""
        if not self.frontend_clients and not self.agents:
            return

        message = json.dumps(event)
        
        # Send to frontend
        if self.frontend_clients:
            await asyncio.gather(
                *[client.send(message) for client in self.frontend_clients],
                return_exceptions=True
            )
            
        # Send to agents (except audio data to save bandwidth if needed, but for now send all)
        # Agents need to hear others to respond
        if self.agents:
            await asyncio.gather(
                *[agent.ws.send(message) for agent in self.agents.values()],
                return_exceptions=True
            )

    async def verify_agent(self, api_key: str) -> Optional[dict]:
        """Verify agent API key with Signaling Server."""
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    f"{SIGNALING_URL}/api/agents/me",
                    headers={"Authorization": f"Bearer {api_key}"}
                )
                if resp.status_code == 200:
                    return resp.json().get("data")
                else:
                    logger.warning(f"Agent auth failed: {resp.status_code} {resp.text}")
                    return None
        except Exception as e:
            logger.error(f"Auth error: {e}")
            return None

    async def handle_frontend(self, websocket):
        """Handle frontend WebSocket connection."""
        self.frontend_clients.add(websocket)
        logger.info(f"Frontend connected. Total: {len(self.frontend_clients)}")
        
        # Send current state
        await websocket.send(json.dumps({
            "type": "room_state",
            "room_id": self.room_id,
            "agents": [a.to_dict() for a in self.agents.values()],
            "active": self.conversation_active
        }))

        try:
            async for msg in websocket:
                data = json.loads(msg)
                if data.get("type") == "start_conversation":
                    self.topic = data.get("topic", self.topic)
                    self.max_turns = data.get("max_turns", self.max_turns)
                    if not self.conversation_active and len(self.agents) >= 1:
                        asyncio.create_task(self.run_conversation_loop())
                    elif len(self.agents) < 1:
                        await websocket.send(json.dumps({
                            "type": "error", 
                            "message": "No agents connected"
                        }))
        except Exception as e:
            logger.error(f"Frontend error: {e}")
        finally:
            self.frontend_clients.discard(websocket)
            logger.info("Frontend disconnected")

    async def handle_agent(self, websocket):
        """Handle agent WebSocket connection."""
        # Authentication handshake
        try:
            auth_msg = await asyncio.wait_for(websocket.recv(), timeout=5.0)
            data = json.loads(auth_msg)
            
            if data.get("type") != "identify" or not data.get("apiKey"):
                await websocket.close(1008, "Auth required")
                return

            profile = await self.verify_agent(data["apiKey"])
            if not profile:
                await websocket.close(1008, "Invalid API Key")
                return

            agent = ConnectedAgent(websocket, profile)
            self.agents[agent.id] = agent
            self.agent_queues[agent.id] = asyncio.Queue()
            logger.info(f"Agent connected: {agent.name} ({agent.id})")

            # Notify everyone
            await self.broadcast({
                "type": "agent_joined",
                "agent": agent.to_dict(),
                "room_id": self.room_id
            })

            try:
                # Keep connection open and handle incoming messages (e.g. unsolicited inputs)
                async for msg in websocket:
                    msg_data = json.loads(msg)
                    # Handle turn response
                    if msg_data.get("type") == "turn_response":
                        if agent.id in self.agent_queues:
                            await self.agent_queues[agent.id].put(msg_data)
            except websockets.exceptions.ConnectionClosed:
                pass
            finally:
                if agent.id in self.agents:
                    del self.agents[agent.id]
                if agent.id in self.agent_queues:
                    del self.agent_queues[agent.id]
                await self.broadcast({
                    "type": "agent_left",
                    "agent": agent.to_dict(),
                    "room_id": self.room_id
                })
                logger.info(f"Agent disconnected: {agent.name}")

        except Exception as e:
            logger.error(f"Agent connection error: {e}")
            await websocket.close()

    async def run_conversation_loop(self):
        """Managed conversation loop."""
        self.conversation_active = True
        self.turn_count = 0
        logger.info(f"Starting conversation: {self.topic}")

        await self.broadcast({
            "type": "conversation_start",
            "topic": self.topic,
            "room_id": self.room_id,
            "max_turns": self.max_turns
        })

        agent_ids = list(self.agents.keys())
        current_context = f"Topic: {self.topic}"

        while self.turn_count < self.max_turns and self.agents:
            agent_id = agent_ids[self.turn_count % len(agent_ids)]
            agent = self.agents.get(agent_id)
            
            if not agent:
                # Agent disconnected, skip
                agent_ids = list(self.agents.keys())
                continue

            # Request turn
            logger.info(f"Requesting turn from {agent.name}")
            
            # Broadcast THINKING state
            await self.broadcast({
                "type": "agent_thinking",
                "agent": agent.to_dict(),
                "room_id": self.room_id
            })

            await self.broadcast({
                "type": "turn_start",
                "turn": self.turn_count + 1,
                "speaker": agent.to_dict(),
                "room_id": self.room_id
            })

            try:
                # Add a small natural delay before requesting the actual turn
                await asyncio.sleep(1.5)

                # Send explicit turn request to the agent
                await agent.ws.send(json.dumps({
                    "type": "turn_request",
                    "context": current_context,
                    "turn": self.turn_count,
                    "topic": self.topic if self.turn_count == 0 else None
                }))

                # Wait for response with timeout via Queue
                if agent.id in self.agent_queues:
                    response = await asyncio.wait_for(self.agent_queues[agent.id].get(), timeout=60.0)
                else:
                    raise Exception("Agent queue not found")

                if response.get("type") == "turn_response":
                    text = response.get("text", "")
                    audio = response.get("audio", "") # base64
                    
                    # Update context for next agent
                    current_context = text 
                    self.history.append({"agent": agent.name, "text": text})

                    # Broadcast result
                    await self.broadcast({
                        "type": "agent_response",
                        "agent": agent.to_dict(),
                        "text": text,
                        "turn": self.turn_count + 1,
                        "room_id": self.room_id
                    })
                    
                    if audio:
                        await self.broadcast({
                            "type": "agent_audio",
                            "agent": agent.to_dict(),
                            "audio": audio,
                            "audio_size": len(audio),
                            "turn": self.turn_count + 1,
                            "room_id": self.room_id
                        })

            except asyncio.TimeoutError:
                logger.warning(f"Agent {agent.name} timed out")
            except Exception as e:
                logger.error(f"Error during turn: {e}")

            self.turn_count += 1
            await asyncio.sleep(1)

        self.conversation_active = False
        await self.broadcast({
            "type": "conversation_end",
            "room_id": self.room_id,
            "total_turns": self.turn_count
        })
        logger.info("Conversation ended")


orchestrator = Orchestrator()

async def connection_handler(websocket, path):
    if path == "/frontend":
        await orchestrator.handle_frontend(websocket)
    elif path == "/agent":
        await orchestrator.handle_agent(websocket)
    else:
        # Default to frontend for backward compatibility or simple testing
        await orchestrator.handle_frontend(websocket)

async def main():
    port = 8765
    logger.info(f"🚀 Open Gateway Orchestrator starting on port {port}")
    
    # Register Host
    await orchestrator.register_host()

    try:
        async with serve(connection_handler, "0.0.0.0", port):
            await asyncio.Future()  # Run forever
    finally:
        await orchestrator.cleanup_room()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
