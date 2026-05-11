import 'dotenv/config';
import * as joi from 'joi';

interface EnvVars {
  PORT: number;
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN?: number;
  // Cloudinary
  CLOUDINARY_CLOUD_NAME: string;
  CLOUDINARY_API_KEY: string;
  CLOUDINARY_API_SECRET: string;
  // Firebase
  FIREBASE_KEYFILE_PATH?: string;
  OPENAI_API_KEY?: string;
  GEMINI_API_KEY: string;
  OPENROUTER_API_KEY: string;
  GROQ_API_KEY: string;
  HF_TOKEN: string;
  CF_ACCOUNT_ID: string;
  CF_API_TOKEN: string;
}

const envVarsSchema = joi
  .object({
    PORT: joi.number().required(),
    DATABASE_URL: joi.string().required(),
    JWT_SECRET: joi.string().required(),
    JWT_EXPIRES_IN: joi.number().optional(),
    // Cloudinary
    CLOUDINARY_CLOUD_NAME: joi.string().required(),
    CLOUDINARY_API_KEY: joi.string().required(),
    CLOUDINARY_API_SECRET: joi.string().required(),
    // Firebase
    FIREBASE_KEYFILE_PATH: joi.string().optional(),
    OPENAI_API_KEY: joi.string().optional(),
    GEMINI_API_KEY: joi.string().required(),
    OPENROUTER_API_KEY: joi.string().required(),
    GROQ_API_KEY: joi.string().required(),
    HF_TOKEN: joi.string().required(),
    CF_ACCOUNT_ID: joi.string().required(),
    CF_API_TOKEN: joi.string().required(),
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
  // Cloudinary
  cloudinary: {
    cloudName: envVars.CLOUDINARY_CLOUD_NAME,
    apiKey: envVars.CLOUDINARY_API_KEY,
    apiSecret: envVars.CLOUDINARY_API_SECRET,
  },
  // Firebase
  firebase: {
    keyFilePath: envVars.FIREBASE_KEYFILE_PATH,
  },
  openaiApiKey: envVars.OPENAI_API_KEY,
  geminiApiKey: envVars.GEMINI_API_KEY,
  openrouterApiKey: envVars.OPENROUTER_API_KEY,
  groqApiKey: envVars.GROQ_API_KEY,
  hfToken: envVars.HF_TOKEN,
  cfAccountId: envVars.CF_ACCOUNT_ID,
  cfApiToken: envVars.CF_API_TOKEN,
};
