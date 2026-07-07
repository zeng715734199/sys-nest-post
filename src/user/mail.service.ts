import { Injectable } from '@nestjs/common';

@Injectable()
export class MailService {
  sendMail(info: any) {
    console.log(
      `邮件发送成功，用户名${info.name}，id：${info.id}，时间${info.createTime}`,
    );
  }
}
