import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

const topics = ['cache.revalidate', 'media.delete', 'mail.send', 'storage.delete-private'] as const;

@Injectable()
export class OperationsService {
  constructor(private readonly db: PrismaService) {}

  async snapshot() {
    const [groups, quarantine, overdueTasks, expiredLeases] = await this.db.$transaction([
      this.db.$queryRaw<{ topic: string; status: string; total: number }[]>`
        SELECT topic, status::text, COUNT(*)::int AS total
        FROM outbox_tasks
        WHERE topic IN ('cache.revalidate', 'media.delete', 'mail.send', 'storage.delete-private')
          AND status IN ('PENDING', 'PROCESSING', 'FAILED')
        GROUP BY topic, status ORDER BY topic, status`,
      this.db.contactFile.count({ where: { scanStatus: 'QUARANTINED' } }),
      this.db.outboxTask.count({
        where: {
          topic: { in: [...topics] },
          status: 'PENDING',
          availableAt: { lt: new Date(Date.now() - 15 * 60000) },
        },
      }),
      this.db.outboxTask.count({
        where: {
          topic: { in: [...topics] },
          status: 'PROCESSING',
          OR: [{ lockedAt: null }, { lockedAt: { lt: new Date(Date.now() - 5 * 60000) } }],
        },
      }),
    ]);
    const queues = topics.map((topic) => ({
      topic,
      pending: groups.find((row) => row.topic === topic && row.status === 'PENDING')?.total ?? 0,
      processing:
        groups.find((row) => row.topic === topic && row.status === 'PROCESSING')?.total ?? 0,
      failed: groups.find((row) => row.topic === topic && row.status === 'FAILED')?.total ?? 0,
    }));
    const exhaustedTasks = queues.reduce((count, queue) => count + queue.failed, 0);
    return {
      status: exhaustedTasks || quarantine || overdueTasks || expiredLeases ? 'attention' : 'ok',
      alerts: { exhaustedTasks, quarantinedAttachments: quarantine, overdueTasks, expiredLeases },
      queues,
    };
  }
}
