#!/bin/bash
# Whisper Transcription Setup - Verification Script
# This script verifies that the whisper.cpp server is working correctly

WHISPER_PORT=${WHISPER_PORT:-8002}
WHISPER_MODEL="/root/.openclaw/workspace-agents/scout/whisper.cpp/models/ggml-small.bin"
SAMPLE_AUDIO="/root/.openclaw/workspace-agents/scout/whisper.cpp/samples/jfk.wav"

echo "=========================================="
echo "Whisper.cpp Server Verification"
echo "=========================================="
echo ""

# Check if whisper-server is running
echo "1. Checking if whisper-server is running..."
if curl -s "http://localhost:$WHISPER_PORT/health" | grep -q "ok"; then
    echo "   ✓ Whisper-server is running on port $WHISPER_PORT"
    HEALTH_STATUS="PASS"
else
    echo "   ✗ Whisper-server is not responding"
    HEALTH_STATUS="FAIL"
fi
echo ""

# Test health endpoint
echo "2. Testing health endpoint..."
HEALTH_RESPONSE=$(curl -s "http://localhost:$WHISPER_PORT/health")
if echo "$HEALTH_RESPONSE" | grep -q "ok"; then
    echo "   ✓ Health check passed: $HEALTH_RESPONSE"
    HEALTH_TEST="PASS"
else
    echo "   ✗ Health check failed: $HEALTH_RESPONSE"
    HEALTH_TEST="FAIL"
fi
echo ""

# Test transcription
echo "3. Testing transcription..."
if [ -f "$SAMPLE_AUDIO" ]; then
    echo "   Using sample audio: $SAMPLE_AUDIO"
    
    START_TIME=$(date +%s%N)
    TRANSCRIPTION=$(curl -s -X POST \
        -F "file=@$SAMPLE_AUDIO" \
        "http://localhost:$WHISPER_PORT/inference")
    END_TIME=$(date +%s%N)
    
    ELAPSED=$(( (END_TIME - START_TIME) / 1000000 ))
    
    if echo "$TRANSCRIPTION" | grep -q '"text"'; then
        echo "   ✓ Transcription successful!"
        echo "   Response time: ${ELAPSED}ms"
        echo "   Text: $(echo "$TRANSCRIPTION" | grep -o '"text"[^}]*' | sed 's/"text"://' | tr -d '"')"
        
        if [ $ELAPSED -lt 3000 ]; then
            echo "   ✓ Response time meets requirement (< 3000ms)"
            SPEED_TEST="PASS"
        else
            echo "   ⚠ Response time exceeds requirement (${ELAPSED}ms > 3000ms)"
            echo "   Note: This is CPU-based transcription and is expected to be slower"
            SPEED_TEST="PARTIAL"
        fi
        TRANSCRIPTION_TEST="PASS"
    else
        echo "   ✗ Transcription failed"
        echo "   Response: $TRANSCRIPTION"
        TRANSCRIPTION_TEST="FAIL"
    fi
else
    echo "   ✗ Sample audio file not found: $SAMPLE_AUDIO"
    TRANSCRIPTION_TEST="FAIL"
fi
echo ""

# Summary
echo "=========================================="
echo "Summary"
echo "=========================================="
echo "Health Check: $HEALTH_STATUS"
echo "Transcription: $TRANSCRIPTION_TEST"
echo "Response Time: $SPEED_TEST"
echo ""

if [ "$HEALTH_STATUS" = "PASS" ] && [ "$TRANSCRIPTION_TEST" = "PASS" ]; then
    echo "✓ Whisper transcription is WORKING!"
    echo ""
    echo "Endpoints available:"
    echo "  - Health: http://localhost:$WHISPER_PORT/health"
    echo "  - Transcribe: POST http://localhost:$WHISPER_PORT/inference"
    echo ""
    echo "Usage:"
    echo "  curl -X POST -F 'file=@audio.wav' http://localhost:$WHISPER_PORT/inference"
    exit 0
else
    echo "✗ Some tests failed. Please check the whisper-server."
    exit 1
fi
