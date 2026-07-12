import { Body, Controller, Post } from '@nestjs/common';
import { ChainsService } from './chains.service';

@Controller('chains')
export class ChainsController {
  constructor(private readonly chainsService: ChainsService) {}
  @Post('polish')
  polishArticle(@Body() body: { article: string }) {
    return this.chainsService.polishArticle(body.article);
  }
}
