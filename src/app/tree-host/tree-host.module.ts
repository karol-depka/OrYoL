import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import {TreeHostComponent} from './tree-host/tree-host.component'
import {TreePrimengModule} from '../tree-primeng/tree-primeng.module'
import {TreeNestedModule} from '../tree-nested/tree-nested.module';
import { ToolbarComponent } from './toolbar/toolbar.component'
import { TimeTrackingModule } from '../time-tracking/time-tracking.module'
import { TreeTableModule } from 'primeng/primeng'
import { SharedModule } from '../shared/shared.module';
import { ToolbarPopoverComponent } from './toolbar/toolbar-popover/toolbar-popover.component'

/* Module used to embed a chosen implementation of tree (nested or primeng) and wire together */
@NgModule({
  imports: [
    CommonModule,
    TreePrimengModule,
    TreeNestedModule,
    TimeTrackingModule,
    TreeTableModule,
    SharedModule,
  ],
  declarations: [
    TreeHostComponent,
    ToolbarComponent,
    ToolbarPopoverComponent,
  ],
  exports: [
    TreeHostComponent,
  ]
})
export class TreeHostModule { }
