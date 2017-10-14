import 'rxjs/add/observable/range'
import 'rxjs/add/operator/do'
import 'rxjs/add/operator/exhaustMap'
import 'rxjs/add/operator/map'
import 'rxjs/add/operator/mergeMap'
import 'rxjs/add/operator/takeUntil'

import { Action } from 'redux-actions'
import { Observable } from 'rxjs/Observable'

import { generateMsg, Msg } from '../service'
import { EffectModule, namespace, Effect, Reducer, ModuleActionProps, DefineAction } from '../../../src'

export interface Module2StateProps {
  currentMsgId: string | null
  allMsgs: Msg[]
  loading: boolean
}

@namespace('two')
class Module2 extends EffectModule<Module2StateProps> {
  defaultState: Module2StateProps = {
    currentMsgId: null,
    allMsgs: [],
    loading: false
  }

  @DefineAction('dispose') dispose: Observable<Action<void>>

  @Effect('get_msg')({
    success: (state: Module2StateProps, { payload }: Action<Msg>) => {
      const { allMsgs } = state
      return { ...state, allMsgs: allMsgs.concat([payload!]), loading: false }
    }
  })
  getMsg(action$: Observable<void>) {
    return action$
      .mergeMap(() => generateMsg()
        .takeUntil(this.dispose)
        .map(msg => this.createAction('success')(msg))
      )
  }

  @Reducer('select_msg')
  selectMsg(state: Module2StateProps, { payload }: Action<string>) {
    return { ...state, currentMsgId: payload }
  }

  @Effect('get_10_msg')()
  loadMsgs(action$: Observable<void>) {
    return action$
      .exhaustMap(() => Observable.range(0, 10)
        .map(() => this.createActionFrom(this.getMsg)())
      )
  }

  @Effect('get_5_msg')({
    loading: (state: Module2StateProps) => {
      return { ...state, loading: true }
    }
  })
  loadFiveMsgs(action$: Observable<void>) {
    return action$
      .exhaustMap(() => {
        const request$ = Observable.range(0, 5)
          .mergeMap(() => generateMsg()
            .takeUntil(this.dispose)
          )
          .toArray()
          .map(msgs => this.createActionFrom(this.setMsgs)(msgs))
        return Observable.of(this.createAction('loading')())
          .concat(request$)
      })
  }

  @Reducer('set_msgs')
  private setMsgs(state: Module2StateProps, { payload }: Action<Msg[]>) {
    const { allMsgs } = state
    return { ...state, allMsgs: allMsgs.concat(payload!) }
  }
}

export type Module2DispatchProps = ModuleActionProps<Module2StateProps, Module2>

const moduleTwo = new Module2
export default moduleTwo
export const reducer = moduleTwo.reducer
export const epic = moduleTwo.epic