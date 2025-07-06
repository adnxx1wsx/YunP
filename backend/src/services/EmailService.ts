import nodemailer from 'nodemailer';
import { log } from '../utils/logger';
import { QueueManager } from './QueueManager';

export interface EmailTemplate {
  subject: string;
  html: string;
  text?: string;
}

export interface EmailOptions {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  template?: string;
  data?: any;
  attachments?: Array<{
    filename: string;
    path?: string;
    content?: Buffer;
    contentType?: string;
  }>;
}

export class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private templates: Map<string, (data: any) => EmailTemplate> = new Map();

  constructor() {
    this.initializeTransporter();
    this.loadTemplates();
  }

  private initializeTransporter(): void {
    if (!process.env.SMTP_HOST) {
      log.warn('SMTP configuration not found, email service disabled');
      return;
    }

    try {
      this.transporter = nodemailer.createTransporter({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
        tls: {
          rejectUnauthorized: false,
        },
      });

      // 验证连接
      this.transporter.verify((error) => {
        if (error) {
          log.error('SMTP connection failed:', error);
          this.transporter = null;
        } else {
          log.info('SMTP connection established successfully');
        }
      });
    } catch (error) {
      log.error('Failed to initialize email transporter:', error);
    }
  }

  private loadTemplates(): void {
    // 欢迎邮件模板
    this.templates.set('welcome', (data: { username: string; loginUrl: string }) => ({
      subject: '欢迎使用 YunP 云盘',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2563eb;">欢迎使用 YunP 云盘！</h1>
          <p>亲爱的 ${data.username}，</p>
          <p>感谢您注册 YunP 云盘服务。您现在可以开始使用我们的云存储服务了。</p>
          <div style="margin: 30px 0;">
            <a href="${data.loginUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              立即登录
            </a>
          </div>
          <p>如果您有任何问题，请随时联系我们的支持团队。</p>
          <p>祝您使用愉快！</p>
          <p>YunP 团队</p>
        </div>
      `,
      text: `欢迎使用 YunP 云盘！\n\n亲爱的 ${data.username}，\n\n感谢您注册 YunP 云盘服务。您现在可以开始使用我们的云存储服务了。\n\n登录地址：${data.loginUrl}\n\n如果您有任何问题，请随时联系我们的支持团队。\n\n祝您使用愉快！\nYunP 团队`
    }));

    // 邮箱验证模板
    this.templates.set('email-verification', (data: { username: string; verificationUrl: string; token: string }) => ({
      subject: '验证您的邮箱地址',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2563eb;">验证您的邮箱地址</h1>
          <p>亲爱的 ${data.username}，</p>
          <p>请点击下面的链接验证您的邮箱地址：</p>
          <div style="margin: 30px 0;">
            <a href="${data.verificationUrl}" style="background-color: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              验证邮箱
            </a>
          </div>
          <p>如果按钮无法点击，请复制以下链接到浏览器：</p>
          <p style="word-break: break-all; color: #6b7280;">${data.verificationUrl}</p>
          <p>此链接将在24小时后过期。</p>
          <p>如果您没有注册 YunP 账户，请忽略此邮件。</p>
          <p>YunP 团队</p>
        </div>
      `,
      text: `验证您的邮箱地址\n\n亲爱的 ${data.username}，\n\n请访问以下链接验证您的邮箱地址：\n${data.verificationUrl}\n\n此链接将在24小时后过期。\n\n如果您没有注册 YunP 账户，请忽略此邮件。\n\nYunP 团队`
    }));

    // 密码重置模板
    this.templates.set('password-reset', (data: { username: string; resetUrl: string }) => ({
      subject: '重置您的密码',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #dc2626;">重置您的密码</h1>
          <p>亲爱的 ${data.username}，</p>
          <p>我们收到了重置您账户密码的请求。请点击下面的链接重置密码：</p>
          <div style="margin: 30px 0;">
            <a href="${data.resetUrl}" style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              重置密码
            </a>
          </div>
          <p>如果按钮无法点击，请复制以下链接到浏览器：</p>
          <p style="word-break: break-all; color: #6b7280;">${data.resetUrl}</p>
          <p>此链接将在1小时后过期。</p>
          <p>如果您没有请求重置密码，请忽略此邮件，您的密码不会被更改。</p>
          <p>YunP 团队</p>
        </div>
      `,
      text: `重置您的密码\n\n亲爱的 ${data.username}，\n\n我们收到了重置您账户密码的请求。请访问以下链接重置密码：\n${data.resetUrl}\n\n此链接将在1小时后过期。\n\n如果您没有请求重置密码，请忽略此邮件，您的密码不会被更改。\n\nYunP 团队`
    }));

    // 文件分享通知模板
    this.templates.set('file-shared', (data: { recipientName: string; senderName: string; fileName: string; shareUrl: string; message?: string }) => ({
      subject: `${data.senderName} 与您分享了文件`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2563eb;">有人与您分享了文件</h1>
          <p>亲爱的 ${data.recipientName}，</p>
          <p>${data.senderName} 与您分享了文件：<strong>${data.fileName}</strong></p>
          ${data.message ? `<p>留言：${data.message}</p>` : ''}
          <div style="margin: 30px 0;">
            <a href="${data.shareUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              查看文件
            </a>
          </div>
          <p>如果按钮无法点击，请复制以下链接到浏览器：</p>
          <p style="word-break: break-all; color: #6b7280;">${data.shareUrl}</p>
          <p>YunP 团队</p>
        </div>
      `,
      text: `有人与您分享了文件\n\n亲爱的 ${data.recipientName}，\n\n${data.senderName} 与您分享了文件：${data.fileName}\n\n${data.message ? `留言：${data.message}\n\n` : ''}查看文件：${data.shareUrl}\n\nYunP 团队`
    }));

    // 存储空间不足警告
    this.templates.set('storage-warning', (data: { username: string; usedPercentage: number; upgradeUrl: string }) => ({
      subject: '存储空间不足警告',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #f59e0b;">存储空间不足警告</h1>
          <p>亲爱的 ${data.username}，</p>
          <p>您的存储空间已使用 ${data.usedPercentage}%，即将用完。</p>
          <p>为了继续使用我们的服务，建议您：</p>
          <ul>
            <li>删除不需要的文件</li>
            <li>清空回收站</li>
            <li>升级到更大的存储计划</li>
          </ul>
          <div style="margin: 30px 0;">
            <a href="${data.upgradeUrl}" style="background-color: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              升级存储计划
            </a>
          </div>
          <p>感谢您使用 YunP 云盘服务。</p>
          <p>YunP 团队</p>
        </div>
      `,
      text: `存储空间不足警告\n\n亲爱的 ${data.username}，\n\n您的存储空间已使用 ${data.usedPercentage}%，即将用完。\n\n为了继续使用我们的服务，建议您：\n- 删除不需要的文件\n- 清空回收站\n- 升级到更大的存储计划\n\n升级地址：${data.upgradeUrl}\n\n感谢您使用 YunP 云盘服务。\n\nYunP 团队`
    }));

    log.info('Email templates loaded successfully');
  }

  // 发送邮件
  async sendEmail(options: EmailOptions): Promise<boolean> {
    if (!this.transporter) {
      log.warn('Email transporter not available, skipping email send');
      return false;
    }

    try {
      let { subject, html, text } = options;

      // 如果指定了模板，使用模板生成内容
      if (options.template && this.templates.has(options.template)) {
        const templateFn = this.templates.get(options.template)!;
        const templateResult = templateFn(options.data || {});
        subject = templateResult.subject;
        html = templateResult.html;
        text = templateResult.text;
      }

      const mailOptions = {
        from: `${process.env.FROM_NAME || 'YunP'} <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
        to: options.to,
        subject,
        html,
        text,
        attachments: options.attachments,
      };

      const result = await this.transporter.sendMail(mailOptions);
      log.info(`Email sent successfully to ${options.to}`, { messageId: result.messageId });
      
      return true;
    } catch (error) {
      log.error(`Failed to send email to ${options.to}:`, error);
      return false;
    }
  }

  // 异步发送邮件（使用队列）
  async sendEmailAsync(options: EmailOptions): Promise<void> {
    await QueueManager.addEmailJob({
      to: options.to,
      subject: options.subject,
      template: options.template || 'custom',
      data: {
        ...options.data,
        html: options.html,
        text: options.text,
        attachments: options.attachments,
      },
    });
  }

  // 批量发送邮件
  async sendBulkEmails(emails: EmailOptions[]): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const email of emails) {
      try {
        await this.sendEmailAsync(email);
        success++;
      } catch (error) {
        log.error(`Failed to queue email to ${email.to}:`, error);
        failed++;
      }
    }

    return { success, failed };
  }

  // 验证邮箱地址格式
  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // 获取邮件服务状态
  getStatus(): { available: boolean; configured: boolean } {
    return {
      available: !!this.transporter,
      configured: !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
    };
  }
}

// 创建全局邮件服务实例
export const emailService = new EmailService();
