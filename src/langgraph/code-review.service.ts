import { Injectable } from '@nestjs/common';

@Injectable()
export class CodeReviewService {
  review(code: string, language?: string) {}
}
