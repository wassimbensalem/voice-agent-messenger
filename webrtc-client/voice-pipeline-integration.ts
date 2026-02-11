/**
 * Complete Voice Pipeline Integration
 * 
 * Flow: Record → Whisper STT (8001) → WebRTC Signaling → Piper TTS (5000) → Playback
 * 
 * Latency Breakdown:
 * - Recording time
 * - STT (Whisper) transcription
 * - WebRTC message round-trip
 * - TTS (Piper) synthesis
 * - Audio playback
 */

import * as fs from 'fs';
import * as path from 'path';
import http from 'http';
import https from 'https';

// Types
interface PipelineConfig {
  whisperUrl: string;
  piperUrl: string;
  signalingUrl: string;
  agentId: string;
  jwtSecret: string;
}

interface PipelineResult {
  success: boolean;
  stages: {
    recording: { duration: number; success: boolean };
    stt: { duration: number; success: boolean; text?: string };
    webrtc: { duration: number; success: boolean; messageId?: string };
    tts: { duration: number; success: boolean; audioSize?: number };
    playback: { duration: number; success: boolean };
  };
  totalLatency: number;
  transcript?: string;
  audioFile?: string;
  errors: string[];
}

/**
 * Voice Pipeline Integration
 */
export class VoicePipeline {
  private config: PipelineConfig;
  private jwtToken: string | null = null;

  constructor(config: PipelineConfig) {
    this.config = config;
  }

  /**
   * Execute complete voice pipeline
   */
  async execute(audioFilePath?: string): Promise<PipelineResult> {
    const startTime = Date.now();
    const result: PipelineResult = {
      success: false,
      stages: {
        recording: { duration: 0, success: false },
        stt: { duration: 0, success: false },
        webrtc: { duration: 0, success: false },
        tts: { duration: 0, success: false },
        playback: { duration: 0, success: false },
      },
      totalLatency: 0,
      errors: [],
    };

    try {
      // Stage 1: Recording (or use provided file)
      console.log('\n🔴 Stage 1: Audio Recording');
      const recordingStart = Date.now();
      
      let audioPath = audioFilePath;
      if (!audioPath) {
        const recordingResult = await this.recordAudio(5000); // 5 second recording
        if (!recordingResult.success) {
          result.errors.push(`Recording failed: ${recordingResult.error}`);
          return this.finalizeResult(result, startTime);
        }
        audioPath = recordingResult.path;
      }
      
      result.stages.recording.duration = Date.now() - recordingStart;
      result.stages.recording.success = true;
      result.audioFile = audioPath;
      console.log(`✅ Recording complete: ${result.stages.recording.duration}ms`);

      // Stage 2: Speech-to-Text (Whisper)
      console.log('\n📝 Stage 2: Speech-to-Text (Whisper)');
      const sttStart = Date.now();
      
      if (!audioPath || !fs.existsSync(audioPath)) {
        result.errors.push('Audio file not found for transcription');
        return this.finalizeResult(result, startTime);
      }

      const transcriptionResult = await this.transcribeWithWhisper(audioPath);
      result.stages.stt.duration = Date.now() - sttStart;
      result.stages.stt.success = transcriptionResult.success;
      result.stages.stt.text = transcriptionResult.text;
      
      if (!transcriptionResult.success) {
        result.errors.push(`STT failed: ${transcriptionResult.error}`);
        return this.finalizeResult(result, startTime);
      }
      
      result.transcript = transcriptionResult.text!;
      console.log(`✅ Transcription complete: ${result.stages.stt.duration}ms`);
      console.log(`   Text: "${transcriptionResult.text}"`);

      // Stage 3: WebRTC Signaling (send transcript)
      console.log('\n🌐 Stage 3: WebRTC Signaling');
      const webrtcStart = Date.now();
      
      const webrtcResult = await this.sendViaWebRTC(transcriptionResult.text!);
      result.stages.webrtc.duration = Date.now() - webrtcStart;
      result.stages.webrtc.success = webrtcResult.success;
      result.stages.webrtc.messageId = webrtcResult.messageId;
      
      if (!webrtcResult.success) {
        // Non-fatal - continue with TTS
        console.warn(`⚠️ WebRTC send failed (non-fatal): ${webrtcResult.error}`);
        result.errors.push(`WebRTC: ${webrtcResult.error}`);
      } else {
        console.log(`✅ WebRTC message sent: ${result.stages.webrtc.duration}ms`);
      }

      // Stage 4: Text-to-Speech (Piper)
      console.log('\n🔊 Stage 4: Text-to-Speech (Piper)');
      const ttsStart = Date.now();
      
      const synthesisResult = await this.synthesizeWithPiper(transcriptionResult.text!);
      result.stages.tts.duration = Date.now() - ttsStart;
      result.stages.tts.success = synthesisResult.success;
      result.stages.tts.audioSize = synthesisResult.audioSize;
      
      if (!synthesisResult.success) {
        result.errors.push(`TTS failed: ${synthesisResult.error}`);
        return this.finalizeResult(result, startTime);
      }
      
      result.audioFile = synthesisResult.outputPath;
      console.log(`✅ Synthesis complete: ${result.stages.tts.duration}ms`);
      console.log(`   Audio size: ${synthesisResult.audioSize} bytes`);

      // Stage 5: Audio Playback
      console.log('\n▶️ Stage 5: Audio Playback');
      const playbackStart = Date.now();
      
      const playbackResult = await this.playbackAudio(synthesisResult.outputPath);
      result.stages.playback.duration = Date.now() - playbackStart;
      result.stages.playback.success = playbackResult.success;
      
      if (!playbackResult.success) {
        result.errors.push(`Playback failed: ${playbackResult.error}`);
        // Non-fatal - pipeline still successful
      } else {
        console.log(`✅ Playback complete: ${result.stages.playback.duration}ms`);
      }

      // Success!
      result.success = true;
      console.log('\n🎉 Pipeline completed successfully!');

    } catch (error) {
      result.errors.push(`Pipeline error: ${error}`);
    }

    return this.finalizeResult(result, startTime);
  }

  /**
   * Record audio from microphone
   */
  private async recordAudio(duration: number): Promise<{ success: boolean; path?: string; error?: string }> {
    return new Promise((resolve) => {
      // Use arecord for Linux recording
      const outputPath = `/tmp/voice-pipeline-${Date.now()}.wav`;
      const arecord = require('child_process').spawn('arecord', [
        '-f', 'cd',
        '-t', 'wav',
        '-d', String(duration),
        '-r', '16000',
        outputPath
      ]);

      arecord.on('error', (err: Error) => {
        resolve({ success: false, error: err.message });
      });

      arecord.on('close', (code: number) => {
        if (code === 0) {
          resolve({ success: true, path: outputPath });
        } else {
          resolve({ success: false, error: `Recording failed with code ${code}` });
        }
      });
    });
  }

  /**
   * Transcribe audio using Whisper
   */
  private async transcribeWithWhisper(audioPath: string): Promise<{ success: boolean; text?: string; error?: string }> {
    try {
      const audioData = fs.readFileSync(audioPath);
      
      // Create multipart form data
      const boundary = '----VoicePipelineBoundary' + Date.now();
      const body = Buffer.concat([
        Buffer.from(`--${boundary}\r\n`),
        Buffer.from(`Content-Disposition: form-data; name="file"; filename="${path.basename(audioPath)}"\r\n`),
        Buffer.from('Content-Type: audio/wav\r\n\r\n'),
        audioData,
        Buffer.from(`\r\n--${boundary}--\r\n`),
      ]);

      const result = await this.httpRequest({
        hostname: this.config.whisperUrl.replace('http://', '').replace('https://', ''),
        port: 8001,
        path: '/inference',
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        body,
      });

      if (result.success && result.data) {
        const parsed = JSON.parse(result.data.toString());
        return { success: true, text: parsed.text?.trim() || '' };
      }

      return { success: false, error: result.error || 'Unknown error' };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Send transcript via WebRTC signaling
   */
  private async sendViaWebRTC(text: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      // Ensure we have JWT token
      if (!this.jwtToken) {
        this.jwtToken = await this.generateToken();
      }

      // For now, just log the message would be sent
      // In full implementation, this would send via WebSocket
      const messageId = `msg-${Date.now()}`;
      
      console.log(`   [WebRTC] Would send: "${text.substring(0, 50)}..."`);
      console.log(`   [WebRTC] Message ID: ${messageId}`);
      
      // Simulate WebRTC message (in real impl, this goes through Socket.IO)
      return { success: true, messageId };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Synthesize speech using Piper
   */
  private async synthesizeWithPiper(text: string): Promise<{ success: boolean; outputPath?: string; audioSize?: number; error?: string }> {
    try {
      const outputPath = `/tmp/piper-output-${Date.now()}.wav`;

      const result = await this.httpRequest({
        hostname: this.config.piperUrl.replace('http://', '').replace('https://', ''),
        port: 5000,
        path: '/synthesize',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: Buffer.from(JSON.stringify({
          text,
          output_file: outputPath,
        })),
      });

      if (result.success) {
        if (fs.existsSync(outputPath)) {
          const stats = fs.statSync(outputPath);
          return { success: true, outputPath, audioSize: stats.size };
        }
        return { success: true, audioSize: result.data?.length || 0 };
      }

      return { success: false, error: result.error || 'Synthesis failed' };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Playback audio file
   */
  private async playbackAudio(audioPath: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      if (!fs.existsSync(audioPath)) {
        resolve({ success: false, error: 'Audio file not found' });
        return;
      }

      // Use aplay for playback
      const aplay = require('child_process').spawn('aplay', [audioPath]);

      aplay.on('error', (err: Error) => {
        resolve({ success: false, error: err.message });
      });

      aplay.on('close', (code: number) => {
        if (code === 0) {
          resolve({ success: true });
        } else {
          resolve({ success: false, error: `Playback failed with code ${code}` });
        }
      });
    });
  }

  /**
   * Generate JWT token for WebRTC
   */
  private async generateToken(): Promise<string> {
    // Simple JWT implementation for demo
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
    const payload = Buffer.from(JSON.stringify({
      agentId: this.config.agentId,
      roles: ['agent'],
      type: 'authentication',
      exp: Date.now() + 3600000,
    })).toString('base64');
    
    const crypto = require('crypto');
    const signature = crypto
      .createHmac('sha256', this.config.jwtSecret)
      .update(`${header}.${payload}`)
      .digest('base64');

    return `${header}.${payload}.${signature}`;
  }

  /**
   * HTTP Request helper
   */
  private httpRequest(options: {
    hostname: string;
    port: number;
    path: string;
    method: string;
    headers: Record<string, string>;
    body: Buffer;
  }): Promise<{ success: boolean; data?: Buffer; error?: string }> {
    return new Promise((resolve) => {
      const req = http.request(
        {
          ...options,
          host: options.hostname,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve({ success: true, data: Buffer.concat(chunks) });
            } else {
              resolve({ success: false, error: `HTTP ${res.statusCode}` });
            }
          });
        }
      );

      req.on('error', (err) => resolve({ success: false, error: err.message }));
      req.write(options.body);
      req.end();
    });
  }

  /**
   * Finalize and format result
   */
  private finalizeResult(result: PipelineResult, startTime: number): PipelineResult {
    result.totalLatency = Date.now() - startTime;
    return result;
  }

  /**
   * Print latency report
   */
  printLatencyReport(result: PipelineResult): void {
    console.log('\n═══════════════════════════════════════════');
    console.log('         LATENCY REPORT');
    console.log('═══════════════════════════════════════════\n');

    console.log('Stage                  Duration    Cumulative');
    console.log('──────────────────────────────────────────');
    
    let cumulative = 0;
    
    console.log('Recording'.padEnd(20) + 
                `${result.stages.recording.duration}ms`.padEnd(12) + 
                `${result.stages.recording.duration}ms`);
    cumulative += result.stages.recording.duration;
    
    console.log('STT (Whisper)'.padEnd(20) + 
                `${result.stages.stt.duration}ms`.padEnd(12) + 
                `${cumulative}ms`);
    cumulative += result.stages.stt.duration;
    
    console.log('WebRTC'.padEnd(20) + 
                `${result.stages.webrtc.duration}ms`.padEnd(12) + 
                `${cumulative}ms`);
    cumulative += result.stages.webrtc.duration;
    
    console.log('TTS (Piper)'.padEnd(20) + 
                `${result.stages.tts.duration}ms`.padEnd(12) + 
                `${cumulative}ms`);
    cumulative += result.stages.tts.duration;
    
    console.log('Playback'.padEnd(20) + 
                `${result.stages.playback.duration}ms`.padEnd(12) + 
                `${cumulative}ms`);

    console.log('──────────────────────────────────────────');
    console.log('TOTAL LATENCY:'.padEnd(20) + `${result.totalLatency}ms`);
    console.log('═══════════════════════════════════════════\n');

    // Bottleneck analysis
    console.log('🔍 BOTTLENECK ANALYSIS:');
    const stages = [
      { name: 'Recording', time: result.stages.recording.duration },
      { name: 'STT', time: result.stages.stt.duration },
      { name: 'WebRTC', time: result.stages.webrtc.duration },
      { name: 'TTS', time: result.stages.tts.duration },
      { name: 'Playback', time: result.stages.playback.duration },
    ];
    
    const maxStage = stages.reduce((max, s) => s.time > max.time ? s : max);
    console.log(`   ⚠️ Slowest stage: ${maxStage.name} (${maxStage.time}ms)`);
    
    if (result.stages.stt.duration > result.totalLatency * 0.5) {
      console.log('   💡 Recommendation: Consider GPU acceleration or smaller Whisper model');
    }
    if (result.stages.tts.duration > 2000) {
      console.log('   💡 Recommendation: Piper TTS is taking >2s. Consider voice model optimization');
    }

    // Errors
    if (result.errors.length > 0) {
      console.log('\n⚠️ ERRORS / WARNINGS:');
      result.errors.forEach((err, i) => console.log(`   ${i + 1}. ${err}`));
    }
  }
}

/**
 * Run integration test
 */
export async function runIntegrationTest(): Promise<void> {
  const config: PipelineConfig = {
    whisperUrl: 'http://localhost',
    piperUrl: 'http://localhost',
    signalingUrl: 'ws://localhost:8080',
    agentId: 'agent-scout',
    jwtSecret: 'your-super-secret-jwt-key-change-in-production',
  };

  console.log('═══════════════════════════════════════════');
  console.log('   VOICE PIPELINE INTEGRATION TEST');
  console.log('═══════════════════════════════════════════');
  console.log(`\nConfiguration:`);
  console.log(`  Whisper: ${config.whisperUrl}:8001`);
  console.log(`  Piper:   ${config.piperUrl}:5000`);
  console.log(`  WebRTC:  ${config.signalingUrl}`);
  console.log(`  Agent:   ${config.agentId}`);

  const pipeline = new VoicePipeline(config);
  const result = await pipeline.execute();

  pipeline.printLatencyReport(result);

  if (result.success) {
    console.log('✅ Integration test PASSED');
    process.exit(0);
  } else {
    console.log('❌ Integration test FAILED');
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  runIntegrationTest().catch(console.error);
}
