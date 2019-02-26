import {TreeNode} from 'primeng/primeng'
import {NodeAddEvent, NodeInclusion} from './TreeListener'
import {
  debugLog,
  errorAlert,
} from '../utils/log'
import {after} from 'selenium-webdriver/testing'
import {DbTreeService} from './db-tree-service'
import {EventEmitter, Injectable} from '@angular/core'
import {
  isNull,
  isNullOrUndefined,
} from 'util'
import {defined, nullOrUndef} from '../utils/utils'
import {sumBy} from 'lodash';
import { OryColumn } from '../tree/OryColumn'
import { FIXME } from '../utils/log'
import { ReplaySubject } from 'rxjs/ReplaySubject'
import { MultiMap } from '../utils/multi-map'
import {
  NodeOrderer,
  NodeOrderInfo,
} from './node-orderer'


/**
 * Created by kd on 2017-10-27.
 *
 * NOTE: this file has both TreeModel and TreeNode to avoid a warning about circular dependency between files.
 * Maybe I will find a better way, perhaps involving refactor...
 */

const uuidV4 = require('uuid/v4');


/** ======================================================================================= */
/** TODO: this should be delegated to database as it might have its own conventions/implementation (e.g. firebase push id) */
let generateNewInclusionId = function () {
  return 'inclusion_' + uuidV4()
}

/** ======================================================================================= */
/** ======================================================================================= */
export class OryTreeNode implements TreeNode {

  // ==== from PrimeNG's TreeNode:

  label?: string;
  data?: any;
  icon?: any;
  expandedIcon?: any;
  collapsedIcon?: any;
  children: OryTreeNode[] = [];
  leaf?: boolean;
  expanded?: boolean;
  type?: string;
  parent?: TreeNode;
  /** because `parent` is reset to null by the tree component if the node is top-level.
   * Possibly rename to parentEvenIfRoot or parentEvenIfTopLevel */
  parent2?: OryTreeNode;
  partialSelected?: boolean;
  styleClass?: string;
  draggable?: boolean;
  droppable?: boolean;
  selectable?: boolean;

  onChangeItemData = new EventEmitter()
  onChangeItemDataOfChild = new EventEmitter()

  startTime = new Date()


  // ==== End of PrimeNG's TreeNode

  static INITIAL_TITLE = ''

  expansion = new class Expansion {
    constructor(public treeNode: OryTreeNode) {}

    setExpansionOnParentsRecursively(expandToSet: boolean) {
      this.treeNode.getAncestorsPathArray().forEach(node => {
        node.expanded = expandToSet
      })
    }

    areParentsExpandedToMakeThisNodeVisible(): boolean {
      if ( this.treeNode.isRoot ) {
        return this.treeNode.treeModel.isRootShown
      }
      // return false
      return this.treeNode.getAncestorsPathArrayExcludingVirtualRoot().every(node => {
        return node.expanded
      })
    }

    setExpansion(expansionState: boolean, recursive: boolean | {recursive: boolean}) {
      const recursiveAsOptions = (recursive as {recursive: boolean})
      if ( recursiveAsOptions && ! isNullOrUndefined(recursiveAsOptions.recursive) ) {
        recursive = recursiveAsOptions.recursive
      }

      this.treeNode.expanded = expansionState
      if ( recursive ) {
        this.treeNode.children.forEach( (node: OryTreeNode) => {
          node.expansion.setExpansion(expansionState, recursive);
        });
      }
    }

    toggleExpansion(recursive: boolean) {
      this.setExpansion(! this.treeNode.expanded, recursive)
    }

  }(this)

  _removeChild(nodeToRemove: OryTreeNode) {
    this.children = this.children.filter(node => node !== nodeToRemove)
  }

  get isRoot() {
    return this.treeModel.root === this;
  }

  get isVisualRoot() {
    return this === this.treeModel.navigation.visualRoot
  }

  get lastChildNode(): OryTreeNode {
    return this.getChildAtIndexOrNull(this.children && this.children.length - 1)
  }

  get isDayPlan() {
    return this.parent2 && this.parent2.itemId === 'item_35023937-195c-4b9c-b265-5e8a01cf397e'
  }

  get isChildOfRoot() {
    return ! (this.parent2 && this.parent2.parent2) // top-level node (our parent is the virtual root)
  }

  constructor(
    public nodeInclusion: NodeInclusion,
    public itemId: string,
    public treeModel: TreeModel,
    public itemData: any
  ) {}

  addSiblingAfterThis(newNode?: OryTreeNode) {
    return this.parent2.addChild(this, newNode)
    // // window.alert('my index z')
    // console.log('this.parent', this.parent)
    // const newNode = this.treeModel.addSiblingAfterNode(newNode, this)
    // // window.alert('my index' + myIndex)
    // // getNodeBelowThis()
    // return newNode
  }

  public getIndexInParent() {
    return (
      this.parent2 &&
      this.parent2.children &&
      this.parent2.children.indexOf(this)
    )
  }

  getSiblingNodeAboveThis() {
    const index = this.getIndexInParent()
    return this.parent2.getChildAtIndexOrNull(index - 1)
  }

  getSiblingNodeBelowThis() {
    const index = this.getIndexInParent()
    // console.log('getNodeBelow index', index, 'count', this.parent2.children.length)
    const childAtIndexOrNull = (
      this.parent2 &&
      this.parent2.getChildAtIndexOrNull(index + 1)
    )
    debugLog('getNodeBelow childAtIndexOrNull', childAtIndexOrNull)
    return childAtIndexOrNull
  }

  getNodeVisuallyAboveThis(): OryTreeNode {
    if ( this.isRoot ) {
      return this.treeModel.root.getLastMostNestedVisibleNodeRecursively()
    }
    let ret: OryTreeNode
    const siblingNodeAboveThis = this.getSiblingNodeAboveThis()
    if ( siblingNodeAboveThis ) {
      const lastMostNestedNodeRecursively = siblingNodeAboveThis.getLastMostNestedVisibleNodeRecursively()
      ret =  lastMostNestedNodeRecursively
    } else {
      ret = siblingNodeAboveThis ||
        this.parent2 || /* note this IS parent2 - should go to the root of all (if it is shown...) */
        this.treeModel.root.getLastMostNestedVisibleNodeRecursively() // not found -- wrap around to bottom-most
    }
    if ( ret.expansion.areParentsExpandedToMakeThisNodeVisible()
        /* TODO: might need smth like && isVisible to handle the isRootVisible case. Later also think about filtering */
    ) {
      debugLog('getNodeVisuallyAboveThis 1')
      return ret
    } else {
      debugLog('getNodeVisuallyAboveThis 2')
      // recursive call:
      return ret.getNodeVisuallyAboveThis() // skip this one, as it is not visible via being collapsed
    }
  }

  getNodeVisuallyBelowThis(): OryTreeNode {
    let ret: OryTreeNode
    const simple = (
      this.children
      && this.children.length
      && this.children[0]
      || this.getSiblingNodeBelowThis()
      // ||
    )
    if ( simple ) {
      ret = simple
    } else {
      let parent = this.parent2
      while (parent) {
        if ( parent.getSiblingNodeBelowThis() ) {
          ret =  parent.getSiblingNodeBelowThis()
          break
        }
        parent = parent.parent2
      }
    }
    // not found - wrap around to top-most
    ret = ret || this.treeModel.root.children[0]
    if ( ! ret.expansion.areParentsExpandedToMakeThisNodeVisible() ) {
      return ret.getNodeVisuallyBelowThis() // recursive call
    } else {
      return ret
    }
  }

  getLastMostNestedVisibleNodeRecursively() {
    const lastImmediateChild = this.getLastImmediateChild()
    if ( lastImmediateChild && ! lastImmediateChild.expansion.areParentsExpandedToMakeThisNodeVisible() ) {
      return this // we stop at this because deeper one is not visible
    }
    if ( lastImmediateChild ) {
      return lastImmediateChild.getLastMostNestedVisibleNodeRecursively()
    } else {
      return this
    }
  }

  public getLastImmediateChild() {
    return this.children && this.children.length > 0 && this.children[this.children.length - 1]
  }


  _appendChildAndSetThisAsParent(nodeToAppend?: OryTreeNode, insertBeforeIndex?: number) {
    if ( ! nodeToAppend ) {
      nodeToAppend = new OryTreeNode(null, '' + uuidV4(), this.treeModel, this.newItemData())
    }
    const afterNode = this.lastChildNode

    if ( nullOrUndef(insertBeforeIndex) ) {
      insertBeforeIndex = this.children.length
    }
    // console.log('this', this)
    if ( nullOrUndef(this.children) ) {
      this.children = []
    }
    nodeToAppend.parent = this
    nodeToAppend.parent2 = this
    // console.log('node.parent', nodeToAppend.parent)
    // console.log('push child', nodeToAppend.parent)
    // this.children.push(node)
    this.children.splice(insertBeforeIndex, 0, nodeToAppend)
    this.treeModel.registerNode(nodeToAppend)
    // console.log('afterNode', afterNode)
    // this.treeModel.addSiblingAfterNode(nodeToAppend, afterNode)

    return nodeToAppend
  }

  private newItemData() {
    return {title: OryTreeNode.INITIAL_TITLE}
  }

  getChildAtIndexOrNull(index: number): OryTreeNode | null {
    if ( this.isIndexPresent(index) ) {
      return this.children[index]
    } else {
      return null
    }
  }

  private isIndexPresent(index: number): boolean {
    const lastIndex = this.children.length - 1
    if ( index < 0 || index > lastIndex ) {
      return false
    } else {
      return true
    }
  }

  /* TODO: should be called *create*, because it is a completely new node/item involving db, vs addChild just looks like tree-only operation */
  addChild(afterExistingNode?: OryTreeNode, newNode?: OryTreeNode) {
    if ( ! afterExistingNode && this.children.length > 0 ) {
      afterExistingNode = this.lastChildNode
    }

    // console.log('addChild, afterExistingNode', afterExistingNode)
    newNode = newNode || new OryTreeNode(null, 'item_' + uuidV4(), this.treeModel, this.newItemData())

    const nodeBelow = afterExistingNode && afterExistingNode.getSiblingNodeBelowThis()
    // console.log('addChild: nodeBelow', nodeBelow)
    const nodeInclusion: NodeInclusion = newNode.nodeInclusion || new NodeInclusion(generateNewInclusionId())

    this.treeModel.nodeOrderer.addOrderMetadataToInclusion(
      {
        inclusionBefore: afterExistingNode && afterExistingNode.nodeInclusion,
        inclusionAfter: nodeBelow && nodeBelow.nodeInclusion,
      },
      nodeInclusion,
    )
    newNode.nodeInclusion = nodeInclusion

    this.treeModel.treeService.addChildNode(this, newNode)

    const newNodeIndex = afterExistingNode ? afterExistingNode.getIndexInParent() + 1 : 0
    this._appendChildAndSetThisAsParent(newNode, newNodeIndex) // this is to avoid delay caused by Firestore; for UX
    return newNode
  }

  addAssociationsHere(nodes: OryTreeNode[], beforeNode: OryTreeNode | undefined) {
    // TODO: use beforeNode
    FIXME('addAssociationsHere not impl')
    for ( const nodeToAssociate of nodes ) {
      const newInclusion = new NodeInclusion(/* FIXME handle order */generateNewInclusionId())
      const newNode = new OryTreeNode(newInclusion, nodeToAssociate.itemId, this.treeModel, nodeToAssociate.itemData)
      // this.treeModel.treeService.addSiblingAfterNode(this.lastChildNode, )
    }
  }

  /* This could/should probably be unified with reorder code */
  moveInclusionsHere(nodes: OryTreeNode[], beforeNode: { beforeNode: OryTreeNode }) {
    // FIXME('moveInclusionsHere: need to calculate order numbers to be last children')
    for ( const childNodeToAssociate of nodes ) {
      const nodeAfter = beforeNode && beforeNode.beforeNode
      let nodeBefore = nodeAfter && nodeAfter.getSiblingNodeAboveThis()
      if ( ! nodeAfter && ! nodeBefore ) {
        // both nodeAfter and nodeBefore can become falsy, causing order == 0
        nodeBefore = this.lastChildNode
      }
      const inclusionToModify = childNodeToAssociate.nodeInclusion
      this.treeModel.nodeOrderer.addOrderMetadataToInclusion(
        {
          inclusionBefore: nodeBefore && nodeBefore.nodeInclusion,
          inclusionAfter: nodeAfter && nodeAfter.nodeInclusion,
        },
        inclusionToModify
      )
      this.treeModel.treeService.patchChildInclusionData(
        /*nodeToAssociate.itemId*/ this.itemId /* parent*/,
        inclusionToModify.nodeInclusionId,
        inclusionToModify,
        childNodeToAssociate.itemId
      )
      childNodeToAssociate.parent2._removeChild(childNodeToAssociate)
      const insertionIndex = nodeAfter ? nodeAfter.getIndexInParent() : this.children.length
      this._appendChildAndSetThisAsParent(childNodeToAssociate, insertionIndex)
    }
  }

  deleteWithoutConfirmation() {
    this.treeModel.treeService.deleteWithoutConfirmation(this.itemId)
    this.parent2._removeChild(this)
  }

  patchItemData(itemData: any) {
    this.treeModel.treeService.patchItemData(this.itemId, itemData)
  }

  reorderUp() {
    // TODO: if topmost, reorder to last item in this plan or to previous plan
    const siblingNodeAboveThis = this.getSiblingNodeAboveThis()
    const order = siblingNodeAboveThis ? {
      inclusionBefore:
        siblingNodeAboveThis &&
        siblingNodeAboveThis.getSiblingNodeAboveThis() &&
        siblingNodeAboveThis.getSiblingNodeAboveThis().nodeInclusion,
      inclusionAfter:
        siblingNodeAboveThis &&
        siblingNodeAboveThis.nodeInclusion
    } : { // wrap-around to last
      inclusionBefore: this.parent2.lastChildNode.nodeInclusion,
      inclusionAfter: null
    }
    this.reorder(order)
  }

  reorderDown() {
    const siblingNodeBelowThis = this.getSiblingNodeBelowThis()
    const order = siblingNodeBelowThis ? {
      inclusionBefore:
        siblingNodeBelowThis &&
        siblingNodeBelowThis.nodeInclusion,
      inclusionAfter:
        siblingNodeBelowThis &&
        siblingNodeBelowThis.getSiblingNodeBelowThis() &&
        siblingNodeBelowThis.getSiblingNodeBelowThis().nodeInclusion
    } : { // wrap-around to first
      inclusionBefore: null,
      inclusionAfter: this.parent2.children[0].nodeInclusion
    }
    this.reorder(order)
  }

  reorder(order: NodeOrderInfo) {
    debugLog('reorder order, this.parent2', order, this.parent2)
    // TODO: replace patch with set due to problems with "no document to update" after quickly reordering/indenting after creating
    const inclusion = this.nodeInclusion
    this.treeModel.nodeOrderer.addOrderMetadataToInclusion(order, inclusion)
    // TODO: reorder locally to avoid UI lag, e.g. when quickly reordering up/down and perhaps will remove keyboard appearing/disappearing on android
    this.treeModel.treeService.patchChildInclusionData(
      this.parent2.itemId,
      this.nodeInclusion.nodeInclusionId,
      inclusion,
      this.itemId
    )
  }

  // ======================================================
  // TODO: extract classes like TaskNodeContent, DayPlanNodeContent
  // since nodes are to allow changing their type, we would just swap an instance of the class mentioned above
  // the separation first would be mainly to separate generic node-logic from time-planning specific, etc.

  timeLeftSumText() {
    const minutesTotalLeft = this.timeLeftSum()
    const hours = Math.floor(minutesTotalLeft / 60)
    const minutesUpTo60 = minutesTotalLeft % 60
    return `${hours}h ${minutesUpTo60}m`
  }

  timeLeftSum() {
    if ( this.children.length ) {
      // debugLog('timeLeftSum this.children', this.children)
    }
    const sumBy1 = sumBy(this.children, childNode => {
      return childNode.effectiveTimeLeft()
    })
    return sumBy1
  }

  effectiveTimeLeft() {
    if ( ! this.itemData.isDone ) {
      if ( this.showEffectiveDuration() ) {
        return this.timeLeftSum()
      }
      const estimatedTime = parseFloat(this.itemData.estimatedTime) || 0
      // console.log('estimatedTime for sum', estimatedTime)
      return estimatedTime
    } else {
      return 0
    }
  }

  showEffectiveDuration() {
    return this.timeLeftSum() !== 0 && ! this.isChildOfRoot
  }

  effectiveDurationText() {
    return this.timeLeftSumText()
  }

  endTime() {
    return new Date(this.startTime.getTime() + this.timeLeftSum() * 60 * 1000)
  }

  highlight = new class Highlight {
    constructor(public treeNode: OryTreeNode) {}

    isChildOfFocusedNode() {

    }

    isAncestorOfFocusedNode() {
      return (
        this.treeNode.treeModel.focus.lastFocusedNode &&
        this.treeNode.treeModel.focus.lastFocusedNode.getParentsPathArray().some(ancestorOfFocused => {
          return this.treeNode === ancestorOfFocused
        })
      )
    }
  } (this)

  getParentsPathArray(): OryTreeNode[] {
    const ret = []
    let node: OryTreeNode = this
    while (true) {
      if ( ! node ) {
        // debugLog('getAncestorsPathArray', ret)
        return ret.reverse()
      } else {
        ret.push(node)
        node = node.parent2
      }
    }
  }

  getAncestorsPathArray() {
    const pathArray = this.getParentsPathArray()
    return pathArray.slice(0, pathArray.length - 1 /*exclusive - skip last*/)
  }

  getAncestorsPathArrayExcludingVirtualRoot() {
    const ancestorsPathArray = this.getAncestorsPathArray()
    return ancestorsPathArray.slice(1, ancestorsPathArray.length)
  }

  toggleDone() {
    this.patchItemData({
      isDone: ! this.itemData.isDone,
    })
    // FIXME: fireOnChangeItemDataOfChildOnParents and on this

    // TODO: focus node below, but too tied to UI; has to know about column too
  }

  fireOnChangeItemDataOfChildOnParents() {
    debugLog('fireOnChangeItemDataOfChildOnParents')
    for (let parent of this.getParentsPathArray()) {
      parent.onChangeItemDataOfChild.emit()
    }
  }

  navigateInto() {
    this.treeModel.navigation.navigateInto(this)
  }

  findInsertionIndexForNewInclusion(newInclusion: NodeInclusion): number {
    return this.treeModel.nodeOrderer.findInsertionIndexForNewInclusion<OryTreeNode>(this.children, newInclusion, node => {
      return node.nodeInclusion
    })
  }

  indentDecrease() {
    const newParent = this.parent2.parent2
    if ( newParent ) {
      newParent.moveInclusionsHere([this], {beforeNode: this.parent2.getSiblingNodeBelowThis()})
    }
  }

  indentIncrease() {
    const siblingNodeAboveThis = this.getSiblingNodeAboveThis()
    if ( siblingNodeAboveThis ) {
      siblingNodeAboveThis.moveInclusionsHere([this], {beforeNode: undefined})
    }
  }
}

export abstract class OryTreeListener {
  abstract onAfterNodeMoved()
}

export class TreeCell {
  constructor(
    public node: OryTreeNode,
    public column: OryColumn,
  ) {}
}

export class FocusEvent {
  constructor(
    public cell: TreeCell,
  ) {}
}

/** =========================================================================== */
/** =========================================================================== */
/** ===========================================================================
 * Idea: have a class that would contain all other classes, e.g. Focus and
 * extract content-specific (what is currently TreeModel),
 * to TreeContents or TreeNodes class for better separation of concerns
 */
@Injectable()
export class TreeModel {

  root: OryTreeNode = new OryTreeNode(null, this.treeService.HARDCODED_ROOT_NODE_ITEM_ID, this, null)

  nodeOrderer = new NodeOrderer()

  /** hardcoded for now, as showing real root-most root is not implemented in UI due to issues */
  isRootShown = false

  navigation = new class Navigation {
    visualRoot: OryTreeNode = this.treeModel.root
    visualRoot$ = new ReplaySubject<OryTreeNode>(1)

    constructor(public treeModel: TreeModel) {
      this.navigateToRoot()
    }

    navigateInto(node: OryTreeNode) {
      this.visualRoot = node
      this.treeModel.isRootShown = node !== this.treeModel.root
      node.expanded = true
      // this.treeModel.focus.setFocused(node, )
      // TODO: set focused
      this.visualRoot$.next(this.visualRoot)
    }

    navigateToParent() {
      const node = this.visualRoot.parent2
      if ( node ) {
        this.navigateInto(node)
      }
    }

    navigateToRoot() {
      this.navigateInto(this.treeModel.root)
    }

  }(this)

  // mapNodeInclusionIdToNode = new MultiMap<string, OryTreeNode>()
  mapNodeInclusionIdToNode = new Map<string, OryTreeNode>()
  mapItemIdToNode = new MultiMap<string, OryTreeNode>()
  isApplyingFromDbNow = false

  focus = new class Focus {
    /** could skip the "focused" part */
    lastFocusedNode: OryTreeNode
    /** could skip the "focused" part */
    lastFocusedColumn: OryColumn

    // expectedNewNodeToFocus:  = null

    focus$ = new EventEmitter<FocusEvent>()

    get lastFocusedCell() {
      return new TreeCell(this.lastFocusedNode, this.lastFocusedColumn)
    }

    ensureNodeVisibleAndFocusIt(treeNode: OryTreeNode, column: OryColumn) {
      this.lastFocusedNode = treeNode
      this.lastFocusedColumn = column
      treeNode.expansion.setExpansionOnParentsRecursively(true)
      this.focus$.emit(new FocusEvent(this.lastFocusedCell))
    }
  }

  /* Workaround for now, as there were some non-deleted children of a deleted parent */
  public showDeleted: boolean = false


  constructor(
    /* TODO Rename to dbTreeService */
    public treeService: DbTreeService,
    public treeListener: OryTreeListener,
  ) {
    this.addNodeToMapByItemId(this.root)
  }

  /* TODO: unify onNodeAdded, onNodeInclusionModified; from OryTreeNode: moveInclusionsHere, addAssociationsHere, addChild, _appendChildAndSetThisAsParent,
   * reorder(). In general unify reordering with moving/copying inclusions and adding nodes */

  onNodeAdded(event: NodeAddEvent) {
    debugLog('onNodeAdded', event)
    const nodeInclusionId = event.nodeInclusion.nodeInclusionId
    const existingNode = this.mapNodeInclusionIdToNode.get(nodeInclusionId)
    try {
      this.isApplyingFromDbNow = true
      if (existingNode) {
        debugLog('node inclusion already exists: ', nodeInclusionId)
        // setTimeout(() => {
        //   setTimeout(() => {
            // setTimeout to avoid "ExpressionChangedAfterItHasBeenCheckedError" in NodeContentComponent.html
            existingNode.itemData = event.itemData
            debugLog('existingNode.onChangeItemData.emit(event.itemData)', existingNode, existingNode.itemData)

        existingNode.onChangeItemData.emit(event.itemData)
        existingNode.fireOnChangeItemDataOfChildOnParents()
        // TODO: unify with the else branch and emit onChangeItemData* stars there too
          // })
        // }, 0)

      } else {
        if ( ! event.itemData.deleted || this.showDeleted ) {
          const parentNodes = this.mapItemIdToNode.get(event.immediateParentId)
          if ( ! parentNodes ) {
            console.log('onNodeAdded: no parent', event.immediateParentId)
          } else {
            for (const parentNode of parentNodes) {
              let insertBeforeIndex = parentNode.findInsertionIndexForNewInclusion(event.nodeInclusion)

              const newTreeNode = new OryTreeNode(event.nodeInclusion, event.itemId, this, event.itemData)
              parentNode._appendChildAndSetThisAsParent(newTreeNode, insertBeforeIndex)
            }
          }
        }
      }
    } finally {
      this.isApplyingFromDbNow = false
    }
  }

  /* Can unify this with moveInclusionsHere() */
  onNodeInclusionModified(nodeInclusionId, nodeInclusionData, newParentItemId: string) {
    // TODO: ensure this same code is executed locally immediately after reorder/move, without waiting for DB
    // if ( nodeInclusionData.parentNode)
    const node: OryTreeNode | undefined = this.mapNodeInclusionIdToNode.get(nodeInclusionId)
    // if ( node.parent2.itemId !== newParentItemId ) {
      // change parent
      node.parent2._removeChild(node)
      const newParents = this.mapItemIdToNode.get(newParentItemId)
      // FIXME: need to create new node instead of moving existing
      debugLog('onNodeInclusionModified newParents.length', newParents.length)
      if ( newParents && newParents.length > 1 ) {
        debugLog('FIXME: onNodeInclusionModified moving node and there are multiple new parents - not yet impl.! newParents', newParents, 'length', newParents.length)
        window.alert('FIXME: onNodeInclusionModified moving node and there are multiple new parents - not yet impl.!')
      }
      for ( const newParent of newParents ) {
        const insertionIndex = newParent.findInsertionIndexForNewInclusion(nodeInclusionData)

        newParent._appendChildAndSetThisAsParent(node, insertionIndex)
      }
      node.nodeInclusion = nodeInclusionData

    // } else { /* same parent */
    //   node.nodeInclusion = nodeInclusionData
    //   const insertionIndex = node.parent2.findInsertionIndexForNewInclusion(node.nodeInclusion)
    //   node.parent2.children.splice(insertionIndex, 0, node)
    //   // node.parent2.children = sortBy(node.parent2.children, item => item.nodeInclusion.orderNum)
      this.treeListener.onAfterNodeMoved()
    // }
  }

  // addSiblingAfterNode(newNode: OryTreeNode, afterExistingNode: OryTreeNode) {
  //   const myIndex = this.getIndexInParent()
  // }

  registerNode(nodeToRegister: OryTreeNode) {
    // console.log('mapNodeInclusionIdToNode registerNode', nodeToRegister)
    // NOTE: does not yet support the same node being in multiple places
    // NOTE: this should register nodeInclusion id

    this.mapNodeInclusionIdToNode.set(nodeToRegister.nodeInclusion.nodeInclusionId, nodeToRegister)
    this.addNodeToMapByItemId(nodeToRegister)
  }

  private addNodeToMapByItemId(nodeToRegister: OryTreeNode) {
    this.mapItemIdToNode.add(nodeToRegister.itemId, nodeToRegister)
  }

  private nodeInclusionExists(nodeInclusionId: string) {
    const existingNode = this.mapNodeInclusionIdToNode.get(nodeInclusionId)
    // console.log('mapNodeInclusionIdToNode nodeInclusionExists: ', nodeInclusionId, existingNode)
    return defined(existingNode)
  }

  getNodesByItemId(itemId: string) {
    const nodes: OryTreeNode[] = this.mapItemIdToNode.get(itemId)
    return nodes
  }
}