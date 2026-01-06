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

// Bucket name from environment
const BUCKET_NAME = process.env.OCI_BUCKET_NAME || 'jaehyeong-tech-uploads'

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

export { objectStorageClient, BUCKET_NAME }
