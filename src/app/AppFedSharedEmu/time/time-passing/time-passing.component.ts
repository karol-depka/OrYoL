import {ChangeDetectorRef, Component, Input, OnDestroy, OnInit} from '@angular/core';
import { TimeTrackedEntry } from '../../../time-tracking/time-tracking.service'

@Component({
  selector: 'app-time-passing',
  templateUrl: './time-passing.component.html',
  styleUrls: ['./time-passing.component.sass'],
})
export class TimePassingComponent implements OnInit, OnDestroy {

  @Input()
  referenceTime: Date

  @Input()
  isCountDown: boolean = true

  @Input()
  pausableEntry: TimeTrackedEntry

  msDiff = 0

  private readonly intervalHandle: any

  constructor(
      private changeDetectorRef: ChangeDetectorRef
  ) {
    this.intervalHandle = setInterval(() => {
      this.update();
    }, 500)
  }

  private update() {
    if ( ! this.referenceTime ) {
      return
    }
    // FIXME: Cannot read property 'getTime' of null
    if ( this.isCountDown ) {
      this.msDiff = this.referenceTime.getTime() - Date.now()
    } else {
      this.msDiff = Date.now() - this.referenceTime.getTime()
    }
    if ( this.pausableEntry ) {
      this.msDiff -= this.pausableEntry.totalMsPaused
    }
    // this.changeDetectorRef.detectChanges()
    this.changeDetectorRef.markForCheck()
  }

  ngOnInit() {
    this.update();
  }

  ngOnDestroy(): void {
    clearInterval(this.intervalHandle)
  }

}
