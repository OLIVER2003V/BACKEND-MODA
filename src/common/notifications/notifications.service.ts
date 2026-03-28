import { Injectable, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { envs } from 'src/config/envs';

export interface SendNotificationDto {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
}

export interface SendMulticastNotificationDto {
  tokens: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
}

export interface NotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface MulticastResult {
  successCount: number;
  failureCount: number;
  results: NotificationResult[];
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private initialized = false;

  constructor() {
    this.initializeFirebase();
  }

  private initializeFirebase(): void {
    const { firebase } = envs;

    if (!firebase.keyFilePath) {
      this.logger.warn('Firebase credentials not configured. Notifications service will not work.');
      return;
    }

    try {
      if (admin.apps.length === 0) {
        admin.initializeApp({
          credential: admin.credential.cert(firebase.keyFilePath),
        });
      }

      this.initialized = true;
      this.logger.log('Firebase initialized successfully');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown Firebase initialization error';
      this.logger.warn(
        `Firebase credentials are invalid or unreadable. Notifications service will be disabled. ${message}`,
      );
      this.initialized = false;
    }
  }

  async sendNotification(dto: SendNotificationDto): Promise<NotificationResult> {
    if (!this.initialized) {
      throw new Error('Notifications service is not configured');
    }

    const message: admin.messaging.Message = {
      token: dto.token,
      notification: {
        title: dto.title,
        body: dto.body,
        imageUrl: dto.imageUrl,
      },
      data: dto.data,
    };

    try {
      const messageId = await admin.messaging().send(message);
      this.logger.log(`Notification sent: ${messageId}`);
      return { success: true, messageId };
    } catch (error) {
      this.logger.error(`Failed to send notification: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async sendMulticastNotification(dto: SendMulticastNotificationDto): Promise<MulticastResult> {
    if (!this.initialized) {
      throw new Error('Notifications service is not configured');
    }

    const message: admin.messaging.MulticastMessage = {
      tokens: dto.tokens,
      notification: {
        title: dto.title,
        body: dto.body,
        imageUrl: dto.imageUrl,
      },
      data: dto.data,
    };

    try {
      const response = await admin.messaging().sendEachForMulticast(message);

      const results: NotificationResult[] = response.responses.map((resp) => ({
        success: resp.success,
        messageId: resp.messageId,
        error: resp.error?.message,
      }));

      this.logger.log(`Multicast sent: ${response.successCount} success, ${response.failureCount} failed`);

      return {
        successCount: response.successCount,
        failureCount: response.failureCount,
        results,
      };
    } catch (error) {
      this.logger.error(`Failed to send multicast notification: ${error.message}`);
      throw error;
    }
  }

  async sendToTopic(
    topic: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<NotificationResult> {
    if (!this.initialized) {
      throw new Error('Notifications service is not configured');
    }

    const message: admin.messaging.Message = {
      topic,
      notification: {
        title,
        body,
      },
      data,
    };

    try {
      const messageId = await admin.messaging().send(message);
      this.logger.log(`Topic notification sent to ${topic}: ${messageId}`);
      return { success: true, messageId };
    } catch (error) {
      this.logger.error(`Failed to send topic notification: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async subscribeToTopic(tokens: string[], topic: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('Notifications service is not configured');
    }

    await admin.messaging().subscribeToTopic(tokens, topic);
    this.logger.log(`Subscribed ${tokens.length} tokens to topic: ${topic}`);
  }

  async unsubscribeFromTopic(tokens: string[], topic: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('Notifications service is not configured');
    }

    await admin.messaging().unsubscribeFromTopic(tokens, topic);
    this.logger.log(`Unsubscribed ${tokens.length} tokens from topic: ${topic}`);
  }
}
