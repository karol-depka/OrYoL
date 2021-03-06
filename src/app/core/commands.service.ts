import { Injectable } from '@angular/core';
import { Subject } from 'rxjs/Subject'
import { NavigationService } from './navigation.service'

export type Command = string

@Injectable()
export class CommandsService {

  commands$ = new Subject<Command>()

  constructor(
    private navigationService: NavigationService,
  ) { }

  reorderUp() {
    this.commands$.next('reorderUp')
  }

  reorderDown() {
    this.commands$.next('reorderDown')
  }

  toggleDone() {
    this.commands$.next('toggleDone')
  }

  planToday() {
    // navigate to last child of Day Plans node - 'item_35023937-195c-4b9c-b265-5e8a01cf397e'
    // this.navigationService.navigateToNodeLastChild('item_35023937-195c-4b9c-b265-5e8a01cf397e')
  }
}
