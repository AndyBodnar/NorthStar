import express from 'express';
import { StateService } from '../services/StateService';
import { logger } from '../utils/logger';
import { body, param, query, validationResult } from 'express-validator';

const router = express.Router();
const stateService = new StateService();

// Validation middleware
const handleValidationErrors = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Set state (create or update)
router.put('/:type/:key',
  [
    param('type').isIn(['global', 'user', 'session', 'temporal', 'contextual']).withMessage('Invalid state type'),
    param('key').notEmpty().withMessage('State key is required'),
    body('value').exists().withMessage('State value is required'),
    body('expiresAt').optional().isISO8601().withMessage('Invalid expiration date'),
    handleValidationErrors
  ],
  async (req, res) => {
    try {
      const request = {
        key: req.params.key,
        stateType: req.params.type as any,
        value: req.body.value,
        expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : undefined,
        createdBy: req.body.createdBy || 'system'
      };

      const state = await stateService.setState(request);
      res.json(state);
    } catch (error) {
      logger.error('Error setting state:', error);
      res.status(500).json({ error: 'Failed to set state' });
    }
  }
);

// Get state
router.get('/:type/:key',
  [
    param('type').isIn(['global', 'user', 'session', 'temporal', 'contextual']).withMessage('Invalid state type'),
    param('key').notEmpty().withMessage('State key is required'),
    handleValidationErrors
  ],
  async (req, res) => {
    try {
      const state = await stateService.getState(req.params.key, req.params.type as any);
      if (!state) {
        return res.status(404).json({ error: 'State not found' });
      }
      res.json(state);
    } catch (error) {
      logger.error('Error getting state:', error);
      res.status(500).json({ error: 'Failed to get state' });
    }
  }
);

// Lock state
router.post('/:type/:key/lock',
  [
    param('type').isIn(['global', 'user', 'session', 'temporal', 'contextual']).withMessage('Invalid state type'),
    param('key').notEmpty().withMessage('State key is required'),
    body('lockedBy').notEmpty().withMessage('lockedBy is required'),
    handleValidationErrors
  ],
  async (req, res) => {
    try {
      const success = await stateService.lockState(
        req.params.key,
        req.params.type as any,
        req.body.lockedBy
      );

      if (!success) {
        return res.status(409).json({ error: 'State is already locked or does not exist' });
      }

      res.json({ success: true, message: 'State locked successfully' });
    } catch (error) {
      logger.error('Error locking state:', error);
      res.status(500).json({ error: 'Failed to lock state' });
    }
  }
);

// Unlock state
router.post('/:type/:key/unlock',
  [
    param('type').isIn(['global', 'user', 'session', 'temporal', 'contextual']).withMessage('Invalid state type'),
    param('key').notEmpty().withMessage('State key is required'),
    body('unlockedBy').notEmpty().withMessage('unlockedBy is required'),
    handleValidationErrors
  ],
  async (req, res) => {
    try {
      const success = await stateService.unlockState(
        req.params.key,
        req.params.type as any,
        req.body.unlockedBy
      );

      if (!success) {
        return res.status(404).json({ error: 'State not found or not locked by this user' });
      }

      res.json({ success: true, message: 'State unlocked successfully' });
    } catch (error) {
      logger.error('Error unlocking state:', error);
      res.status(500).json({ error: 'Failed to unlock state' });
    }
  }
);

// Search states
router.get('/',
  [
    query('stateTypes').optional().isArray().withMessage('State types must be an array'),
    query('keyPattern').optional().isString().withMessage('Key pattern must be a string'),
    query('isLocked').optional().isBoolean().withMessage('isLocked must be a boolean'),
    query('limit').optional().isInt({ min: 1, max: 1000 }).withMessage('Limit must be between 1 and 1000'),
    handleValidationErrors
  ],
  async (req, res) => {
    try {
      const searchRequest = {
        stateTypes: req.query.stateTypes as string[],
        keyPattern: req.query.keyPattern as string,
        isLocked: req.query.isLocked ? req.query.isLocked === 'true' : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 100,
        createdAfter: req.query.createdAfter ? new Date(req.query.createdAfter as string) : undefined
      };

      const states = await stateService.searchStates(searchRequest);
      res.json(states);
    } catch (error) {
      logger.error('Error searching states:', error);
      res.status(500).json({ error: 'Failed to search states' });
    }
  }
);

// Get state history
router.get('/:type/:key/history',
  [
    param('type').isIn(['global', 'user', 'session', 'temporal', 'contextual']).withMessage('Invalid state type'),
    param('key').notEmpty().withMessage('State key is required'),
    handleValidationErrors
  ],
  async (req, res) => {
    try {
      const history = await stateService.getStateHistory(req.params.key, req.params.type as any);
      res.json(history);
    } catch (error) {
      logger.error('Error getting state history:', error);
      res.status(500).json({ error: 'Failed to get state history' });
    }
  }
);

// Delete state
router.delete('/:type/:key',
  [
    param('type').isIn(['global', 'user', 'session', 'temporal', 'contextual']).withMessage('Invalid state type'),
    param('key').notEmpty().withMessage('State key is required'),
    handleValidationErrors
  ],
  async (req, res) => {
    try {
      const deleted = await stateService.deleteState(req.params.key, req.params.type as any);
      if (!deleted) {
        return res.status(404).json({ error: 'State not found' });
      }
      res.status(204).send();
    } catch (error) {
      logger.error('Error deleting state:', error);
      res.status(500).json({ error: 'Failed to delete state' });
    }
  }
);

export default router;