/**
 * ClawSocial Notification Service
 * 
 * Sends notifications via Telegram, Discord, or custom webhooks
 * when actions complete, errors occur, or rate limits are exceeded.
 */

import { log } from '../utils/logger.js';
import type {
  NotificationConfig,
  NotificationPayload,
  NotificationChannel,
  NotificationEvent,
  Platform,
  ActionType,
} from '../types/index.js';

// ============================================================================
// Notification Templates
// ============================================================================

interface TemplateData {
  platform: Platform;
  action: ActionType;
  success: boolean;
  target?: string;
  error?: string;
  details?: Record<string, unknown>;
  brandFooter: string;
}

const PLATFORM_EMOJI: Record<Platform, string> = {
  linkedin: '🔗',
  instagram: '📸',
  twitter: '🐦',
};

const ACTION_LABELS: Record<ActionType, string> = {
  like: 'LIKE',
  comment: 'COMMENT',
  follow: 'FOLLOW',
  unfollow: 'UNFOLLOW',
  dm: 'DM',
  post: 'POST',
  retweet: 'RETWEET',
  reply: 'REPLY',
  connect: 'CONNECT SENT',
  view_story: 'STORY VIEW',
  view_profile: 'PROFILE VIEW',
};

function formatNotification(data: TemplateData): string {
  const emoji = PLATFORM_EMOJI[data.platform] || '🤖';
  const actionLabel = ACTION_LABELS[data.action] || data.action.toUpperCase();
  const platformName = data.platform.toUpperCase();
  const status = data.success ? '✅' : '❌';
  
  const lines: string[] = [];
  
  // Header
  lines.push(`${emoji} **${platformName} ${actionLabel}** ${status}`);
  lines.push('');
  
  // Target/Profile
  if (data.target) {
    if (data.action === 'connect' || data.action === 'follow' || data.action === 'unfollow') {
      lines.push(`**Profile:** ${extractProfileName(data.target)}`);
      lines.push(`**URL:** ${data.target}`);
    } else if (data.action === 'like' || data.action === 'comment') {
      lines.push(`**Post:** ${data.target}`);
    } else if (data.action === 'dm') {
      lines.push(`**To:** ${data.target}`);
    } else {
      lines.push(`**Target:** ${data.target}`);
    }
  }
  
  // Details (degree, method, etc.)
  if (data.details) {
    if (data.details.degree) {
      lines.push(`**Degree:** ${data.details.degree}`);
    }
    
    // Flow section for connect actions
    if (data.action === 'connect' && data.success) {
      lines.push('');
      lines.push('**Flow:**');
      lines.push('• ✅ Profile loaded');
      if (data.details.method === 'direct') {
        lines.push('• ✅ Button detection: Direct Connect');
        lines.push('• ✅ Method: Direct click');
      } else if (data.details.method === 'more_dropdown') {
        lines.push('• ✅ Button detection: Follow + More (no direct Connect)');
        lines.push('• ✅ Method: More dropdown → Connect');
      }
      lines.push('• ✅ Connection request sent');
    }
    
    // Comment text
    if (data.details.commentText) {
      lines.push(`**Comment:** "${data.details.commentText}"`);
    }
  }
  
  // Error message
  if (!data.success && data.error) {
    lines.push('');
    lines.push(`**Error:** ${data.error}`);
  }
  
  // Footer
  lines.push('');
  lines.push(data.brandFooter);
  
  return lines.join('\n');
}

function extractProfileName(url: string): string {
  const match = url.match(/linkedin\.com\/in\/([^\/\?]+)/);
  if (match) return match[1];
  const igMatch = url.match(/instagram\.com\/([^\/\?]+)/);
  if (igMatch) return `@${igMatch[1]}`;
  const twMatch = url.match(/(?:twitter|x)\.com\/([^\/\?]+)/);
  if (twMatch) return `@${twMatch[1]}`;
  return url;
}

// ============================================================================
// Notification Sender
// ============================================================================

export class Notifier {
  private config: NotificationConfig;
  
  constructor(config: NotificationConfig) {
    this.config = config;
  }
  
  isEnabled(): boolean {
    return this.config.enabled;
  }
  
  isEventEnabled(event: NotificationEvent): boolean {
    return this.config.enabled && this.config.events[event];
  }
  
  getChannels(): NotificationChannel[] {
    const channels: NotificationChannel[] = [];
    if (this.config.channels.telegram) channels.push('telegram');
    if (this.config.channels.discord) channels.push('discord');
    if (this.config.channels.webhook) channels.push('webhook');
    return channels;
  }
  
  updateConfig(config: Partial<NotificationConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  getConfig(): NotificationConfig {
    return this.config;
  }
  
  async notify(payload: NotificationPayload): Promise<boolean> {
    if (!this.isEventEnabled(payload.event)) {
      log.debug('Notification skipped - event disabled', { event: payload.event });
      return false;
    }
    
    const message = formatNotification({
      platform: payload.platform,
      action: payload.action,
      success: payload.success,
      target: payload.target,
      error: payload.error,
      details: payload.details,
      brandFooter: this.config.brandFooter || '*ClawSocial Automation*',
    });
    
    return this.broadcast(message);
  }
  
  async broadcast(message: string): Promise<boolean> {
    if (!this.config.enabled) {
      log.debug('Notifications disabled, skipping broadcast');
      return false;
    }
    
    const results: boolean[] = [];
    
    if (this.config.channels.telegram) {
      results.push(await this.sendTelegram(message));
    }
    if (this.config.channels.discord) {
      results.push(await this.sendDiscord(message));
    }
    if (this.config.channels.webhook) {
      results.push(await this.sendWebhook(message));
    }
    
    return results.some(r => r);
  }
  
  async send(channel: NotificationChannel, message: string): Promise<boolean> {
    switch (channel) {
      case 'telegram':
        return this.sendTelegram(message);
      case 'discord':
        return this.sendDiscord(message);
      case 'webhook':
        return this.sendWebhook(message);
      default:
        log.error(`Unknown notification channel: ${channel}`);
        return false;
    }
  }
  
  async sendTest(channel?: NotificationChannel): Promise<boolean> {
    const testMessage = `🧪 **NOTIFICATION TEST**

This is a test notification from ClawSocial.

**Status:** ✅ Working
**Timestamp:** ${new Date().toISOString()}

${this.config.brandFooter || '*ClawSocial Automation*'}`;
    
    if (channel) {
      return this.send(channel, testMessage);
    }
    return this.broadcast(testMessage);
  }
  
  private async sendTelegram(message: string): Promise<boolean> {
    const cfg = this.config.channels.telegram;
    if (!cfg) return false;
    
    try {
      const url = `https://api.telegram.org/bot${cfg.botToken}/sendMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: cfg.chatId,
          text: message,
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
        }),
      });
      
      if (!response.ok) {
        const error = await response.text();
        log.error('Telegram notification failed', { status: response.status, error });
        return false;
      }
      
      log.debug('Telegram notification sent');
      return true;
    } catch (error) {
      log.error('Telegram notification error', { error: String(error) });
      return false;
    }
  }
  
  private async sendDiscord(message: string): Promise<boolean> {
    const cfg = this.config.channels.discord;
    if (!cfg) return false;
    
    try {
      const response = await fetch(cfg.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: message }),
      });
      
      if (!response.ok) {
        const error = await response.text();
        log.error('Discord notification failed', { status: response.status, error });
        return false;
      }
      
      log.debug('Discord notification sent');
      return true;
    } catch (error) {
      log.error('Discord notification error', { error: String(error) });
      return false;
    }
  }
  
  private async sendWebhook(message: string): Promise<boolean> {
    const cfg = this.config.channels.webhook;
    if (!cfg) return false;
    
    try {
      const response = await fetch(cfg.url, {
        method: cfg.method || 'POST',
        headers: { 'Content-Type': 'application/json', ...cfg.headers },
        body: JSON.stringify({ message, timestamp: Date.now(), source: 'clawsocial' }),
      });
      
      if (!response.ok) {
        const error = await response.text();
        log.error('Webhook notification failed', { status: response.status, error });
        return false;
      }
      
      log.debug('Webhook notification sent');
      return true;
    } catch (error) {
      log.error('Webhook notification error', { error: String(error) });
      return false;
    }
  }
}

let notifierInstance: Notifier | null = null;

export function initNotifier(config: NotificationConfig): Notifier {
  notifierInstance = new Notifier(config);
  return notifierInstance;
}

export function getNotifier(): Notifier | null {
  return notifierInstance;
}
