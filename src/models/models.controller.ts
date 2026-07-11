import { Body, Controller, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ModelsService } from './models.service';

@Controller('models')
export class ModelsController {
  constructor(private readonly modelsService: ModelsService) {}
  @Post('chat-basic')
  baseChat(@Body() { message }: { message: string }) {
    return this.modelsService.baseChat(message);
  }
  @Post('chat-system')
  systemChat(@Body() { system, message }: { system: string; message: string }) {
    return this.modelsService.systemChat(system, message);
  }
  @Post('chat-stream')
  streamChat(
    @Body() { message, system }: { message: string; system: string },
    @Res() response: Response,
  ) {
    return this.modelsService.streamChat({
      message,
      system,
      response,
    });
  }
  @Post('chat-parser')
  chatParser(@Body() { message }: { message: string }) {
    return this.modelsService.chatParser(message);
  }
  @Post('chat-parser-chain')
  chatParserChain(
    @Body() { message, role }: { message: string; role: string },
  ) {
    return this.modelsService.chatParserChain(message, role);
  }
}
