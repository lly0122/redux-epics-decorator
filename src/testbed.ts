import { connect as reactConnect } from 'react-redux'
import {
  createStore,
  Store,
  compose,
  applyMiddleware,
  Reducer,
  combineReducers,
} from 'redux'
import { ReflectiveInjector, Injector, Provider } from 'injection-js'
import { Observable } from 'rxjs'
import { catchError } from 'rxjs/operators'

import { allDeps } from './decorators/Module'
import { Constructorof } from './EffectModule'

export interface TestBedConfig {
  providers: Provider[]
}

export class TestBedFactory {
  static configureTestingModule(config?: TestBedConfig) {
    if (!config) {
      return new TestBed(
        ReflectiveInjector.resolveAndCreate(Array.from(allDeps as any)),
      )
    }
    const newAllDeps = new Set(allDeps as any)
    const providers = config.providers
    providers.forEach((provider) => newAllDeps.add(provider))
    const testbed = new TestBed(this.configInjector(newAllDeps))
    return testbed
  }

  private static configInjector(newAllDeps: Set<any>) {
    const parent = ReflectiveInjector.resolveAndCreate(
      Array.from(allDeps as any),
    )
    return parent.resolveAndCreateChild(Array.from(newAllDeps as any))
  }
}

export class TestBed {
  constructor(private injector: Injector) {}

  getInstance<T = any>(ins: Constructorof<T>): T {
    return this.injector.get(ins)
  }

  connect(effectModule: any) {
    return (...args: any) => {
      const originalDispatch = args[1] || {}
      const module = this.getInstance(effectModule)
      Object.assign(originalDispatch, module.allDispatch)
      args[1] = originalDispatch
      return reactConnect.apply(null, args)
    }
  }

  setupStore<MockGlobalState>(
    modules: { [index: string]: Constructorof<any> } = {},
  ): Store<MockGlobalState> {
    const { createEpicMiddleware, combineEpics } = require('redux-observable')
    let epicSetupError: Error | null = null
    const results = Object.keys(modules).reduce(
      (acc, key) => {
        const { reducer, epics } = acc
        const instance = this.getInstance(modules[key])
        Object.assign(reducer, { [key]: instance.reducer })
        epics.push(instance.epic)
        return acc
      },
      { reducer: {} as { [index: string]: Reducer<any> }, epics: [] as any[] },
    )
    const epicMiddleware = createEpicMiddleware()
    const store = createStore(
      !Object.keys(results.reducer).length
        ? () => ({} as any)
        : combineReducers(results.reducer),
      compose(applyMiddleware(epicMiddleware)),
    )

    epicMiddleware.run((action$: Observable<any>, state$: Observable<any>) => {
      try {
        return combineEpics(...results.epics)
          .call(null, action$, state$)
          .pipe(
            catchError((err, source) => {
              console.error(err)
              return source
            }),
          )
      } catch (e) {
        epicSetupError = e
      }
    })
    if (epicSetupError) {
      throw epicSetupError
    }
    return store
  }
}
