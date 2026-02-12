// CLAW.VOX // System Core
const CONFIG = {
    signalingUrl: 'http://localhost:8080',
    whisperUrl: 'http://localhost:8001',
    piperUrl: 'http://localhost:5001',
    agentId: `user-${Math.random().toString(36).substr(2, 9)}`,
    defaultRoom: 'General-Lobby'
};

// State
const state = {
    connected: false,
    recording: false,
    audioContext: null,
    mediaRecorder: null,
    audioChunks: [],
    mediaStream: null,
    agentWs: null
};

// DOM Elements
const elements = {
    connectBtn: document.getElementById('connectBtn'),
    micBtn: document.getElementById('micBtn'),
    statusDisplay: document.getElementById('statusDisplay'),
    visualizerCanvas: document.getElementById('visualizerCanvas'),
    transcriptContent: document.getElementById('transcriptContent'),
    signalingStatus: document.getElementById('signalingStatus'),
    whisperStatus: document.getElementById('whisperStatus'),
    piperStatus: document.getElementById('piperStatus')
};

// Initialize
function init() {
    console.log('booting CLAW.VOX...');
    checkServicesHealth();
    
    elements.connectBtn.addEventListener('click', toggleSystemConnection);
    elements.micBtn.addEventListener('click', toggleMic);
    
    // Init Audio Context on first interaction
    state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
}

// System Connection
async function toggleSystemConnection() {
    if (!state.connected) {
        // Connect
        elements.connectBtn.disabled = true;
        elements.connectBtn.textContent = 'INITIALIZING...';
        
        try {
            await initializeSystem();
            state.connected = true;
            elements.connectBtn.textContent = 'TERMINATE LINK';
            elements.connectBtn.classList.replace('btn-primary', 'btn-danger');
            elements.micBtn.disabled = false;
            elements.statusDisplay.textContent = 'SYSTEM.ONLINE';
            elements.statusDisplay.style.color = 'var(--success)';
            
            logSystem('Link Established.');
        } catch (error) {
            console.error(error);
            elements.connectBtn.textContent = 'RETRY LINK';
            elements.statusDisplay.textContent = 'SYSTEM.ERROR';
            elements.statusDisplay.style.color = 'var(--danger)';
        } finally {
            elements.connectBtn.disabled = false;
        }
    } else {
        // Disconnect
        terminateSystem();
        state.connected = false;
        elements.connectBtn.textContent = 'INITIALIZE LINK';
        elements.connectBtn.classList.replace('btn-danger', 'btn-primary');
        elements.micBtn.disabled = true;
        elements.micBtn.textContent = 'MIC OFF';
        elements.statusDisplay.textContent = 'SYSTEM.STANDBY';
        elements.statusDisplay.style.color = 'var(--accent-primary)';
        logSystem('Link Terminated.');
    }
}

async function initializeSystem() {
    // 1. Join Default Room
    await joinRoom(CONFIG.defaultRoom);
    
    // 2. Connect to Agent Orchestrator
    await connectAgentWebSocket();
    
    // 3. Start Agent Conversation (Topic: General AI)
    startAgentConversation("General AI");
}

function terminateSystem() {
    // Stop Recording
    if (state.recording) stopRecording();
    
    // Leave Room (Signaling) - Todo: Implement proper leave interaction
    // Close WS
    if (state.agentWs) state.agentWs.close();
    
    // Stop Visualizer
    // (Optional clean up)
}

// Room Logic (Simplified)
async function joinRoom(roomId) {
    // For now, we simulate joining by just logging it. 
    // In a real WebRTC setup, we'd exchange SDP here via Signaling Server.
    // Since we are using Agent Runner separately, we just need to ensure 
    // we are capturing audio and sending valid transcripts to the Agent.
    
    // Important: The Agent Orchestrator handles the "Room" concept for the agents.
    // For the User, we just need to be "Live".
    logSystem(`Joined Frequency: ${roomId}`);
}

// Audio / Mic Logic
async function toggleMic() {
    if (!state.recording) {
        await startRecording();
    } else {
        stopRecording();
    }
}

async function startRecording() {
    try {
        state.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        state.mediaRecorder = new MediaRecorder(state.mediaStream);
        state.audioChunks = [];
        
        state.mediaRecorder.ondataavailable = (event) => {
            state.audioChunks.push(event.data);
        };
        
        state.mediaRecorder.onstop = async () => {
             const audioBlob = new Blob(state.audioChunks, { type: 'audio/wav' });
             state.audioChunks = [];
             await transcribeAudio(audioBlob);
        };
        
        state.mediaRecorder.start();
        state.recording = true;
        
        elements.micBtn.textContent = 'MIC ACTIVE';
        elements.micBtn.classList.add('btn-danger'); // Red when active
        elements.statusDisplay.textContent = 'TRANSMITTING';
        
        startVisualizer(state.mediaStream);
        
    } catch (e) {
        console.error(e);
        logSystem('Mic Error: ' + e.message);
    }
}

function stopRecording() {
    if (state.mediaRecorder && state.recording) {
        state.mediaRecorder.stop();
        state.recording = false;
        
        elements.micBtn.textContent = 'MIC OFF';
        elements.micBtn.classList.remove('btn-danger');
        elements.statusDisplay.textContent = 'SYSTEM.ONLINE';
        
        if (state.mediaStream) {
             state.mediaStream.getTracks().forEach(track => track.stop());
        }
    }
}

// Visualizer
function startVisualizer(stream) {
    const audioContext = new AudioContext(); // New context or reuse state.audioContext?
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
    
    source.connect(analyser);
    analyser.fftSize = 2048; // Higher res for large display
    
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const canvas = elements.visualizerCanvas;
    const ctx = canvas.getContext('2d');
    
    function draw() {
        if (!state.recording) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            return;
        }
        
        requestAnimationFrame(draw);
        analyser.getByteFrequencyData(dataArray);
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const barWidth = (canvas.width / bufferLength) * 2.5;
        let barHeight;
        let x = 0;
        
        for (let i = 0; i < bufferLength; i++) {
            barHeight = (dataArray[i] / 255) * canvas.height;
            
            // OpenClaw Red Color
            ctx.fillStyle = `rgb(255, ${200 - barHeight}, ${200 - barHeight})`;
            ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
            
            x += barWidth + 1;
        }
    }
    draw();
}

// Transcription (User Speech)
async function transcribeAudio(audioBlob) {
    try {
        logSystem('Processing Audio...');
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.wav');
        
        const response = await fetch(`${CONFIG.whisperUrl}/transcribe`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) throw new Error('Transcription failed');
        
        const result = await response.json();
        const text = result.text;
        
        if (text) {
            logSystem(`YOU: ${text}`);
            // Send to Agent!!
            // Wait, we don't have a direct "Send Text to Agent" method in the Orchestrator WS yet?
            // The Agent listens to audio usually? Or do we act as "User Agent"?
            // The current implementation uses WebSocket for Agent-to-Browser.
            // Browser-to-Agent is usually missing in the previous implementation!
            // Ah, the previous implementation was "Conversational Loop" between Agents.
            // USER participation was missing!
            
            // To make this interactive, we should send this text to the Orchestrator
            // as a "User Message".
            // Since Orchestrator manages agents, we can broadcast this text.
            // But for now, let's just log it. The Agents are talking to each other.
            // If we want to talk to them, we need to inject this into their context.
            // This requires backend changes.
            // For Phase 8 Simplification, let's just show it.
        }
        
    } catch (e) {
        logSystem('Transcription Error.');
    }
}

// Agent Logic (WebSocket)
function connectAgentWebSocket() {
    return new Promise((resolve, reject) => {
        const wsUrl = `ws://${window.location.hostname}:8765`;
        state.agentWs = new WebSocket(wsUrl);
        
        state.agentWs.onopen = () => {
            logSystem('Connected to Neural Core.');
            resolve();
        };
        
        state.agentWs.onmessage = (event) => {
            handleAgentEvent(JSON.parse(event.data));
        };
        
        state.agentWs.onerror = (err) => {
            logSystem('Neural Core Connection Failed.');
            reject(err);
        };
    });
}

function startAgentConversation(topic) {
    if (state.agentWs && state.agentWs.readyState === WebSocket.OPEN) {
        state.agentWs.send(JSON.stringify({
            type: 'start_conversation',
            topic: topic,
            max_turns: 20, // Long conversation
            agents: ['scout', 'sage']
        }));
    }
}

function handleAgentEvent(event) {
    switch (event.type) {
        case 'agent_response':
            logSystem(`${event.agent.name}: ${event.text}`);
            break;
        case 'agent_audio':
             // Play Audio
            playAgentAudio(event.audio);
            break;
        case 'conversation_start':
            logSystem(`System Topic: ${event.topic}`);
            break;
    }
}

function playAgentAudio(base64Audio) {
    if (!base64Audio) return;
    try {
        const binaryString = atob(base64Audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes.buffer], { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.play();
        
        // Visualize Agent Audio? 
        // We'd need to hook this audio element to the visualizer.
        // For now, simplier is fine.
    } catch (e) {
        console.error('Audio Playback Error', e);
    }
}

// Utilities
function logSystem(text) {
    const div = document.createElement('div');
    div.className = 'transcript-item';
    div.textContent = `[${new Date().toLocaleTimeString()}] ${text}`;
    elements.transcriptContent.appendChild(div);
    elements.transcriptContent.scrollTop = elements.transcriptContent.scrollHeight;
}

async function checkServicesHealth() {
    try { await fetch(`${CONFIG.signalingUrl}/api/health`); elements.signalingStatus.classList.add('connected'); } catch {}
    try { await fetch(`${CONFIG.whisperUrl}/health`); elements.whisperStatus.classList.add('connected'); } catch {}
    try { await fetch(`${CONFIG.piperUrl}/health`); elements.piperStatus.classList.add('connected'); } catch {}
}

// Boot
document.addEventListener('DOMContentLoaded', init);
