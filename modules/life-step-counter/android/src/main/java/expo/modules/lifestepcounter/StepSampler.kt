package expo.modules.lifestepcounter

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.SystemClock
import java.util.Calendar
import java.util.Locale
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

// Reads the phone's own step counter and keeps one total for every day.
//
// The phone's step sensor counts all day by itself, even when no app is running.
// It gives one number: all steps since the phone was switched on.
// Every time we read it, we add the NEW steps to today's total.
object StepSampler {
  private const val PREFS = "life_step_counter"

  private fun prefs(context: Context) =
    context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  private fun dayKey(calendar: Calendar): String =
    String.format(
      Locale.US,
      "%04d-%02d-%02d",
      calendar.get(Calendar.YEAR),
      calendar.get(Calendar.MONTH) + 1,
      calendar.get(Calendar.DAY_OF_MONTH)
    )

  fun isAvailable(context: Context): Boolean {
    val manager = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
    return manager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) != null
  }

  // Reads the sensor once and adds the new steps to today. Returns true if it worked.
  // Call this from a background thread, never from the main thread.
  @Synchronized
  fun sample(context: Context): Boolean {
    val manager = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
    val sensor = manager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) ?: return false

    var reading = -1f
    val done = CountDownLatch(1)
    val listener = object : SensorEventListener {
      override fun onSensorChanged(event: SensorEvent) {
        reading = event.values[0]
        done.countDown()
      }

      override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}
    }

    manager.registerListener(listener, sensor, SensorManager.SENSOR_DELAY_NORMAL)
    val gotValue = done.await(8, TimeUnit.SECONDS)
    manager.unregisterListener(listener)

    if (!gotValue || reading < 0f) return false
    record(context, reading.toLong())
    return true
  }

  private fun record(context: Context, counter: Long) {
    val saved = prefs(context)
    val lastCounter = saved.getLong("lastCounter", -1L)
    val lastElapsed = saved.getLong("lastElapsed", 0L)
    val elapsedNow = SystemClock.elapsedRealtime() // time since the phone was switched on

    // If the time since switch-on got smaller, the phone was restarted
    // and the sensor started again from 0.
    val restarted = elapsedNow < lastElapsed || counter < lastCounter

    val newSteps = when {
      lastCounter < 0L -> 0L // first reading ever: nothing to compare with
      restarted -> counter
      else -> counter - lastCounter
    }

    val today = "d_" + dayKey(Calendar.getInstance())
    val editor = saved.edit()
    if (newSteps > 0L) {
      editor.putLong(today, saved.getLong(today, 0L) + newSteps)
    }
    editor.putLong("lastCounter", counter)
    editor.putLong("lastElapsed", elapsedNow)
    editor.apply()
  }

  // The totals of the last few days as JSON, for example {"2026-10-08":4321,"2026-10-07":8000}
  fun daysAsJson(context: Context, count: Int): String {
    val saved = prefs(context)
    val calendar = Calendar.getInstance()
    val builder = StringBuilder("{")
    for (i in 0 until count) {
      val key = dayKey(calendar)
      if (i > 0) builder.append(",")
      builder.append("\"").append(key).append("\":").append(saved.getLong("d_$key", 0L))
      calendar.add(Calendar.DAY_OF_MONTH, -1)
    }
    builder.append("}")
    return builder.toString()
  }
}
