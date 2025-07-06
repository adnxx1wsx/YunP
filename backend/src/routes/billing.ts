import express from 'express';
import Stripe from 'stripe';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { dbGet, dbAll, dbRun } from '../utils/database';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

// 获取所有订阅计划
router.get('/plans', asyncHandler(async (req, res) => {
  const plans = await dbAll(
    'SELECT * FROM subscription_plans WHERE is_active = 1 ORDER BY price ASC'
  );

  const formattedPlans = plans.map(plan => ({
    ...plan,
    cloud_providers: JSON.parse(plan.cloud_providers || '[]'),
    advanced_sharing: Boolean(plan.advanced_sharing),
    api_access: Boolean(plan.api_access),
    priority_support: Boolean(plan.priority_support),
    custom_branding: Boolean(plan.custom_branding),
    is_active: Boolean(plan.is_active),
  }));

  res.json({
    success: true,
    data: formattedPlans
  });
}));

// 获取用户当前订阅
router.get('/subscription', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;

  const subscription = await dbGet(
    `SELECT us.*, sp.name as plan_name, sp.display_name, sp.price, sp.currency, sp.interval
     FROM user_subscriptions us
     JOIN subscription_plans sp ON us.plan_id = sp.id
     WHERE us.user_id = ? AND us.status = 'active'
     ORDER BY us.created_at DESC
     LIMIT 1`,
    [userId]
  );

  res.json({
    success: true,
    data: subscription
  });
}));

// 创建订阅
router.post('/subscribe', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { planId, paymentMethodId } = req.body;
  const userId = req.user!.id;

  if (!planId || !paymentMethodId) {
    throw createError('Plan ID and payment method are required', 400);
  }

  // 获取计划信息
  const plan = await dbGet(
    'SELECT * FROM subscription_plans WHERE id = ? AND is_active = 1',
    [planId]
  );

  if (!plan) {
    throw createError('Plan not found', 404);
  }

  // 获取用户信息
  const user = await dbGet(
    'SELECT * FROM users WHERE id = ?',
    [userId]
  );

  try {
    // 创建或获取 Stripe 客户
    let customerId = user.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.username,
        metadata: {
          userId: userId
        }
      });
      customerId = customer.id;

      // 更新用户的 Stripe 客户 ID
      await dbRun(
        'UPDATE users SET stripe_customer_id = ? WHERE id = ?',
        [customerId, userId]
      );
    }

    // 附加支付方式到客户
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });

    // 设置为默认支付方式
    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    // 创建 Stripe 价格对象（如果不存在）
    let stripePriceId = plan.stripe_price_id;
    if (!stripePriceId) {
      const price = await stripe.prices.create({
        unit_amount: Math.round(plan.price * 100), // 转换为分
        currency: plan.currency.toLowerCase(),
        recurring: {
          interval: plan.interval as 'month' | 'year',
        },
        product_data: {
          name: plan.display_name,
          description: plan.description,
        },
      });
      stripePriceId = price.id;

      // 更新计划的 Stripe 价格 ID
      await dbRun(
        'UPDATE subscription_plans SET stripe_price_id = ? WHERE id = ?',
        [stripePriceId, planId]
      );
    }

    // 创建订阅
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: stripePriceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
    });

    // 保存订阅到数据库
    const subscriptionId = uuidv4();
    const currentPeriodStart = new Date(subscription.current_period_start * 1000);
    const currentPeriodEnd = new Date(subscription.current_period_end * 1000);

    await dbRun(
      `INSERT INTO user_subscriptions 
       (id, user_id, plan_id, status, current_period_start, current_period_end, stripe_subscription_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        subscriptionId,
        userId,
        planId,
        subscription.status,
        currentPeriodStart,
        currentPeriodEnd,
        subscription.id
      ]
    );

    // 更新用户存储限制
    await dbRun(
      'UPDATE users SET storage_limit = ? WHERE id = ?',
      [plan.storage_limit, userId]
    );

    const latestInvoice = subscription.latest_invoice as Stripe.Invoice;
    const paymentIntent = latestInvoice.payment_intent as Stripe.PaymentIntent;

    res.json({
      success: true,
      data: {
        subscriptionId: subscription.id,
        clientSecret: paymentIntent.client_secret,
        status: subscription.status
      }
    });
  } catch (error: any) {
    console.error('Subscription creation error:', error);
    throw createError(error.message || 'Failed to create subscription', 500);
  }
}));

// 取消订阅
router.post('/cancel', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { immediate = false } = req.body;
  const userId = req.user!.id;

  // 获取当前订阅
  const subscription = await dbGet(
    'SELECT * FROM user_subscriptions WHERE user_id = ? AND status = "active" ORDER BY created_at DESC LIMIT 1',
    [userId]
  );

  if (!subscription) {
    throw createError('No active subscription found', 404);
  }

  try {
    if (immediate) {
      // 立即取消
      await stripe.subscriptions.cancel(subscription.stripe_subscription_id);
      
      await dbRun(
        'UPDATE user_subscriptions SET status = "canceled", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [subscription.id]
      );
    } else {
      // 在当前计费周期结束时取消
      await stripe.subscriptions.update(subscription.stripe_subscription_id, {
        cancel_at_period_end: true,
      });

      await dbRun(
        'UPDATE user_subscriptions SET cancel_at_period_end = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [subscription.id]
      );
    }

    res.json({
      success: true,
      message: immediate ? 'Subscription canceled immediately' : 'Subscription will be canceled at the end of the current period'
    });
  } catch (error: any) {
    console.error('Subscription cancellation error:', error);
    throw createError(error.message || 'Failed to cancel subscription', 500);
  }
}));

// 恢复订阅
router.post('/resume', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;

  // 获取当前订阅
  const subscription = await dbGet(
    'SELECT * FROM user_subscriptions WHERE user_id = ? AND status = "active" AND cancel_at_period_end = 1 ORDER BY created_at DESC LIMIT 1',
    [userId]
  );

  if (!subscription) {
    throw createError('No subscription to resume found', 404);
  }

  try {
    // 恢复订阅
    await stripe.subscriptions.update(subscription.stripe_subscription_id, {
      cancel_at_period_end: false,
    });

    await dbRun(
      'UPDATE user_subscriptions SET cancel_at_period_end = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [subscription.id]
    );

    res.json({
      success: true,
      message: 'Subscription resumed successfully'
    });
  } catch (error: any) {
    console.error('Subscription resume error:', error);
    throw createError(error.message || 'Failed to resume subscription', 500);
  }
}));

// 获取账单历史
router.get('/invoices', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { limit = 10, offset = 0 } = req.query;

  // 获取用户的 Stripe 客户 ID
  const user = await dbGet(
    'SELECT stripe_customer_id FROM users WHERE id = ?',
    [userId]
  );

  if (!user?.stripe_customer_id) {
    return res.json({
      success: true,
      data: []
    });
  }

  try {
    const invoices = await stripe.invoices.list({
      customer: user.stripe_customer_id,
      limit: parseInt(limit as string),
      starting_after: offset ? undefined : undefined, // Stripe 使用游标分页
    });

    const formattedInvoices = invoices.data.map(invoice => ({
      id: invoice.id,
      amount: invoice.amount_paid,
      currency: invoice.currency,
      status: invoice.status,
      created: new Date(invoice.created * 1000),
      paidAt: invoice.status_transitions.paid_at ? new Date(invoice.status_transitions.paid_at * 1000) : null,
      invoiceUrl: invoice.hosted_invoice_url,
      invoicePdf: invoice.invoice_pdf,
    }));

    res.json({
      success: true,
      data: formattedInvoices
    });
  } catch (error: any) {
    console.error('Invoice retrieval error:', error);
    throw createError(error.message || 'Failed to retrieve invoices', 500);
  }
}));

// Stripe Webhook 处理
router.post('/webhook', express.raw({ type: 'application/json' }), asyncHandler(async (req, res) => {
  const sig = req.headers['stripe-signature'] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (error: any) {
    console.error('Webhook signature verification failed:', error.message);
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  // 处理事件
  switch (event.type) {
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      const subscription = event.data.object as Stripe.Subscription;
      await handleSubscriptionChange(subscription);
      break;

    case 'invoice.payment_succeeded':
      const invoice = event.data.object as Stripe.Invoice;
      await handlePaymentSucceeded(invoice);
      break;

    case 'invoice.payment_failed':
      const failedInvoice = event.data.object as Stripe.Invoice;
      await handlePaymentFailed(failedInvoice);
      break;

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  res.json({ received: true });
}));

// 辅助函数
async function handleSubscriptionChange(subscription: Stripe.Subscription): Promise<void> {
  try {
    const currentPeriodStart = new Date(subscription.current_period_start * 1000);
    const currentPeriodEnd = new Date(subscription.current_period_end * 1000);

    await dbRun(
      `UPDATE user_subscriptions 
       SET status = ?, current_period_start = ?, current_period_end = ?, 
           cancel_at_period_end = ?, updated_at = CURRENT_TIMESTAMP
       WHERE stripe_subscription_id = ?`,
      [
        subscription.status,
        currentPeriodStart,
        currentPeriodEnd,
        subscription.cancel_at_period_end,
        subscription.id
      ]
    );
  } catch (error) {
    console.error('Error handling subscription change:', error);
  }
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
  try {
    // 可以在这里添加支付成功后的逻辑，比如发送确认邮件
    console.log(`Payment succeeded for invoice: ${invoice.id}`);
  } catch (error) {
    console.error('Error handling payment succeeded:', error);
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  try {
    // 可以在这里添加支付失败后的逻辑，比如发送提醒邮件
    console.log(`Payment failed for invoice: ${invoice.id}`);
  } catch (error) {
    console.error('Error handling payment failed:', error);
  }
}

export default router;
