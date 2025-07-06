import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

export const validate = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error } = schema.validate(req.body);
    
    if (error) {
      const errorMessage = error.details.map(detail => detail.message).join(', ');
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        message: errorMessage,
        details: error.details
      });
      return;
    }
    
    next();
  };
};

// 用户注册验证
export const userRegistrationSchema = Joi.object({
  username: Joi.string()
    .alphanum()
    .min(3)
    .max(30)
    .required()
    .messages({
      'string.alphanum': 'Username must contain only alphanumeric characters',
      'string.min': 'Username must be at least 3 characters long',
      'string.max': 'Username must not exceed 30 characters',
      'any.required': 'Username is required'
    }),
  
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),
  
  password: Joi.string()
    .min(6)
    .max(128)
    .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)'))
    .required()
    .messages({
      'string.min': 'Password must be at least 6 characters long',
      'string.max': 'Password must not exceed 128 characters',
      'string.pattern.base': 'Password must contain at least one lowercase letter, one uppercase letter, and one number',
      'any.required': 'Password is required'
    })
});

// 用户登录验证
export const userLoginSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),
  
  password: Joi.string()
    .required()
    .messages({
      'any.required': 'Password is required'
    })
});

// 文件夹创建验证
export const folderCreateSchema = Joi.object({
  name: Joi.string()
    .min(1)
    .max(255)
    .pattern(new RegExp('^[^<>:"/\\|?*]+$'))
    .required()
    .messages({
      'string.min': 'Folder name cannot be empty',
      'string.max': 'Folder name must not exceed 255 characters',
      'string.pattern.base': 'Folder name contains invalid characters',
      'any.required': 'Folder name is required'
    }),
  
  parentId: Joi.string()
    .uuid()
    .optional()
    .allow(null)
    .messages({
      'string.uuid': 'Parent ID must be a valid UUID'
    })
});

// 文件夹重命名验证
export const folderRenameSchema = Joi.object({
  name: Joi.string()
    .min(1)
    .max(255)
    .pattern(new RegExp('^[^<>:"/\\|?*]+$'))
    .required()
    .messages({
      'string.min': 'Folder name cannot be empty',
      'string.max': 'Folder name must not exceed 255 characters',
      'string.pattern.base': 'Folder name contains invalid characters',
      'any.required': 'Folder name is required'
    })
});

// 文件分享验证
export const fileShareSchema = Joi.object({
  expiresAt: Joi.date()
    .greater('now')
    .optional()
    .messages({
      'date.greater': 'Expiration date must be in the future'
    }),
  
  downloadLimit: Joi.number()
    .integer()
    .min(1)
    .max(1000)
    .optional()
    .messages({
      'number.integer': 'Download limit must be an integer',
      'number.min': 'Download limit must be at least 1',
      'number.max': 'Download limit cannot exceed 1000'
    })
});

// 查询参数验证
export const paginationSchema = Joi.object({
  page: Joi.number()
    .integer()
    .min(1)
    .default(1)
    .messages({
      'number.integer': 'Page must be an integer',
      'number.min': 'Page must be at least 1'
    }),
  
  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(20)
    .messages({
      'number.integer': 'Limit must be an integer',
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit cannot exceed 100'
    }),
  
  sort: Joi.string()
    .valid('name', 'size', 'createdAt', 'updatedAt')
    .default('createdAt')
    .messages({
      'any.only': 'Sort field must be one of: name, size, createdAt, updatedAt'
    }),
  
  order: Joi.string()
    .valid('asc', 'desc')
    .default('desc')
    .messages({
      'any.only': 'Order must be either asc or desc'
    })
});

export const validateQuery = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.query);
    
    if (error) {
      const errorMessage = error.details.map(detail => detail.message).join(', ');
      res.status(400).json({
        success: false,
        error: 'Query validation failed',
        message: errorMessage,
        details: error.details
      });
      return;
    }
    
    req.query = value;
    next();
  };
};
