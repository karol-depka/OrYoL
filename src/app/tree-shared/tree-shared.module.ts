import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import {NodeContentComponent} from './node-content/node-content.component'
import {NumericCellComponent} from './cells/node-cell/numeric-cell.component'
import {TreeNodeMenuComponent} from './tree-node-menu/tree-node-menu.component'
import {ItemClassIconComponent} from './item-class-icon/item-class-icon.component'
import {ConfirmDeleteTreeNodeComponent} from './confirm-delete-tree-node/confirm-delete-tree-node.component'
import {SharedModule} from '../shared/shared.module';
import { TimeTrackingMenuComponent } from './tree-node-menu/time-tracking-menu/time-tracking-menu.component';
import { NodeContentTimeTrackingComponent } from './node-content-time-tracking/node-content-time-tracking.component'
import { TimeTrackingModule } from '../time-tracking/time-tracking.module';
import { RangeCellComponent } from './cells/range-cell/range-cell.component';
import { CellsGroupComponent } from './cells/cells-group/cells-group.component';
import { CellHostComponent } from './cell-host/cell-host.component';
import { ExampleCellComponent } from './cells/example-cell/example-cell.component';
import { ContenteditableCellComponent } from './cells/contenteditable-cell/contenteditable-cell.component';
import { NodeDebugCellComponent } from './node-content/node-debug-cell/node-debug-cell.component';
import { NodeExpansionIconComponent } from './node-content/node-expansion-icon/node-expansion-icon.component';
import { NodeClassIconComponent } from './node-content/node-class-icon/node-class-icon.component'
import { TimeModule } from '../AppFedSharedEmu/time/time.module';
import { NodeClassPickerComponent } from './tree-node-menu/node-class-picker/node-class-picker.component'

/** Components reusable to be embedded in different tree implementations (e.g. node content) */
@NgModule({
  declarations: [
    NodeContentComponent,
    NumericCellComponent,
    TreeNodeMenuComponent,
    NodeContentComponent,
    ItemClassIconComponent,
    ConfirmDeleteTreeNodeComponent,
    TimeTrackingMenuComponent,
    NodeContentTimeTrackingComponent,
    RangeCellComponent,
    CellsGroupComponent,
    CellHostComponent,
    ExampleCellComponent,
    ContenteditableCellComponent,
    NodeDebugCellComponent,
    NodeExpansionIconComponent,
    NodeClassIconComponent,
    NodeClassPickerComponent,
  ],
  imports: [
    CommonModule,
    SharedModule,
    TimeTrackingModule,
    TimeModule,
  ],
  exports: [
    NodeContentComponent,
    ExampleCellComponent,
    NodeClassIconComponent,
  ],
  entryComponents: [
    ConfirmDeleteTreeNodeComponent,
  ],
})
export class TreeSharedModule { }
