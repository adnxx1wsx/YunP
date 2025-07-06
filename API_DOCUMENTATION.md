# YunP Cloud Storage API Documentation

## 🚀 Overview

YunP provides a comprehensive RESTful API for cloud storage management, supporting file operations, user management, multi-cloud integration, and administrative functions.

**Base URL**: `http://localhost:3001/api`

## 🔐 Authentication

All API endpoints (except public ones) require authentication using JWT tokens.

### Headers
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

## 📚 API Endpoints

### 🔑 Authentication Endpoints

#### POST /auth/register
Register a new user account.

**Request Body:**
```json
{
  "username": "string",
  "email": "string",
  "password": "string"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "string",
      "username": "string",
      "email": "string"
    },
    "token": "string"
  }
}
```

#### POST /auth/login
Authenticate user and get access token.

**Request Body:**
```json
{
  "email": "string",
  "password": "string"
}
```

#### POST /auth/logout
Logout current user session.

#### POST /auth/refresh
Refresh JWT token.

#### POST /auth/forgot-password
Request password reset email.

#### POST /auth/reset-password
Reset password with token.

### 👤 User Management

#### GET /users/profile
Get current user profile.

#### PUT /users/profile
Update user profile.

#### GET /users/storage-usage
Get user storage usage statistics.

#### GET /users/activity
Get user activity history.

### 📁 File Management

#### GET /files
List user files with pagination and filtering.

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20)
- `search`: Search query
- `type`: File type filter
- `folder`: Folder ID filter

#### POST /files/upload
Upload single or multiple files.

**Content-Type**: `multipart/form-data`

#### GET /files/:id
Get file details.

#### GET /files/:id/download
Download file.

#### PUT /files/:id
Update file metadata.

#### DELETE /files/:id
Delete file (move to trash).

#### POST /files/:id/copy
Copy file to another location.

#### POST /files/:id/move
Move file to another location.

#### POST /files/:id/share
Create file share link.

#### GET /files/:id/preview
Get file preview (for supported formats).

### 📂 Folder Management

#### GET /folders
List folders.

#### POST /folders
Create new folder.

#### GET /folders/:id
Get folder details.

#### PUT /folders/:id
Update folder.

#### DELETE /folders/:id
Delete folder.

#### GET /folders/:id/contents
Get folder contents.

### 🗑️ Trash Management

#### GET /trash
List deleted files.

#### POST /trash/:id/restore
Restore file from trash.

#### DELETE /trash/:id
Permanently delete file.

#### DELETE /trash/empty
Empty trash completely.

### 🔗 File Sharing

#### GET /shares
List user's shared files.

#### POST /shares
Create new share.

#### GET /shares/:id
Get share details.

#### PUT /shares/:id
Update share settings.

#### DELETE /shares/:id
Delete share.

#### GET /public/:shareId
Access public shared file.

### ☁️ Storage Providers

#### GET /storage/providers
List available storage providers.

#### POST /storage/providers/:provider/connect
Connect to storage provider.

#### GET /storage/providers/:provider/auth
Get provider authorization URL.

#### POST /storage/providers/:provider/callback
Handle OAuth callback.

#### DELETE /storage/providers/:provider/disconnect
Disconnect storage provider.

#### GET /storage/quota
Get storage quota information.

### 💰 Billing & Subscriptions

#### GET /billing/plans
List available subscription plans.

#### GET /billing/subscription
Get current subscription.

#### POST /billing/subscribe
Create new subscription.

#### PUT /billing/subscription
Update subscription.

#### DELETE /billing/subscription
Cancel subscription.

#### GET /billing/invoices
List billing invoices.

#### GET /billing/usage
Get usage statistics.

### 🏢 Organization Management

#### GET /organizations
List user organizations.

#### POST /organizations
Create new organization.

#### GET /organizations/:id
Get organization details.

#### PUT /organizations/:id
Update organization.

#### DELETE /organizations/:id
Delete organization.

#### GET /organizations/:id/members
List organization members.

#### POST /organizations/:id/invite
Invite member to organization.

#### PUT /organizations/:id/members/:userId
Update member role.

#### DELETE /organizations/:id/members/:userId
Remove member from organization.

### 🔧 Admin Endpoints

#### GET /admin/stats
Get system statistics.

#### GET /admin/users
List all users (admin only).

#### GET /admin/users/:id
Get user details (admin only).

#### PUT /admin/users/:id
Update user (admin only).

#### DELETE /admin/users/:id
Delete user (admin only).

#### GET /admin/logs
Get system logs.

#### GET /admin/queues
Get queue status.

#### POST /admin/queues/clean
Clean completed jobs.

#### GET /admin/cache
Get cache statistics.

#### DELETE /admin/cache
Clear cache.

#### GET /admin/config
Get system configuration.

#### PUT /admin/config/:key
Update configuration value.

## 📊 Response Format

### Success Response
```json
{
  "success": true,
  "data": {
    // Response data
  },
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {
    // Additional error details
  }
}
```

## 🔍 Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `413` - Payload Too Large
- `429` - Too Many Requests
- `500` - Internal Server Error

## 🚦 Rate Limiting

API endpoints are rate limited to prevent abuse:

- **General API**: 1000 requests per 15 minutes per IP
- **Authentication**: 10 requests per 15 minutes per IP
- **File Upload**: 100 requests per hour per IP
- **File Download**: 500 requests per hour per IP

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Request limit
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Reset time

## 📝 Examples

### Upload File
```bash
curl -X POST \
  http://localhost:3001/api/files/upload \
  -H "Authorization: Bearer <token>" \
  -F "file=@document.pdf" \
  -F "folderId=folder123"
```

### Create Share Link
```bash
curl -X POST \
  http://localhost:3001/api/files/file123/share \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "expiresAt": "2024-12-31T23:59:59Z",
    "password": "secret123",
    "downloadLimit": 10
  }'
```

### Get User Files
```bash
curl -X GET \
  "http://localhost:3001/api/files?page=1&limit=20&search=document" \
  -H "Authorization: Bearer <token>"
```

## 🔒 Security Considerations

1. **Always use HTTPS** in production
2. **Store JWT tokens securely** (httpOnly cookies recommended)
3. **Validate file types** before upload
4. **Implement proper CORS** settings
5. **Monitor rate limits** and suspicious activity
6. **Use strong passwords** and enable 2FA when available

## 📞 Support

For API support and questions:
- Documentation: [GitHub Repository](https://github.com/adnxx1wsx/YunP)
- Issues: [GitHub Issues](https://github.com/adnxx1wsx/YunP/issues)
- Email: support@yunp.com

---

**YunP API** - Powerful, secure, and scalable cloud storage API
