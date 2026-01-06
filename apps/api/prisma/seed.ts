import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Create admin user
  const hashedPassword = await bcrypt.hash('admin123!', 12)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@jaehyeong.site' },
    update: {},
    create: {
      email: 'admin@jaehyeong.site',
      password: hashedPassword,
      name: 'Jaehyeong',
      role: 'ADMIN',
      bio: '클라우드 인프라와 자동화, 그리고 MLOps 파이프라인 구축에 열정을 가진 엔지니어입니다.',
    },
  })
  console.log('✅ Created admin user:', admin.email)

  // Create categories
  const categories = [
    { name: 'DevOps', slug: 'devops', icon: 'settings_suggest', color: 'blue', description: 'CI/CD 파이프라인, 자동화, 인프라 관리' },
    { name: 'MLOps', slug: 'mlops', icon: 'psychology', color: 'purple', description: '모델 서빙, 모니터링, 데이터 파이프라인' },
    { name: 'Kubernetes', slug: 'kubernetes', icon: 'anchor', color: 'indigo', description: '컨테이너 오케스트레이션, Helm, 서비스 메쉬' },
    { name: 'Cloud Native', slug: 'cloud-native', icon: 'cloud', color: 'orange', description: 'AWS, GCP, 클라우드 아키텍처' },
    { name: 'AI & ML', slug: 'ai-ml', icon: 'smart_toy', color: 'green', description: '딥러닝, LLM, 데이터 사이언스' },
    { name: 'IaC', slug: 'iac', icon: 'code_blocks', color: 'pink', description: 'Terraform, Ansible, 인프라 코드' },
    { name: 'Monitoring', slug: 'monitoring', icon: 'monitoring', color: 'teal', description: 'Prometheus, Grafana, Observability' },
    { name: 'Security', slug: 'security', icon: 'lock', color: 'red', description: 'DevSecOps, 클라우드 보안, 취약점 관리' },
  ]

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: cat,
      create: cat,
    })
  }
  console.log('✅ Created categories:', categories.length)

  // Create tags
  const tags = [
    { name: 'Docker', slug: 'docker' },
    { name: 'Kubernetes', slug: 'kubernetes' },
    { name: 'Terraform', slug: 'terraform' },
    { name: 'GitHub Actions', slug: 'github-actions' },
    { name: 'Python', slug: 'python' },
    { name: 'Go', slug: 'go' },
    { name: 'AWS', slug: 'aws' },
    { name: 'GCP', slug: 'gcp' },
    { name: 'Prometheus', slug: 'prometheus' },
    { name: 'Grafana', slug: 'grafana' },
    { name: 'ArgoCD', slug: 'argocd' },
    { name: 'MLflow', slug: 'mlflow' },
    { name: 'Kubeflow', slug: 'kubeflow' },
  ]

  for (const tag of tags) {
    await prisma.tag.upsert({
      where: { slug: tag.slug },
      update: tag,
      create: tag,
    })
  }
  console.log('✅ Created tags:', tags.length)

  console.log('🎉 Seeding completed!')
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
