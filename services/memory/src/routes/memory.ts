import express from 'express';
import { MemoryService } from '../services/MemoryService';
import { logger } from '../utils/logger';
import { body, param, query, validationResult } from 'express-validator';

const router = express.Router();
const memoryService = new MemoryService();

// Validation middleware
const handleValidationErrors = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Create memory
router.post('/',
  [
    body('content').notEmpty().withMessage('Content is required'),
    body('memoryType').isIn(['short_term', 'long_term', 'episodic', 'semantic', 'procedural', 'working']).withMessage('Invalid memory type'),
    body('importanceScore').optional().isFloat({ min: 0, max: 1 }).withMessage('Importance score must be between 0 and 1'),
    body('tags').optional().isArray().withMessage('Tags must be an array'),
    body('expiresAt').optional().isISO8601().withMessage('Invalid expiration date'),
    handleValidationErrors
  ],
  async (req, res) => {
    try {
      const memory = await memoryService.createMemory(req.body);
      res.status(201).json(memory);
    } catch (error) {
      logger.error('Error creating memory:', error);
      res.status(500).json({ error: 'Failed to create memory' });
    }
  }
);

// Get memory by ID
router.get('/:id',
  [
    param('id').isUUID().withMessage('Invalid memory ID'),
    handleValidationErrors
  ],
  async (req, res) => {
    try {
      const memory = await memoryService.getMemory(req.params.id);
      if (!memory) {
        return res.status(404).json({ error: 'Memory not found' });
      }
      res.json(memory);
    } catch (error) {
      logger.error('Error retrieving memory:', error);
      res.status(500).json({ error: 'Failed to retrieve memory' });
    }
  }
);

// Search memories
router.get('/',
  [
    query('memoryTypes').optional().isArray().withMessage('Memory types must be an array'),
    query('tags').optional().isArray().withMessage('Tags must be an array'),
    query('minImportance').optional().isFloat({ min: 0, max: 1 }).withMessage('Min importance must be between 0 and 1'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 1000 }).withMessage('Limit must be between 1 and 1000'),
    query('sortBy').optional().isIn(['created_at', 'updated_at', 'importance_score', 'access_count']).withMessage('Invalid sort field'),
    query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc'),
    handleValidationErrors
  ],
  async (req, res) => {
    try {
      const searchRequest = {
        memoryTypes: req.query.memoryTypes as string[],
        tags: req.query.tags as string[],
        minImportance: req.query.minImportance ? parseFloat(req.query.minImportance as string) : undefined,
        query: req.query.q as string,
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
        sortBy: req.query.sortBy as any,
        sortOrder: req.query.sortOrder as any,
        createdAfter: req.query.createdAfter ? new Date(req.query.createdAfter as string) : undefined,
        createdBefore: req.query.createdBefore ? new Date(req.query.createdBefore as string) : undefined
      };

      const result = await memoryService.searchMemories(searchRequest);
      res.json(result);
    } catch (error) {
      logger.error('Error searching memories:', error);
      res.status(500).json({ error: 'Failed to search memories' });
    }
  }
);

// Update memory
router.put('/:id',
  [
    param('id').isUUID().withMessage('Invalid memory ID'),
    body('content').optional().notEmpty().withMessage('Content cannot be empty'),
    body('importanceScore').optional().isFloat({ min: 0, max: 1 }).withMessage('Importance score must be between 0 and 1'),
    body('tags').optional().isArray().withMessage('Tags must be an array'),
    handleValidationErrors
  ],
  async (req, res) => {
    try {
      const memory = await memoryService.updateMemory(req.params.id, req.body);
      if (!memory) {
        return res.status(404).json({ error: 'Memory not found' });
      }
      res.json(memory);
    } catch (error) {
      logger.error('Error updating memory:', error);
      res.status(500).json({ error: 'Failed to update memory' });
    }
  }
);

// Delete memory
router.delete('/:id',
  [
    param('id').isUUID().withMessage('Invalid memory ID'),
    handleValidationErrors
  ],
  async (req, res) => {
    try {
      const deleted = await memoryService.deleteMemory(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: 'Memory not found' });
      }
      res.status(204).send();
    } catch (error) {
      logger.error('Error deleting memory:', error);
      res.status(500).json({ error: 'Failed to delete memory' });
    }
  }
);

// Get memories by type
router.get('/type/:type',
  [
    param('type').isIn(['short_term', 'long_term', 'episodic', 'semantic', 'procedural', 'working']).withMessage('Invalid memory type'),
    query('limit').optional().isInt({ min: 1, max: 1000 }).withMessage('Limit must be between 1 and 1000'),
    handleValidationErrors
  ],
  async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const memories = await memoryService.getMemoriesByType(req.params.type as any, limit);
      res.json(memories);
    } catch (error) {
      logger.error('Error getting memories by type:', error);
      res.status(500).json({ error: 'Failed to get memories by type' });
    }
  }
);

export default router;