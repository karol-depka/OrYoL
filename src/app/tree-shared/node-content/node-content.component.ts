import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import {
  NodeFocusOptions,
  OryTreeNode,
} from '../../tree-model/TreeModel'
import { TreeHostComponent } from '../../tree-host/tree-host/tree-host.component'
import { OryColumn } from '../OryColumn'
import { isNullOrUndefined } from 'util'
import 'rxjs/add/operator/throttleTime';

import { padStart } from 'lodash';
import { DebugService } from '../../core/debug.service'

import 'hammerjs';
import { debugLog } from '../../utils/log'
import {
  NgbModal,
  NgbPopoverConfig,
} from '@ng-bootstrap/ng-bootstrap'
import {
  getActiveElementCaretPos,
  getSelectionCursorState,
} from '../../utils/caret-utils'
import { ConfirmDeleteTreeNodeComponent } from '../confirm-delete-tree-node/confirm-delete-tree-node.component'
import {
  Cells,
  ColumnCell,
} from './Cells'
import { CellComponent } from '../cells/CellComponent'
import { NodeContentViewSyncer } from './NodeContentViewSyncer'
import { NodeDebug } from './node-debug-cell/node-debug-cell.component'
import {
  columnDefs,
  Columns,
} from './Columns'
import { ConfigService } from '../../core/config.service'
import { TimeTrackingService } from '../../time-tracking/time-tracking.service'

/* ==== Note there are those sources of truth kind-of (for justified reasons) :
* - UI state
* - tree model: treeNode.itemData & treeNode's nodeInclusionData
* - tree model / view-model events, e.g. fireOnChangeItemDataOfChildOnParents()
* (those above could probably be always 100% in sync; although might be throttleTime-d eg. 100ms if complex calculations and updating dependent nodes)
* - firestore (sent-to-firestore, received-from-firestore)
*/

@Component({
  selector: 'app-node-content',
  templateUrl: './node-content.component.html',
  styleUrls: ['./node-content.component.sass'],
  // encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [NgbPopoverConfig],
})
export class NodeContentComponent implements OnInit, AfterViewInit, OnDestroy {

  /** Could be actually map *Cell* to Component */
  mapColumnToComponent = new Map<OryColumn, CellComponent>()

  columnDefs = columnDefs

  /* TODO: move to tree model / column-model */
  static columnsStatic = new Columns()

  columns: Columns = NodeContentComponent.columnsStatic

  cells: Cells

  isDone: boolean = false

  nodeContentViewSyncer: NodeContentViewSyncer

  @Input() treeNode: OryTreeNode

  @Input() treeHost: TreeHostComponent

  private focusedColumn: OryColumn

  isAncestorOfFocused = false

  isDestroyed = false

  public get isFocusAtRightmostColumn() { return this.focusedColumn === this.columns.lastColumn }

  public get isFocusAtLeftmostColumn() { return this.focusedColumn === this.columns.leftMostColumn }

  get isEstimatedTimeShown() {
    return ! this.treeNode.isChildOfRoot // FIXME
    // return this.treeNode.hasField(this.columns.estimatedTime)
  }

  nodeDebug = new NodeDebug()

  config$ = this.configService.config$

  constructor(
    public timeTrackingService: TimeTrackingService,
    private changeDetectorRef: ChangeDetectorRef,
    public debugService: DebugService,
    private modalService: NgbModal,
    public configService: ConfigService,
    ngbPopoverConfig: NgbPopoverConfig,
  ) {
    ngbPopoverConfig.placement = 'auto' // 'right' // 'hover';

    // should be at the level of model / column-model
    this.config$.subscribe(config => {
      this.columnDefs.estimatedTimeMin.hidden = ! config.showMinMaxColumns
      this.columnDefs.estimatedTimeMax.hidden = ! config.showMinMaxColumns
    })
  }

  ngOnInit() {
    this.cells = this.columns.createColumnCells(this.treeNode)
    debugLog('ngOnInit', this.treeNode.nodeInclusion)
    this.treeHost.registerNodeComponent(this)

    // here also react to child nodes to recalculate sum
    const onChangeItemDataOrChildHandler = () => {
      debugLog('onChangeItemDataOrChildHandler')
      if ( ! this.isDestroyed ) {
        this.applyItemDataValuesToViews()
      }
    }
    this.treeNode.onChangeItemData.subscribe(onChangeItemDataOrChildHandler)
    this.treeNode.onChangeItemDataOfChild.subscribe(onChangeItemDataOrChildHandler)

    this.treeNode.treeModel.focus.focus$.subscribe(() => {
      if (!this.isDestroyed) {
        this.isAncestorOfFocused = this.treeNode.highlight.isAncestorOfFocusedNode()
        // console.log('isAncestorOfFocused', this.isAncestorOfFocused)
        this.changeDetectorRef.detectChanges()
      }
    })
  }

  private applyItemDataValuesToViews() {
    this.nodeDebug.countApplyItemDataValuesToViews ++
    debugLog('applyItemDataValuesToViews this.treeNode', this.treeNode)

    this.isDone = this.treeNode.itemData.isDone // TODO: remove redundant field in favor of single source of truth
    if (isNullOrUndefined(this.isDone)) {
      this.isDone = false;
    }

    this.nodeContentViewSyncer.applyItemDataValuesToViews()
    this.changeDetectorRef.detectChanges()
  }

  ngAfterViewInit(): void {
    this.nodeContentViewSyncer = new NodeContentViewSyncer(
      this.treeNode,
      this.columns,
      this.mapColumnToComponent,
    )
    this.applyItemDataValuesToViews()

    // focus if expecting to focus
    // this.focus()
  }

  addChild() {
    const newTreeNode = this.treeNode.addChild()
    this.treeNode.expanded = true
    this.focusNewlyCreatedNode(newTreeNode)
  }

  private focusNewlyCreatedNode(newTreeNode: OryTreeNode) {
    setTimeout(() => {
      this.treeHost.focusNode(newTreeNode)
    })
  }

  keyPressEnter(event) {
    if ( this.treeNode.isVisualRoot ) {
      this.addChild()
    } else {
      debugLog('key press enter; node: ', this.treeNode)
      event.preventDefault()
      const newTreeNode = this.addNodeAfterThis()
      this.focusNewlyCreatedNode(newTreeNode)
    }
  }

  keyPressMetaEnter(event) {
    debugLog('keyPressMetaEnter')
    const timeTrackedEntry = this.timeTrackingService.obtainEntryForItem(this.treeNode)

    if ( timeTrackedEntry.wasTracked ) {
      this.isDone = !this.isDone
      this.onInputChanged(null, this.cells.mapColumnToCell.get(this.columnDefs.isDone), this.isDone, null)
      this.focusNodeBelow(event)
    } else {
      timeTrackedEntry.startOrResumeTrackingIfNeeded()
    }
  }

  addNodeAfterThis() {
    return this.treeNode.addSiblingAfterThis()
  }

  focusNodeAboveAtEnd() {
    const nodeToFocus = this.treeNode.getNodeVisuallyAboveThis()
    this.treeHost.focusNode(nodeToFocus, this.columns.lastColumn, {cursorPosition: -1})
  }

  focusNodeBelowAtBeginningOfLine() {
    const nodeToFocus = this.treeNode.getNodeVisuallyBelowThis()
    this.treeHost.focusNode(nodeToFocus, this.columns.leftMostColumn, {cursorPosition: 0})
  }

  public focusNodeAbove($event) {
    const nodeToFocus = this.treeNode.getNodeVisuallyAboveThis()
    this.focusOtherNode(nodeToFocus)
  }

  public focusNodeBelow($event) {
    const nodeToFocus = this.treeNode.getNodeVisuallyBelowThis()
    this.focusOtherNode(nodeToFocus)
  }

  focusOtherNode(nodeToFocus: OryTreeNode) {
    debugLog('focusOtherNode this.focusedColumn', this.focusedColumn)
    this.treeHost.focusNode(nodeToFocus, this.focusedColumn)
  }

  focus(column?: OryColumn, options?: NodeFocusOptions) {
    let cellComponentToFocus = this.getCellComponentByColumnOrDefault(column)
    if ( cellComponentToFocus ) {
      cellComponentToFocus.focus(options)
    }
  }

  getCellComponentByColumnOrDefault(column?: OryColumn): CellComponent {
    return this.mapColumnToComponent.get(column)
      || this.mapColumnToComponent.get(this.columnDefs.title)
  }

  onColumnFocused(column: OryColumn, event) {
    debugLog('onColumnFocused', column)
    this.focusedColumn = column
    this.treeHost.treeModel.focus.ensureNodeVisibleAndFocusIt(this.treeNode, column)
  }

  /* TODO: rename reactToInputChangedAndSave */
  onInputChanged(event, cell: ColumnCell, inputNewValue, component: CellComponent) {
    debugLog('onInputChanged, cell', cell, event, component)
    const column = cell.column
    this.nodeContentViewSyncer.onInputChangedByUser(cell, inputNewValue)
    column.setValueOnItemData(this.treeNode.itemData, inputNewValue)
    // note: the applying from UI to model&events could be throttleTime()-d to e.g. 100-200ms to not overwhelm when typing fast
    this.treeNode.fireOnChangeItemDataOfChildOnParents()
    this.treeNode.onChangeItemData.emit()
    // TODO: investigating time recalculation
  }

  reorderUp(event) {
    event.preventDefault() // for Firefox causing page up/down; same for Safari and TextEdit, so looks like Chrome is lacking this shortcut
    this.treeNode.reorderUp()
  }

  reorderDown(event) {
    event.preventDefault() // for Firefox causing page up/down; same for Safari and TextEdit, so looks like Chrome is lacking this shortcut
    this.treeNode.reorderDown()
  }

  // private buildItemDataFromUi() {
  //   const itemData = {
  //     title: titleVal,
  //     estimatedTime: estimatedTimeVal,
  //     isDone: this.isDone,
  //     itemClass: 'task' /* FIXME */,
  //   }
  // }

  ngOnDestroy(): void {
    this.isDestroyed = true
    this.treeHost.onNodeContentComponentDestroyed(this)
  }

  formatEndTime(column: OryColumn) {
    const date = this.treeNode.endTime(column)
    return '' + date.getHours() + ':' + padStart('' + date.getMinutes(), 2, '0')
  }

  indentDecrease($event) {
    $event.preventDefault()
    this.treeNode.indentDecrease()
    this.focusNewlyCreatedNode(this.treeNode) // FIXME this will not work correctly when multi-parents get fully implemented
  }

  indentIncrease($event) {
    $event.preventDefault()
    this.treeNode.indentIncrease()
    this.focusNewlyCreatedNode(this.treeNode) // FIXME this will not work correctly when multi-parents get fully implemented
  }

  onArrowRightOnRightMostCell() {
    // if ( getActiveElementCaretPos() === 0 ) {
    this.focusNodeBelowAtBeginningOfLine()
    // }
  }

  onKeyDownBackspaceOnEstimatedTime() {
    if ( getActiveElementCaretPos() === 0
      && this.treeNode.itemData.estimatedTime === ''
    ) {
      this.openDeleteDialog()
    }
  }

  onKeyDownBackspaceOnTitle() {
    // if (getCaretPosition(this.elInputTitle.nativeElement) === 0
    //   && this.treeNode.itemData.title === ''
    // ) {
    //   this.openDeleteDialog()
    // }
  }

  private openDeleteDialog() {
    // TODO: move to our own modal service - single line with passing treeNode
    const modalRef = this.modalService.open(ConfirmDeleteTreeNodeComponent);
    const component = modalRef.componentInstance as ConfirmDeleteTreeNodeComponent
    component.treeNode = this.treeNode;
  }

  onArrowLeft() {
    if ( getSelectionCursorState().atStart )  {
      if ( this.isFocusAtLeftmostColumn ) {
        this.focusNodeAboveAtEnd()
      } else {
        this.focusColumnToTheLeft()
      }
    }
  }

  onArrowRight() {
    if ( getSelectionCursorState().atEnd ) {
      if ( this.isFocusAtRightmostColumn ) {
        this.onArrowRightOnRightMostCell()
      } else {
        this.focusColumnToTheRight()

      }
    }
  }

  public focusColumnToTheRight() {
    const colIdx = this.columns.allNotHiddenColumns.indexOf(this.focusedColumn)
    debugLog('coldIdx', colIdx)
    this.focus(this.columns.allNotHiddenColumns[colIdx + 1])
  }

  public focusColumnToTheLeft() {
    const colIdx = this.columns.allNotHiddenColumns.indexOf(this.focusedColumn)
    debugLog('coldIdx', colIdx)
    this.focus(this.columns.allNotHiddenColumns[colIdx - 1])
  }
}
