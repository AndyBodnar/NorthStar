import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3006;
const server = createServer(app);

// Socket.IO for real-time interaction
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:4000'],
    methods: ['GET', 'POST']
  }
});

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:4000'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: 'Too many interaction requests from this IP, please try again later.'
});
app.use(limiter);

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// In-memory stores
const sessions = new Map();
const messages = new Map();
const presence = new Map();
const holographicObjects = new Map();

// Socket.IO handling
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // User joins a session
  socket.on('join_session', (data) => {
    const { sessionId, userId, userName, presenceType = 'avatar' } = data;

    socket.join(sessionId);

    // Update presence
    presence.set(socket.id, {
      userId,
      userName,
      sessionId,
      presenceType,
      position: { x: 0, y: 0, z: 0 },
      orientation: { x: 0, y: 0, z: 0, w: 1 },
      isActive: true,
      lastSeen: new Date().toISOString(),
      capabilities: ['voice', 'text', 'gesture'],
      socketId: socket.id
    });

    // Notify other participants
    socket.to(sessionId).emit('user_joined', {
      userId,
      userName,
      presenceType,
      timestamp: new Date().toISOString()
    });

    // Send current session state to new user
    const sessionPresence = Array.from(presence.values()).filter(p => p.sessionId === sessionId);
    socket.emit('session_state', {
      participants: sessionPresence,
      holographicObjects: Array.from(holographicObjects.values()).filter(obj => obj.sessionId === sessionId)
    });
  });

  // Handle messages
  socket.on('send_message', (data) => {
    const messageId = uuidv4();
    const message = {
      id: messageId,
      sessionId: data.sessionId,
      senderId: data.senderId,
      senderName: data.senderName,
      content: data.content,
      type: data.type || 'text', // text, voice, gesture, haptic, visual
      timestamp: new Date().toISOString(),
      replyTo: data.replyTo,
      mentions: data.mentions || [],
      attachments: data.attachments || [],
      metadata: data.metadata || {}
    };

    messages.set(messageId, message);

    // Broadcast to session participants
    io.to(data.sessionId).emit('new_message', message);
  });

  // Handle presence updates
  socket.on('update_presence', (data) => {
    const userPresence = presence.get(socket.id);
    if (userPresence) {
      const updated = {
        ...userPresence,
        position: data.position || userPresence.position,
        orientation: data.orientation || userPresence.orientation,
        isActive: data.isActive !== undefined ? data.isActive : userPresence.isActive,
        lastSeen: new Date().toISOString()
      };

      presence.set(socket.id, updated);

      // Broadcast presence update
      socket.to(userPresence.sessionId).emit('presence_updated', {
        userId: userPresence.userId,
        position: updated.position,
        orientation: updated.orientation,
        isActive: updated.isActive
      });
    }
  });

  // Handle holographic objects
  socket.on('create_hologram', (data) => {
    const hologramId = uuidv4();
    const hologram = {
      id: hologramId,
      sessionId: data.sessionId,
      creatorId: data.creatorId,
      name: data.name,
      type: data.type || 'model_3d',
      position: data.position || { x: 0, y: 0, z: 0 },
      rotation: data.rotation || { x: 0, y: 0, z: 0 },
      scale: data.scale || { x: 1, y: 1, z: 1 },
      isVisible: true,
      permissions: data.permissions || ['view'],
      content: data.content,
      animations: data.animations || [],
      createdAt: new Date().toISOString()
    };

    holographicObjects.set(hologramId, hologram);

    // Broadcast to session
    io.to(data.sessionId).emit('hologram_created', hologram);
  });

  socket.on('update_hologram', (data) => {
    const hologram = holographicObjects.get(data.hologramId);
    if (hologram) {
      const updated = { ...hologram, ...data, updatedAt: new Date().toISOString() };
      holographicObjects.set(data.hologramId, updated);

      io.to(hologram.sessionId).emit('hologram_updated', updated);
    }
  });

  socket.on('delete_hologram', (data) => {
    const hologram = holographicObjects.get(data.hologramId);
    if (hologram) {
      holographicObjects.delete(data.hologramId);
      io.to(hologram.sessionId).emit('hologram_deleted', { id: data.hologramId });
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    const userPresence = presence.get(socket.id);
    if (userPresence) {
      // Notify session participants
      socket.to(userPresence.sessionId).emit('user_left', {
        userId: userPresence.userId,
        userName: userPresence.userName,
        timestamp: new Date().toISOString()
      });

      presence.delete(socket.id);
    }

    console.log(`Client disconnected: ${socket.id}`);
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'interaction',
    timestamp: new Date().toISOString(),
    connectedUsers: presence.size,
    activeSessions: sessions.size,
    totalMessages: messages.size,
    holographicObjects: holographicObjects.size
  });
});

// Create interaction session
app.post('/sessions', (req, res) => {
  try {
    const sessionId = uuidv4();
    const session = {
      id: sessionId,
      name: req.body.name || `Session ${sessionId.substr(0, 8)}`,
      description: req.body.description,
      creatorId: req.body.creatorId,
      type: req.body.type || 'conference', // conference, collaboration, social, mixed_reality
      maxParticipants: req.body.maxParticipants || 50,
      isPrivate: req.body.isPrivate || false,
      allowedInteractionTypes: req.body.allowedInteractionTypes || ['voice', 'text', 'gesture'],
      createdAt: new Date().toISOString(),
      participants: [],
      settings: {
        recordingEnabled: req.body.recordingEnabled || false,
        moderationEnabled: req.body.moderationEnabled || true,
        spatialAudioEnabled: req.body.spatialAudioEnabled || true
      }
    };

    sessions.set(sessionId, session);
    res.status(201).json(session);

  } catch (error) {
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// Get session details
app.get('/sessions/:sessionId', (req, res) => {
  const session = sessions.get(req.params.sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const sessionPresence = Array.from(presence.values())
    .filter(p => p.sessionId === req.params.sessionId);

  res.json({
    ...session,
    currentParticipants: sessionPresence,
    participantCount: sessionPresence.length
  });
});

// Get session messages
app.get('/sessions/:sessionId/messages', (req, res) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const before = req.query.before as string;

  let sessionMessages = Array.from(messages.values())
    .filter(m => m.sessionId === req.params.sessionId);

  if (before) {
    sessionMessages = sessionMessages.filter(m =>
      new Date(m.timestamp) < new Date(before)
    );
  }

  sessionMessages = sessionMessages
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);

  res.json({
    messages: sessionMessages.reverse(),
    hasMore: sessionMessages.length === limit
  });
});

// Get presence in session
app.get('/sessions/:sessionId/presence', (req, res) => {
  const sessionPresence = Array.from(presence.values())
    .filter(p => p.sessionId === req.params.sessionId);

  res.json({
    participants: sessionPresence,
    count: sessionPresence.length
  });
});

// Get holographic objects in session
app.get('/sessions/:sessionId/holograms', (req, res) => {
  const sessionHolograms = Array.from(holographicObjects.values())
    .filter(obj => obj.sessionId === req.params.sessionId);

  res.json({
    holograms: sessionHolograms,
    count: sessionHolograms.length
  });
});

// Get all sessions
app.get('/sessions', (req, res) => {
  const publicSessions = Array.from(sessions.values())
    .filter(session => !session.isPrivate)
    .map(session => ({
      ...session,
      participantCount: Array.from(presence.values())
        .filter(p => p.sessionId === session.id).length
    }));

  res.json({
    sessions: publicSessions,
    total: publicSessions.length
  });
});

// Get interaction capabilities
app.get('/capabilities', (req, res) => {
  res.json({
    interactionTypes: [
      {
        type: 'voice',
        description: 'Real-time voice communication',
        features: ['spatial_audio', 'noise_cancellation', 'echo_reduction']
      },
      {
        type: 'text',
        description: 'Text-based messaging',
        features: ['threading', 'mentions', 'reactions', 'attachments']
      },
      {
        type: 'gesture',
        description: 'Hand and body gesture recognition',
        features: ['pointing', 'waving', 'custom_gestures']
      },
      {
        type: 'haptic',
        description: 'Tactile feedback',
        features: ['vibration', 'force_feedback', 'temperature']
      },
      {
        type: 'visual',
        description: 'Visual cues and indicators',
        features: ['eye_tracking', 'facial_expressions', 'gaze_direction']
      },
      {
        type: 'holographic',
        description: '3D holographic objects',
        features: ['3d_models', 'animations', 'interactions']
      }
    ],
    presenceTypes: ['avatar', 'hologram', 'voice_only', 'text_only', 'mixed_reality'],
    maxParticipants: 100,
    supportedFormats: ['webrtc', 'websocket', 'rest_api']
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'North Star Interaction Service',
    version: '1.0.0',
    description: 'Multi-modal interaction and communication service',
    endpoints: {
      health: '/health',
      sessions: '/sessions',
      capabilities: '/capabilities',
      websocket: 'Socket.IO connection available'
    },
    stats: {
      connectedUsers: presence.size,
      activeSessions: sessions.size,
      totalMessages: messages.size,
      holographicObjects: holographicObjects.size
    }
  });
});

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`Interaction Service running on port ${PORT}`);
  console.log('Socket.IO server ready for real-time interactions');
  console.log('Supported interaction types: voice, text, gesture, haptic, visual, holographic');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  io.close(() => {
    server.close(() => {
      console.log('Interaction Service shut down');
      process.exit(0);
    });
  });
});

export default app;