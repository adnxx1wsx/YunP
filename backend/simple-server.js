const express = require('express');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

// 加载环境变量
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// 数据库连接
const db = new sqlite3.Database('./database.sqlite', (err) => {
  if (err) {
    console.error('❌ 数据库连接失败:', err.message);
  } else {
    console.log('✅ 数据库连接成功');
  }
});

// 文件上传配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueId = uuidv4();
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueId}${ext}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

// 认证中间件
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// 路由

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'YunP Backend is running!',
    timestamp: new Date().toISOString()
  });
});

// 用户注册
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Username, email and password are required' 
      });
    }

    // 检查用户是否已存在
    db.get('SELECT id FROM users WHERE email = ? OR username = ?', [email, username], async (err, row) => {
      if (err) {
        return res.status(500).json({ success: false, error: 'Database error' });
      }
      
      if (row) {
        return res.status(400).json({ success: false, error: 'User already exists' });
      }

      // 创建新用户
      const hashedPassword = await bcrypt.hash(password, 10);
      const userId = uuidv4();
      
      db.run(
        `INSERT INTO users (id, username, email, password, created_at) 
         VALUES (?, ?, ?, ?, datetime('now'))`,
        [userId, username, email, hashedPassword],
        function(err) {
          if (err) {
            return res.status(500).json({ success: false, error: 'Failed to create user' });
          }
          
          const token = jwt.sign({ id: userId, username, email }, JWT_SECRET, { expiresIn: '7d' });
          
          res.json({
            success: true,
            message: 'User registered successfully',
            data: {
              user: { id: userId, username, email },
              token
            }
          });
        }
      );
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// 用户登录
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email and password are required' 
      });
    }

    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
      if (err) {
        return res.status(500).json({ success: false, error: 'Database error' });
      }
      
      if (!user) {
        return res.status(401).json({ success: false, error: 'Invalid credentials' });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ success: false, error: 'Invalid credentials' });
      }

      const token = jwt.sign(
        { id: user.id, username: user.username, email: user.email }, 
        JWT_SECRET, 
        { expiresIn: '7d' }
      );
      
      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: { 
            id: user.id, 
            username: user.username, 
            email: user.email,
            role: user.role 
          },
          token
        }
      });
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// 获取用户信息
app.get('/api/users/me', authenticateToken, (req, res) => {
  db.get('SELECT id, username, email, role, created_at FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err) {
      return res.status(500).json({ success: false, error: 'Database error' });
    }
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({
      success: true,
      data: user
    });
  });
});

// 文件上传
app.post('/api/files/upload', authenticateToken, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const fileId = uuidv4();
    const { originalname, filename, size, mimetype } = req.file;
    
    db.run(
      `INSERT INTO files (id, name, original_name, size, mime_type, storage_path, user_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [fileId, filename, originalname, size, mimetype, `./uploads/${filename}`, req.user.id],
      function(err) {
        if (err) {
          console.error('File save error:', err);
          return res.status(500).json({ success: false, error: 'Failed to save file' });
        }
        
        res.json({
          success: true,
          message: 'File uploaded successfully',
          data: {
            id: fileId,
            name: filename,
            originalName: originalname,
            size,
            mimeType: mimetype
          }
        });
      }
    );
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// 获取文件列表
app.get('/api/files', authenticateToken, (req, res) => {
  db.all(
    'SELECT id, name, original_name, size, mime_type, created_at FROM files WHERE user_id = ? ORDER BY created_at DESC',
    [req.user.id],
    (err, files) => {
      if (err) {
        return res.status(500).json({ success: false, error: 'Database error' });
      }
      
      res.json({
        success: true,
        data: { files, folders: [] }
      });
    }
  );
});

// 文件下载
app.get('/api/files/:id/download', authenticateToken, (req, res) => {
  const { id } = req.params;
  
  db.get('SELECT * FROM files WHERE id = ? AND user_id = ?', [id, req.user.id], (err, file) => {
    if (err) {
      return res.status(500).json({ success: false, error: 'Database error' });
    }
    
    if (!file) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }

    const filePath = path.join(__dirname, file.storage_path);
    res.download(filePath, file.original_name);
  });
});

// 前端路由处理
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    success: false, 
    error: 'Internal server error' 
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log('');
  console.log('🚀 YunP 云存储平台启动成功!');
  console.log('================================');
  console.log(`📡 服务器地址: http://localhost:${PORT}`);
  console.log(`🗄️ 数据库: SQLite`);
  console.log(`📁 上传目录: ./uploads`);
  console.log('');
  console.log('📝 默认管理员账户:');
  console.log('   邮箱: admin@yunp.com');
  console.log('   密码: admin123');
  console.log('');
  console.log('⚠️  首次使用请及时修改管理员密码!');
  console.log('================================');
});
