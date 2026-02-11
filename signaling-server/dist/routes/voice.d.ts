/**
 * Voice API Routes
 *
 * REST API endpoints for voice room management and operations.
 * Provides voice-specific functionality beyond basic room management.
 */
import { Router } from 'express';
import { RoomManager } from '../services/room-manager';
import { AuthService } from '../services/auth';
export declare function createVoiceRouter(roomManager: RoomManager, authService: AuthService): Router;
//# sourceMappingURL=voice.d.ts.map