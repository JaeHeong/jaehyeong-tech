import amqp, { Connection, Channel } from 'amqplib';
import { generateEventId } from '@shared/utils';
import { Event } from '@shared/events';

class EventPublisher {
  private connection: Connection | null = null;
  private channel: Channel | null = null;
  private readonly exchangeName = 'msa-events';

  async connect() {
    try {
      const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://admin:admin@localhost:5672';
      this.connection = await amqp.connect(rabbitmqUrl);
      this.channel = await this.connection.createChannel();

      // Exchange 생성 (fanout: 모든 구독자에게 브로드캐스트)
      await this.channel.assertExchange(this.exchangeName, 'topic', { durable: true });

      console.info('✅ RabbitMQ connected');
    } catch (error) {
      console.error('❌ RabbitMQ connection failed:', error);
      // 연결 실패해도 서비스는 계속 실행 (이벤트만 발행 안 됨)
    }
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
