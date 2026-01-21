import amqp from 'amqplib';
import { generateEventId } from '@shared/utils';
import { Event } from '@shared/events';

// Environment prefix for exchange namespacing (dev/prod isolation)
const ENV_PREFIX = process.env.NODE_ENV === 'production' ? 'prod' : 'dev';
const RECONNECT_DELAY = 5000; // 5초 후 재연결

class EventPublisher {
  private connection: Awaited<ReturnType<typeof amqp.connect>> | null = null;
  private channel: Awaited<ReturnType<Awaited<ReturnType<typeof amqp.connect>>['createChannel']>> | null = null;
  private readonly exchangeName = `msa-events-${ENV_PREFIX}`;
  private isReconnecting = false;

  async connect() {
    try {
      const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://admin:admin@localhost:5672';
      this.connection = await amqp.connect(rabbitmqUrl);
      this.channel = await this.connection.createChannel();

      // Exchange 생성 (fanout: 모든 구독자에게 브로드캐스트)
      await this.channel.assertExchange(this.exchangeName, 'topic', { durable: true });

      // 연결 끊김 감지 및 자동 재연결
      this.connection.on('close', () => {
        console.warn('⚠️ RabbitMQ connection closed');
        this.channel = null;
        this.connection = null;
        this.scheduleReconnect();
      });

      this.connection.on('error', (err) => {
        console.error('❌ RabbitMQ connection error:', err.message);
      });

      this.channel.on('close', () => {
        console.warn('⚠️ RabbitMQ channel closed');
        this.channel = null;
      });

      this.channel.on('error', (err) => {
        console.error('❌ RabbitMQ channel error:', err.message);
      });

      this.isReconnecting = false;
      console.info('✅ RabbitMQ connected');
    } catch (error) {
      console.error('❌ RabbitMQ connection failed:', error);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.isReconnecting) return;
    this.isReconnecting = true;
    console.info(`🔄 RabbitMQ reconnecting in ${RECONNECT_DELAY / 1000}s...`);
    setTimeout(() => this.connect(), RECONNECT_DELAY);
  }

  async publish(event: Omit<Event, 'eventId' | 'timestamp' | 'version'>): Promise<void> {
    if (!this.channel) {
      console.warn('⚠️ RabbitMQ not connected, skipping event publish');
      return;
    }

    try {
      const fullEvent: Event = {
        ...event,
        eventId: generateEventId(),
        timestamp: new Date(),
        version: '1.0',
      } as Event;

      // Routing key: eventType (예: comment.created)
      const routingKey = event.eventType;

      this.channel.publish(
        this.exchangeName,
        routingKey,
        Buffer.from(JSON.stringify(fullEvent)),
        {
          persistent: true,
          contentType: 'application/json',
          timestamp: Date.now(),
        }
      );

      console.info(`📤 Event published: ${fullEvent.eventType} (${fullEvent.eventId})`);
    } catch (error) {
      console.error('❌ Failed to publish event:', error);
      // 이벤트 발행 실패해도 메인 로직은 성공으로 처리
    }
  }

  async disconnect() {
    try {
      await this.channel?.close();
      await this.connection?.close();
      console.info('✅ RabbitMQ disconnected');
    } catch (error) {
      console.error('❌ RabbitMQ disconnection error:', error);
    }
  }
}

export const eventPublisher = new EventPublisher();
