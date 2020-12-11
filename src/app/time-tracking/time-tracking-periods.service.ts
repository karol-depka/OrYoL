import { Injectable } from '@angular/core';
import { TimeTrackedEntry } from './time-tracking.service'
import Timestamp = firebase.firestore.Timestamp
import { ItemId } from '../db/DbItem'
import { uuidv4 } from '../utils/utils'

export type TimeTrackingPeriodId = string

/** Ranges, (time) intervals, time period */
export class TimeTrackingPeriod {

  constructor(
    id: TimeTrackingPeriodId,
    itemId: ItemId,
    start: Timestamp,
    end? : Timestamp,
  ) {
  }
}

@Injectable({
  providedIn: 'root'
})
export class TimeTrackingPeriodsService {

  constructor() { }

  onPeriodEnd(entry: TimeTrackedEntry) {
    let period: TimeTrackingPeriod
    period.end = Timestamp.now()

    // TODO: update in DB
  }

  onPeriodStart(entry: TimeTrackedEntry) {
    const period = new TimeTrackingPeriod(
      uuidv4(),
      entry.timeTrackable.getId(),
      Timestamp.now()
    )
    // TODO: push to DB collection "TimeTrackedEntry
    return period
//
    FIXME
  }
}
