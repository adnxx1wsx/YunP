import { dbRun, dbGet } from '../utils/database';
import { v4 as uuidv4 } from 'uuid';

const defaultPlans = [
  {
    name: 'free',
    displayName: '免费版',
    description: '适合个人用户的基础存储服务',
    price: 0,
    currency: 'USD',
    interval: 'month',
    storageLimit: 5 * 1024 * 1024 * 1024, // 5GB
    maxFileSize: 100 * 1024 * 1024, // 100MB
    maxFiles: 1000,
    cloudProviders: JSON.stringify(['local']),
    advancedSharing: false,
    apiAccess: false,
    prioritySupport: false,
    customBranding: false,
  },
  {
    name: 'basic',
    displayName: '基础版',
    description: '适合小团队的增强存储服务',
    price: 9.99,
    currency: 'USD',
    interval: 'month',
    storageLimit: 100 * 1024 * 1024 * 1024, // 100GB
    maxFileSize: 1024 * 1024 * 1024, // 1GB
    maxFiles: 10000,
    cloudProviders: JSON.stringify(['local', 'onedrive', 'googledrive']),
    advancedSharing: true,
    apiAccess: false,
    prioritySupport: false,
    customBranding: false,
  },
  {
    name: 'pro',
    displayName: '专业版',
    description: '适合中型团队的专业存储服务',
    price: 29.99,
    currency: 'USD',
    interval: 'month',
    storageLimit: 1024 * 1024 * 1024 * 1024, // 1TB
    maxFileSize: 5 * 1024 * 1024 * 1024, // 5GB
    maxFiles: 100000,
    cloudProviders: JSON.stringify(['local', 'onedrive', 'googledrive', 'dropbox', 'aws-s3']),
    advancedSharing: true,
    apiAccess: true,
    prioritySupport: true,
    customBranding: false,
  },
  {
    name: 'enterprise',
    displayName: '企业版',
    description: '适合大型企业的完整存储解决方案',
    price: 99.99,
    currency: 'USD',
    interval: 'month',
    storageLimit: 10 * 1024 * 1024 * 1024 * 1024, // 10TB
    maxFileSize: 50 * 1024 * 1024 * 1024, // 50GB
    maxFiles: 1000000,
    cloudProviders: JSON.stringify(['local', 'onedrive', 'googledrive', 'dropbox', 'aws-s3', 'azure-blob']),
    advancedSharing: true,
    apiAccess: true,
    prioritySupport: true,
    customBranding: true,
  },
];

export async function initSubscriptionPlans(): Promise<void> {
  console.log('Initializing subscription plans...');

  for (const plan of defaultPlans) {
    try {
      // 检查计划是否已存在
      const existingPlan = await dbGet(
        'SELECT id FROM subscription_plans WHERE name = ?',
        [plan.name]
      );

      if (!existingPlan) {
        const planId = uuidv4();
        await dbRun(
          `INSERT INTO subscription_plans (
            id, name, display_name, description, price, currency, interval,
            storage_limit, max_file_size, max_files, cloud_providers,
            advanced_sharing, api_access, priority_support, custom_branding
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            planId,
            plan.name,
            plan.displayName,
            plan.description,
            plan.price,
            plan.currency,
            plan.interval,
            plan.storageLimit,
            plan.maxFileSize,
            plan.maxFiles,
            plan.cloudProviders,
            plan.advancedSharing,
            plan.apiAccess,
            plan.prioritySupport,
            plan.customBranding,
          ]
        );

        console.log(`Created plan: ${plan.displayName}`);
      } else {
        console.log(`Plan already exists: ${plan.displayName}`);
      }
    } catch (error) {
      console.error(`Error creating plan ${plan.name}:`, error);
    }
  }

  console.log('Subscription plans initialization completed');
}

// 如果直接运行此脚本
if (require.main === module) {
  import('../utils/database').then(({ initDatabase }) => {
    initDatabase()
      .then(() => initSubscriptionPlans())
      .then(() => {
        console.log('All done!');
        process.exit(0);
      })
      .catch((error) => {
        console.error('Error:', error);
        process.exit(1);
      });
  });
}
