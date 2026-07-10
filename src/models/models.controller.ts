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
  async streamChat(
    @Body() { message, system }: { message: string; system: string },
    @Res() response: Response,
  ) {
    return this.modelsService.streamChat({
      message,
      system,
      response,
    });
  }
}
