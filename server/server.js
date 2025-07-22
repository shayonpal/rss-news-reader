require('dotenv').config();
const express = require('express');
const cors = require('cors');
const BiDirectionalSyncService = require('./services/bidirectional-sync');
const markAllReadRouter = require('./routes/mark-all-read');

const app = express();
const PORT = process.env.SERVER_PORT || 3000;

// Initialize bi-directional sync service
const syncService = new BiDirectionalSyncService();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/server', markAllReadRouter);

// Bi-directional sync endpoints
app.post('/server/sync/trigger', async (req, res) => {
  try {
    await syncService.triggerManualSync();
    res.json({ success: true, message: 'Bi-directional sync triggered' });
  } catch (error) {
    console.error('Error triggering sync:', error);
    res.status(500).json({ error: 'Failed to trigger sync' });
  }
});

app.get('/server/sync/stats', async (req, res) => {
  try {
    const stats = await syncService.getSyncQueueStats();
    res.json(stats);
  } catch (error) {
    console.error('Error getting sync stats:', error);
    res.status(500).json({ error: 'Failed to get sync stats' });
  }
});

app.post('/server/sync/clear-failed', async (req, res) => {
  try {
    const cleared = await syncService.clearFailedItems();
    res.json({ success: true, cleared });
  } catch (error) {
    console.error('Error clearing failed items:', error);
    res.status(500).json({ error: 'Failed to clear failed items' });
  }
});

// Health check
app.get('/server/health', (req, res) => {
  res.json({ 
    status: 'ok',
    service: 'rss-reader-server',
    biDirectionalSync: syncService.syncTimer ? 'active' : 'inactive'
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`[Server] RSS Reader server listening on port ${PORT}`);
  
  // Start bi-directional sync service
  syncService.startPeriodicSync();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received, shutting down gracefully');
  
  // Stop sync service
  syncService.stopPeriodicSync();
  
  // Close server
  server.close(() => {
    console.log('[Server] Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('[Server] SIGINT received, shutting down gracefully');
  
  // Stop sync service
  syncService.stopPeriodicSync();
  
  // Close server
  server.close(() => {
    console.log('[Server] Server closed');
    process.exit(0);
  });
});