import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: parseInt(process.env.PORT as string, 10) || 3000,
  env: process.env.NODE_ENV || 'development',
  apiPrefix: process.env.API_PREFIX || 'api/v1',
  fieldEncryptionKey: process.env.FIELD_ENCRYPTION_KEY || '',
  aiServiceUrl: process.env.AI_SERVICE_URL || 'http://localhost:8001',
}));
