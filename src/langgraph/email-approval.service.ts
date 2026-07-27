import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  StateGraph,
  START,
  END,
  Annotation,
  Command,
  INTERRUPT,
  interrupt,
  isInterrupted,
  MemorySaver,
} from '@langchain/langgraph';
import { HumanMessage } from '@langchain/core/messages';
import { BaseLLM } from 'src/llm';

const ApprovalEmailState = Annotation.Root({
  // 邮件需求描述
  emailRequest: Annotation<string>(),
  // 修改意见
  feedback: Annotation<string>(),
  // 上一轮邮件内容
  emailJsonContent: Annotation<string>(),
  // 起草轮次
  draftRoundCount: Annotation<number>({
    reducer: (pre, cur) => pre + cur,
  }),
  // 邮件状态（pending/approve/reject/modify）
  approvalStatus: Annotation<ApprovalStatus>(),
  // 最终状态描述
  finalStatus: Annotation<string>(),
});

type ApprovalStatus = 'pending' | 'approve' | 'reject' | 'modify';

type ApprovalResume =
  | 'approve'
  | 'reject'
  | {
      action: 'modify';
      feedback: string;
    };

type EmailReviewInterrupt = {
  type: 'email_review';
  message: string;
  draft: string;
  options: {
    approve: string;
    reject: string;
    modify: string;
  };
};

const emailApprovalInterrupt = interrupt<EmailReviewInterrupt, ApprovalResume>;

const handleParseJson = (emailJsonContent: string) => {
  let parsedJson: {
    subject: string;
    recipientEmail: string;
    content: string;
  };
  try {
    const json = emailJsonContent.replace(/```json\n?|\n?```/g, '').trim();
    parsedJson = JSON.parse(json);
  } catch {
    parsedJson = {
      subject: '草稿',
      recipientEmail: '未知',
      content: emailJsonContent,
    };
  }
  return parsedJson;
};
@Injectable()
export class EmailApprovalService extends BaseLLM implements OnModuleInit {
  private EmailApprovalGraph!: ReturnType<typeof this.buildEmailApprovalGraph>;
  /**
    START → draftEmail → waitForApproval（interrupt 暂停）
                          ↓ Command({ resume })
              ┌── 'approve' ──→ sendEmail       → END
              ├── 'reject'  ──→ rejectSendEmail → END
              └── { action:'modify', feedback:'' } ──→ draftEmail（重新起草，循环）

    START → draftEmail
    1. 邮件需求描述
    2. 重新起草：邮件需求描述 + 修改意见 + 上一轮邮件内容
    3. 起草轮次
    draftEmail -> waitForApproval
    1. 状态（approved/rejected/modify）
    2. modify需要feedback（修改意见）
   */
  buildEmailApprovalGraph() {
    const draftEmail = async (state: typeof ApprovalEmailState.State) => {
      const { emailRequest, feedback, emailJsonContent, approvalStatus } =
        state;
      const parsedJson = handleParseJson(emailJsonContent);
      const prompt =
        approvalStatus === 'modify'
          ? `请根据修改意见和上一轮邮件内容重新起草邮件。\n- 修改意见\n${feedback}\n- 上一轮邮件内容\n邮件主题：${parsedJson.subject}；收件人邮箱：${parsedJson.recipientEmail}；邮件内容：${parsedJson.content}`
          : `请根据邮件需求描述起草邮件。\n- 邮件需求描述\n${emailRequest}`;
      const response = await this.llm.invoke([
        new HumanMessage(
          `${prompt}\n\n***只允许输出JSON格式数据（不需要其他内容），如：{"subject":"xxx","recipientEmail":"xxx@xxx.com","content":"xxx}。***\n邮件主题-subject; 收件人邮箱-recipientEmail; 邮件内容-content;`,
        ),
      ]);
      return {
        approvalStatus: 'pending' as const,
        emailJsonContent: response.content,
        draftRoundCount: emailJsonContent ? 1 : 0,
      };
    };

    const waitForApproval = async (state: typeof ApprovalEmailState.State) => {
      const { emailJsonContent } = state;
      const parsedJson = handleParseJson(emailJsonContent);
      const decision = emailApprovalInterrupt({
        type: 'email_review',
        message: `请审查邮件草稿（第 ${state.draftRoundCount + 1} 版）`,
        draft: `- 邮件主题\n${parsedJson.subject}\n- 收件人邮箱\n${parsedJson.recipientEmail}\n- 邮件内容\n${parsedJson.content}`,
        options: {
          approve: '批准发送',
          reject: '拒绝（取消发送）',
          modify: '需要修改（附修改意见）',
        },
      });

      if (['approve', 'reject'].includes(decision as string)) {
        return { approvalStatus: decision };
      }
      if (
        decision &&
        typeof decision === 'object' &&
        decision.action === 'modify'
      ) {
        return {
          approvalStatus: 'modify',
          feedback: decision.feedback,
        };
      }
      return {
        approvalStatus: 'reject',
      };
    };

    const sendEmail = async (state: typeof ApprovalEmailState.State) => {
      const { emailJsonContent } = state;
      const parsedJson = handleParseJson(emailJsonContent);
      console.log(parsedJson, '已发送');
      return {
        finalStatus: `邮件已发送，收件人邮箱：${parsedJson.recipientEmail}，邮件主题：${parsedJson.subject}，邮件内容：${parsedJson.content}`,
      };
    };

    const rejectSendEmail = async (state: typeof ApprovalEmailState.State) => {
      const { emailJsonContent } = state;
      const parsedJson = handleParseJson(emailJsonContent);
      console.log(parsedJson, '拒绝发送');
      return { finalStatus: '邮件已拒绝发送！' };
    };

    return new StateGraph(ApprovalEmailState, {
      interrupt: emailApprovalInterrupt,
    })
      .addNode('draftEmail', draftEmail)
      .addNode('waitForApproval', waitForApproval)
      .addNode('sendEmail', sendEmail)
      .addNode('rejectSendEmail', rejectSendEmail)
      .addEdge(START, 'draftEmail')
      .addEdge('draftEmail', 'waitForApproval')
      .addConditionalEdges(
        'waitForApproval',
        (state: typeof ApprovalEmailState.State) => {
          switch (state.approvalStatus) {
            case 'modify':
              return 'draftEmail';
            case 'approve':
              return 'sendEmail';
            case 'reject':
              return 'rejectSendEmail';
            default:
              return END;
          }
        },
        {
          draftEmail: 'draftEmail',
          sendEmail: 'sendEmail',
          rejectSendEmail: 'rejectSendEmail',
          [END]: END,
        },
      )
      .addEdge('sendEmail', END)
      .addEdge('rejectSendEmail', END)
      .compile({ checkpointer: new MemorySaver() });
  }
  onModuleInit() {
    this.EmailApprovalGraph = this.buildEmailApprovalGraph();
  }
  async start(request: string, threadId: string) {
    const result = await this.EmailApprovalGraph.invoke(
      {
        emailRequest: request,
      },
      { configurable: { thread_id: threadId } },
    );
    if (isInterrupted<EmailReviewInterrupt>(result)) {
      return {
        status: 'waiting_for_approval',
        threadId,
        reviewData: result[INTERRUPT][0].value,
        message: '邮件草稿已生成，请审批',
      };
    }
    return {
      status: 'completed',
      result,
    };
  }
  async approve(threadId: string) {
    const response = await this.EmailApprovalGraph.invoke(
      new Command({
        resume: 'approve',
      }),
      { configurable: { thread_id: threadId } },
    );
    if (!Object.keys(response).length) {
      return { code: 500, message: '接受了个寂寞' };
    }
    return { status: 'email_sent', message: response.finalStatus };
  }

  async reject(threadId: string) {
    const response = await this.EmailApprovalGraph.invoke(
      new Command({
        resume: 'reject',
      }),
      { configurable: { thread_id: threadId } },
    );
    if (!Object.keys(response).length) {
      return { code: 500, message: '拒绝了个寂寞' };
    }
    return { status: 'email_rejected', message: response.finalStatus };
  }
  async requestModify(threadId: string, feedback: string) {
    const result = await this.EmailApprovalGraph.invoke(
      new Command({
        resume: {
          action: 'modify',
          feedback,
        },
      }),
      { configurable: { thread_id: threadId } },
    );
    if (isInterrupted<EmailReviewInterrupt>(result)) {
      return {
        status: 'waiting_for_approval',
        reviewData: result[INTERRUPT][0].value,
        message: '邮件已修改，请重新审批',
      };
    }
    return { status: 'completed' };
  }
  async getState(threadId: string) {
    const state = await this.EmailApprovalGraph.getState({
      configurable: { thread_id: threadId },
    });
    return state.values;
  }
}
