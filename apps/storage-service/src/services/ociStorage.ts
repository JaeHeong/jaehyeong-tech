import * as os from 'oci-objectstorage';
import * as common from 'oci-common';

class OCIStorageService {
  private client: os.ObjectStorageClient | null = null;
  private namespace: string = '';
  private bucket: string = '';

  async initialize() {
    try {
      const region = process.env.OCI_REGION || 'ap-seoul-1';
      const namespace = process.env.OCI_NAMESPACE;
      const bucket = process.env.OCI_BUCKET;
      const accessKey = process.env.OCI_ACCESS_KEY;
      const secretKey = process.env.OCI_SECRET_KEY;

      if (!namespace || !bucket || !accessKey || !secretKey) {
        console.warn('⚠️ OCI credentials not configured, storage will not work');
        return;
      }

      this.namespace = namespace;
      this.bucket = bucket;

      // OCI 인증 설정
      const provider = new common.SimpleAuthenticationDetailsProvider(
        '', // tenancy
        '', // user
        '', // fingerprint
        '', // privateKey
        '', // passphrase
        common.Region.fromRegionId(region)
      );

      // API Key 인증 사용
      provider.getKeyId = () => accessKey;

      this.client = new os.ObjectStorageClient({ authenticationDetailsProvider: provider });

      console.info('✅ OCI Object Storage connected');
    } catch (error) {
      console.error('❌ OCI Object Storage connection failed:', error);
    }
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
    const region = process.env.OCI_REGION || 'ap-seoul-1';
    return `https://objectstorage.${region}.oraclecloud.com/n/${this.namespace}/b/${this.bucket}/o/${objectName}`;
  }
}

export const ociStorage = new OCIStorageService();
