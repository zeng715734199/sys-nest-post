import { Controller, Post, Get, Delete, Body } from '@nestjs/common';
import { RagService } from './rag.service';

@Controller('rag')
export class RagController {
  constructor(private readonly ragService: RagService) {}

  // POST /rag/load → 加载文档到知识库
  @Post('load')
  loadDocuments(
    @Body()
    body: {
      documents: { id: string; content: string; source?: string }[];
    },
  ) {
    return this.ragService.loadDocuments(body.documents);
  }

  // POST /rag/search → 纯向量检索（不过大模型）
  @Post('search')
  search(@Body() body: { query: string; topK?: number }) {
    return this.ragService.search(body.query, body.topK);
  }

  // POST /rag/query → 完整 RAG 问答
  @Post('query')
  query(@Body() body: { question: string; topK?: number }) {
    return this.ragService.query(body.question, body.topK);
  }

  // GET /rag/status → 知识库状态
  @Get('status')
  getStatus() {
    return this.ragService.getStatus();
  }

  // DELETE /rag/clear → 清空知识库
  @Delete('clear')
  clearKnowledge() {
    return this.ragService.clearKnowledge();
  }
}
