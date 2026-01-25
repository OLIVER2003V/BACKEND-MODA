import { Injectable, Logger } from '@nestjs/common';
import { Storage } from '@google-cloud/storage';
import { envs } from 'src/config/envs';

export interface UploadedFile {
  url: string;
  fileName: string;
  bucket: string;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private storage: Storage;
  private bucketName: string;

  constructor() {
    const { gcs } = envs;

    if (!gcs.keyFilePath || !gcs.bucketName) {
      this.logger.warn(
        'GCS credentials not configured. Storage service will not work.',
      );
      return;
    }

    this.bucketName = gcs.bucketName;
    this.storage = new Storage({
      keyFilename: gcs.keyFilePath,
    });

    this.logger.log('GCS Storage initialized successfully');
  }

  // ---------- UPLOAD DESDE MULTER ----------
  async uploadFile(
    file: Express.Multer.File,
    folder?: string,
  ): Promise<UploadedFile> {
    this.ensureStorage();

    const bucket = this.storage.bucket(this.bucketName);
    const fileName = this.generateFileName(file.originalname, folder);
    const blob = bucket.file(fileName);

    await blob.save(file.buffer, {
      contentType: file.mimetype,
      metadata: {
        originalName: file.originalname,
      },
    });

    // 🔐 URL firmada (NO pública)
    const url = await this.getSignedUrl(fileName);

    this.logger.log(`File uploaded: ${fileName}`);

    return {
      url,
      fileName,
      bucket: this.bucketName,
    };
  }

  // ---------- UPLOAD DESDE BUFFER ----------
  async uploadBuffer(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    folder?: string,
  ): Promise<UploadedFile> {
    this.ensureStorage();

    const bucket = this.storage.bucket(this.bucketName);
    const fileName = this.generateFileName(originalName, folder);
    const blob = bucket.file(fileName);

    await blob.save(buffer, {
      contentType: mimeType,
      metadata: {
        originalName,
      },
    });

    // 🔐 URL firmada (NO pública)
    const url = await this.getSignedUrl(fileName);

    this.logger.log(`File uploaded: ${fileName}`);

    return {
      url,
      fileName,
      bucket: this.bucketName,
    };
  }

  // ---------- DELETE ----------
  async deleteFile(fileName: string): Promise<void> {
    this.ensureStorage();

    const bucket = this.storage.bucket(this.bucketName);
    await bucket.file(fileName).delete();

    this.logger.log(`File deleted: ${fileName}`);
  }

  // ---------- SIGNED URL ----------
  async getSignedUrl(
    fileName: string,
    expiresInMinutes = 5760,
  ): Promise<string> {
    this.ensureStorage();

    const bucket = this.storage.bucket(this.bucketName);
    const [url] = await bucket.file(fileName).getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + expiresInMinutes * 60 * 1000,
    });

    return url;
  }

  // ---------- HELPERS ----------
  private ensureStorage() {
    if (!this.storage || !this.bucketName) {
      throw new Error('Storage service is not configured');
    }
  }

  private generateFileName(originalName: string, folder?: string): string {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const extension = originalName.split('.').pop();
    const baseName = originalName
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9]/g, '_');

    const fileName = `${baseName}_${timestamp}_${randomString}.${extension}`;

    return folder ? `${folder}/${fileName}` : fileName;
  }
}
