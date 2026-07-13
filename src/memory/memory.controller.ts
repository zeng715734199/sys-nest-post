import { Controller, Post, Body } from '@nestjs/common';
import { MemoryService } from './memory.service';
import { generateUUID } from '../utils';

@Controller('memory')
export class MemoryController {
  constructor(private readonly memoryService: MemoryService) {}

  @Post('chat')
  memoryChat(@Body() body: { message: string; sessionId?: string }) {
    const sessionId = body.sessionId || generateUUID();
    return this.memoryService.memoryChat(sessionId, body.message);
  }
}
