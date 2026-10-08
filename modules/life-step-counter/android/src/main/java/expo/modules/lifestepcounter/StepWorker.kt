package expo.modules.lifestepcounter

import android.content.Context
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequest
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit

// Android runs this about every 15 minutes, even when LifeTracker is closed
// (and again after the phone restarts). It reads the step counter and saves the new steps.
class StepWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
  override fun doWork(): Result {
    StepSampler.sample(applicationContext)
    return Result.success()
  }

  companion object {
    private const val WORK_NAME = "life_step_sampler"

    fun schedule(context: Context) {
      val request = PeriodicWorkRequest.Builder(StepWorker::class.java, 15, TimeUnit.MINUTES).build()
      WorkManager.getInstance(context.applicationContext).enqueueUniquePeriodicWork(
        WORK_NAME,
        ExistingPeriodicWorkPolicy.KEEP,
        request
      )
    }
  }
}
