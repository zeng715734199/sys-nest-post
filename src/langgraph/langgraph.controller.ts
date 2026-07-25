import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { LanggraphService } from './langgraph.service';
import { ArticleService } from './article.service';
import { ReactAgentService } from './react-agent.service';
import { RoutingService } from './routing.service';
import { ParallelService } from './parallel.service';
import { SupervisorService } from './supervisor.service';
import { PipelineService } from './pipeline.service';
import { CodeReviewService } from './code-review.service';

@Controller('langgraph')
export class LanggraphController {
  constructor(
    private readonly svc: LanggraphService,
    private readonly articleSvc: ArticleService,
    private readonly reactSvc: ReactAgentService,
    private readonly routingSvc: RoutingService,
    private readonly parallelSvc: ParallelService,
    private readonly supervisorSvc: SupervisorService,
    private readonly pipelineSvc: PipelineService,
    private readonly codeReviewSvc: CodeReviewService,
  ) {}

  // ── 第一章接口 ──────────────────────────────────────
  // 工作流一：无记忆简单问答
  @Post('simple-chat')
  simpleChat(@Body() body: { message: string }) {
    return this.svc.simpleChat(body.message).then((answer) => ({ answer }));
  }

  // 工作流二：有记忆多轮对话
  @Post('memory-chat')
  memoryChat(@Body() body: { threadId: string; message: string }) {
    return this.svc
      .memoryChat(body.threadId, body.message)
      .then((answer) => ({ answer }));
  }

  // 工作流二：查看对话历史
  @Get('history/:threadId')
  getHistory(@Param('threadId') threadId: string) {
    return this.svc.getHistory(threadId);
  }

  // 工作流三：文章摘要流水线
  @Post('article')
  processArticle(@Body() body: { article: string }) {
    return this.articleSvc.process(body.article);
  }

  // ── 第二章接口 ──────────────────────────────────────
  @Post('react-chat')
  reactChat(@Body() body: { threadId: string; message: string }) {
    return this.reactSvc
      .chat(body.threadId, body.message)
      .then((answer) => ({ answer }));
  }

  @Post('route')
  route(@Body() body: { input: string }) {
    return this.routingSvc.handle(body.input);
  }

  @Post('parallel')
  parallel(@Body() body: { task: string }) {
    return this.parallelSvc.run(body.task);
  }

  // ── 第三章 ──────────────────────────────────────────
  @Post('supervisor')
  supervisor(@Body() body: { input: string }) {
    return this.supervisorSvc.run(body.input);
  }

  @Post('pipeline')
  pipeline(@Body() body: { topic: string }) {
    return this.pipelineSvc.createContent(body.topic);
  }

  @Post('code-review')
  codeReview(@Body() body: { code: string; language?: string }) {
    return this.codeReviewSvc.review(body.code, body.language);
  }
}
