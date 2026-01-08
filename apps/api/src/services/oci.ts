import * as oci from 'oci-sdk'

// OCI Configuration from environment variables
const config: oci.common.ConfigFileAuthenticationDetailsProvider | null = (() => {
  const tenancy = process.env.OCI_TENANCY
  const user = process.env.OCI_USER
  const fingerprint = process.env.OCI_FINGERPRINT
  const privateKeyRaw = process.env.OCI_PRIVATE_KEY
  const region = process.env.OCI_REGION || 'ap-chuncheon-1'

  if (!tenancy || !user || !fingerprint || !privateKeyRaw) {
    console.warn('OCI credentials not configured. Object Storage will not be available.')
    return null
  }

  // Handle escaped newlines from environment variables
  const privateKey = privateKeyRaw.replace(/\\n/g, '\n')

  const provider = new oci.common.SimpleAuthenticationDetailsProvider(
    tenancy,
    user,
    fingerprint,
    privateKey,
    null,
    oci.common.Region.fromRegionId(region)
  )

  return provider as unknown as oci.common.ConfigFileAuthenticationDetailsProvider
})()

// Object Storage client
let objectStorageClient: oci.objectstorage.ObjectStorageClient | null = null
let namespace: string | null = null

if (config) {
  objectStorageClient = new oci.objectstorage.ObjectStorageClient({
    authenticationDetailsProvider: config,
  })
}

// Get namespace (cached)
async function getNamespace(): Promise<string> {
  if (namespace) return namespace
  if (!objectStorageClient) throw new Error('OCI not configured')

  const response = await objectStorageClient.getNamespace({})
  namespace = response.value
  return namespace
}

// Bucket names from environment
const BUCKET_NAME = process.env.OCI_BUCKET_NAME || 'jaehyeong-tech-uploads'
const BACKUP_BUCKET_NAME = process.env.OCI_BACKUP_BUCKET_NAME || BUCKET_NAME

// Upload file to Object Storage
export async function uploadToOCI(
  fileName: string,
  fileBuffer: Buffer,
  contentType: string,
  folder: string = 'images'
): Promise<string> {
  if (!objectStorageClient) {
    throw new Error('OCI Object Storage is not configured')
  }

  const ns = await getNamespace()
  const objectName = `${folder}/${fileName}`

  await objectStorageClient.putObject({
    namespaceName: ns,
    bucketName: BUCKET_NAME,
    objectName,
    putObjectBody: fileBuffer,
    contentType,
  })

  // Return public URL
  const region = process.env.OCI_REGION || 'ap-chuncheon-1'
  return `https://objectstorage.${region}.oraclecloud.com/n/${ns}/b/${BUCKET_NAME}/o/${encodeURIComponent(objectName)}`
}

// Delete file from Object Storage
export async function deleteFromOCI(objectName: string): Promise<void> {
  if (!objectStorageClient) {
    throw new Error('OCI Object Storage is not configured')
  }

  const ns = await getNamespace()

  await objectStorageClient.deleteObject({
    namespaceName: ns,
    bucketName: BUCKET_NAME,
    objectName,
  })
}

// List objects in a folder
export async function listObjects(folder: string = ''): Promise<string[]> {
  if (!objectStorageClient) {
    throw new Error('OCI Object Storage is not configured')
  }

  const ns = await getNamespace()

  const response = await objectStorageClient.listObjects({
    namespaceName: ns,
    bucketName: BUCKET_NAME,
    prefix: folder,
  })

  return response.listObjects.objects?.map((obj) => obj.name || '') || []
}

// Download file from Object Storage
export async function downloadFromOCI(objectName: string): Promise<Buffer> {
  if (!objectStorageClient) {
    throw new Error('OCI Object Storage is not configured')
  }

  const ns = await getNamespace()

  const response = await objectStorageClient.getObject({
    namespaceName: ns,
    bucketName: BUCKET_NAME,
    objectName,
  })

  // Read stream to buffer
  const chunks: Buffer[] = []
  const stream = response.value as NodeJS.ReadableStream

  return new Promise((resolve, reject) => {
    stream.on('data', (chunk: Buffer) => chunks.push(chunk))
    stream.on('end', () => resolve(Buffer.concat(chunks)))
    stream.on('error', reject)
  })
}

// Check if OCI is configured
export function isOCIConfigured(): boolean {
  return objectStorageClient !== null
}

// Check if backup bucket is configured (separate from main bucket)
export function isBackupBucketConfigured(): boolean {
  return objectStorageClient !== null && !!process.env.OCI_BACKUP_BUCKET_NAME
}

// ===== Backup Bucket Functions (Private Bucket) =====

// Upload file to Backup Bucket
export async function uploadToBackupBucket(
  fileName: string,
  fileBuffer: Buffer,
  contentType: string,
  folder: string = 'backups'
): Promise<string> {
  if (!objectStorageClient) {
    throw new Error('OCI Object Storage is not configured')
  }

  const ns = await getNamespace()
  const objectName = `${folder}/${fileName}`

  await objectStorageClient.putObject({
    namespaceName: ns,
    bucketName: BACKUP_BUCKET_NAME,
    objectName,
    contentType,
    putObjectBody: fileBuffer,
  })

  // Return object path (not public URL since bucket is private)
  return objectName
}

// Download file from Backup Bucket
export async function downloadFromBackupBucket(objectName: string): Promise<Buffer> {
  if (!objectStorageClient) {
    throw new Error('OCI Object Storage is not configured')
  }

  const ns = await getNamespace()

  const response = await objectStorageClient.getObject({
    namespaceName: ns,
    bucketName: BACKUP_BUCKET_NAME,
    objectName,
  })

  const value = response.value

  // Handle different response types
  if (Buffer.isBuffer(value)) {
    return value
  }

  if (value instanceof Uint8Array) {
    return Buffer.from(value)
  }

  // Handle ReadableStream (Node.js stream)
  if (typeof (value as NodeJS.ReadableStream)?.on === 'function') {
    const stream = value as NodeJS.ReadableStream
    const chunks: Buffer[] = []
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => chunks.push(chunk))
      stream.on('end', () => resolve(Buffer.concat(chunks)))
      stream.on('error', reject)
    })
  }

  // Handle Web ReadableStream
  if (typeof (value as ReadableStream)?.getReader === 'function') {
    const reader = (value as ReadableStream).getReader()
    const chunks: Uint8Array[] = []
    while (true) {
      const { done, value: chunk } = await reader.read()
      if (done) break
      if (chunk) chunks.push(chunk)
    }
    return Buffer.concat(chunks.map(c => Buffer.from(c)))
  }

  throw new Error(`Unexpected response type from OCI: ${typeof value}`)
}

// List objects in Backup Bucket
export async function listBackupObjects(folder: string = ''): Promise<string[]> {
  if (!objectStorageClient) {
    throw new Error('OCI Object Storage is not configured')
  }

  const ns = await getNamespace()

  const response = await objectStorageClient.listObjects({
    namespaceName: ns,
    bucketName: BACKUP_BUCKET_NAME,
    prefix: folder,
  })

  return response.listObjects.objects?.map((obj) => obj.name || '') || []
}

// Delete file from Backup Bucket
export async function deleteFromBackupBucket(objectName: string): Promise<void> {
  if (!objectStorageClient) {
    throw new Error('OCI Object Storage is not configured')
  }

  const ns = await getNamespace()

  await objectStorageClient.deleteObject({
    namespaceName: ns,
    bucketName: BACKUP_BUCKET_NAME,
    objectName,
  })
}

export { objectStorageClient, BUCKET_NAME, BACKUP_BUCKET_NAME }
