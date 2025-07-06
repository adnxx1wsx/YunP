import { Request, Response, NextFunction } from 'express';

export const notFound = (req: Request, res: Response, next: NextFunction): void => {
  res.status(404).json({
    success: false,
    error: `Route ${req.originalUrl} not found`,
    message: 'The requested resource does not exist'
  });
};
