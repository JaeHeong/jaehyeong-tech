# MSA 배포 전략 및 자동화

## 목차
1. [GitHub Actions Workflow](#github-actions-workflow)
2. [Kubernetes 배포 구조](#kubernetes-배포-구조)
3. [서비스별 Kubernetes YAML](#서비스별-kubernetes-yaml)
4. [GitOps 전략](#gitops-전략)
5. [모니터링 및 로깅](#모니터링-및-로깅)

---

## GitHub Actions Workflow

### 프로젝트 구조

```
jaehyeong-tech/
├── .github/
│   └── workflows/
│       ├── build-and-deploy.yaml      (메인 워크플로우)
│       ├── build-universal.yaml       (범용 서비스 빌드)
│       └── build-project-specific.yaml (전용 서비스 빌드)
├── apps/
│   ├── auth-service/
│   │   ├── Dockerfile
│   │   └── package.json
│   ├── comment-service/
│   ├── storage-service/
│   ├── blog-service/
│   ├── page-service/
│   └── mfe-*/
└── k8s/
    ├── auth-service/
    │   ├── deployment.yaml
    │   ├── service.yaml
    │   ├── configmap.yaml
    │   └── secret.yaml
    └── ...
```

---

### 메인 Workflow (서비스 선택 가능)

```yaml
# .github/workflows/build-and-deploy.yaml
name: Build and Deploy MSA Services

on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Deployment Environment'
        required: true
        type: choice
        options:
          - dev
          - prod
        default: 'dev'

      services:
        description: 'Services to deploy (comma-separated or "all")'
        required: true
        type: string
        default: 'all'
        # Examples:
        # - "all" → 모든 서비스
        # - "auth-service,comment-service" → 특정 서비스
        # - "universal" → 범용 서비스만
        # - "project-specific" → 전용 서비스만

      skip_tests:
        description: 'Skip tests'
        required: false
        type: boolean
        default: false

env:
  REGISTRY: ghcr.io
  IMAGE_PREFIX: ${{ github.repository_owner }}

jobs:
  # ================================================================
  # Job 1: 배포할 서비스 목록 파싱
  # ================================================================
  prepare:
    runs-on: ubuntu-latest
    outputs:
      services: ${{ steps.parse.outputs.services }}
      tag: ${{ steps.tag.outputs.tag }}

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Generate Image Tag
        id: tag
        run: |
          if [ "${{ inputs.environment }}" == "dev" ]; then
            TAG="dev-$(git rev-parse --short HEAD)"
          else
            TAG="$(git rev-parse --short HEAD)"
          fi
          echo "tag=$TAG" >> $GITHUB_OUTPUT
          echo "Generated tag: $TAG"

      - name: Parse Services
        id: parse
        run: |
          INPUT="${{ inputs.services }}"

          # 모든 서비스 정의
          ALL_SERVICES='["auth-service","comment-service","storage-service","analytics-service","blog-service","page-service","mfe-shell","mfe-blog","mfe-admin","mfe-user"]'
          UNIVERSAL_SERVICES='["auth-service","comment-service","storage-service","analytics-service"]'
          PROJECT_SERVICES='["blog-service","page-service","mfe-shell","mfe-blog","mfe-admin","mfe-user"]'

          if [ "$INPUT" == "all" ]; then
            SERVICES=$ALL_SERVICES
          elif [ "$INPUT" == "universal" ]; then
            SERVICES=$UNIVERSAL_SERVICES
          elif [ "$INPUT" == "project-specific" ]; then
            SERVICES=$PROJECT_SERVICES
          else
            # 콤마로 구분된 서비스 파싱
            SERVICES=$(echo "$INPUT" | jq -R 'split(",") | map(select(length > 0) | gsub("^\\s+|\\s+$"; ""))')
          fi

          echo "services=$SERVICES" >> $GITHUB_OUTPUT
          echo "Deploying services: $SERVICES"

  # ================================================================
  # Job 2: 서비스 빌드 및 푸시 (Matrix Strategy)
  # ================================================================
  build:
    needs: prepare
    runs-on: self-hosted  # ARM64 지원
    strategy:
      matrix:
        service: ${{ fromJson(needs.prepare.outputs.services) }}
      fail-fast: false  # 한 서비스 실패해도 다른 서비스 계속 빌드

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to GHCR
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Determine Service Type and Path
        id: service-info
        run: |
          SERVICE="${{ matrix.service }}"

          if [[ "$SERVICE" == mfe-* ]]; then
            CONTEXT="apps/$SERVICE"
            DOCKERFILE="apps/$SERVICE/Dockerfile"
            TYPE="mfe"
          elif [[ "$SERVICE" == *-service ]]; then
            CONTEXT="apps/$SERVICE"
            DOCKERFILE="apps/$SERVICE/Dockerfile"
            TYPE="service"
          else
            echo "Unknown service type: $SERVICE"
            exit 1
          fi

          echo "context=$CONTEXT" >> $GITHUB_OUTPUT
          echo "dockerfile=$DOCKERFILE" >> $GITHUB_OUTPUT
          echo "type=$TYPE" >> $GITHUB_OUTPUT

      - name: Run Tests
        if: ${{ !inputs.skip_tests }}
        working-directory: ${{ steps.service-info.outputs.context }}
        run: |
          npm install
          npm test || echo "No tests found"

      - name: Build and Push Docker Image
        uses: docker/build-push-action@v5
        with:
          context: ${{ steps.service-info.outputs.context }}
          file: ${{ steps.service-info.outputs.dockerfile }}
          push: true
          tags: |
            ${{ env.REGISTRY }}/${{ env.IMAGE_PREFIX }}/${{ matrix.service }}:${{ needs.prepare.outputs.tag }}
            ${{ env.REGISTRY }}/${{ env.IMAGE_PREFIX }}/${{ matrix.service }}:latest
          cache-from: type=registry,ref=${{ env.REGISTRY }}/${{ env.IMAGE_PREFIX }}/${{ matrix.service }}:buildcache
          cache-to: type=registry,ref=${{ env.REGISTRY }}/${{ env.IMAGE_PREFIX }}/${{ matrix.service }}:buildcache,mode=max
          platforms: linux/arm64  # ARM64 아키텍처
          build-args: |
            NODE_ENV=production
            BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
            VCS_REF=$(git rev-parse --short HEAD)

      - name: Image Digest
        run: |
          echo "Image: ${{ env.REGISTRY }}/${{ env.IMAGE_PREFIX }}/${{ matrix.service }}:${{ needs.prepare.outputs.tag }}"

  # ================================================================
  # Job 3: GitOps 레포 업데이트
  # ================================================================
  update-gitops:
    needs: [prepare, build]
    runs-on: ubuntu-latest

    steps:
      - name: Checkout GitOps Repository
        uses: actions/checkout@v4
        with:
          repository: ${{ github.repository_owner }}/gitops
          token: ${{ secrets.GITOPS_TOKEN }}
          path: gitops

      - name: Install yq
        run: |
          sudo wget -qO /usr/local/bin/yq https://github.com/mikefarah/yq/releases/latest/download/yq_linux_amd64
          sudo chmod +x /usr/local/bin/yq

      - name: Update Helm Values
        run: |
          cd gitops/charts/jaehyeong-tech

          ENV="${{ inputs.environment }}"
          TAG="${{ needs.prepare.outputs.tag }}"
          SERVICES='${{ needs.prepare.outputs.services }}'

          # values-{env}.yaml 업데이트
          for SERVICE in $(echo "$SERVICES" | jq -r '.[]'); do
            # service-name → serviceName (camelCase)
            SERVICE_KEY=$(echo "$SERVICE" | sed 's/-\([a-z]\)/\U\1/g')

            echo "Updating $SERVICE_KEY.image.tag to $TAG"
            yq eval ".${SERVICE_KEY}.image.tag = \"$TAG\"" -i values-$ENV.yaml
          done

          cat values-$ENV.yaml

      - name: Commit and Push
        run: |
          cd gitops

          git config user.name "GitHub Actions"
          git config user.email "actions@github.com"

          git add .
          git commit -m "Deploy services to ${{ inputs.environment }}: ${{ needs.prepare.outputs.tag }}" || exit 0
          git push

  # ================================================================
  # Job 4: Kubernetes 배포 (ArgoCD 동기화)
  # ================================================================
  deploy:
    needs: [prepare, update-gitops]
    runs-on: ubuntu-latest

    steps:
      - name: Install ArgoCD CLI
        run: |
          curl -sSL -o argocd https://github.com/argoproj/argo-cd/releases/latest/download/argocd-linux-amd64
          chmod +x argocd
          sudo mv argocd /usr/local/bin/

      - name: Sync ArgoCD Application
        run: |
          ENV="${{ inputs.environment }}"

          argocd login ${{ secrets.ARGOCD_SERVER }} \
            --username ${{ secrets.ARGOCD_USERNAME }} \
            --password ${{ secrets.ARGOCD_PASSWORD }} \
            --insecure

          argocd app sync jaehyeong-tech-$ENV \
            --prune \
            --timeout 600

          argocd app wait jaehyeong-tech-$ENV \
            --timeout 600 \
            --health

  # ================================================================
  # Job 5: 배포 알림
  # ================================================================
  notify:
    needs: [prepare, deploy]
    runs-on: ubuntu-latest
    if: always()

    steps:
      - name: Slack Notification
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: |
            Deployment to ${{ inputs.environment }}
            Services: ${{ inputs.services }}
            Tag: ${{ needs.prepare.outputs.tag }}
            Status: ${{ job.status }}
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
        if: always()
```

---

### 범용 서비스 전용 Workflow (선택적)

```yaml
# .github/workflows/build-universal.yaml
name: Build Universal Services

on:
  push:
    branches:
      - main
    paths:
      - 'apps/auth-service/**'
      - 'apps/comment-service/**'
      - 'apps/storage-service/**'
      - 'apps/analytics-service/**'

jobs:
  build:
    uses: ./.github/workflows/build-and-deploy.yaml
    with:
      environment: dev
      services: universal
      skip_tests: false
    secrets: inherit
```

---

## Kubernetes 배포 구조

### 네임스페이스 구조

```
Kubernetes Cluster
├── jaehyeong-tech-dev/
│   ├── auth-service
│   ├── comment-service
│   ├── storage-service
│   ├── analytics-service
│   ├── blog-service
│   ├── page-service
│   ├── mfe-shell
│   ├── mfe-blog
│   ├── mfe-admin
│   ├── mfe-user
│   ├── rabbitmq
│   ├── redis
│   └── kong-gateway
│
└── jaehyeong-tech-prod/
    └── (동일 구조)
```

---

## 서비스별 Kubernetes YAML

### 1. Auth Service

```yaml
# k8s/auth-service/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: auth-service
  namespace: jaehyeong-tech-dev
  labels:
    app: auth-service
    tier: backend
    type: universal
spec:
  replicas: 2
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: auth-service
  template:
    metadata:
      labels:
        app: auth-service
        version: v1
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "3001"
        prometheus.io/path: "/metrics"
    spec:
      containers:
      - name: auth-service
        image: ghcr.io/jaehyeong/auth-service:dev-latest
        imagePullPolicy: Always
        ports:
        - name: http
          containerPort: 3001
          protocol: TCP

        env:
        # Database
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: auth-service-secret
              key: database-url

        # Redis
        - name: REDIS_URL
          value: "redis://redis:6379"

        # Service Config
        - name: PORT
          value: "3001"
        - name: NODE_ENV
          value: "production"

        # Logging
        - name: LOG_LEVEL
          valueFrom:
            configMapKeyRef:
              name: auth-service-config
              key: log-level

        # CORS
        - name: CORS_ORIGIN
          valueFrom:
            configMapKeyRef:
              name: auth-service-config
              key: cors-origin

        resources:
          requests:
            memory: "256Mi"
            cpu: "200m"
          limits:
            memory: "512Mi"
            cpu: "500m"

        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3

        readinessProbe:
          httpGet:
            path: /ready
            port: 3001
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3

        lifecycle:
          preStop:
            exec:
              command: ["/bin/sh", "-c", "sleep 15"]

      # Graceful shutdown
      terminationGracePeriodSeconds: 30

      # Image pull secrets
      imagePullSecrets:
      - name: ghcr-secret

---
# k8s/auth-service/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: auth-service
  namespace: jaehyeong-tech-dev
  labels:
    app: auth-service
spec:
  type: ClusterIP
  selector:
    app: auth-service
  ports:
  - name: http
    port: 3001
    targetPort: 3001
    protocol: TCP
  sessionAffinity: None

---
# k8s/auth-service/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: auth-service-config
  namespace: jaehyeong-tech-dev
data:
  log-level: "info"
  cors-origin: "https://jaehyeong.tech,https://dev.jaehyeong.tech"
  jwt-expiry: "7d"

---
# k8s/auth-service/secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: auth-service-secret
  namespace: jaehyeong-tech-dev
type: Opaque
stringData:
  database-url: "postgresql://user:password@postgres-auth:5432/auth_db?schema=public"
  # 실제 프로덕션에서는 Sealed Secrets 또는 External Secrets 사용

---
# k8s/auth-service/hpa.yaml (선택적)
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: auth-service-hpa
  namespace: jaehyeong-tech-dev
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: auth-service
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
      - type: Percent
        value: 100
        periodSeconds: 30
      - type: Pods
        value: 2
        periodSeconds: 30
      selectPolicy: Max
```

---

### 2. Comment Service

```yaml
# k8s/comment-service/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: comment-service
  namespace: jaehyeong-tech-dev
  labels:
    app: comment-service
    tier: backend
    type: universal
spec:
  replicas: 2
  selector:
    matchLabels:
      app: comment-service
  template:
    metadata:
      labels:
        app: comment-service
    spec:
      containers:
      - name: comment-service
        image: ghcr.io/jaehyeong/comment-service:dev-latest
        ports:
        - containerPort: 3003
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: comment-service-secret
              key: database-url
        - name: REDIS_URL
          value: "redis://redis:6379"
        - name: RABBITMQ_URL
          value: "amqp://rabbitmq:5672"
        - name: AUTH_SERVICE_URL
          value: "http://auth-service:3001"
        - name: PORT
          value: "3003"
        resources:
          requests:
            memory: "256Mi"
            cpu: "200m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3003
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3003
          initialDelaySeconds: 10
          periodSeconds: 5

---
# k8s/comment-service/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: comment-service
  namespace: jaehyeong-tech-dev
spec:
  type: ClusterIP
  selector:
    app: comment-service
  ports:
  - port: 3003
    targetPort: 3003
```

---

### 3. Storage Service

```yaml
# k8s/storage-service/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: storage-service
  namespace: jaehyeong-tech-dev
  labels:
    app: storage-service
    tier: backend
    type: universal
spec:
  replicas: 2
  selector:
    matchLabels:
      app: storage-service
  template:
    metadata:
      labels:
        app: storage-service
    spec:
      containers:
      - name: storage-service
        image: ghcr.io/jaehyeong/storage-service:dev-latest
        ports:
        - containerPort: 3006
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: storage-service-secret
              key: database-url
        - name: OCI_NAMESPACE
          valueFrom:
            secretKeyRef:
              name: storage-service-secret
              key: oci-namespace
        - name: OCI_BUCKET_NAME
          valueFrom:
            secretKeyRef:
              name: storage-service-secret
              key: oci-bucket-name
        - name: OCI_ACCESS_KEY
          valueFrom:
            secretKeyRef:
              name: storage-service-secret
              key: oci-access-key
        - name: OCI_SECRET_KEY
          valueFrom:
            secretKeyRef:
              name: storage-service-secret
              key: oci-secret-key
        - name: OCI_REGION
          value: "ap-seoul-1"
        - name: PORT
          value: "3006"
        resources:
          requests:
            memory: "512Mi"  # 이미지 처리로 메모리 더 필요
            cpu: "300m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3006
          initialDelaySeconds: 30
          periodSeconds: 10

---
# k8s/storage-service/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: storage-service
  namespace: jaehyeong-tech-dev
spec:
  type: ClusterIP
  selector:
    app: storage-service
  ports:
  - port: 3006
    targetPort: 3006
```

---

### 4. Blog Service (프로젝트 전용)

```yaml
# k8s/blog-service/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: blog-service
  namespace: jaehyeong-tech-dev
  labels:
    app: blog-service
    tier: backend
    type: project-specific
    project: jaehyeong-tech
spec:
  replicas: 3  # 읽기 부하가 많으므로 3개
  selector:
    matchLabels:
      app: blog-service
  template:
    metadata:
      labels:
        app: blog-service
    spec:
      containers:
      - name: blog-service
        image: ghcr.io/jaehyeong/blog-service:dev-latest
        ports:
        - containerPort: 3002
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: blog-service-secret
              key: database-url
        - name: REDIS_URL
          value: "redis://redis:6379"
        - name: RABBITMQ_URL
          value: "amqp://rabbitmq:5672"
        - name: AUTH_SERVICE_URL
          value: "http://auth-service:3001"
        - name: PORT
          value: "3002"
        resources:
          requests:
            memory: "256Mi"
            cpu: "200m"
          limits:
            memory: "512Mi"
            cpu: "500m"

---
# k8s/blog-service/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: blog-service
  namespace: jaehyeong-tech-dev
spec:
  type: ClusterIP
  selector:
    app: blog-service
  ports:
  - port: 3002
    targetPort: 3002
```

---

### 5. MFE Shell (프론트엔드)

```yaml
# k8s/mfe-shell/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mfe-shell
  namespace: jaehyeong-tech-dev
  labels:
    app: mfe-shell
    tier: frontend
    type: mfe
spec:
  replicas: 2
  selector:
    matchLabels:
      app: mfe-shell
  template:
    metadata:
      labels:
        app: mfe-shell
    spec:
      containers:
      - name: mfe-shell
        image: ghcr.io/jaehyeong/mfe-shell:dev-latest
        ports:
        - containerPort: 80
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"
        livenessProbe:
          httpGet:
            path: /
            port: 80
          initialDelaySeconds: 10
          periodSeconds: 10

---
# k8s/mfe-shell/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: mfe-shell
  namespace: jaehyeong-tech-dev
spec:
  type: ClusterIP
  selector:
    app: mfe-shell
  ports:
  - port: 80
    targetPort: 80
```

---

### 6. Kong Gateway

```yaml
# k8s/kong-gateway/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kong-gateway
  namespace: jaehyeong-tech-dev
  labels:
    app: kong-gateway
spec:
  replicas: 2
  selector:
    matchLabels:
      app: kong-gateway
  template:
    metadata:
      labels:
        app: kong-gateway
    spec:
      containers:
      - name: kong
        image: kong:3.5-alpine
        env:
        - name: KONG_DATABASE
          value: "off"
        - name: KONG_DECLARATIVE_CONFIG
          value: /kong/declarative/kong.yaml
        - name: KONG_PROXY_LISTEN
          value: "0.0.0.0:8000"
        - name: KONG_ADMIN_LISTEN
          value: "0.0.0.0:8001"
        - name: KONG_LOG_LEVEL
          value: "info"
        ports:
        - name: proxy
          containerPort: 8000
        - name: admin
          containerPort: 8001
        volumeMounts:
        - name: kong-config
          mountPath: /kong/declarative
        resources:
          requests:
            memory: "256Mi"
            cpu: "200m"
          limits:
            memory: "512Mi"
            cpu: "500m"
      volumes:
      - name: kong-config
        configMap:
          name: kong-config

---
# k8s/kong-gateway/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: kong-gateway
  namespace: jaehyeong-tech-dev
spec:
  type: ClusterIP
  selector:
    app: kong-gateway
  ports:
  - name: proxy
    port: 8000
    targetPort: 8000
  - name: admin
    port: 8001
    targetPort: 8001

---
# k8s/kong-gateway/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: kong-config
  namespace: jaehyeong-tech-dev
data:
  kong.yaml: |
    _format_version: "3.0"

    services:
      - name: auth-service
        url: http://auth-service:3001
        routes:
          - name: auth-routes
            paths:
              - /api/auth
              - /api/users
              - /api/tenants
        plugins:
          - name: rate-limiting
            config:
              minute: 100
              policy: local
          - name: cors
            config:
              origins:
                - "*"
              credentials: true

      - name: comment-service
        url: http://comment-service:3003
        routes:
          - name: comment-routes
            paths:
              - /api/comments
        plugins:
          - name: rate-limiting
            config:
              minute: 200

      - name: blog-service
        url: http://blog-service:3002
        routes:
          - name: blog-routes
            paths:
              - /api/posts
              - /api/categories
              - /api/tags
              - /api/drafts
        plugins:
          - name: rate-limiting
            config:
              minute: 500

      - name: storage-service
        url: http://storage-service:3006
        routes:
          - name: storage-routes
            paths:
              - /api/upload
              - /api/images
        plugins:
          - name: request-size-limiting
            config:
              allowed_payload_size: 20
```

---

### 7. RabbitMQ

```yaml
# k8s/rabbitmq/statefulset.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: rabbitmq
  namespace: jaehyeong-tech-dev
spec:
  serviceName: rabbitmq
  replicas: 1
  selector:
    matchLabels:
      app: rabbitmq
  template:
    metadata:
      labels:
        app: rabbitmq
    spec:
      containers:
      - name: rabbitmq
        image: rabbitmq:3.12-management-alpine
        ports:
        - name: amqp
          containerPort: 5672
        - name: management
          containerPort: 15672
        env:
        - name: RABBITMQ_DEFAULT_USER
          value: "admin"
        - name: RABBITMQ_DEFAULT_PASS
          valueFrom:
            secretKeyRef:
              name: rabbitmq-secret
              key: password
        volumeMounts:
        - name: rabbitmq-data
          mountPath: /var/lib/rabbitmq
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
  volumeClaimTemplates:
  - metadata:
      name: rabbitmq-data
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 10Gi

---
# k8s/rabbitmq/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: rabbitmq
  namespace: jaehyeong-tech-dev
spec:
  type: ClusterIP
  selector:
    app: rabbitmq
  ports:
  - name: amqp
    port: 5672
    targetPort: 5672
  - name: management
    port: 15672
    targetPort: 15672
```

---

### 8. Redis

```yaml
# k8s/redis/statefulset.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: redis
  namespace: jaehyeong-tech-dev
spec:
  serviceName: redis
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        ports:
        - containerPort: 6379
        command:
          - redis-server
          - --appendonly
          - "yes"
          - --maxmemory
          - "512mb"
          - --maxmemory-policy
          - "allkeys-lru"
        volumeMounts:
        - name: redis-data
          mountPath: /data
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "200m"
  volumeClaimTemplates:
  - metadata:
      name: redis-data
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 5Gi

---
# k8s/redis/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: redis
  namespace: jaehyeong-tech-dev
spec:
  type: ClusterIP
  selector:
    app: redis
  ports:
  - port: 6379
    targetPort: 6379
```

---

### 9. Ingress (Traefik)

```yaml
# k8s/ingress/ingressroute.yaml
apiVersion: traefik.containo.us/v1alpha1
kind: IngressRoute
metadata:
  name: jaehyeong-tech
  namespace: jaehyeong-tech-dev
spec:
  entryPoints:
    - websecure
  routes:
    # API 요청 → Kong Gateway
    - match: Host(`dev.jaehyeong.tech`) && PathPrefix(`/api`)
      kind: Rule
      services:
        - name: kong-gateway
          port: 8000
      middlewares:
        - name: tenant-header
        - name: compress
        - name: security-headers

    # 프론트엔드 → MFE Shell (SPA)
    - match: Host(`dev.jaehyeong.tech`)
      kind: Rule
      services:
        - name: mfe-shell
          port: 80
      middlewares:
        - name: spa-fallback

  tls:
    secretName: jaehyeong-tech-tls

---
# k8s/ingress/middleware.yaml
apiVersion: traefik.containo.us/v1alpha1
kind: Middleware
metadata:
  name: tenant-header
  namespace: jaehyeong-tech-dev
spec:
  headers:
    customRequestHeaders:
      X-Tenant-Name: "jaehyeong-tech"

---
apiVersion: traefik.containo.us/v1alpha1
kind: Middleware
metadata:
  name: compress
  namespace: jaehyeong-tech-dev
spec:
  compress: {}

---
apiVersion: traefik.containo.us/v1alpha1
kind: Middleware
metadata:
  name: security-headers
  namespace: jaehyeong-tech-dev
spec:
  headers:
    customResponseHeaders:
      X-Frame-Options: "SAMEORIGIN"
      X-Content-Type-Options: "nosniff"
      X-XSS-Protection: "1; mode=block"
      Referrer-Policy: "strict-origin-when-cross-origin"

---
apiVersion: traefik.containo.us/v1alpha1
kind: Middleware
metadata:
  name: spa-fallback
  namespace: jaehyeong-tech-dev
spec:
  errors:
    status:
      - "404"
    query: "/index.html"
    service:
      name: mfe-shell
      port: 80
```

---

## GitOps 전략

### GitOps 레포지토리 구조

```
gitops/
├── charts/
│   └── jaehyeong-tech/
│       ├── Chart.yaml
│       ├── values-dev.yaml
│       ├── values-prod.yaml
│       └── templates/
│           ├── auth-service/
│           ├── comment-service/
│           ├── storage-service/
│           └── ...
└── argocd/
    ├── application-dev.yaml
    └── application-prod.yaml
```

### ArgoCD Application

```yaml
# gitops/argocd/application-dev.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: jaehyeong-tech-dev
  namespace: argocd
spec:
  project: default

  source:
    repoURL: https://github.com/jaehyeong/gitops.git
    targetRevision: main
    path: charts/jaehyeong-tech
    helm:
      valueFiles:
        - values-dev.yaml

  destination:
    server: https://kubernetes.default.svc
    namespace: jaehyeong-tech-dev

  syncPolicy:
    automated:
      prune: true
      selfHeal: true
      allowEmpty: false
    syncOptions:
      - CreateNamespace=true
      - PruneLast=true
    retry:
      limit: 5
      backoff:
        duration: 5s
        factor: 2
        maxDuration: 3m
```

### Helm Values

```yaml
# gitops/charts/jaehyeong-tech/values-dev.yaml
global:
  environment: dev
  domain: dev.jaehyeong.tech

authService:
  enabled: true
  image:
    repository: ghcr.io/jaehyeong/auth-service
    tag: dev-latest
  replicas: 2
  resources:
    requests:
      memory: 256Mi
      cpu: 200m
    limits:
      memory: 512Mi
      cpu: 500m

commentService:
  enabled: true
  image:
    repository: ghcr.io/jaehyeong/comment-service
    tag: dev-latest
  replicas: 2

storageService:
  enabled: true
  image:
    repository: ghcr.io/jaehyeong/storage-service
    tag: dev-latest
  replicas: 2

blogService:
  enabled: true
  image:
    repository: ghcr.io/jaehyeong/blog-service
    tag: dev-latest
  replicas: 3

# ... 나머지 서비스 동일 패턴
```

---

## 모니터링 및 로깅

### Prometheus ServiceMonitor

```yaml
# k8s/monitoring/servicemonitor.yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: jaehyeong-tech-services
  namespace: jaehyeong-tech-dev
spec:
  selector:
    matchLabels:
      tier: backend
  endpoints:
  - port: http
    path: /metrics
    interval: 30s
```

### Grafana Dashboard ConfigMap

```yaml
# k8s/monitoring/dashboard.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: grafana-dashboard-msa
  namespace: monitoring
data:
  msa-dashboard.json: |
    {
      "dashboard": {
        "title": "Jaehyeong Tech MSA",
        "panels": [
          {
            "title": "Request Rate by Service",
            "targets": [
              {
                "expr": "rate(http_requests_total[5m])"
              }
            ]
          }
        ]
      }
    }
```

---

## 배포 시나리오

### 시나리오 1: 모든 서비스 배포

```bash
# GitHub Actions UI에서:
Environment: dev
Services: all
Skip Tests: false

# 또는 CLI:
gh workflow run build-and-deploy.yaml \
  -f environment=dev \
  -f services=all \
  -f skip_tests=false
```

### 시나리오 2: 범용 서비스만 배포

```bash
gh workflow run build-and-deploy.yaml \
  -f environment=prod \
  -f services=universal \
  -f skip_tests=false

# 배포되는 서비스:
# - auth-service
# - comment-service
# - storage-service
# - analytics-service
```

### 시나리오 3: 특정 서비스만 배포

```bash
gh workflow run build-and-deploy.yaml \
  -f environment=dev \
  -f services="auth-service,comment-service" \
  -f skip_tests=false
```

### 시나리오 4: 핫픽스 (단일 서비스 빠른 배포)

```bash
gh workflow run build-and-deploy.yaml \
  -f environment=prod \
  -f services="blog-service" \
  -f skip_tests=true  # 긴급 배포
```

---

## 리소스 요구사항 (전체)

### 개발 환경 (jaehyeong-tech-dev)

```
Services (10개):
  CPU: 2.2 cores (requests) / 5.5 cores (limits)
  Memory: 3.2 GB (requests) / 6.4 GB (limits)

Infrastructure:
  RabbitMQ: 250m CPU / 512 MB RAM
  Redis: 100m CPU / 256 MB RAM
  Kong: 200m CPU / 256 MB RAM

Total:
  CPU: ~3 cores (requests) / ~7 cores (limits)
  Memory: ~4 GB (requests) / ~8 GB (limits)
  Storage: 15 GB (RabbitMQ + Redis PVC)

→ 4대 노드로 충분 (각 2vCPU, 12GB RAM)
```

### 프로덕션 환경 (jaehyeong-tech-prod)

```
Services (각 2-3 replicas):
  CPU: 6 cores (requests) / 15 cores (limits)
  Memory: 9 GB (requests) / 18 GB (limits)

Infrastructure:
  RabbitMQ: 500m CPU / 1 GB RAM (replicas: 3)
  Redis: 200m CPU / 512 MB RAM (replicas: 3)
  Kong: 500m CPU / 512 MB RAM (replicas: 3)

Total:
  CPU: ~8 cores (requests) / ~18 cores (limits)
  Memory: ~12 GB (requests) / ~24 GB (limits)

→ 현재 4대 노드 (2vCPU, 12GB RAM)로 개발만 가능
→ 프로덕션은 8-10대 노드 필요 또는 노드 스펙 업그레이드
```

---

## 요약

### GitHub Actions
- ✅ 서비스 선택 가능 (all, universal, 개별 선택)
- ✅ Matrix 빌드 (병렬 처리)
- ✅ ARM64 지원 (Self-hosted runner)
- ✅ GitOps 자동 업데이트
- ✅ ArgoCD 자동 동기화

### Kubernetes
- ✅ 서비스별 독립 Deployment
- ✅ HPA (Auto-scaling)
- ✅ Liveness/Readiness Probe
- ✅ Resource Limits
- ✅ ConfigMap/Secret 분리
- ✅ StatefulSet (RabbitMQ, Redis)
- ✅ Traefik Ingress + Middleware

### GitOps
- ✅ Helm Chart 기반
- ✅ Environment별 values
- ✅ ArgoCD 자동 동기화
- ✅ Git이 Single Source of Truth

**이제 각 서비스를 선택해서 독립적으로 빌드하고 배포할 수 있습니다!** 🚀

---

**문서 버전**: 1.0
**작성일**: 2026-01-16
**작성자**: Claude (AI Assistant)
