import { Body, Controller, Post } from '@nestjs/common';
import { ModelsService } from './models.service';

@Controller('models')
export class ModelsController {
  constructor(private readonly modelsService: ModelsService) {}
  @Post('create')
  baseChat(@Body() { message }: { message: string }) {
    return this.modelsService.baseChat(message);
  }
}
