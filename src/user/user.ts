export class User {
  // 用户id
  id: string;
  // 用户名
  name: string;
  // 性别
  gender?: 0 | 1;
  // 创建时间
  createTime: number;
}

export class Pager {
  pageNum: number;
  pageSize: number;
}
