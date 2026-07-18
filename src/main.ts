import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3000);
}

// TODO : 暂时关闭 CORS，后续需要根据需求开启
// async function bootstrap() {
//   const app = await NestFactory.create(AppModule);

//   // 开启全局 CORS 支持，这样 NestJS 会自动处理 OPTIONS 预检请求
//   app.enableCors({
//     origin: '*', // 允许所有来源，生产环境建议指定具体域名
//     methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
//     credentials: true,
//   });
//   await app.listen(3000);
// }

bootstrap();
