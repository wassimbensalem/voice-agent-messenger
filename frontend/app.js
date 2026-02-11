// Configuration
const CONFIG = {
    signalingUrl: 'http://localhost:8080',
    whisperUrl: 'http://localhost:8001',
    piperUrl: 'http://localhost:5001',
    agentId: `user-${Math.random().toString(36).substr(2, 9)}`
};

// State
const state = {
    connected: false,
    recording: false,
    currentRoom: null,
    audioContext: null,
    mediaRecorder: null,
    audioChunks: [],
    socket: null,
    mediaStream: null
};

// DOM Elements
const elements = {
    statusDot: document.getElementById('statusDot'),
    statusText: document.getElementById('statusText'),
    createRoomBtn: document.getElementById('createRoomBtn'),
    joinRoomBtn: document.getElementById('joinRoomBtn'),
    leaveRoomBtn: document.getElementById('leaveRoomBtn'),
    roomActive: document.getElementById('roomActive'),
    roomContent: document.getElementById('roomContent'),
    roomName: document.getElementById('roomName'),
    participantCount: document.getElementById('participantCount'),
    participantList: document.getElementById('participantList'),
    muteBtn: document.getElementById('muteBtn'),
    volumeBar: document.getElementById('volumeBar'),
    recordBtn: document.getElementById('recordBtn'),
    recordBtnText: document.getElementById('recordBtnText'),
    visualizerCanvas: document.getElementById('visualizerCanvas'),
    transcriptContent: document.getElementById('transcriptContent'),
    clearTranscriptBtn: document.getElementById('clearTranscriptBtn'),
    ttsInput: document.getElementById('ttsInput'),
    speakBtn: document.getElementById('speakBtn'),
    ttsOutput: document.getElementById('ttsOutput'),
    ttsAudio: document.getElementById('ttsAudio'),
    roomModal: document.getElementById('roomModal'),
    modalTitle: document.getElementById('modalTitle'),
    roomIdInput: document.getElementById('roomIdInput'),
    generateRoomIdBtn: document.getElementById('generateRoomIdBtn'),
    closeModalBtn: document.getElementById('closeModalBtn'),
    cancelModalBtn: document.getElementById('cancelModalBtn'),
    confirmModalBtn: document.getElementById('confirmModalBtn'),
    signalingStatus: document.getElementById('signalingStatus'),
    whisperStatus: document.getElementById('whisperStatus'),
    piperStatus: document.getElementById('piperStatus')
};

// Initialize
async function init() {
    console.log('Initializing Voice Agent Messenger...');
    
    // Check service health
    await checkServicesHealth();
    
    // Setup event listeners
    setupEventListeners();
    
    // Initialize audio context
    state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    updateStatus('Ready', 'connected');
}

// Check Services Health
async function checkServicesHealth() {
    try {
        // Check Signaling Server
        const signalingResponse = await fetch(`${CONFIG.signalingUrl}/api/health`);
        if (signalingResponse.ok) {
            elements.signalingStatus.classList.add('healthy');
        }
    } catch (error) {
        console.error('Signaling server not available:', error);
        elements.signalingStatus.classList.add('error');
    }
    
    try {
        // Check Whisper STT
        const whisperResponse = await fetch(`${CONFIG.whisperUrl}/health`);
        if (whisperResponse.ok) {
            elements.whisperStatus.classList.add('healthy');
        }
    } catch (error) {
        console.error('Whisper STT not available:', error);
        elements.whisperStatus.classList.add('error');
    }
    
    try {
        // Check Piper TTS
        const piperResponse = await fetch(`${CONFIG.piperUrl}/health`);
        if (piperResponse.ok) {
            elements.piperStatus.classList.add('healthy');
        }
    } catch (error) {
        console.error('Piper TTS not available:', error);
        elements.piperStatus.classList.add('error');
    }
}

// Setup Event Listeners
function setupEventListeners() {
    elements.createRoomBtn.addEventListener('click', () => openRoomModal('create'));
    elements.joinRoomBtn.addEventListener('click', () => openRoomModal('join'));
    elements.leaveRoomBtn.addEventListener('click', leaveRoom);
    elements.recordBtn.addEventListener('click', toggleRecording);
    elements.clearTranscriptBtn.addEventListener('click', clearTranscript);
    elements.speakBtn.addEventListener('click', synthesizeSpeech);
    elements.generateRoomIdBtn.addEventListener('click', generateRoomId);
    elements.closeModalBtn.addEventListener('click', closeRoomModal);
    elements.cancelModalBtn.addEventListener('click', closeRoomModal);
    elements.confirmModalBtn.addEventListener('click', confirmRoomAction);
    elements.muteBtn.addEventListener('click', toggleMute);
}

// Update Status
function updateStatus(text, status = 'connected') {
    elements.statusText.textContent = text;
    elements.statusDot.className = `status-dot ${status}`;
}

// Room Modal
let currentModalAction = 'join';

function openRoomModal(action) {
    currentModalAction = action;
    elements.modalTitle.textContent = action === 'create' ? 'Create Room' : 'Join Room';
    elements.roomIdInput.value = '';
    if (action === 'create') {
        generateRoomId();
    }
    elements.roomModal.classList.add('active');
}

function closeRoomModal() {
    elements.roomModal.classList.remove('active');
}

function generateRoomId() {
    const roomId = `room-${Math.random().toString(36).substr(2, 9)}`;
    elements.roomIdInput.value = roomId;
}

function confirmRoomAction() {
    const roomId = elements.roomIdInput.value.trim();
    if (!roomId) {
        alert('Please enter a room ID');
        return;
    }
    
    if (currentModalAction === 'create' || currentModalAction === 'join') {
        joinRoom(roomId);
    }
    
    closeRoomModal();
}

// Room Management
function joinRoom(roomId) {
    state.currentRoom = roomId;
    elements.roomName.textContent = `Room: ${roomId}`;
    
    // Show active room UI
    document.querySelector('.room-empty').style.display = 'none';
    elements.roomActive.style.display = 'block';
    
    // Add self as participant
    addParticipant(CONFIG.agentId, 'You', true);
    
    updateStatus(`In room: ${roomId}`, 'connected');
    showNotification(`Joined room: ${roomId}`);
}

function leaveRoom() {
    if (!state.currentRoom) return;
    
    const roomId = state.currentRoom;
    state.currentRoom = null;
    
    // Hide active room UI
    document.querySelector('.room-empty').style.display = 'flex';
    elements.roomActive.style.display = 'none';
    
    // Clear participants
    elements.participantList.innerHTML = '';
    elements.participantCount.textContent = '0';
    
    updateStatus('Ready', 'connected');
    showNotification(`Left room: ${roomId}`);
}

function addParticipant(id, name, isLocal = false) {
    const participantDiv = document.createElement('div');
    participantDiv.className = 'participant-item';
    participantDiv.id = `participant-${id}`;
    
    const avatar = document.createElement('div');
    avatar.className = 'participant-avatar';
    avatar.textContent = name.charAt(0).toUpperCase();
    
    const info = document.createElement('div');
    info.className = 'participant-info';
    
    const nameSpan = document.createElement('div');
    nameSpan.className = 'participant-name';
    nameSpan.textContent = name;
    
    const statusSpan = document.createElement('div');
    statusSpan.className = 'participant-status';
    statusSpan.textContent = isLocal ? 'You' : 'Connected';
    
    info.appendChild(nameSpan);
    info.appendChild(statusSpan);
    
    participantDiv.appendChild(avatar);
    participantDiv.appendChild(info);
    
    elements.participantList.appendChild(participantDiv);
    updateParticipantCount();
}

function updateParticipantCount() {
    const count = elements.participantList.children.length;
    elements.participantCount.textContent = count;
}

// Audio Recording
async function toggleRecording() {
    if (state.recording) {
        stopRecording();
    } else {
        await startRecording();
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
            await transcribeAudio(audioBlob);
            state.audioChunks = [];
        };
        
        state.mediaRecorder.start();
        state.recording = true;
        
        elements.recordBtn.classList.add('recording');
        elements.recordBtnText.textContent = 'Stop Recording';
        
        // Start visualizer
        startVisualizer(state.mediaStream);
        
        showNotification('Recording started');
    } catch (error) {
        console.error('Error starting recording:', error);
        showNotification('Error accessing microphone', 'error');
    }
}

function stopRecording() {
    if (state.mediaRecorder && state.recording) {
        state.mediaRecorder.stop();
        state.recording = false;
        
        elements.recordBtn.classList.remove('recording');
        elements.recordBtnText.textContent = 'Start Recording';
        
        // Stop media stream
        if (state.mediaStream) {
            state.mediaStream.getTracks().forEach(track => track.stop());
        }
        
        showNotification('Recording stopped');
    }
}

// Audio Visualizer
function startVisualizer(stream) {
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
    
    source.connect(analyser);
    analyser.fftSize = 256;
    
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const canvas = elements.visualizerCanvas;
    const ctx = canvas.getContext('2d');
    
    function draw() {
        if (!state.recording) return;
        
        requestAnimationFrame(draw);
        
        analyser.getByteFrequencyData(dataArray);
        
        ctx.fillStyle = 'rgba(10, 14, 39, 0.3)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        const barWidth = (canvas.width / bufferLength) * 2.5;
        let barHeight;
        let x = 0;
        
        for (let i = 0; i < bufferLength; i++) {
            barHeight = (dataArray[i] / 255) * canvas.height;
            
            const gradient = ctx.createLinearGradient(0, canvas.height - barHeight, 0, canvas.height);
            gradient.addColorStop(0, '#667eea');
            gradient.addColorStop(1, '#764ba2');
            
            ctx.fillStyle = gradient;
            ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
            
            x += barWidth + 1;
        }
    }
    
    draw();
}

// Speech to Text
async function transcribeAudio(audioBlob) {
    try {
        showNotification('Transcribing...');
        
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.wav');
        
        const response = await fetch(`${CONFIG.whisperUrl}/transcribe`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error('Transcription failed');
        }
        
        const result = await response.json();
        addTranscript(result.text || 'No speech detected');
        showNotification('Transcription complete');
    } catch (error) {
        console.error('Transcription error:', error);
        showNotification('Transcription failed', 'error');
    }
}

function addTranscript(text) {
    // Remove placeholder if exists
    const placeholder = elements.transcriptContent.querySelector('.placeholder');
    if (placeholder) {
        placeholder.remove();
    }
    
    const transcriptDiv = document.createElement('div');
    transcriptDiv.className = 'transcript-item';
    
    const timeDiv = document.createElement('div');
    timeDiv.className = 'transcript-time';
    timeDiv.textContent = new Date().toLocaleTimeString();
    
    const textDiv = document.createElement('div');
    textDiv.textContent = text;
    
    transcriptDiv.appendChild(timeDiv);
    transcriptDiv.appendChild(textDiv);
    
    elements.transcriptContent.appendChild(transcriptDiv);
    elements.transcriptContent.scrollTop = elements.transcriptContent.scrollHeight;
}

function clearTranscript() {
    elements.transcriptContent.innerHTML = '<p class="placeholder">Your transcription will appear here...</p>';
}

// Text to Speech
async function synthesizeSpeech() {
    const text = elements.ttsInput.value.trim();
    
    if (!text) {
        showNotification('Please enter text to synthesize', 'error');
        return;
    }
    
    try {
        showNotification('Synthesizing speech...');
        elements.speakBtn.disabled = true;
        
        const response = await fetch(`${CONFIG.piperUrl}/synthesize`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text })
        });
        
        if (!response.ok) {
            throw new Error('Speech synthesis failed');
        }
        
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        
        elements.ttsAudio.src = audioUrl;
        elements.ttsOutput.style.display = 'block';
        elements.ttsAudio.play();
        
        showNotification('Speech synthesized successfully');
    } catch (error) {
        console.error('TTS error:', error);
        showNotification('Speech synthesis failed', 'error');
    } finally {
        elements.speakBtn.disabled = false;
    }
}

// Mute Toggle
function toggleMute() {
    if (state.mediaStream) {
        const audioTrack = state.mediaStream.getAudioTracks()[0];
        audioTrack.enabled = !audioTrack.enabled;
        
        elements.muteBtn.style.opacity = audioTrack.enabled ? '1' : '0.5';
        showNotification(audioTrack.enabled ? 'Unmuted' : 'Muted');
    }
}

// Notifications
function showNotification(message, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${message}`);
    
    // You can implement a toast notification system here
    // For now, we'll just log to console
}

// Initialize on load
document.addEventListener('DOMContentLoaded', init);
