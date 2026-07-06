import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
    // 模块初始化，数据库建立连接
    async onModuleInit(){
    //
    }
    // 程序退出的时候，数据库断开连接
    async onModuleDestroy () {
    //
    }
}
