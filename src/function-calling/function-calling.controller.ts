import { Controller, Post, Body } from '@nestjs/common';
import { FunctionCallingService } from './function-calling.service';

@Controller('function-calling')
export class FunctionCallingController {
  constructor(private readonly fcService: FunctionCallingService) {}

  // POST /function-calling/run → 执行 Function Calling
  @Post('run')
  run(@Body() body: { message: string }) {
    return this.fcService.runFunctionCalling(body.message);
  }
}
