import { Injectable, OnModuleInit } from '@nestjs/common';
import { StateGraph, START, END, Annotation } from '@langchain/langgraph';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { BaseLLM } from 'src/llm';

const CategoryState = Annotation.Root({
  question: Annotation<string>(),
  category: Annotation<string>(), // classify 写入，路由函数读取
  answer: Annotation<string>(),
});

@Injectable()
export class RoutingService extends BaseLLM implements OnModuleInit {
  private classifyGraph!: ReturnType<typeof this.buildClassifyGraph>;
  constructor() {
    super({ temperature: 0 });
  }
  private buildClassifyGraph() {
    const classifyRouter = async (state: typeof CategoryState.State) => {
      const prompt = ChatPromptTemplate.fromMessages([
        [
          'system',
          `你是一个问题智能分类助手，能根据用户的提问内容进行问题分类，输出对应问题类型的code。
如：
- 技术类问题-code: technical
- 订单、价格问题-code: pricing
- 其他类型的问题-code: general

- ***每次回答只允许输出code，不要有其他内容!***。

提问内容: {question}
`,
        ],
      ]);
      const chain = prompt
        .pipe(this.llm)
        .pipe(new StringOutputParser())
        .pipe((text: string) =>
          text.replace(/^(assistant|ai|system|user)[:\s\n]*/i, '').trim(),
        );
      const category = await chain.invoke({ question: state.question });
      return {
        category: ['technical', 'pricing', 'general'].includes(category)
          ? category
          : 'general', // 如果 LLM 返回了无效值，兜底用 general
      };
    };
    const resolveHandler = (systemMsg: string) => {
      return async (state: typeof CategoryState.State) => {
        const messages = [
          new SystemMessage(systemMsg),
          new HumanMessage(state.question),
        ];
        const response = await this.llm.invoke(messages);
        return {
          answer: response.content,
        };
      };
    };
    return new StateGraph(CategoryState)
      .addNode('classify', classifyRouter)
      .addNode(
        'technical',
        resolveHandler('你是技术专家，给出专业的技术解答。'),
      )
      .addNode(
        'pricing',
        resolveHandler(
          '你是商务专员，友好回答，具体价格引导联系 sales@example.com。',
        ),
      )
      .addNode('general', resolveHandler('你是客服，友好回答用户问题。'))
      .addEdge(START, 'classify')
      .addConditionalEdges(
        'classify',
        (state: typeof CategoryState.State) => state.category,
        {
          technical: 'technical',
          pricing: 'pricing',
          general: 'general',
        },
      )
      .addEdge('technical', END)
      .addEdge('pricing', END)
      .addEdge('general', END)
      .compile();
  }
  onModuleInit() {
    this.classifyGraph = this.buildClassifyGraph();
  }
  async handle(input: string) {
    const response = await this.classifyGraph.invoke({
      question: input,
    });
    return {
      question: input,
      category: response.category,
      answer: response.answer,
    };
  }
}
