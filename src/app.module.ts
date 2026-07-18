import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './user/user.module';
import { PrismaModule } from './prisma/prisma.module';
import { PostModule } from './post/post.module';
import { ConfigModule } from '@nestjs/config';
import { McpClientModule } from './mcp-client/mcp-client.module';
import { McpAgentModule } from './mcp-agent/mcp-agent.module';
import { ChainsModule } from './chains/chains.module';
import { AgentsModule } from './agents/agents.module';
import { MemoryModule } from './memory/memory.module';
import { RagModule } from './rag/rag.module';
import { FunctionCallingModule } from './function-calling/function-calling.module';
import { ModelsModule } from './models/models.module';
import { PromptsModule } from './prompts/prompts.module';
import { RagDbModule } from './rag-db/rag-db.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // 🌟 设为全局模块，其他模块不需要再 import ConfigModule
    }),
    UserModule,
    PostModule,
    PrismaModule,
    McpClientModule,
    McpAgentModule,
    ChainsModule,
    AgentsModule,
    MemoryModule,
    RagModule,
    FunctionCallingModule,
    ModelsModule,
    PromptsModule,
    RagDbModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
