import { dbGet, dbAll, dbRun } from './database';
import { cache } from './cache';
import { log } from './logger';

/**
 * 查询优化器 - 提供缓存、分页、安全查询等功能
 */

interface QueryOptions {
  cache?: boolean;
  cacheTTL?: number;
  cacheKey?: string;
}

interface PaginationOptions {
  page?: number;
  limit?: number;
  offset?: number;
}

interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * 安全的参数化查询执行器
 */
export class QueryBuilder {
  private query: string = '';
  private params: any[] = [];
  private cacheOptions?: QueryOptions;

  constructor(baseQuery: string) {
    this.query = baseQuery;
  }

  /**
   * 添加WHERE条件
   */
  where(condition: string, ...params: any[]): QueryBuilder {
    if (this.query.toLowerCase().includes('where')) {
      this.query += ` AND ${condition}`;
    } else {
      this.query += ` WHERE ${condition}`;
    }
    this.params.push(...params);
    return this;
  }

  /**
   * 添加ORDER BY
   */
  orderBy(column: string, direction: 'ASC' | 'DESC' = 'ASC'): QueryBuilder {
    // 验证列名安全性（防止SQL注入）
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)?$/.test(column)) {
      throw new Error(`Invalid column name: ${column}`);
    }
    
    this.query += ` ORDER BY ${column} ${direction}`;
    return this;
  }

  /**
   * 添加LIMIT
   */
  limit(count: number): QueryBuilder {
    this.query += ` LIMIT ?`;
    this.params.push(count);
    return this;
  }

  /**
   * 添加OFFSET
   */
  offset(count: number): QueryBuilder {
    this.query += ` OFFSET ?`;
    this.params.push(count);
    return this;
  }

  /**
   * 设置缓存选项
   */
  withCache(options: QueryOptions): QueryBuilder {
    this.cacheOptions = options;
    return this;
  }

  /**
   * 执行查询并返回单个结果
   */
  async getOne<T = any>(): Promise<T | null> {
    const cacheKey = this.getCacheKey();
    
    if (this.cacheOptions?.cache && cacheKey) {
      const cached = await cache.get(cacheKey);
      if (cached) {
        log.debug(`Cache hit for query: ${cacheKey}`);
        return cached;
      }
    }

    const result = await dbGet(this.query, this.params);
    
    if (this.cacheOptions?.cache && cacheKey && result) {
      await cache.set(cacheKey, result, this.cacheOptions.cacheTTL);
      log.debug(`Cached query result: ${cacheKey}`);
    }

    return result;
  }

  /**
   * 执行查询并返回多个结果
   */
  async getMany<T = any>(): Promise<T[]> {
    const cacheKey = this.getCacheKey();
    
    if (this.cacheOptions?.cache && cacheKey) {
      const cached = await cache.get(cacheKey);
      if (cached) {
        log.debug(`Cache hit for query: ${cacheKey}`);
        return cached;
      }
    }

    const results = await dbAll(this.query, this.params);
    
    if (this.cacheOptions?.cache && cacheKey) {
      await cache.set(cacheKey, results, this.cacheOptions.cacheTTL);
      log.debug(`Cached query results: ${cacheKey}`);
    }

    return results;
  }

  /**
   * 执行更新/删除查询
   */
  async execute(): Promise<{ changes: number; lastID?: number }> {
    // 更新/删除操作不使用缓存
    const result = await dbRun(this.query, this.params);
    
    // 清除相关缓存
    if (this.cacheOptions?.cacheKey) {
      await cache.delete(this.cacheOptions.cacheKey);
    }

    return result;
  }

  /**
   * 生成缓存键
   */
  private getCacheKey(): string | null {
    if (this.cacheOptions?.cacheKey) {
      return this.cacheOptions.cacheKey;
    }
    
    if (this.cacheOptions?.cache) {
      // 基于查询和参数生成缓存键
      const queryHash = require('crypto')
        .createHash('md5')
        .update(this.query + JSON.stringify(this.params))
        .digest('hex');
      return `query:${queryHash}`;
    }
    
    return null;
  }
}

/**
 * 分页查询助手
 */
export class PaginatedQuery<T = any> {
  constructor(
    private baseQuery: string,
    private countQuery?: string
  ) {}

  /**
   * 执行分页查询
   */
  async execute(
    params: any[] = [],
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<T>> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20)); // 限制最大100条
    const offset = options.offset ?? (page - 1) * limit;

    // 构建数据查询
    const dataQuery = `${this.baseQuery} LIMIT ? OFFSET ?`;
    const dataParams = [...params, limit, offset];

    // 构建计数查询
    const countQuerySql = this.countQuery || this.generateCountQuery();
    
    // 并行执行数据查询和计数查询
    const [data, countResult] = await Promise.all([
      dbAll(dataQuery, dataParams),
      dbGet(countQuerySql, params)
    ]);

    const total = countResult?.count || 0;
    const pages = Math.ceil(total / limit);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        pages,
        hasNext: page < pages,
        hasPrev: page > 1
      }
    };
  }

  /**
   * 从基础查询生成计数查询
   */
  private generateCountQuery(): string {
    // 简单的计数查询生成（可能需要根据具体查询调整）
    const fromIndex = this.baseQuery.toLowerCase().indexOf('from');
    if (fromIndex === -1) {
      throw new Error('Cannot generate count query: FROM clause not found');
    }

    const fromClause = this.baseQuery.substring(fromIndex);
    
    // 移除ORDER BY子句（计数查询不需要）
    const orderByIndex = fromClause.toLowerCase().lastIndexOf('order by');
    const cleanFromClause = orderByIndex > -1 
      ? fromClause.substring(0, orderByIndex)
      : fromClause;

    return `SELECT COUNT(*) as count ${cleanFromClause}`;
  }
}

/**
 * 常用查询优化器
 */
export const QueryOptimizer = {
  /**
   * 创建查询构建器
   */
  query(sql: string): QueryBuilder {
    return new QueryBuilder(sql);
  },

  /**
   * 创建分页查询
   */
  paginate<T = any>(baseQuery: string, countQuery?: string): PaginatedQuery<T> {
    return new PaginatedQuery<T>(baseQuery, countQuery);
  },

  /**
   * 用户文件查询（优化版）
   */
  async getUserFiles(
    userId: string, 
    options: {
      folderId?: string;
      search?: string;
      mimeType?: string;
      page?: number;
      limit?: number;
      orderBy?: string;
      orderDirection?: 'ASC' | 'DESC';
    } = {}
  ): Promise<PaginatedResult<any>> {
    let query = new QueryBuilder('SELECT * FROM files');
    
    query.where('user_id = ?', userId);
    
    if (options.folderId) {
      query.where('folder_id = ?', options.folderId);
    } else if (options.folderId === null) {
      query.where('folder_id IS NULL');
    }
    
    if (options.search) {
      query.where('name LIKE ?', `%${options.search}%`);
    }
    
    if (options.mimeType) {
      query.where('mime_type = ?', options.mimeType);
    }
    
    if (options.orderBy) {
      query.orderBy(options.orderBy, options.orderDirection || 'ASC');
    } else {
      query.orderBy('created_at', 'DESC');
    }

    // 使用缓存（5分钟）
    query.withCache({
      cache: true,
      cacheTTL: 5 * 60,
      cacheKey: `user_files:${userId}:${JSON.stringify(options)}`
    });

    const paginatedQuery = this.paginate(query.query);
    return paginatedQuery.execute(query.params, {
      page: options.page,
      limit: options.limit
    });
  },

  /**
   * 用户存储使用统计（优化版）
   */
  async getUserStorageStats(userId: string): Promise<{
    totalFiles: number;
    totalSize: number;
    filesByType: Array<{ mimeType: string; count: number; size: number }>;
  }> {
    const cacheKey = `storage_stats:${userId}`;
    const cached = await cache.get(cacheKey);
    
    if (cached) {
      return cached;
    }

    const [totalStats, filesByType] = await Promise.all([
      dbGet(
        'SELECT COUNT(*) as totalFiles, COALESCE(SUM(size), 0) as totalSize FROM files WHERE user_id = ?',
        [userId]
      ),
      dbAll(
        `SELECT mime_type as mimeType, COUNT(*) as count, COALESCE(SUM(size), 0) as size 
         FROM files 
         WHERE user_id = ? 
         GROUP BY mime_type 
         ORDER BY size DESC`,
        [userId]
      )
    ]);

    const result = {
      totalFiles: totalStats?.totalFiles || 0,
      totalSize: totalStats?.totalSize || 0,
      filesByType: filesByType || []
    };

    // 缓存10分钟
    await cache.set(cacheKey, result, 10 * 60);
    
    return result;
  },

  /**
   * 清除用户相关缓存
   */
  async clearUserCache(userId: string): Promise<void> {
    const patterns = [
      `user_files:${userId}:*`,
      `storage_stats:${userId}`,
      `user_folders:${userId}:*`
    ];

    for (const pattern of patterns) {
      await cache.deletePattern(pattern);
    }
  }
};
