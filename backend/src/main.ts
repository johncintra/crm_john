import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: false
  });

  const configService = app.get(ConfigService);
  const corsOrigin = configService.get<string>('app.corsOrigin') ?? '';
  const origins = corsOrigin
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  app.enableCors({
    origin: origins.length ? origins : true,
    credentials: false
  });

  app.setGlobalPrefix('');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true
      }
    })
  );

  const port = configService.get<number>('app.port') ?? 3000;
  await app.listen(port);
  console.log(`Backend running on http://localhost:${port}`);
}

void bootstrap();
