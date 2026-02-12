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
    analyser: null,
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
}

// System Connection
async function toggleSystemConnection() {
    // Initialize AudioContext on first click (User Gesture Required)
    if (!state.audioContext) {
        state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        state.analyser = state.audioContext.createAnalyser();
        state.analyser.fftSize = 256; // Tighter bars for the Neo-Brutalist look
        startVisualizerLoop();
    }

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
    await joinRoom(CONFIG.defaultRoom);
    await connectAgentWebSocket();
    startAgentConversation("General AI");
}

function terminateSystem() {
    if (state.recording) stopRecording();
    if (state.agentWs) state.agentWs.close();
}

async function joinRoom(roomId) {
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
        
        // Connect mic stream to analyser
        const source = state.audioContext.createMediaStreamSource(state.mediaStream);
        source.connect(state.analyser);

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
        elements.micBtn.classList.add('btn-danger');
        elements.statusDisplay.textContent = 'TRANSMITTING';
        
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

// Visualizer Loop
function startVisualizerLoop() {
    const canvas = elements.visualizerCanvas;
    const ctx = canvas.getContext('2d');
    
    function draw() {
        requestAnimationFrame(draw);
        const bufferLength = state.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        state.analyser.getByteFrequencyData(dataArray);
        
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

// Transcription
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
            // In Phase 10 we don't inject to agents per user request.
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
            max_turns: 20
        }));
    }
}

function handleAgentEvent(event) {
    switch (event.type) {
        case 'agent_thinking':
            logSystem(`${event.agent.name} // NEURAL_SYNTHESIS...`);
            break;
        case 'agent_searching':
            logSystem(`${event.agent.name} // CONSULTING_EXTERNAL_NEURAL_NODES...`);
            break;
        case 'agent_response':
            logSystem(`${event.agent.name}: ${event.text}`);
            break;
        case 'agent_audio':
            playAgentAudio(event.audio);
            break;
        case 'conversation_start':
            logSystem(`System Topic: ${event.topic}`);
            break;
    }
}

async function playAgentAudio(base64Audio) {
    if (!base64Audio || !state.audioContext) return;
    try {
        const binaryString = atob(base64Audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        
        // Decode and play through analyzer
        const audioBuffer = await state.audioContext.decodeAudioData(bytes.buffer);
        const source = state.audioContext.createBufferSource();
        source.buffer = audioBuffer;
        
        source.connect(state.analyser);
        state.analyser.connect(state.audioContext.destination);
        
        source.start(0);
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

document.addEventListener('DOMContentLoaded', init);
