# YunP Testing Guide

## 🧪 Testing Overview

This guide covers testing strategies, setup, and execution for the YunP cloud storage system.

## 🛠️ Testing Setup

### Prerequisites
- Node.js 18+
- Docker and Docker Compose
- Git

### Environment Setup
```bash
# Clone the repository
git clone https://github.com/adnxx1wsx/YunP.git
cd YunP

# Install dependencies
npm install

# Setup environment variables
cp backend/.env.example backend/.env
# Edit backend/.env with your configuration

# Start services with Docker
docker-compose up -d
```

## 🔍 Testing Categories

### 1. Unit Tests
Test individual components and functions in isolation.

**Backend Unit Tests:**
```bash
cd backend
npm test
```

**Frontend Unit Tests:**
```bash
cd frontend
npm test
```

### 2. Integration Tests
Test interactions between different components.

```bash
# Run integration tests
npm run test:integration
```

### 3. End-to-End Tests
Test complete user workflows.

```bash
# Run E2E tests
npm run test:e2e
```

### 4. API Tests
Test REST API endpoints.

```bash
# Run API tests
npm run test:api
```

## 📋 Manual Testing Checklist

### 🔐 Authentication Testing

#### User Registration
- [ ] Register with valid email and password
- [ ] Register with invalid email format
- [ ] Register with weak password
- [ ] Register with existing email
- [ ] Email verification flow (if enabled)

#### User Login
- [ ] Login with valid credentials
- [ ] Login with invalid email
- [ ] Login with wrong password
- [ ] Login with unverified email (if verification enabled)
- [ ] JWT token generation and validation

#### Password Reset
- [ ] Request password reset with valid email
- [ ] Request password reset with invalid email
- [ ] Reset password with valid token
- [ ] Reset password with expired token
- [ ] Reset password with invalid token

### 📁 File Management Testing

#### File Upload
- [ ] Upload single file
- [ ] Upload multiple files
- [ ] Upload large files (>100MB)
- [ ] Upload files with special characters in name
- [ ] Upload unsupported file types
- [ ] Upload files exceeding size limit
- [ ] Upload to specific folder
- [ ] Upload progress tracking

#### File Operations
- [ ] Download file
- [ ] Preview file (images, videos, PDFs)
- [ ] Rename file
- [ ] Move file to different folder
- [ ] Copy file
- [ ] Delete file (move to trash)
- [ ] Restore file from trash
- [ ] Permanently delete file

#### File Sharing
- [ ] Create public share link
- [ ] Create password-protected share
- [ ] Set share expiration date
- [ ] Set download limit
- [ ] Access shared file without password
- [ ] Access shared file with correct password
- [ ] Access shared file with wrong password
- [ ] Access expired share
- [ ] Access share after download limit reached

### 📂 Folder Management Testing

#### Folder Operations
- [ ] Create new folder
- [ ] Rename folder
- [ ] Move folder
- [ ] Delete folder
- [ ] Navigate folder hierarchy
- [ ] Upload files to folder
- [ ] Share folder

### ☁️ Cloud Storage Testing

#### Provider Integration
- [ ] Connect OneDrive account
- [ ] Connect Google Drive account
- [ ] Connect Dropbox account
- [ ] Connect AWS S3
- [ ] Connect Azure Blob Storage
- [ ] Upload file to cloud provider
- [ ] Download file from cloud provider
- [ ] Sync files between providers
- [ ] Disconnect provider

### 💰 Billing Testing

#### Subscription Management
- [ ] View available plans
- [ ] Subscribe to paid plan
- [ ] Update subscription
- [ ] Cancel subscription
- [ ] View billing history
- [ ] Download invoices
- [ ] Handle payment failures

### 🏢 Organization Testing

#### Organization Management
- [ ] Create organization
- [ ] Invite members
- [ ] Assign roles (owner, admin, member, viewer)
- [ ] Share files within organization
- [ ] Manage organization storage
- [ ] Remove members
- [ ] Delete organization

### 🔧 Admin Panel Testing

#### System Administration
- [ ] View system statistics
- [ ] Manage users
- [ ] View system logs
- [ ] Monitor queue status
- [ ] Clear cache
- [ ] Update system configuration
- [ ] View performance metrics

## 🚀 Performance Testing

### Load Testing
Test system performance under various loads.

```bash
# Install artillery for load testing
npm install -g artillery

# Run load tests
artillery run tests/load/api-load-test.yml
```

### Stress Testing
Test system limits and breaking points.

```bash
# Run stress tests
artillery run tests/stress/stress-test.yml
```

### File Upload Performance
- [ ] Upload 1MB file
- [ ] Upload 10MB file
- [ ] Upload 100MB file
- [ ] Upload 1GB file
- [ ] Concurrent uploads (10 users)
- [ ] Concurrent uploads (100 users)

## 🔒 Security Testing

### Authentication Security
- [ ] JWT token expiration
- [ ] Token refresh mechanism
- [ ] Session management
- [ ] Password hashing verification
- [ ] Rate limiting on login attempts

### File Security
- [ ] File access permissions
- [ ] Unauthorized file access attempts
- [ ] File type validation
- [ ] Malicious file upload prevention
- [ ] XSS prevention in file names

### API Security
- [ ] SQL injection prevention
- [ ] CSRF protection
- [ ] Rate limiting enforcement
- [ ] Input validation
- [ ] Error message security

## 📱 Cross-Platform Testing

### Browser Compatibility
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile browsers

### Device Testing
- [ ] Desktop (1920x1080)
- [ ] Laptop (1366x768)
- [ ] Tablet (768x1024)
- [ ] Mobile (375x667)

## 🐛 Bug Reporting

### Bug Report Template
```markdown
**Bug Description:**
Brief description of the issue

**Steps to Reproduce:**
1. Step one
2. Step two
3. Step three

**Expected Behavior:**
What should happen

**Actual Behavior:**
What actually happens

**Environment:**
- OS: [e.g., Windows 10, macOS 12.0]
- Browser: [e.g., Chrome 96.0]
- Version: [e.g., v1.0.0]

**Screenshots:**
If applicable, add screenshots

**Additional Context:**
Any other relevant information
```

## 📊 Test Reporting

### Coverage Reports
```bash
# Generate coverage report
npm run test:coverage

# View coverage report
open coverage/index.html
```

### Test Results
- Unit Tests: Target 90%+ coverage
- Integration Tests: All critical paths covered
- E2E Tests: All user workflows tested
- Performance Tests: Response times < 200ms

## 🔄 Continuous Testing

### GitHub Actions
Automated testing runs on:
- Pull requests
- Main branch commits
- Scheduled daily runs

### Test Environments
- **Development**: Local testing
- **Staging**: Pre-production testing
- **Production**: Monitoring and health checks

## 📚 Testing Resources

### Tools Used
- **Jest**: Unit and integration testing
- **Cypress**: End-to-end testing
- **Supertest**: API testing
- **Artillery**: Load testing
- **ESLint**: Code quality
- **Prettier**: Code formatting

### Documentation
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Cypress Documentation](https://docs.cypress.io)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)

---

**Quality Assurance** - Ensuring YunP delivers reliable, secure, and performant cloud storage!
