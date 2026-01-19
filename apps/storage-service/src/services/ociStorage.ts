import * as oci from 'oci-sdk';

class OCIStorageService {
  private client: oci.objectstorage.ObjectStorageClient | null = null;
  private namespace: string = '';
  private bucket: string = '';
  private backupBucket: string = '';

  async initialize() {
    try {
      const tenancy = process.env.OCI_TENANCY;
      const user = process.env.OCI_USER;
      const fingerprint = process.env.OCI_FINGERPRINT;
      const privateKeyRaw = process.env.OCI_PRIVATE_KEY;
      const region = process.env.OCI_REGION || 'ap-chuncheon-1';

      if (!tenancy || !user || !fingerprint || !privateKeyRaw) {
        console.warn('⚠️ OCI credentials not configured, storage will not work');
        return;
      }

      // Handle escaped newlines from environment variables
      const privateKey = privateKeyRaw.replace(/\\n/g, '\n');

      const provider = new oci.common.SimpleAuthenticationDetailsProvider(
        tenancy,
        user,
        fingerprint,
        privateKey,
        null,
        oci.common.Region.fromRegionId(region)
      );

      this.client = new oci.objectstorage.ObjectStorageClient({
        authenticationDetailsProvider: provider as unknown as oci.common.ConfigFileAuthenticationDetailsProvider,
      });

      // Get namespace
      const nsResponse = await this.client.getNamespace({});
      this.namespace = nsResponse.value;
      this.bucket = process.env.OCI_BUCKET_NAME || 'jaehyeong-tech-uploads';
      this.backupBucket = process.env.OCI_BACKUP_BUCKET_NAME || this.bucket;

      console.info('✅ OCI Object Storage connected');
      console.info(`   Namespace: ${this.namespace}`);
      console.info(`   Bucket: ${this.bucket}`);
      console.info(`   Backup Bucket: ${this.backupBucket}`);
    } catch (error) {
      console.error('❌ OCI Object Storage connection failed:', error);
    }
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  async uploadFile(
    tenantName: string,
    folder: string,
    fileName: string,
    buffer: Buffer,
    mimeType: string
  ): Promise<string> {
    if (!this.client) {
      throw new Error('OCI Object Storage not initialized');
    }

    try {
      // 객체 이름: {tenant}/{folder}/{fileName}
      const objectName = `${tenantName}/${folder}/${fileName}`;

      // 파일 업로드
      await this.client.putObject({
        namespaceName: this.namespace,
        bucketName: this.bucket,
        objectName,
        putObjectBody: buffer,
        contentType: mimeType,
        contentLength: buffer.length,
      });

      // Public URL 생성
      const url = this.getPublicUrl(objectName);

      console.info(`✅ File uploaded to OCI: ${objectName}`);
      return url;
    } catch (error) {
      console.error('❌ Failed to upload file to OCI:', error);
      throw new Error('Failed to upload file to OCI Object Storage');
    }
  }

  async deleteFile(objectName: string): Promise<void> {
    if (!this.client) {
      throw new Error('OCI Object Storage not initialized');
    }

    try {
      await this.client.deleteObject({
        namespaceName: this.namespace,
        bucketName: this.bucket,
        objectName,
      });

      console.info(`✅ File deleted from OCI: ${objectName}`);
    } catch (error) {
      console.error('❌ Failed to delete file from OCI:', error);
      throw new Error('Failed to delete file from OCI Object Storage');
    }
  }

  getPublicUrl(objectName: string): string {
    const region = process.env.OCI_REGION || 'ap-chuncheon-1';
    return `https://objectstorage.${region}.oraclecloud.com/n/${this.namespace}/b/${this.bucket}/o/${encodeURIComponent(objectName)}`;
  }

  // ===== Backup Bucket Methods =====

  async uploadToBackupBucket(
    tenantName: string,
    fileName: string,
    buffer: Buffer,
    mimeType: string
  ): Promise<string> {
    if (!this.client) {
      throw new Error('OCI Object Storage not initialized');
    }

    try {
      const objectName = `${tenantName}/backups/${fileName}`;

      await this.client.putObject({
        namespaceName: this.namespace,
        bucketName: this.backupBucket,
        objectName,
        putObjectBody: buffer,
        contentType: mimeType,
        contentLength: buffer.length,
      });

      console.info(`✅ Backup uploaded to OCI: ${objectName}`);
      return objectName;
    } catch (error) {
      console.error('❌ Failed to upload backup to OCI:', error);
      throw new Error('Failed to upload backup to OCI Object Storage');
    }
  }

  async downloadFromBackupBucket(objectName: string): Promise<Buffer> {
    if (!this.client) {
      throw new Error('OCI Object Storage not initialized');
    }

    try {
      const response = await this.client.getObject({
        namespaceName: this.namespace,
        bucketName: this.backupBucket,
        objectName,
      });

      const value = response.value;

      // Handle different response types
      if (Buffer.isBuffer(value)) {
        return value;
      }

      if (value instanceof Uint8Array) {
        return Buffer.from(value);
      }

      // Handle ReadableStream (Node.js stream)
      if (typeof (value as NodeJS.ReadableStream)?.on === 'function') {
        const stream = value as NodeJS.ReadableStream;
        const chunks: Buffer[] = [];
        return new Promise((resolve, reject) => {
          stream.on('data', (chunk: Buffer) => chunks.push(chunk));
          stream.on('end', () => resolve(Buffer.concat(chunks)));
          stream.on('error', reject);
        });
      }

      // Handle Web ReadableStream
      if (typeof (value as ReadableStream)?.getReader === 'function') {
        const reader = (value as ReadableStream).getReader();
        const chunks: Uint8Array[] = [];
        while (true) {
          const { done, value: chunk } = await reader.read();
          if (done) break;
          if (chunk) chunks.push(chunk);
        }
        return Buffer.concat(chunks.map(c => Buffer.from(c)));
      }

      throw new Error(`Unexpected response type from OCI: ${typeof value}`);
    } catch (error) {
      console.error('❌ Failed to download backup from OCI:', error);
      throw new Error('Failed to download backup from OCI Object Storage');
    }
  }

  async listBackupObjects(tenantName: string): Promise<string[]> {
    if (!this.client) {
      throw new Error('OCI Object Storage not initialized');
    }

    try {
      const prefix = `${tenantName}/backups/`;
      const response = await this.client.listObjects({
        namespaceName: this.namespace,
        bucketName: this.backupBucket,
        prefix,
      });

      return response.listObjects.objects?.map((obj) => obj.name || '') || [];
    } catch (error) {
      console.error('❌ Failed to list backup objects from OCI:', error);
      throw new Error('Failed to list backup objects from OCI Object Storage');
    }
  }

  async deleteFromBackupBucket(objectName: string): Promise<void> {
    if (!this.client) {
      throw new Error('OCI Object Storage not initialized');
    }

    try {
      await this.client.deleteObject({
        namespaceName: this.namespace,
        bucketName: this.backupBucket,
        objectName,
      });

      console.info(`✅ Backup deleted from OCI: ${objectName}`);
    } catch (error) {
      console.error('❌ Failed to delete backup from OCI:', error);
      throw new Error('Failed to delete backup from OCI Object Storage');
    }
  }
}

export const ociStorage = new OCIStorageService();
