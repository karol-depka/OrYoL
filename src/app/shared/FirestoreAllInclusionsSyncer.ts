import * as firebase from 'firebase'
import DocumentChange = firebase.firestore.DocumentChange
import {
  debugLog,
  FIXME,
} from './log'
import QuerySnapshot = firebase.firestore.QuerySnapshot
import { NodeInclusion } from './TreeListener'
import {
  FirestoreNodeInclusion,
  FirestoreTreeService,
} from './firestore-tree.service'
import DocumentReference = firebase.firestore.DocumentReference
import { ChildrenChangesEvent } from './children-changes-event'
import {
  observable,
  Observable,
  ReplaySubject,
  Subject,
} from 'rxjs'
import DocumentSnapshot = firebase.firestore.DocumentSnapshot
import { MultiMap } from './multi-map'

class InclusionsValueAndCallbacks {
  /* Used as initial value if someone subscribes */
  mapByInclusionId = new Map<string, DocumentSnapshot>()
  observables: Subject<ChildrenChangesEvent>[] = []
}

export class FirestoreAllInclusionsSyncer {

  mapParentIdToChildInclusions = new Map<string, InclusionsValueAndCallbacks>()

  private INCLUSIONS_COLLECTION = this.dbPrefix + '_inclusions'

  constructor(
    private db: firebase.firestore.Firestore,
    private dbPrefix: string,
  ) {

  }

  private inclusionsCollection(): firebase.firestore.CollectionReference {
    return this.db.collection(this.INCLUSIONS_COLLECTION)
  }

  startQuery() {
    this.inclusionsCollection().onSnapshot((snapshot: QuerySnapshot) => {
      const mapParentIdToDocs = new MultiMap<string, DocumentSnapshot>()
      // NOTE: for now treating adding and modifying as same event (as in tree event add-or-modify)
      snapshot.docChanges().forEach((change: DocumentChange) => {
        const documentSnapshot = change.doc
        const docData = documentSnapshot.data() as FirestoreNodeInclusion
        debugLog('FirestoreAllInclusionsSyncer onSnapshot id', change.doc.id, 'DocumentChange', change)
        if (change.type === 'added' || change.type === 'modified') {

          mapParentIdToDocs.add(docData.parentNode.id, documentSnapshot)

          // this.putItemAndFireCallbacks(documentSnapshot)
        }
        // if (change.type === 'modified') {
        //   debugLog('FirestoreAllItemsLoader modified: ', nodeInclusionData);
        //   // listener.onNodeInclusionModified(nodeInclusionId, nodeInclusionData)
        // }
        if (change.type === 'removed') {
          FIXME('FirestoreAllItemsLoader change.type === \'removed\'', change)
          // debugLog('Removed city: ', nodeInclusionData);
        }
      })
      mapParentIdToDocs.map.forEach((inclusions, parent) => {
        this.putInclusionsForParentAndFireEvent(parent, inclusions)
      })
    })
  }

  getChildInclusionsForParentItem$(parentItemId: string) {
    const inclusionsEntry = this.obtainInclusionsEntryForParentId(parentItemId)
    const newObs = new ReplaySubject<ChildrenChangesEvent>() /* HACK so that the subscriber gets what they need
     * instead I should investigate if it is possible to make a custom observable which emits something (initial value of inclusions map) to the new subscriber only while not emitting it to others.
     * Current impl. makes it so that, you should only subscribe once to a given observable returned (second subscriber will not get the initial value) */
    inclusionsEntry.observables.push(newObs)
    newObs.next(new ChildrenChangesEvent(inclusionsEntry.mapByInclusionId))
    return newObs
    FIXME('getChildInclusionsForParentItem$')
  }

  addNodeInclusionToParent(
      nodeInclusion: NodeInclusion,
      parentId: string,
      parentDoc: DocumentReference,
      nodeInclusionFirebaseObject: FirestoreNodeInclusion
  ) {
    nodeInclusionFirebaseObject.parentNode = parentDoc
    this.docByInclusionId(nodeInclusion.nodeInclusionId).set(nodeInclusionFirebaseObject)
  }


  private docByInclusionId(nodeInclusionId: string) {
    return this.inclusionsCollection().doc(nodeInclusionId)
  }

  private putInclusionsForParentAndFireEvent(parentId: string, inclusions: DocumentSnapshot[]) {
    const addedOrModifiedInclusionsMap = this.arrayToMapById(inclusions)
    let inclusionsValueAndCallbacks = this.obtainInclusionsEntryForParentId(parentId)
    inclusions.forEach(inclusion => {
      inclusionsValueAndCallbacks.mapByInclusionId.set(inclusion.id, inclusion)
    })
    inclusionsValueAndCallbacks.observables.forEach(subject => {
      subject.next(new ChildrenChangesEvent(addedOrModifiedInclusionsMap /* note: only fire with the currently modified, not all already present!*/))
    })
  }

  private obtainInclusionsEntryForParentId(parentId: string) {
    let inclusionsValueAndCallbacks = this.mapParentIdToChildInclusions.get(parentId)
    if (!inclusionsValueAndCallbacks) {
      inclusionsValueAndCallbacks = new InclusionsValueAndCallbacks()
      this.mapParentIdToChildInclusions.set(parentId, inclusionsValueAndCallbacks)
    }
    return inclusionsValueAndCallbacks
  }

  private arrayToMapById(inclusions: DocumentSnapshot[]) {
    const arrayToMapById = new Map<string, DocumentSnapshot>()
    inclusions.forEach(inclusion => {
      arrayToMapById.set(inclusion.id, inclusion)
    })
    return arrayToMapById
  }

  patchChildInclusionData(parentItemId: string, itemInclusionId: string, itemInclusionData: any) {
    this.docByInclusionId(itemInclusionId).update(itemInclusionData)
  }
}
