/**
 * Latency Benchmark for Voice Pipeline Components
 * 
 * Measures detailed timing for each stage and identifies bottlenecks
 */

import * as fs from 'fs';
import * as http from 'http';

interface BenchmarkResult {
  component: string;
  iterations: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  p50Duration: number;
  p95Duration: number;
  p99Duration: number;
  throughput: number; // operations per second
}

interface BenchmarkConfig {
  whisperUrl: string;
  piperUrl: string;
  signalingUrl: string;
  testAudioPath: string;
  iterations: number;
}

/**
 * Run latency benchmarks for all voice pipeline components
 */
export async function runLatencyBenchmarks(config: BenchmarkConfig): Promise<Map<string, BenchmarkResult>> {
  const results = new Map<string, BenchmarkResult>();

  console.log('\n═══════════════════════════════════════════');
  console.log('   VOICE PIPELINE LATENCY BENCHMARK');
  console.log('═══════════════════════════════════════════\n');

  // Benchmark 1: Whisper STT
  console.log('📊 Benchmarking Whisper STT (8001)...');
  const whisperResult = await benchmarkWhisper(
    config.whisperUrl, 
    config.testAudioPath, 
    config.iterations
  );
  results.set('whisper-stt', whisperResult);
  printBenchmarkResult(whisperResult);

  // Benchmark 2: Piper TTS
  console.log('\n📊 Benchmarking Piper TTS (5000)...');
  const piperResult = await benchmarkPiper(
    config.piperUrl,
    'Hello, this is a test of the text to speech system.',
    config.iterations
  );
  results.set('piper-tts', piperResult);
  printBenchmarkResult(piperResult);

  // Benchmark 3: Health Checks
  console.log('\n📊 Benchmarking Health Check Endpoints...');
  const healthResult = await benchmarkHealthChecks(
    config.whisperUrl,
    config.piperUrl,
    config.iterations
  );
  results.set('health-checks', healthResult);
  printBenchmarkResult(healthResult);

  return results;
}

/**
 * Benchmark Whisper STT service
 */
async function benchmarkWhisper(
  url: string,
  audioPath: string,
  iterations: number
): Promise<BenchmarkResult> {
  if (!fs.existsSync(audioPath)) {
    return createErrorResult('whisper-stt', 'Audio file not found');
  }

  const audioData = fs.readFileSync(audioPath);
  const durations: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const start = process.hrtime.bigint();
    
    try {
      await new Promise<void>((resolve, reject) => {
        const boundary = `----Benchmark${Date.now()}`;
        const body = Buffer.concat([
          Buffer.from(`--${boundary}\r\n`),
          Buffer.from(`Content-Disposition: form-data; name="file"; filename="audio.wav"\r\n`),
          Buffer.from('Content-Type: audio/wav\r\n\r\n'),
          audioData,
          Buffer.from(`\r\n--${boundary}--\r\n`),
        ]);

        const req = http.request(
          {
            hostname: url.replace('http://', ''),
            port: 8001,
            path: '/inference',
            method: 'POST',
            headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
          },
          (res) => {
            if (res.statusCode && res.statusCode < 400) {
              resolve();
            } else {
              reject(new Error(`HTTP ${res.statusCode}`));
            }
          }
        );

        req.on('error', reject);
        req.write(body);
        req.end();
      });
    } catch {
      // Continue timing even on error
    }

    const end = process.hrtime.bigint();
    durations.push(Number(end - start) / 1000000); // Convert to ms
  }

  return calculateStats('whisper-stt', durations, iterations);
}

/**
 * Benchmark Piper TTS service
 */
async function benchmarkPiper(
  url: string,
  text: string,
  iterations: number
): Promise<BenchmarkResult> {
  const durations: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const start = process.hrtime.bigint();
    
    try {
      await new Promise<void>((resolve, reject) => {
        const req = http.request(
          {
            hostname: url.replace('http://', ''),
            port: 5000,
            path: '/synthesize',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          },
          (res) => {
            if (res.statusCode && res.statusCode < 400) {
              resolve();
            } else {
              reject(new Error(`HTTP ${res.statusCode}`));
            }
          }
        );

        req.on('error', reject);
        req.write(JSON.stringify({ text, output_file: '/dev/null' }));
        req.end();
      });
    } catch {
      // Continue timing
    }

    const end = process.hrtime.bigint();
    durations.push(Number(end - start) / 1000000);
  }

  return calculateStats('piper-tts', durations, iterations);
}

/**
 * Benchmark health check endpoints
 */
async function benchmarkHealthChecks(
  whisperUrl: string,
  piperUrl: string,
  iterations: number
): Promise<BenchmarkResult> {
  const durations: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const start = process.hrtime.bigint();
    
    try {
      await Promise.all([
        new Promise<void>((resolve, reject) => {
          const req = http.get(`${whisperUrl.replace('http://', 'http://')}:8001/health`, (res) => {
            resolve();
          });
          req.on('error', reject);
        }),
        new Promise<void>((resolve, reject) => {
          const req = http.get(`${piperUrl.replace('http://', 'http://')}:5000/health`, (res) => {
            resolve();
          });
          req.on('error', reject);
        }),
      ]);
    } catch {
      // Continue timing
    }

    const end = process.hrtime.bigint();
    durations.push(Number(end - start) / 1000000);
  }

  return calculateStats('health-checks', durations, iterations);
}

/**
 * Calculate statistics from durations
 */
function calculateStats(
  component: string,
  durations: number[],
  iterations: number
): BenchmarkResult {
  const sorted = [...durations].sort((a, b) => a - b);
  
  const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
  const minDuration = Math.min(...durations);
  const maxDuration = Math.max(...durations);
  
  const p50Index = Math.floor(iterations * 0.50);
  const p95Index = Math.floor(iterations * 0.95);
  const p99Index = Math.floor(iterations * 0.99);
  
  const p50Duration = sorted[p50Index];
  const p95Duration = sorted[p95Index];
  const p99Duration = sorted[p99Index];
  
  const throughput = 1000 / avgDuration; // ops per second

  return {
    component,
    iterations,
    avgDuration: Math.round(avgDuration * 100) / 100,
    minDuration: Math.round(minDuration * 100) / 100,
    maxDuration: Math.round(maxDuration * 100) / 100,
    p50Duration: Math.round(p50Duration * 100) / 100,
    p95Duration: Math.round(p95Duration * 100) / 100,
    p99Duration: Math.round(p99Duration * 100) / 100,
    throughput: Math.round(throughput * 100) / 100,
  };
}

/**
 * Create error result
 */
function createErrorResult(component: string, error: string): BenchmarkResult {
  return {
    component,
    iterations: 0,
    avgDuration: 0,
    minDuration: 0,
    maxDuration: 0,
    p50Duration: 0,
    p95Duration: 0,
    p99Duration: 0,
    throughput: 0,
  };
}

/**
 * Print benchmark result
 */
function printBenchmarkResult(result: BenchmarkResult): void {
  console.log(`\n  Component: ${result.component}`);
  console.log(`  Iterations: ${result.iterations}`);
  console.log(`  ─────────────────────────────────`);
  console.log(`  Average:   ${result.avgDuration.toString().padStart(8)} ms`);
  console.log(`  Min:       ${result.minDuration.toString().padStart(8)} ms`);
  console.log(`  Max:       ${result.maxDuration.toString().padStart(8)} ms`);
  console.log(`  P50:       ${result.p50Duration.toString().padStart(8)} ms`);
  console.log(`  P95:       ${result.p95Duration.toString().padStart(8)} ms`);
  console.log(`  P99:       ${result.p99Duration.toString().padStart(8)} ms`);
  console.log(`  ─────────────────────────────────`);
  console.log(`  Throughput: ${result.throughput} ops/sec`);
}

/**
 * Generate comparison report
 */
export function generateComparisonReport(results: Map<string, BenchmarkResult>): string {
  let report = '\n═══════════════════════════════════════════\n';
  report += '       BOTTLENECK ANALYSIS REPORT\n';
  report += '═══════════════════════════════════════════\n\n';

  const sortedResults = Array.from(results.values()).sort((a, b) => b.avgDuration - a.avgDuration);

  report += 'Performance Ranking (Slowest → Fastest):\n';
  report += '────────────────────────────────────────────\n';

  sortedResults.forEach((result, index) => {
    report += `${index + 1}. ${result.component.padEnd(15)} ${result.avgDuration.toString().padStart(8)} ms avg\n`;
  });

  report += '\n────────────────────────────────────────────\n';
  report += 'Bottleneck Identification:\n\n';

  const slowest = sortedResults[0];
  const totalTime = sortedResults.reduce((sum, r) => sum + r.avgDuration, 0);
  const percentage = (slowest.avgDuration / totalTime * 100).toFixed(1);

  report += `⚠️  PRIMARY BOTTLENECK: ${slowest.component}\n`;
  report += `   - Average duration: ${slowest.avgDuration} ms\n`;
  report += `   - Impact: ${percentage}% of total processing time\n`;

  report += '\nRecommendations:\n';
  
  if (slowest.component === 'whisper-stt') {
    report += '   • Use GPU acceleration if available\n';
    report += '   • Consider smaller model (tiny instead of small)\n';
    report += '   • Increase thread count (-t 8 or -t 16)\n';
    report += '   • Implement streaming transcription for real-time\n';
    report += '   • Consider cloud API for better performance\n';
  } else if (slowest.component === 'piper-tts') {
    report += '   • Use smaller voice model\n';
    report += '   • Implement audio caching for repeated phrases\n';
    report += '   • Consider voice model quantization\n';
  } else if (slowest.component === 'health-checks') {
    report += '   • This is typically fast; high values indicate network issues\n';
    report += '   • Check network connectivity\n';
  }

  report += '\n────────────────────────────────────────────\n';
  report += 'Latency Targets:\n';
  report += '────────────────────────────────────────────\n';
  report += '   STT: < 3000ms target (current: ' + 
    (results.get('whisper-stt')?.avgDuration || 'N/A') + 'ms)\n';
  report += '   TTS: < 2000ms target (current: ' + 
    (results.get('piper-tts')?.avgDuration || 'N/A') + 'ms)\n';
  report += '   E2E: < 5000ms target\n';

  return report;
}

// Run benchmarks if executed directly
if (require.main === module) {
  const config: BenchmarkConfig = {
    whisperUrl: 'http://localhost',
    piperUrl: 'http://localhost',
    signalingUrl: 'ws://localhost:8080',
    testAudioPath: '/root/.openclaw/workspace-agents/scout/whisper.cpp/jfk.wav',
    iterations: 3,
  };

  runLatencyBenchmarks(config).then((results) => {
    console.log(generateComparisonReport(results));
  }).catch(console.error);
}
