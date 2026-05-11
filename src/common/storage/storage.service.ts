import { Injectable, Logger } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { envs } from 'src/config/envs';
import { Readable } from 'node:stream';

export interface UploadedFile {
  url: string;
  fileName: string;
  bucket: string;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  constructor() {
    const { cloudName, apiKey, apiSecret } = envs.cloudinary;

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
    });

    this.logger.log('Cloudinary Storage initialized successfully');
  }

  async uploadFile(
    file: Express.Multer.File,
    folder?: string,
  ): Promise<UploadedFile> {
    const result = await this.uploadStream(file.buffer, file.mimetype, folder);
    this.logger.log(`File uploaded: ${result.public_id}`);
    return {
      url: result.secure_url,
      fileName: result.public_id,
      bucket: envs.cloudinary.cloudName,
    };
  }

  async uploadBuffer(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    folder?: string,
  ): Promise<UploadedFile> {
    const result = await this.uploadStream(buffer, mimeType, folder);
    this.logger.log(`File uploaded: ${result.public_id}`);
    return {
      url: result.secure_url,
      fileName: result.public_id,
      bucket: envs.cloudinary.cloudName,
    };
  }

  async deleteFile(fileName: string): Promise<void> {
    await cloudinary.uploader.destroy(fileName);
    this.logger.log(`File deleted: ${fileName}`);
  }

  async getSignedUrl(fileName: string): Promise<string> {
    const result = await cloudinary.api.resource(fileName);
    return result.secure_url;
  }

  private uploadStream(
    buffer: Buffer,
    mimeType: string,
    folder?: string,
  ): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const options: Record<string, unknown> = {
        resource_type: 'auto',
      };
      if (folder) options.folder = folder;

      const uploadStream = cloudinary.uploader.upload_stream(
        options,
        (error, result) => {
          if (error) return reject(new Error(error.message));
          resolve(result!);
        },
      );

      Readable.from(buffer).pipe(uploadStream);
    });
  }
}
