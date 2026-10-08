package expo.modules.lifestepcounter

import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// The bridge between the app (JavaScript) and the phone's step counter
class StepCounterModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("LifeStepCounter")

    // Does this phone have a step counter sensor?
    AsyncFunction("isAvailable") { promise: Promise ->
      val context = appContext.reactContext
      promise.resolve(context != null && StepSampler.isAvailable(context))
    }

    // Starts the 15-minute background reader and reads once right now
    AsyncFunction("start") { promise: Promise ->
      val context = appContext.reactContext
      if (context == null) {
        promise.resolve(false)
      } else {
        Thread {
          try {
            StepWorker.schedule(context)
            promise.resolve(StepSampler.sample(context))
          } catch (error: Exception) {
            promise.resolve(false)
          }
        }.start()
      }
    }

    // Reads the sensor right now (used when the app is open)
    AsyncFunction("sampleNow") { promise: Promise ->
      val context = appContext.reactContext
      if (context == null) {
        promise.resolve(false)
      } else {
        Thread {
          try {
            promise.resolve(StepSampler.sample(context))
          } catch (error: Exception) {
            promise.resolve(false)
          }
        }.start()
      }
    }

    // The saved totals of the last few days, as JSON text
    AsyncFunction("getDays") { count: Int, promise: Promise ->
      val context = appContext.reactContext
      if (context == null) {
        promise.resolve("{}")
      } else {
        promise.resolve(StepSampler.daysAsJson(context, count))
      }
    }
  }
}
