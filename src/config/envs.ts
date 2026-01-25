import 'dotenv/config';
import * as joi from 'joi';

interface EnvVars {
  PORT: number;
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN?: number;
  // Google Cloud Storage
  GCS_BUCKET_NAME?: string;
  GCS_KEYFILE_PATH?: string;
  // Firebase
  FIREBASE_KEYFILE_PATH?: string;
  OPENAI_API_KEY: string;
  GEMINI_API_KEY: string;
}

const envVarsSchema = joi
  .object({
    PORT: joi.number().required(),
    DATABASE_URL: joi.string().required(),
    JWT_SECRET: joi.string().required(),
    JWT_EXPIRES_IN: joi.number().optional(),
    // Google Cloud Storage
    GCS_BUCKET_NAME: joi.string().optional(),
    GCS_KEYFILE_PATH: joi.string().optional(),
    // Firebase
    FIREBASE_KEYFILE_PATH: joi.string().optional(),
    OPENAI_API_KEY: joi.string().required(),
    GEMINI_API_KEY: joi.string().required(),
  })
  .unknown(true);

const { error, value } = envVarsSchema.validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

const envVars: EnvVars = value;

export const envs = {
  port: envVars.PORT,
  databaseUrl: envVars.DATABASE_URL,
  jwtSecret: envVars.JWT_SECRET,
  jwtExpiresIn: envVars.JWT_EXPIRES_IN || 3600,
  // Google Cloud Storage
  gcs: {
    bucketName: envVars.GCS_BUCKET_NAME,
    keyFilePath: envVars.GCS_KEYFILE_PATH,
  },
  // Firebase
  firebase: {
    keyFilePath: envVars.FIREBASE_KEYFILE_PATH,
  },
  openaiApiKey: envVars.OPENAI_API_KEY,
  geminiApiKey: envVars.GEMINI_API_KEY,
};