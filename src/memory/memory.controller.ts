import type { Response } from 'express';
import {
  Controller,
  Post,
  Body,
  Res,
  Get,
  Param,
  Delete,
} from '@nestjs/common';
import { MemoryService } from './memory.service';
import { generateUUID } from '../utils';

@Controller('memory')
export class MemoryController {
  constructor(private readonly memoryService: MemoryService) {}
  // POST /memory/chat → 多轮对话（普通）
  @Post('chat')
  memoryChat(@Body() body: { message: string; sessionId?: string }) {
    // 没有提供sessionId，则生成一个
    const sessionId = body.sessionId || generateUUID();
    return this.memoryService.memoryChat(sessionId, body.message);
  }
  // POST /memory/chat-stream → 多轮对话（流式）
  @Post('chat-stream')
  chatStream(
    @Body() body: { sessionId: string; message: string },
    @Res() res: Response,
  ) {
    return this.memoryService.chatStream(body.sessionId, body.message, res);
  }

  // GET /memory/history/:sessionId → 查看会话历史
  @Get('history/:sessionId')
  getHistory(@Param('sessionId') sessionId: string) {
    return this.memoryService.getHistory(sessionId);
  }

  // DELETE /memory/session/:sessionId → 清空会话
  @Delete('session/:sessionId')
  clearSession(@Param('sessionId') sessionId: string) {
    return this.memoryService.clearSession(sessionId);
  }

  // GET /memory/sessions → 所有会话列表
  @Get('sessions')
  listSessions() {
    return this.memoryService.listSessions();
  }
}
