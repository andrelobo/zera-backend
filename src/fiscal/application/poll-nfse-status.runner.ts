import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { PollNfseStatusService } from './poll-nfse-status.service'

@Injectable()
export class PollNfseStatusRunner implements OnModuleInit {
  private readonly logger = new Logger(PollNfseStatusRunner.name)
  private running = false

  onModuleInit() {
    const enabled = (process.env.NFSE_POLLING_ENABLED ?? 'true').toLowerCase() === 'true'
    if (!enabled) {
      this.logger.log('NFSe polling disabled')
      return
    }

    const intervalMsRaw = Number(process.env.NFSE_POLLING_INTERVAL_MS ?? 300000)
    const intervalMs = Number.isFinite(intervalMsRaw) && intervalMsRaw >= 60000 ? intervalMsRaw : 300000

    const jitterMsRaw = Number(process.env.NFSE_POLLING_JITTER_MS ?? 15000)
    const jitterMs = Number.isFinite(jitterMsRaw) && jitterMsRaw >= 0 ? jitterMsRaw : 15000

    const tick = async () => {
      if (this.running) return
      this.running = true

      try {
        const jitter = Math.floor(Math.random() * jitterMs)
        if (jitter > 0) await new Promise((r) => setTimeout(r, jitter))

        await this.poll.runOnce({
          limit: Number(process.env.NFSE_POLLING_LIMIT ?? 50),
          olderThanMs: Number(process.env.NFSE_POLLING_OLDER_THAN_MS ?? 30000),
        })
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        this.logger.error(`Polling tick failed: ${msg}`)
      } finally {
        this.running = false
      }
    }

    void tick()
    setInterval(() => void tick(), intervalMs)

    this.logger.log(`NFSe polling enabled intervalMs=${intervalMs} jitterMs=${jitterMs}`)
  }

  constructor(private readonly poll: PollNfseStatusService) {}
}
