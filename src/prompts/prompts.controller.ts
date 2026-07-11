import { Body, Controller, Post } from '@nestjs/common';
import { PromptsService } from './prompts.service';

@Controller('prompts')
export class PromptsController {
  constructor(private readonly promptsService: PromptsService) {}
  @Post('translate')
  translate(
    @Body()
    { text, targetLanguage }: { text: string; targetLanguage: string },
  ) {
    return this.promptsService.translate(text, targetLanguage);
  }
}
