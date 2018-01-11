import {
  AfterViewInit, Component, ElementRef, Input, OnInit, SimpleChanges, ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import {FirestoreTreeService, debugLog} from '../../shared/firestore-tree.service'
import {TreeNode} from 'primeng/primeng'
import {OryTreeNode} from '../../shared/TreeModel'
import {TreeHostComponent} from '../tree-host/tree-host.component'
import {OryColumn} from '../OryColumn'
import {DbTreeService} from '../../shared/db-tree-service'
import {DomSanitizer} from '@angular/platform-browser'

/* Consider renamig to "view slots" - more generic than columns, while more view-related than "property".
 * Or maybe PropertyView ? */
export class Columns {
  title = new OryColumn('title')
  estimatedTime = new OryColumn('estimatedTime')
  isDone = new OryColumn('isDone')
}

@Component({
  selector: 'app-node-content',
  templateUrl: './node-content.component.html',
  styleUrls: ['./node-content.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class NodeContentComponent implements OnInit, AfterViewInit {

  static columnsStatic = new Columns()

  columns: Columns = NodeContentComponent.columnsStatic

  titleValue
  initialTitle: string
  estimatedTimeModel: number

  isDone: boolean = false

  // @Input() node: TreeNode & {dbId: string}
  @Input() treeNode: OryTreeNode
  @Input() treeHost: TreeHostComponent
  // @Input() node2
  @ViewChild('inputEstimatedTime') elInputEstimatedTime: ElementRef;
  @ViewChild('inputTitle')         elInputTitle: ElementRef;
  // https://stackoverflow.com/questions/44479457/angular-2-4-set-focus-on-input-element

  // nodeIndex = 0
  private focusedColumn: OryColumn

  // isApplyingFromDbNow = false



  constructor(
    public dbService: DbTreeService,
    public sanitizer: DomSanitizer,
  ) { }

  ngOnInit() {
    // debugLog('node content node', this.treeNode)
    // debugLog('n2', this.node2)
    // this.nodeIndex = this.treeNode.getIndexInParent()
    this.treeHost.registerNodeComponent(this)
    // this.elInputTitle.nativeElement.value = 'title: ' + (this.treeNode.itemData as any).title

    this.elInputEstimatedTime
      .nativeElement.addEventListener('input', this.onInputChanged.bind(this));
    this.elInputTitle
      .nativeElement.addEventListener('input', this.onInputChanged.bind(this));

    this.isDone = this.treeNode.itemData.isDone
    this.initialTitle = this.treeNode.itemData.title /* note: shortcut that I took: not yet updating title in realtime
    */
    // NEXT: enable real time updates of title - perhaps check if new value === existing, perhaps use isApplyingFromDbNow
    // WHY: 1. my mind is already in the topic; cementing it would be good
    // WHY: 2. it can lead to data loss if I go to another window/device and accidentally edit something that was changed elsewhere
    // this.elInputTitle.nativeElement.innerHTML = this.sanitizer.bypassSecurityTrustHtml(this.initialTitle);
    this.elInputTitle.nativeElement.innerHTML = this.initialTitle;
    this.estimatedTimeModel = this.treeNode.itemData.estimatedTime
    this.elInputEstimatedTime.nativeElement.value = this.estimatedTimeModel;


    this.treeNode.onChangeItemData.subscribe(() => {
      // estimated time:
      const newEstimatedTime = this.treeNode.itemData.estimatedTime
      console.log('newEstimatedTime, ', newEstimatedTime)
      if ( this.elInputEstimatedTime.nativeElement.value !== newEstimatedTime ) {
        this.elInputEstimatedTime.nativeElement.value = newEstimatedTime
      }

      // title:
      const newTitle = this.treeNode.itemData.title
      if ( this.elInputTitle.nativeElement.innerHTML !== newTitle ) {
        this.elInputTitle.nativeElement.innerHTML = newTitle
      }

      this.isDone = this.treeNode.itemData.isDone

    })

  }

  // ngOnChanges(changes: SimpleChanges) {
  //   for (let propName in changes) {
  //     let chng = changes[propName];
  //     // let cur  = JSON.stringify(chng.currentValue);
  //     // let prev = JSON.stringify(chng.previousValue);
  //     console.log('ngOnChanges', propName, chng)
  //   }
  // }

  ngAfterViewInit(): void {
   this.focus()
  }

  delete() {
    // this.dbService.delete(this.node.dbId)
  }

  addChild() {
    this.addChildToDb()
    // if ( ! this.node.children ) {
    //   this.node.children = []
    // }
    // this.node.children.push({
    //   label: 'new child'
    // })
  }

  private addChildToDb() {
    // this.dbService.addNode(this.node.dbId)
  }

  keyPressEnter(event) {
    event.preventDefault()
    this.addNodeAfterThis()
    console.log('key press enter; node: ', this.treeNode)
  }

  keyPressMetaEnter(event) {
    console.log('keyPressMetaEnter')
    this.isDone = ! this.isDone
    this.onInputChanged(null, this.columns.isDone)
  }

  private addNodeAfterThis() {
    this.treeNode.addSiblingAfterThis()
  }

  public focusNodeAbove() {
    const nodeToFocus = this.treeNode.getNodeAboveThis()
    this.focusOtherNode(nodeToFocus)
  }

  public focusNodeBelow() {
    const nodeToFocus = this.treeNode.getNodeBelowThis()
    this.focusOtherNode(nodeToFocus)
  }

  focusToEstimatedTime() {
    // Note: it was changed from input to contenteditable, so needs reworking
    const element = <HTMLInputElement>document.activeElement
    const start = element.selectionStart === 0

    if (start) {
      this.focus(this.columns.estimatedTime)
    }
  }

  focusToDescription() {
    const element = <HTMLInputElement>document.activeElement
    const end = element.selectionEnd === ('' + element.value).length

    if (end) {
      this.focus(<HTMLInputElement>this.columns.title)
    }
  }

  focusOtherNode(nodeToFocus: OryTreeNode) {
    this.treeHost.focusNode(nodeToFocus, this.focusedColumn)
  }

  focus(column?: OryColumn) {
    const toFocus = this.getComponentByColumnOrDefault(column)
    toFocus.nativeElement.focus()
  }

  getComponentByColumnOrDefault(column?: OryColumn) {
    if ( column === this.columns.estimatedTime) {
      return this.elInputEstimatedTime
    } else {
      return this.elInputTitle
    }
  }

  onColumnFocused(column) {
    this.focusedColumn = column
  }

  onChangeEstimatedTime() {
    console.log('onChangeEstimatedTime')
  }

  onChange(e) {
    console.log('onInputChanged onChange', e)
  }

  onInputChanged(e, column) {
    this.onChange(e)
    console.log('onInputChanged; isApplyingFromDbNow', this.treeNode.treeModel.isApplyingFromDbNow)
    if ( ! this.treeNode.treeModel.isApplyingFromDbNow ) {
      const titleVal = this.elInputTitle.nativeElement.innerHTML
      const estimatedTimeVal = this.elInputEstimatedTime.nativeElement.value
      // console.log('input val: ' + titleVal)
      this.treeNode.patchItemData({
        title: titleVal,
        estimatedTime: estimatedTimeVal,
        isDone: this.isDone,
      })
    } // else: no need to react, since it is being applied from Db
  }
}
