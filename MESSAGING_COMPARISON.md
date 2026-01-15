# RabbitMQ vs Kafka 비교 분석

## 개요

jaehyeong-tech MSA 프로젝트에서 메시징 시스템을 선택하기 위한 비교 분석입니다.

---

## 빠른 결론

| 기준 | RabbitMQ | Kafka | 추천 |
|------|----------|-------|------|
| **프로젝트 규모** | 중소규모에 적합 | 대규모에 적합 | RabbitMQ ✅ |
| **학습 곡선** | 쉬움 | 어려움 | RabbitMQ ✅ |
| **운영 복잡도** | 낮음 | 높음 | RabbitMQ ✅ |
| **이벤트 재생** | 제한적 | 강력함 | Kafka ✅ |
| **처리량** | ~20K msg/sec | ~1M msg/sec | Kafka ✅ |
| **메시지 보장** | 둘 다 강력함 | 둘 다 강력함 | 동등 |
| **리소스 사용** | 적음 (512MB) | 많음 (4GB+) | RabbitMQ ✅ |

**최종 추천**: **RabbitMQ** (현 단계) → **Kafka** (향후 확장 시)

---

## 상세 비교

### 1. 아키텍처 차이

#### RabbitMQ (Message Broker)
```
┌──────────┐    ┌─────────────────┐    ┌──────────┐
│ Producer │───→│   Exchange      │───→│ Consumer │
└──────────┘    │   + Queues      │    └──────────┘
                └─────────────────┘
```

**특징**:
- **Push 모델**: 브로커가 소비자에게 메시지를 푸시
- **메시지 삭제**: 소비되면 큐에서 삭제
- **라우팅 복잡**: Topic, Direct, Fanout, Headers 교환기

#### Kafka (Distributed Log)
```
┌──────────┐    ┌─────────────────┐    ┌──────────┐
│ Producer │───→│  Topic          │───→│ Consumer │
└──────────┘    │  (Partitions)   │    │  Group   │
                └─────────────────┘    └──────────┘
```

**특징**:
- **Pull 모델**: 소비자가 능동적으로 메시지를 가져감
- **메시지 보존**: 설정된 기간 동안 로그에 보존
- **파티션 기반**: 순서 보장 및 병렬 처리

---

### 2. 프로젝트 요구사항 매핑

#### 우리 프로젝트의 이벤트 패턴

```typescript
// 예상 이벤트 볼륨
post.created      → ~10 events/day
post.updated      → ~20 events/day
post.deleted      → ~2 events/day
comment.created   → ~50 events/day
like.toggled      → ~200 events/day
user.profile.updated → ~5 events/day

// 총합: ~300 events/day (초당 0.003개)
```

**결론**: RabbitMQ도 충분히 처리 가능 (초당 20,000개까지 가능)

#### 이벤트 재생 필요성

| 시나리오 | 필요성 | RabbitMQ | Kafka |
|---------|--------|----------|-------|
| 새 서비스 추가 시 과거 데이터 동기화 | 중간 | ❌ 어려움 | ✅ 가능 |
| 버그 수정 후 재처리 | 낮음 | ❌ 불가능 | ✅ 가능 |
| 데이터 감사/분석 | 낮음 | ❌ 불가능 | ✅ 가능 |

**우리 프로젝트**: 이벤트 재생이 **필수는 아님** (초기 데이터는 DB 마이그레이션으로 해결)

---

### 3. 운영 복잡도

#### RabbitMQ

**장점**:
- 간단한 Docker Compose 설정
- Management UI 제공 (메시지 모니터링, 큐 관리)
- 적은 리소스 사용 (512MB RAM)

**설정 예시**:
```yaml
# docker-compose.yaml
rabbitmq:
  image: rabbitmq:3.12-management-alpine
  ports:
    - "5672:5672"
    - "15672:15672"
  environment:
    RABBITMQ_DEFAULT_USER: admin
    RABBITMQ_DEFAULT_PASS: password
  volumes:
    - rabbitmq_data:/var/lib/rabbitmq
```

**Kubernetes 배포**:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: rabbitmq
spec:
  replicas: 1
  template:
    spec:
      containers:
      - name: rabbitmq
        image: rabbitmq:3.12-management-alpine
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
```

---

#### Kafka

**단점**:
- Zookeeper 의존 (Kafka 3.3+ KRaft 모드로 개선 중이지만 아직 불안정)
- 최소 3대 브로커 권장 (고가용성)
- 복잡한 설정 (파티션, 복제, 리텐션)
- 많은 리소스 사용 (브로커당 4GB+ RAM)

**설정 예시**:
```yaml
# docker-compose.yaml
version: '3'
services:
  zookeeper:
    image: confluentinc/cp-zookeeper:7.5.0
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
    volumes:
      - zk_data:/var/lib/zookeeper

  kafka-1:
    image: confluentinc/cp-kafka:7.5.0
    depends_on:
      - zookeeper
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka-1:9092
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 3
    volumes:
      - kafka1_data:/var/lib/kafka

  kafka-2:
    # ... (추가 브로커)

  kafka-3:
    # ... (추가 브로커)
```

**Kubernetes 배포**:
```yaml
# Kafka는 Strimzi Operator 사용 권장
apiVersion: kafka.strimzi.io/v1beta2
kind: Kafka
metadata:
  name: jaehyeong-kafka
spec:
  kafka:
    replicas: 3
    resources:
      requests:
        memory: 4Gi
        cpu: 1
  zookeeper:
    replicas: 3
    resources:
      requests:
        memory: 2Gi
```

**리소스 비교**:
- RabbitMQ: 512MB RAM, 0.25 CPU
- Kafka 클러스터: 12GB+ RAM (Kafka 3대 + Zookeeper 3대), 3+ CPU

---

### 4. 개발 복잡도

#### RabbitMQ 코드 예시

```typescript
// Publisher (Blog Service)
import amqp from 'amqplib';

const connection = await amqp.connect('amqp://localhost');
const channel = await connection.createChannel();

await channel.assertExchange('blog-events', 'topic', { durable: true });

channel.publish(
  'blog-events',
  'post.created',
  Buffer.from(JSON.stringify({ postId, slug }))
);
```

```typescript
// Consumer (Analytics Service)
const q = await channel.assertQueue('analytics-queue');
await channel.bindQueue(q.queue, 'blog-events', 'post.*');

channel.consume(q.queue, (msg) => {
  const event = JSON.parse(msg.content.toString());
  // 처리 로직
  channel.ack(msg);
});
```

**특징**: 간단하고 직관적

---

#### Kafka 코드 예시

```typescript
// Producer (Blog Service)
import { Kafka } from 'kafkajs';

const kafka = new Kafka({
  clientId: 'blog-service',
  brokers: ['kafka-1:9092', 'kafka-2:9092', 'kafka-3:9092'],
});

const producer = kafka.producer();
await producer.connect();

await producer.send({
  topic: 'blog-events',
  messages: [
    {
      key: 'post.created',
      value: JSON.stringify({ postId, slug }),
      partition: 0,  // 파티션 선택 필요
    },
  ],
});
```

```typescript
// Consumer (Analytics Service)
const consumer = kafka.consumer({ groupId: 'analytics-group' });
await consumer.connect();
await consumer.subscribe({ topic: 'blog-events', fromBeginning: false });

await consumer.run({
  eachMessage: async ({ topic, partition, message }) => {
    const event = JSON.parse(message.value.toString());
    // 처리 로직
  },
});
```

**특징**: 파티션, 오프셋 관리 등 추가 개념 이해 필요

---

### 5. 메시지 패턴 지원

| 패턴 | RabbitMQ | Kafka |
|------|----------|-------|
| **Pub/Sub** | ✅ Fanout Exchange | ✅ Topic |
| **Point-to-Point** | ✅ Direct Exchange | ✅ Consumer Group |
| **Topic 라우팅** | ✅ Topic Exchange | ✅ Topic Partitions |
| **Priority Queue** | ✅ 네이티브 지원 | ❌ 미지원 |
| **Dead Letter Queue** | ✅ 네이티브 지원 | ⚠️ 수동 구현 |
| **Message TTL** | ✅ 네이티브 지원 | ⚠️ 수동 구현 |

**우리 프로젝트 필요 패턴**: Pub/Sub (여러 서비스가 같은 이벤트 구독)

---

### 6. 성능 비교

#### 처리량

| 지표 | RabbitMQ | Kafka |
|------|----------|-------|
| **메시지/초** | ~20,000 | ~1,000,000 |
| **레이턴시** | 1-10ms | 10-100ms |
| **MB/초** | ~100MB/s | ~600MB/s |

**우리 프로젝트**: 하루 300개 이벤트 = 초당 0.003개 → 둘 다 충분함

#### 디스크 사용

- **RabbitMQ**: 메시지 소비 후 삭제 → 디스크 사용 적음
- **Kafka**: 7일 보관 기본 → 디스크 사용 많음

**예상 디스크 사용**:
```
RabbitMQ: ~100MB (미소비 메시지만)
Kafka: ~5GB (7일 보관 시)
```

---

### 7. 모니터링 및 관리

#### RabbitMQ
- **Management UI**: 웹 기반 GUI (기본 제공)
- **메트릭**: Prometheus 플러그인
- **시각화**: Grafana 대시보드

**장점**: 즉시 사용 가능한 UI

#### Kafka
- **Kafka UI**: Kafdrop, AKHQ (서드파티 필요)
- **메트릭**: JMX Exporter + Prometheus
- **시각화**: Grafana 대시보드

**단점**: 추가 도구 설치 필요

---

### 8. 고가용성 및 확장성

#### RabbitMQ
- **클러스터링**: 3대 구성 가능
- **미러링 큐**: 메시지 복제
- **확장성**: 수직 확장 중심

**Kubernetes StatefulSet**:
```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: rabbitmq
spec:
  replicas: 3
  serviceName: rabbitmq
  template:
    spec:
      containers:
      - name: rabbitmq
        image: rabbitmq:3.12-management-alpine
        env:
        - name: RABBITMQ_ERLANG_COOKIE
          value: "secret-cookie"
```

#### Kafka
- **파티셔닝**: 수평 확장 강력
- **복제**: 브로커 간 메시지 복제
- **확장성**: 수평 확장 중심

**장점**: 대규모 트래픽 처리에 유리

---

### 9. 비용 분석

#### 클라우드 비용 (예: AWS)

| 구성 | RabbitMQ | Kafka |
|------|----------|-------|
| **개발 환경** | $10/월 (t3.small) | $50/월 (3 x t3.medium) |
| **프로덕션** | $50/월 (t3.medium 클러스터) | $300/월 (MSK 기본) |
| **스토리지** | $5/월 (10GB) | $20/월 (100GB) |

**총 비용**:
- RabbitMQ: ~$55/월
- Kafka: ~$320/월

---

### 10. 실전 시나리오

#### 시나리오 1: 포스트 삭제 시 연관 데이터 정리

```typescript
// Blog Service
await eventPublisher.publish('post.deleted', { postId });

// Content Service, Analytics Service, Storage Service가 구독
// RabbitMQ: Exchange에 발행 → 3개 큐에 자동 라우팅
// Kafka: Topic에 발행 → 3개 Consumer Group이 읽음

// 결과: 둘 다 동일하게 작동
```

**결론**: 기능상 차이 없음

---

#### 시나리오 2: 새 서비스 추가 (예: Notification Service)

**RabbitMQ**:
```typescript
// 새 큐 생성 및 바인딩
await channel.assertQueue('notification-queue');
await channel.bindQueue('notification-queue', 'blog-events', 'post.created');

// 이후 이벤트만 수신 가능 (과거 이벤트 ❌)
```

**Kafka**:
```typescript
// 새 Consumer Group 생성
const consumer = kafka.consumer({ groupId: 'notification-group' });
await consumer.subscribe({ topic: 'blog-events', fromBeginning: true });

// 과거 이벤트부터 재생 가능 ✅
```

**차이점**: Kafka는 과거 이벤트 재생 가능

**우리 프로젝트**:
- 새 서비스 추가 시 DB에서 초기 데이터 동기화하면 됨
- 이벤트 재생이 필수는 아님

---

#### 시나리오 3: 버그 수정 후 재처리

**예시**: Analytics Service에서 조회수 계산 버그 발견

**RabbitMQ**:
- 과거 이벤트 재생 불가능
- DB에서 재계산 필요

**Kafka**:
- 오프셋을 과거로 되돌려 재처리 가능
- 자동 재계산

**우리 프로젝트**:
- 통계 데이터는 DB에서 재계산 가능
- 이벤트 재생이 필수는 아님

---

### 11. 학습 곡선

#### RabbitMQ
- **학습 시간**: 1-2일
- **핵심 개념**: Exchange, Queue, Binding, Routing Key
- **문서**: 잘 정리됨
- **커뮤니티**: 활발함

#### Kafka
- **학습 시간**: 1-2주
- **핵심 개념**: Topic, Partition, Offset, Consumer Group, Rebalancing, Compaction
- **문서**: 방대하지만 복잡함
- **커뮤니티**: 매우 활발함

**초기 진입 장벽**: RabbitMQ가 낮음

---

## 프로젝트 단계별 추천

### Phase 1-6: 초기 MSA 구축 (현재 ~ 5개월)

**추천: RabbitMQ ✅**

**이유**:
1. 간단한 설정 및 운영
2. 적은 리소스 사용 (비용 절감)
3. 빠른 학습 및 구현
4. 현재 트래픽 규모에 충분
5. 우리 프로젝트에 이벤트 재생이 필수가 아님

**구성**:
```yaml
# 단일 인스턴스로 시작
rabbitmq:
  replicas: 1
  resources:
    requests:
      memory: 512Mi
      cpu: 250m
```

---

### Phase 7+: 프로덕션 안정화 후 (6개월 이후)

**Kafka로 전환 고려 시점**:

1. **이벤트 볼륨 증가**
   - 초당 1,000개 이벤트 이상

2. **이벤트 재생 필요성 증가**
   - 데이터 분석 파이프라인 추가
   - ML 모델 학습용 데이터 필요

3. **실시간 스트림 처리 필요**
   - Kafka Streams, ksqlDB 활용

4. **리소스 여유**
   - 인프라 비용 부담 감소

---

## 하이브리드 접근

**단계적 전환 전략**:

```
Phase 1-6: RabbitMQ (전체 이벤트)
   │
   ├─ 운영 경험 축적
   ├─ 트래픽 패턴 파악
   └─ 병목 지점 식별

Phase 7: 부분 Kafka 도입
   │
   ├─ RabbitMQ: 실시간 이벤트 (post.created, comment.created)
   └─ Kafka: 분석용 이벤트 (page.viewed, user.activity)

Phase 8+: 전면 Kafka 전환 (필요 시)
```

**장점**:
- 리스크 최소화
- 점진적 학습
- 비용 최적화

---

## 최종 추천

### RabbitMQ를 선택하세요 ✅

**근거**:

1. **프로젝트 규모**: 개인 블로그 → 중소규모
2. **트래픽**: 하루 300개 이벤트 (RabbitMQ로 충분)
3. **이벤트 재생**: 필수가 아님 (DB 마이그레이션으로 해결)
4. **리소스**: 제한적인 인프라 예산
5. **학습 곡선**: 빠른 MSA 구축이 목표
6. **운영 복잡도**: 초기 단계에서는 단순함이 중요

### Kafka로 전환 시점

다음 중 **2가지 이상** 해당 시:
- [ ] 초당 1,000개 이상 이벤트
- [ ] 이벤트 재생이 필수 요구사항
- [ ] 실시간 스트림 처리 필요
- [ ] 데이터 분석 파이프라인 구축
- [ ] 인프라 비용 부담 감소

---

## 결론

**지금은 RabbitMQ**, **나중에 필요하면 Kafka**

MSA 리팩토링의 핵심은 **메시징 시스템이 아니라 도메인 분리**입니다. RabbitMQ로 빠르게 시작하고, 운영 경험을 쌓은 후 필요 시 Kafka로 전환하는 것이 현명한 전략입니다.

---

**문서 버전**: 1.0
**작성일**: 2026-01-15
**검토 대상**: JaeHeong
**결정**: [ ] RabbitMQ (추천) [ ] Kafka [ ] 하이브리드
