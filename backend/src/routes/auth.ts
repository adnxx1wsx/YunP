import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { dbGet, dbRun } from '../utils/database';
import { validate, userRegistrationSchema, userLoginSchema } from '../middleware/validation';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/errorHandler';

const router = express.Router();

// 用户注册
router.post('/register', validate(userRegistrationSchema), asyncHandler(async (req, res) => {
  const { username, email, password } = req.body;

  // 检查用户是否已存在
  const existingUser = await dbGet(
    'SELECT id FROM users WHERE email = ? OR username = ?',
    [email, username]
  );

  if (existingUser) {
    throw createError('User with this email or username already exists', 409);
  }

  // 加密密码
  const saltRounds = 12;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  // 创建用户
  const userId = uuidv4();
  const defaultStorageLimit = parseInt(process.env.DEFAULT_STORAGE_LIMIT || '5368709120'); // 5GB

  await dbRun(
    `INSERT INTO users (id, username, email, password_hash, storage_limit) 
     VALUES (?, ?, ?, ?, ?)`,
    [userId, username, email, passwordHash, defaultStorageLimit]
  );

  // 生成 JWT token
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw createError('JWT secret not configured', 500);
  }

  const token = jwt.sign(
    { userId },
    jwtSecret,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  // 获取创建的用户信息
  const user = await dbGet(
    'SELECT id, username, email, storage_used, storage_limit, created_at FROM users WHERE id = ?',
    [userId]
  );

  res.status(201).json({
    success: true,
    data: {
      user,
      token
    },
    message: 'User registered successfully'
  });
}));

// 用户登录
router.post('/login', validate(userLoginSchema), asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // 查找用户
  const user = await dbGet(
    'SELECT id, username, email, password_hash, storage_used, storage_limit FROM users WHERE email = ?',
    [email]
  );

  if (!user) {
    throw createError('Invalid email or password', 401);
  }

  // 验证密码
  const isPasswordValid = await bcrypt.compare(password, user.password_hash);
  if (!isPasswordValid) {
    throw createError('Invalid email or password', 401);
  }

  // 生成 JWT token
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw createError('JWT secret not configured', 500);
  }

  const token = jwt.sign(
    { userId: user.id },
    jwtSecret,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  // 移除密码哈希
  const { password_hash, ...userWithoutPassword } = user;

  res.json({
    success: true,
    data: {
      user: userWithoutPassword,
      token
    },
    message: 'Login successful'
  });
}));

// 获取当前用户信息
router.get('/me', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const user = await dbGet(
    'SELECT id, username, email, avatar, storage_used, storage_limit, created_at, updated_at FROM users WHERE id = ?',
    [req.user!.id]
  );

  if (!user) {
    throw createError('User not found', 404);
  }

  res.json({
    success: true,
    data: user
  });
}));

// 更新用户信息
router.put('/profile', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { username, avatar } = req.body;
  const userId = req.user!.id;

  // 验证输入
  if (username && (username.length < 3 || username.length > 30)) {
    throw createError('Username must be between 3 and 30 characters', 400);
  }

  if (username && !/^[a-zA-Z0-9]+$/.test(username)) {
    throw createError('Username must contain only alphanumeric characters', 400);
  }

  // 检查用户名是否已被使用
  if (username) {
    const existingUser = await dbGet(
      'SELECT id FROM users WHERE username = ? AND id != ?',
      [username, userId]
    );

    if (existingUser) {
      throw createError('Username already taken', 409);
    }
  }

  // 构建更新查询
  const updates: string[] = [];
  const values: any[] = [];

  if (username) {
    updates.push('username = ?');
    values.push(username);
  }

  if (avatar !== undefined) {
    updates.push('avatar = ?');
    values.push(avatar);
  }

  if (updates.length === 0) {
    throw createError('No valid fields to update', 400);
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(userId);

  await dbRun(
    `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
    values
  );

  // 获取更新后的用户信息
  const updatedUser = await dbGet(
    'SELECT id, username, email, avatar, storage_used, storage_limit, created_at, updated_at FROM users WHERE id = ?',
    [userId]
  );

  res.json({
    success: true,
    data: updatedUser,
    message: 'Profile updated successfully'
  });
}));

// 修改密码
router.put('/password', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user!.id;

  // 验证输入
  if (!currentPassword || !newPassword) {
    throw createError('Current password and new password are required', 400);
  }

  if (newPassword.length < 6) {
    throw createError('New password must be at least 6 characters long', 400);
  }

  // 获取当前密码哈希
  const user = await dbGet(
    'SELECT password_hash FROM users WHERE id = ?',
    [userId]
  );

  if (!user) {
    throw createError('User not found', 404);
  }

  // 验证当前密码
  const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!isCurrentPasswordValid) {
    throw createError('Current password is incorrect', 401);
  }

  // 加密新密码
  const saltRounds = 12;
  const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

  // 更新密码
  await dbRun(
    'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [newPasswordHash, userId]
  );

  res.json({
    success: true,
    message: 'Password updated successfully'
  });
}));

// 登出 (客户端处理，服务端只返回成功消息)
router.post('/logout', authenticateToken, (req, res) => {
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

export default router;
