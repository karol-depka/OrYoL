import { Injectable } from '@angular/core';
import { TimeTrackedEntry } from './time-tracking.service'
// import Timestamp = firebase.firestore.Timestamp
import { ItemId } from '../db/DbItem'
import { uuidv4 } from '../utils/utils'
import { firestore1 } from '../db-firestore/firestore-tree.service'
import { firestore } from 'firebase'

export type TimeTrackingPeriodId = string

/** Ranges, (time) intervals, time period */
export class TimeTrackingPeriod {

  constructor(
    public id: TimeTrackingPeriodId,
    public itemId: ItemId,
    public start: firestore.Timestamp,
    public end : firestore.Timestamp | null /* null instead of missing, to be able to query for non-finished periods ! */,
  ) {
  }
}



@Injectable({
  providedIn: 'root'
})
export class TimeTrackingPeriodsService {

  coll = firestore1.collection(`TimeTrackingPeriodTest`)

  constructor(
  ) {
    console.log( `firestore1.collection(\`TimeTrackingPeriodTest\`).add({testing: 'test'}) `)
    // coll.add({testing: 'test'})
  }

  onPeriodEnd(entry: TimeTrackedEntry) {
    let period: TimeTrackingPeriod
    // period.end = Timestamp.now()

    // TODO: update in DB
  }

  onPeriodStart(entry: TimeTrackedEntry) {
    const period = new TimeTrackingPeriod(
      uuidv4(),
      entry.timeTrackable.getId(),
      firestore.Timestamp.now(),
      null,
    )
    // TODO: push to DB collection "TimeTrackedEntry
    this.coll.add(Object.assign({}, period))
    return period
//
//     FIXME
  }
}
